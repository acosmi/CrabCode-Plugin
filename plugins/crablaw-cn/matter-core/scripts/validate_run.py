#!/usr/bin/env python3
"""Deterministically validate a CrabLaw-CN deep-analysis run and its cross-file references."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from _matter_common import (
    load_json,
    load_jsonl,
    require_id,
    resolve_root,
    safe_path,
    sha256_file,
)
from schema_validation import validate_instance


SCRIPT_DIR = Path(__file__).resolve().parent
PLUGIN_ROOT = SCRIPT_DIR.parents[1]
BASE_SCHEMAS = PLUGIN_ROOT / "matter-core" / "schemas"
CORE_SCHEMAS = PLUGIN_ROOT / "legal-core" / "schemas"
ALLOWED_CONFLICT = {"no-hit", "cleared-by-lawyer"}
TERMINAL_SPECIALIST = {"integrated", "reviewed", "closed"}


def add_schema_errors(
    payload: Any,
    schema_path: Path,
    label: str,
    errors: list[str],
) -> None:
    schema = load_json(schema_path)
    for error in validate_instance(payload, schema):
        errors.append(f"{label}: {error}")


def index_rows(rows: list[dict[str, Any]], key: str, label: str, errors: list[str]) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for position, row in enumerate(rows, 1):
        value = row.get(key)
        if not isinstance(value, str) or not value:
            errors.append(f"{label}[{position}] missing {key}")
            continue
        if value in result:
            errors.append(f"{label} duplicate {key}: {value}")
            continue
        result[value] = row
    return result


def require_refs(values: list[str], available: set[str], label: str, errors: list[str]) -> None:
    for value in values:
        if value not in available:
            errors.append(f"{label} references unknown id: {value}")


def validate_base_store(root: Path, matter_id: str, errors: list[str]) -> dict[str, Any]:
    matter_dir = safe_path(root, "matters", matter_id, must_exist=True)
    files = {
        "matter": ("matter.json", "matter.schema.json"),
        "parties": ("parties.json", "parties.schema.json"),
        "conflict": ("conflict-check.json", "conflict-check.schema.json"),
        "permissions": ("permissions.json", "permissions.schema.json"),
    }
    state: dict[str, Any] = {"matterDir": matter_dir}
    for key, (filename, schema_name) in files.items():
        payload = load_json(safe_path(matter_dir, filename, must_exist=True))
        add_schema_errors(payload, BASE_SCHEMAS / schema_name, filename, errors)
        state[key] = payload

    matter = state["matter"]
    conflict = state["conflict"]
    permissions = state["permissions"]
    if matter.get("matterId") != matter_id:
        errors.append("matter.json matterId mismatch")
    if matter.get("status") != "active":
        errors.append(f"matter status blocks substantive work: {matter.get('status')}")
    for field in ("matterType", "responsibleLawyer", "reviewOwner", "engagementScope"):
        if not matter.get(field):
            errors.append(f"matter.json requires {field} before substantive work")
    if conflict.get("status") not in ALLOWED_CONFLICT:
        errors.append(f"conflict status blocks substantive work: {conflict.get('status')}")
    if not permissions.get("allowedUsers"):
        errors.append("permissions.json allowedUsers must not be empty")

    sources_path = safe_path(matter_dir, "sources.jsonl", must_exist=True)
    source_rows = load_jsonl(sources_path)
    source_schema = load_json(BASE_SCHEMAS / "source-record.schema.json")
    for position, source in enumerate(source_rows, 1):
        for error in validate_instance(source, source_schema):
            errors.append(f"sources.jsonl[{position}]: {error}")
    state["sources"] = source_rows
    state["sourceIndex"] = index_rows(source_rows, "sourceId", "sources", errors)
    return state


def validate_cross_references(
    matter_dir: Path,
    run_id: str,
    payloads: dict[str, Any],
    sources: dict[str, dict[str, Any]],
    errors: list[str],
    strict: bool,
    require_verified_source: bool,
) -> None:
    plan = payloads["analysis-plan"]
    documents = payloads["document-index"]
    chronology = payloads["fact-chronology"]
    issue_tree = payloads["issue-tree"]
    claim_map = payloads["claim-evidence-map"]
    findings_payload = payloads["analysis-findings"]
    specialists = payloads["specialist-findings"]
    manifest = payloads["run-manifest"]
    review_item = payloads["review-item"]

    for label, payload in payloads.items():
        if isinstance(payload, dict) and "runId" in payload and payload.get("runId") != run_id:
            errors.append(f"{label} runId mismatch")

    document_rows = documents.get("documents", [])
    document_index = index_rows(document_rows, "documentId", "documents", errors)
    document_ids = set(document_index)
    source_ids = set(sources)
    issue_rows = issue_tree.get("issues", [])
    issue_index = index_rows(issue_rows, "issueId", "issues", errors)
    issue_ids = set(issue_index)
    fact_rows = chronology.get("facts", [])
    evidence_rows = chronology.get("evidence", [])
    fact_index = index_rows(fact_rows, "factId", "facts", errors)
    evidence_index = index_rows(evidence_rows, "evidenceId", "evidence", errors)
    fact_ids = set(fact_index)
    evidence_ids = set(evidence_index)
    finding_rows = findings_payload.get("findings", [])
    finding_index = index_rows(finding_rows, "findingId", "findings", errors)
    finding_ids = set(finding_index)
    specialist_rows = specialists.get("tasks", [])
    specialist_index = index_rows(specialist_rows, "taskId", "specialist tasks", errors)
    specialist_ids = set(specialist_index)

    require_refs(plan.get("documentIds", []), document_ids, "analysis plan", errors)
    for issue in plan.get("issues", []):
        if issue.get("issueId") not in issue_ids:
            errors.append(f"analysis plan references issue missing from issue-tree: {issue.get('issueId')}")
        require_refs(issue.get("documentIds", []), document_ids, f"plan issue {issue.get('issueId')}", errors)

    for document_id, document in document_index.items():
        source_id = document.get("sourceRecordId")
        if source_id not in source_ids:
            errors.append(f"document {document_id} references unknown sourceRecordId: {source_id}")
        else:
            source_record = sources[source_id]
            if source_record.get("documentId") and source_record.get("documentId") != document_id:
                errors.append(f"document {document_id} differs from its source record documentId")
            if source_record.get("contentHash") and source_record.get("contentHash") != document.get("sha256"):
                errors.append(f"document {document_id} differs from its source record contentHash")
        require_refs(document.get("issueIds", []), issue_ids, f"document {document_id}", errors)
        try:
            managed_path = safe_path(
                matter_dir,
                *Path(document.get("path", "")).parts,
                must_exist=True,
            )
            actual_hash = sha256_file(managed_path)
            if actual_hash != document.get("sha256"):
                errors.append(f"document {document_id} sha256 does not match current bytes")
        except (OSError, ValueError) as exc:
            errors.append(f"document {document_id} path is invalid or unreadable: {exc}")

    for fact_id, fact in fact_index.items():
        require_refs(fact.get("sourceDocumentIds", []), document_ids, f"fact {fact_id}", errors)
        require_refs(fact.get("evidenceIds", []), evidence_ids, f"fact {fact_id}", errors)
    for evidence_id, evidence in evidence_index.items():
        if evidence.get("documentId") not in document_ids:
            errors.append(f"evidence {evidence_id} references unknown documentId: {evidence.get('documentId')}")

    for issue_id, issue in issue_index.items():
        require_refs(issue.get("documentIds", []), document_ids, f"issue {issue_id}", errors)
        require_refs(issue.get("factIds", []), fact_ids, f"issue {issue_id}", errors)
        require_refs(issue.get("evidenceIds", []), evidence_ids, f"issue {issue_id}", errors)
        require_refs(issue.get("specialistTaskIds", []), specialist_ids, f"issue {issue_id}", errors)
        parent = issue.get("parentIssueId")
        if parent and parent not in issue_ids:
            errors.append(f"issue {issue_id} references unknown parentIssueId: {parent}")

    claim_rows = claim_map.get("claims", [])
    element_rows = claim_map.get("elements", [])
    claim_index = index_rows(claim_rows, "claimId", "claims", errors)
    element_index = index_rows(element_rows, "elementId", "elements", errors)
    for claim_id, claim in claim_index.items():
        if claim.get("issueId") not in issue_ids:
            errors.append(f"claim {claim_id} references unknown issueId: {claim.get('issueId')}")
        require_refs(claim.get("elementIds", []), set(element_index), f"claim {claim_id}", errors)
    for element_id, element in element_index.items():
        if element.get("claimId") not in claim_index:
            errors.append(f"element {element_id} references unknown claimId: {element.get('claimId')}")
        require_refs(element.get("factIds", []), fact_ids, f"element {element_id}", errors)
        require_refs(element.get("evidenceIds", []), evidence_ids, f"element {element_id}", errors)
        require_refs(element.get("sourceRecordIds", []), source_ids, f"element {element_id}", errors)

    verified_source_seen = False
    case_comparison_issues: set[str] = set()
    for comparison in payloads.get("case-comparisons", []):
        issue_id = comparison.get("issueId")
        if issue_id not in issue_ids:
            errors.append(f"case comparison references unknown issueId: {issue_id}")
        else:
            case_comparison_issues.add(issue_id)
        for case in comparison.get("cases", []):
            source_id = case.get("sourceRecordId")
            if source_id not in source_ids:
                errors.append(f"case comparison references unknown sourceRecordId: {source_id}")

    for finding_id, finding in finding_index.items():
        issue_id = finding.get("issueId")
        if issue_id not in issue_ids:
            errors.append(f"finding {finding_id} references unknown issueId: {issue_id}")
        finding_source_ids = finding.get("sourceRecordIds", [])
        require_refs(finding_source_ids, source_ids, f"finding {finding_id}", errors)
        require_refs(finding.get("factIds", []), fact_ids, f"finding {finding_id}", errors)
        require_refs(finding.get("evidenceIds", []), evidence_ids, f"finding {finding_id}", errors)
        source_records = [sources[source_id] for source_id in finding_source_ids if source_id in sources]
        citation_tag = finding.get("citationTag")
        if citation_tag == "[已核验-来源]":
            verified = [
                source
                for source in source_records
                if source.get("sourceType") in {"official-law", "official-guidance", "case"}
                and source.get("status") != "source-needs-check"
            ]
            if not verified:
                errors.append(f"finding {finding_id} marks verified but has no verified official/case source")
            else:
                verified_source_seen = True
        elif citation_tag == "[模型知识-待核]":
            if not any(source.get("status") == "source-needs-check" for source in source_records):
                errors.append(f"finding {finding_id} model-knowledge tag requires a source-needs-check record")
        elif citation_tag == "[用户提供]":
            if not any(source.get("sourceType") == "user-provided" for source in source_records):
                errors.append(f"finding {finding_id} user-provided tag requires a user-provided source")
        if finding.get("category") == "legal-conclusion" and not finding.get("factIds"):
            errors.append(f"legal conclusion {finding_id} must reference at least one factId")
        if finding.get("caseComparisonRequired") and issue_id not in case_comparison_issues:
            errors.append(f"finding {finding_id} requires a missing case comparison for issue {issue_id}")

    if require_verified_source and not verified_source_seen:
        errors.append("strict source mode requires at least one finding backed by an official/case source")

    for task_id, task in specialist_index.items():
        if task.get("issueId") not in issue_ids:
            errors.append(f"specialist task {task_id} references unknown issueId: {task.get('issueId')}")
        require_refs(task.get("returnedFindingIds", []), finding_ids, f"specialist task {task_id}", errors)
        if task.get("status") not in TERMINAL_SPECIALIST and not task.get("limitation"):
            errors.append(f"open specialist task {task_id} must state a limitation/blocking reason")
        if task.get("status") in {"integrated", "reviewed", "closed"} and not (
            task.get("returnedFindingIds") or task.get("limitation")
        ):
            errors.append(f"terminal specialist task {task_id} needs returned findings or a documented limitation")

    manifest_document_ids = {item.get("documentId") for item in manifest.get("documents", [])}
    if manifest_document_ids != document_ids:
        errors.append("run-manifest document set differs from document-index")
    for item in manifest.get("documents", []):
        indexed = document_index.get(item.get("documentId"), {})
        if item.get("sha256") != indexed.get("sha256"):
            errors.append(f"run-manifest document hash differs for {item.get('documentId')}")

    for artifact in manifest.get("artifacts", []):
        try:
            artifact_path = safe_path(matter_dir, *Path(artifact.get("path", "")).parts, must_exist=True)
            if sha256_file(artifact_path) != artifact.get("sha256"):
                errors.append(f"artifact {artifact.get('artifactId')} sha256 does not match current bytes")
        except (OSError, ValueError) as exc:
            errors.append(f"artifact {artifact.get('artifactId')} path is invalid or unreadable: {exc}")
        require_refs(artifact.get("dependsOnDocumentIds", []), document_ids, f"artifact {artifact.get('artifactId')}", errors)
        require_refs(artifact.get("dependsOnIssueIds", []), issue_ids, f"artifact {artifact.get('artifactId')}", errors)

    if review_item.get("sourceCapability") != "crablaw-cn:matter-deep-analysis":
        errors.append("review item sourceCapability must be crablaw-cn:matter-deep-analysis")
    if review_item.get("runId") != run_id:
        errors.append("review item runId mismatch")
    require_refs(review_item.get("issueIds", []), issue_ids, "review item", errors)
    output_path = review_item.get("outputPath")
    if output_path:
        try:
            safe_path(matter_dir, *Path(output_path).parts, must_exist=True)
        except (OSError, ValueError) as exc:
            errors.append(f"review item outputPath is invalid or unreadable: {exc}")

    if manifest.get("externalRelease") == "approved" and manifest.get("reviewState") != "lawyer-reviewed":
        errors.append("external release cannot be approved before lawyer review")
    if strict and (manifest.get("status") == "stale" or manifest.get("staleIssueIds")):
        errors.append("strict validation blocks stale runs and stale issues")
    if strict and manifest.get("status") == "ready-for-review":
        required_artifacts = {
            "analysis-plan",
            "document-index",
            "fact-chronology",
            "issue-tree",
            "claim-evidence-map",
            "analysis-findings",
            "specialist-findings",
            "memo",
            "review-item",
        }
        present_artifacts = {artifact.get("type") for artifact in manifest.get("artifacts", [])}
        missing_artifacts = sorted(required_artifacts - present_artifacts)
        if missing_artifacts:
            errors.append(f"ready-for-review run is missing required manifest artifacts: {', '.join(missing_artifacts)}")
        nonvalidated = [
            artifact.get("artifactId")
            for artifact in manifest.get("artifacts", [])
            if artifact.get("status") != "validated"
        ]
        if nonvalidated:
            errors.append(f"ready-for-review run contains non-validated artifacts: {', '.join(map(str, nonvalidated))}")
        if manifest.get("staleIssueIds"):
            errors.append("ready-for-review run cannot contain stale issues")
        if review_item.get("status") != "pending-review":
            errors.append("ready-for-review run requires a pending-review queue item")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root")
    parser.add_argument("--matter-id", required=True)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--strict", action="store_true")
    parser.add_argument("--require-verified-source", action="store_true")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    errors: list[str] = []
    try:
        matter_id = require_id("matter-id", args.matter_id)
        run_id = require_id("run-id", args.run_id)
        root = resolve_root(args.root, create=False)
        state = validate_base_store(root, matter_id, errors)
        matter_dir = state["matterDir"]
        run_dir = safe_path(matter_dir, "runs", run_id, must_exist=True)

        artifact_specs = {
            "run-manifest": ("run-manifest.json", "run-manifest.schema.json", CORE_SCHEMAS),
            "analysis-plan": ("analysis-plan.json", "analysis-plan.schema.json", CORE_SCHEMAS),
            "document-index": ("document-index.json", "document-index.schema.json", CORE_SCHEMAS),
            "fact-chronology": ("fact-chronology.json", "fact-chronology.schema.json", CORE_SCHEMAS),
            "issue-tree": ("issue-tree.json", "issue-tree.schema.json", CORE_SCHEMAS),
            "claim-evidence-map": ("claim-evidence-map.json", "claim-evidence-map.schema.json", CORE_SCHEMAS),
            "analysis-findings": ("analyzer-findings.json", "analysis-finding.schema.json", CORE_SCHEMAS),
            "specialist-findings": ("specialist-findings.json", "specialist-findings.schema.json", CORE_SCHEMAS),
            "review-item": ("review-queue-item.json", "review-queue.schema.json", BASE_SCHEMAS),
        }
        payloads: dict[str, Any] = {}
        for label, (filename, schema_name, schema_root) in artifact_specs.items():
            payload = load_json(safe_path(run_dir, filename, must_exist=True))
            add_schema_errors(payload, schema_root / schema_name, filename, errors)
            payloads[label] = payload

        comparisons: list[dict[str, Any]] = []
        comparison_dir = safe_path(run_dir, "case-comparison")
        if comparison_dir.exists():
            for comparison_path in sorted(comparison_dir.glob("*.json")):
                payload = load_json(comparison_path)
                add_schema_errors(payload, CORE_SCHEMAS / "case-comparison.schema.json", comparison_path.name, errors)
                comparisons.append(payload)
        payloads["case-comparisons"] = comparisons

        validate_cross_references(
            matter_dir,
            run_id,
            payloads,
            state["sourceIndex"],
            errors,
            args.strict,
            args.require_verified_source,
        )
    except (OSError, ValueError) as exc:
        errors.append(str(exc))

    result = {
        "status": "ok" if not errors else "failed",
        "matterId": args.matter_id,
        "runId": args.run_id,
        "errors": errors,
    }
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    elif errors:
        print("VALIDATION FAILED", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
    else:
        print(json.dumps(result, ensure_ascii=False))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
