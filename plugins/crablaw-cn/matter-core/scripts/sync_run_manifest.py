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
    safe_path,
    sha256_file,
    utc_now,
)


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
        document_index_path = safe_path(run_dir, "document-index.json", must_exist=True)
        issue_tree_path = safe_path(run_dir, "issue-tree.json", must_exist=True)
        manifest_path = safe_path(run_dir, "run-manifest.json")
        document_index = load_json(document_index_path)
        issue_tree = load_json(issue_tree_path)

        now = utc_now()
        if manifest_path.exists():
            manifest = load_json(manifest_path)
            previous = {item.get("documentId"): item.get("sha256") for item in manifest.get("documents", [])}
            revision = int(manifest.get("revision", 0)) + 1
        else:
            previous = {}
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
                "artifacts": [],
                "staleIssueIds": [],
                "completedStepIds": [],
                "reviewState": "not-ready",
                "externalRelease": "prohibited",
            }

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
        direct_stale = {
            issue.get("issueId")
            for issue in issue_tree.get("issues", [])
            if issue.get("issueId")
            and changed_document_ids.intersection(issue.get("documentIds", []))
        }
        stale_issue_ids = descendants_of_stale(issue_tree.get("issues", []), direct_stale)

        for issue in issue_tree.get("issues", []):
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
        manifest["staleIssueIds"] = sorted(stale_issue_ids)
        if changed_document_ids:
            manifest["status"] = "stale"

        result = {
            "status": "apply-ready" if changed_document_ids else "unchanged",
            "matterId": matter_id,
            "runId": run_id,
            "changedDocumentIds": sorted(changed_document_ids),
            "staleIssueIds": sorted(stale_issue_ids),
            "applied": args.apply,
        }
        if args.apply:
            with file_lock(safe_path(matter_dir, ".writer.lock"), timeout_seconds=1.0):
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
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(json.dumps({"status": "failed", "error": str(exc)}, ensure_ascii=False))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
