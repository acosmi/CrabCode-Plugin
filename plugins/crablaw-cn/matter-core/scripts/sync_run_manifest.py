#!/usr/bin/env python3
"""Compute document hashes and mark dependent CrabLaw-CN issues/artifacts stale.

The command is dry-run by default. Pass --apply to update document-index.json and
run-manifest.json under a single-writer lock. It never schedules background work.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

from _matter_common import (
    atomic_write_json,
    file_lock,
    load_json,
    require_id,
    resolve_root,
    review_binding_blocking_reason,
    safe_path,
    sha256_file,
    source_digests,
    utc_now,
)


def issues_touching_sources(
    changed_source_ids: set[str],
    document_index: dict[str, Any],
    issue_rows: list[dict[str, Any]],
    run_dir: Path,
) -> set[str]:
    """Map changed source records onto the issues that rely on them."""

    if not changed_source_ids:
        return set()
    affected: set[str] = set()

    changed_document_ids = {
        document.get("documentId")
        for document in document_index.get("documents", [])
        if document.get("sourceRecordId") in changed_source_ids and document.get("documentId")
    }
    if changed_document_ids:
        for issue in issue_rows:
            issue_id = issue.get("issueId")
            if issue_id and changed_document_ids.intersection(issue.get("documentIds", []) or []):
                affected.add(issue_id)

    claim_map_path = safe_path(run_dir, "claim-evidence-map.json")
    if claim_map_path.exists():
        claim_map = load_json(claim_map_path)
        claim_issue = {
            claim.get("claimId"): claim.get("issueId")
            for claim in claim_map.get("claims", [])
            if isinstance(claim, dict)
        }
        for element in claim_map.get("elements", []):
            if not isinstance(element, dict):
                continue
            if changed_source_ids.intersection(element.get("sourceRecordIds", []) or []):
                issue_id = claim_issue.get(element.get("claimId"))
                if issue_id:
                    affected.add(issue_id)

    findings_path = safe_path(run_dir, "analyzer-findings.json")
    if findings_path.exists():
        findings = load_json(findings_path)
        for finding in findings.get("findings", []):
            if not isinstance(finding, dict):
                continue
            if changed_source_ids.intersection(finding.get("sourceRecordIds", []) or []):
                issue_id = finding.get("issueId")
                if issue_id:
                    affected.add(issue_id)

    return affected


def carried_stale_issue_ids(
    manifest: dict[str, Any], issue_rows: list[dict[str, Any]]
) -> set[str]:
    """Keep a prior stale mark until the issue tree itself says it was reanalyzed.

    A sync that finds no new change is not evidence that the previous change was
    addressed, so `unchanged` must never clear the ledger.
    """

    status_by_issue = {
        issue.get("issueId"): issue.get("status")
        for issue in issue_rows
        if isinstance(issue, dict) and issue.get("issueId")
    }
    return {
        issue_id
        for issue_id in manifest.get("staleIssueIds", []) or []
        if status_by_issue.get(issue_id) == "stale"
    }


def descendants_of_stale(issues: list[dict[str, Any]], initial: set[str]) -> set[str]:
    stale = set(initial)
    changed = True
    while changed:
        changed = False
        for issue in issues:
            issue_id = issue.get("issueId")
            parent = issue.get("parentIssueId")
            if issue_id and parent in stale and issue_id not in stale:
                stale.add(issue_id)
                changed = True
    return stale


def synchronize(matter_dir: Path, run_dir: Path, matter_id: str, run_id: str, apply: bool) -> dict[str, Any]:
    document_index_path = safe_path(run_dir, "document-index.json", must_exist=True)
    issue_tree_path = safe_path(run_dir, "issue-tree.json", must_exist=True)
    manifest_path = safe_path(run_dir, "run-manifest.json")
    document_index = load_json(document_index_path)
    issue_tree = load_json(issue_tree_path)

    now = utc_now()
    if manifest_path.exists():
        manifest = load_json(manifest_path)
        previous = {item.get("documentId"): item.get("sha256") for item in manifest.get("documents", [])}
        previous_sources = {
            item.get("sourceId"): item.get("sha256") for item in manifest.get("sources", []) or []
        }
        revision = int(manifest.get("revision", 0)) + 1
    else:
        previous = {}
        previous_sources = {}
        revision = 1
        manifest = {
            "schemaVersion": 1,
            "runId": run_id,
            "matterId": matter_id,
            "revision": revision,
            "status": "draft",
            "startedAt": now,
            "updatedAt": now,
            "documents": [],
            "sources": [],
            "artifacts": [],
            "staleIssueIds": [],
            "completedStepIds": [],
            "reviewState": "not-ready",
            "externalRelease": "prohibited",
        }

    issue_rows = issue_tree.get("issues", [])
    carried_stale = carried_stale_issue_ids(manifest, issue_rows)

    current_documents: list[dict[str, str]] = []
    changed_document_ids: set[str] = set()
    for document in document_index.get("documents", []):
        document_id = document.get("documentId")
        relative_path = document.get("path")
        if not document_id or not relative_path:
            raise ValueError("document-index entry requires documentId and path")
        managed_path = safe_path(matter_dir, *Path(relative_path).parts, must_exist=True)
        digest = sha256_file(managed_path)
        if previous.get(document_id) != digest:
            changed_document_ids.add(document_id)
        document["sha256"] = digest
        current_documents.append({"documentId": document_id, "sha256": digest})

    removed_document_ids = set(previous) - {item["documentId"] for item in current_documents}
    changed_document_ids.update(removed_document_ids)

    current_sources = source_digests(matter_dir)
    changed_source_ids = {
        item["sourceId"] for item in current_sources if previous_sources.get(item["sourceId"]) != item["sha256"]
    }
    changed_source_ids.update(set(previous_sources) - {item["sourceId"] for item in current_sources})

    direct_stale = {
        issue.get("issueId")
        for issue in issue_rows
        if issue.get("issueId") and changed_document_ids.intersection(issue.get("documentIds", []) or [])
    }
    direct_stale |= issues_touching_sources(changed_source_ids, document_index, issue_rows, run_dir)
    stale_issue_ids = descendants_of_stale(issue_rows, direct_stale | carried_stale)

    for issue in issue_rows:
        if issue.get("issueId") in stale_issue_ids:
            issue["status"] = "stale"
    for artifact in manifest.get("artifacts", []):
        if changed_document_ids.intersection(artifact.get("dependsOnDocumentIds", [])) or stale_issue_ids.intersection(
            artifact.get("dependsOnIssueIds", [])
        ):
            artifact["status"] = "stale"

    manifest["revision"] = revision
    manifest["updatedAt"] = now
    manifest["documents"] = sorted(current_documents, key=lambda item: item["documentId"])
    manifest["sources"] = current_sources
    manifest["staleIssueIds"] = sorted(stale_issue_ids)
    if changed_document_ids or changed_source_ids or stale_issue_ids:
        manifest["status"] = "stale"
    if changed_document_ids or changed_source_ids:
        # The bytes a lawyer approved are gone, so the approval is gone with them.
        # The decisions themselves stay on the record: they are history, not state.
        manifest["reviewState"] = "not-ready"
        manifest["externalRelease"] = "prohibited"
        reason = review_binding_blocking_reason(revision)
        blocking_reasons = manifest.setdefault("blockingReasons", [])
        if reason not in blocking_reasons:
            blocking_reasons.append(reason)

    result = {
        "status": "apply-ready" if (changed_document_ids or changed_source_ids) else "unchanged",
        "matterId": matter_id,
        "runId": run_id,
        "changedDocumentIds": sorted(changed_document_ids),
        "changedSourceIds": sorted(changed_source_ids),
        "staleIssueIds": sorted(stale_issue_ids),
        "reviewState": manifest.get("reviewState"),
        "externalRelease": manifest.get("externalRelease"),
        "applied": apply,
    }
    if apply:
        atomic_write_json(document_index_path, document_index)
        atomic_write_json(issue_tree_path, issue_tree)
        relative_document_index = str(document_index_path.relative_to(matter_dir))
        relative_issue_tree = str(issue_tree_path.relative_to(matter_dir))
        for artifact in manifest.get("artifacts", []):
            if artifact.get("path") == relative_document_index:
                artifact["sha256"] = sha256_file(document_index_path)
                artifact["status"] = "validated"
            if artifact.get("path") == relative_issue_tree:
                artifact["sha256"] = sha256_file(issue_tree_path)
        atomic_write_json(manifest_path, manifest)
    return result


def main() -> int:
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root")
    parser.add_argument("--matter-id", required=True)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    try:
        matter_id = require_id("matter-id", args.matter_id)
        run_id = require_id("run-id", args.run_id)
        root = resolve_root(args.root, create=False)
        matter_dir = safe_path(root, "matters", matter_id, must_exist=True)
        run_dir = safe_path(matter_dir, "runs", run_id, must_exist=True)

        if args.apply:
            # The whole read-modify-write runs under the writer lock; reading first
            # and locking later would let a concurrent writer land between them.
            with file_lock(safe_path(matter_dir, ".writer.lock"), timeout_seconds=1.0):
                result = synchronize(matter_dir, run_dir, matter_id, run_id, apply=True)
        else:
            result = synchronize(matter_dir, run_dir, matter_id, run_id, apply=False)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(json.dumps({"status": "failed", "error": str(exc)}, ensure_ascii=False))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
