#!/usr/bin/env python3
"""Bind a lawyer review / external-release decision to the exact bytes it approved.

`reviewState` and `externalRelease` are claims a manifest makes about itself. This
command is the only place that turns such a claim into evidence: it recomputes the
run's dependency digest from the files on disk, checks the review-queue item that
records the human decision, and appends an append-only decision entry bound to that
digest. Change a document, a source record or an artifact afterwards and the digest
moves, so the decision stops being effective without anyone having to remember it.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import unicodedata
from pathlib import Path
from typing import Any, Optional

from _matter_common import (
    PENDING_MATTER_MESSAGE,
    DIGEST_EXCLUDED_ARTIFACT_TYPES,
    REVIEW_BINDING_BLOCKING_REASON_PREFIX,
    atomic_write_json,
    file_lock,
    load_json,
    matter_is_pending,
    require_id,
    resolve_root,
    run_dependency_digest,
    safe_path,
    utc_now,
)


SCRIPT_DIR = Path(__file__).resolve().parent

EXIT_OK = 0
EXIT_USAGE_OR_IO = 2
EXIT_DRIFT_OR_STALE = 3
EXIT_STRICT_VALIDATION = 4
EXIT_REVIEW_ITEM_PREREQUISITE = 5
EXIT_DECIDER_MISMATCH = 6
EXIT_ACTOR_NOT_AUTHORIZED = 7
EXIT_LOCKED = 10

DECISION_KINDS = ("lawyer-reviewed", "approved-external")
LAWYER_REVIEW_ITEM_STATUSES = ("approved-internal", "approved-external", "sent")
EXTERNAL_RELEASE_ITEM_STATUSES = ("approved-external", "sent")
REQUIRED_REVIEW_ITEM_FIELDS = ("reviewer", "reviewedAt", "decisionActor")
LAWYER_REVIEW_KINDS = {"lawyer-reviewed", "approved-external"}

DRIFT_GROUPS = (
    ("documents", "documentId"),
    ("sources", "sourceId"),
    ("artifacts", "artifactId"),
)


def emit(payload: dict[str, Any], code: int) -> int:
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return code


def failure(error: str, code: int, **extra: Any) -> int:
    return emit({"status": "failed", "error": error, **extra}, code)


def normalize_actor(value: Any) -> str:
    """Compare people by name the way a person reads it, not byte by byte."""

    if not isinstance(value, str):
        return ""
    return unicodedata.normalize("NFKC", value).strip()


def recorded_digests(manifest: dict[str, Any], group: str, key: str) -> dict[str, Any]:
    entries = manifest.get(group, []) or []
    recorded: dict[str, Any] = {}
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        if group == "artifacts" and entry.get("type") in DIGEST_EXCLUDED_ARTIFACT_TYPES:
            continue
        identifier = entry.get(key)
        if isinstance(identifier, str) and identifier:
            recorded[identifier] = entry.get("sha256")
    return recorded


def compute_drift(manifest: dict[str, Any], current: dict[str, Any]) -> dict[str, list[str]]:
    """Name every dependency whose bytes no longer match what the manifest recorded."""

    drift: dict[str, list[str]] = {}
    for group, key in DRIFT_GROUPS:
        recorded = recorded_digests(manifest, group, key)
        observed = {entry[key]: entry["sha256"] for entry in current[group]}
        changed = {
            identifier for identifier, digest in observed.items() if recorded.get(identifier) != digest
        }
        changed |= set(recorded) - set(observed)
        drift[group] = sorted(changed)
    return drift


def describe_decisions(manifest: dict[str, Any], current_digest: str) -> list[dict[str, Any]]:
    decisions: list[dict[str, Any]] = []
    for raw in manifest.get("reviewDecisions", []) or []:
        if not isinstance(raw, dict):
            continue
        effective = raw.get("boundDigest") == current_digest
        entry = {key: raw.get(key) for key in (
            "decisionId",
            "kind",
            "decidedBy",
            "decidedAt",
            "boundRevision",
            "boundDigest",
            "reviewItemId",
            "destination",
            "note",
        ) if raw.get(key) is not None}
        entry["effective"] = effective
        entry["reason"] = (
            "bound to the bytes currently on disk"
            if effective
            else "the run's bytes changed after this decision was recorded"
        )
        decisions.append(entry)
    return decisions


def evaluate(matter_dir: Path, run_dir: Path) -> dict[str, Any]:
    manifest_path = safe_path(run_dir, "run-manifest.json", must_exist=True)
    manifest = load_json(manifest_path)
    if not isinstance(manifest, dict):
        raise ValueError("run-manifest.json must be a JSON object")
    current = run_dependency_digest(matter_dir, run_dir, manifest)
    drift = compute_drift(manifest, current)
    decisions = describe_decisions(manifest, current["digest"])
    stale = bool(manifest.get("status") == "stale" or manifest.get("staleIssueIds"))
    effective_kinds = {decision.get("kind") for decision in decisions if decision["effective"]}

    if any(drift.values()) or stale:
        release_capability = "prohibited"
    elif "approved-external" in effective_kinds:
        release_capability = "approved-external"
    elif "lawyer-reviewed" in effective_kinds:
        release_capability = "lawyer-reviewed"
    else:
        release_capability = "internal-draft"

    return {
        "manifestPath": manifest_path,
        "manifest": manifest,
        "current": current,
        "drift": drift,
        "decisions": decisions,
        "effectiveKinds": effective_kinds,
        "stale": stale,
        "releaseCapability": release_capability,
    }


def blocking_reasons(state: dict[str, Any], require: Optional[str] = None) -> list[str]:
    reasons: list[str] = []
    for group, _ in DRIFT_GROUPS:
        changed = state["drift"][group]
        if changed:
            reasons.append(f"{group} changed since the recorded decision: {', '.join(changed)}")
    if state["stale"]:
        reasons.append("the run is stale; rerun the stale issues and sync before release")
    if require and not reasons:
        reasons.append(
            f"no effective {require} decision is bound to the current bytes "
            f"(release capability is {state['releaseCapability']})"
        )
    return reasons


def state_summary(state: dict[str, Any], matter_id: str, run_id: str) -> dict[str, Any]:
    manifest = state["manifest"]
    return {
        "matterId": matter_id,
        "runId": run_id,
        "manifestRevision": manifest.get("revision"),
        "currentDigest": state["current"]["digest"],
        "drift": state["drift"],
        "stale": state["stale"],
        "decisions": state["decisions"],
        "releaseCapability": state["releaseCapability"],
        "reviewState": manifest.get("reviewState"),
        "externalRelease": manifest.get("externalRelease"),
    }


def run_strict_validation(root: Path, matter_id: str, run_id: str) -> tuple[bool, list[str], str]:
    """Reuse the real validator as a subprocess instead of re-deriving its rules."""

    completed = subprocess.run(
        [
            sys.executable,
            str(SCRIPT_DIR / "validate_run.py"),
            "--root",
            str(root),
            "--matter-id",
            matter_id,
            "--run-id",
            run_id,
            "--strict",
            "--json",
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        env={**os.environ, "PYTHONIOENCODING": "utf-8"},
    )
    try:
        payload = json.loads(completed.stdout)
    except json.JSONDecodeError:
        return False, [], f"{completed.stdout}{completed.stderr}".strip()
    if payload.get("status") == "ok" and completed.returncode == 0:
        return True, [], ""
    errors = [str(item) for item in payload.get("errors", []) or []]
    return False, errors, ""


def review_item_prerequisite(
    kind: str, review_item: dict[str, Any], effective_kinds: set[Any]
) -> Optional[str]:
    """The human decision lives in the review queue; this command only binds it."""

    status = review_item.get("status")
    if kind == "lawyer-reviewed":
        if status not in LAWYER_REVIEW_ITEM_STATUSES:
            return (
                f"review queue item status {status!r} does not record a lawyer decision; "
                f"expected one of {', '.join(LAWYER_REVIEW_ITEM_STATUSES)}"
            )
    else:
        if status not in EXTERNAL_RELEASE_ITEM_STATUSES:
            return (
                f"review queue item status {status!r} does not authorize external release; "
                f"expected one of {', '.join(EXTERNAL_RELEASE_ITEM_STATUSES)}"
            )
        if not str(review_item.get("externalDestination") or "").strip():
            return "review queue item must record an externalDestination before external release"
        if not (effective_kinds & LAWYER_REVIEW_KINDS):
            return (
                "external release requires an effective lawyer-reviewed decision bound to the "
                "current bytes; record --kind lawyer-reviewed first"
            )
    for field in REQUIRED_REVIEW_ITEM_FIELDS:
        if not str(review_item.get(field) or "").strip():
            return f"review queue item must record {field} before a decision can be bound"
    return None


def actor_is_authorized(matter_dir: Path, decided_by: str) -> bool:
    """Only someone this matter already knows may act at the release entry point.

    The matter's own permission record answers this; the command never widens the
    circle on its own, and a name that is merely typed on the queue item is not
    enough to make its bearer an authorized user of the matter.
    """

    permissions = load_json(safe_path(matter_dir, "permissions.json", must_exist=True))
    matter = load_json(safe_path(matter_dir, "matter.json", must_exist=True))
    authorized = {
        normalize_actor(user)
        for user in (permissions.get("allowedUsers") or [])
        if isinstance(user, str)
    }
    authorized.add(normalize_actor(matter.get("reviewOwner")))
    authorized.add(normalize_actor(matter.get("responsibleLawyer")))
    authorized.discard("")
    return normalize_actor(decided_by) in authorized


def retire_binding_blocking_reasons(manifest: dict[str, Any]) -> None:
    """Drop the reason a sync left behind, now that this record answers it.

    `record` only gets here with no drift and no staleness, so "review decisions no
    longer bind" has just stopped being true. Leaving it would make the run look
    blocked by a condition that no longer exists; every other reason is untouched
    because this command knows nothing about them.
    """

    reasons = manifest.get("blockingReasons")
    if not isinstance(reasons, list):
        return
    remaining = [
        reason
        for reason in reasons
        if not (isinstance(reason, str) and reason.startswith(REVIEW_BINDING_BLOCKING_REASON_PREFIX))
    ]
    if remaining:
        manifest["blockingReasons"] = remaining
    else:
        manifest.pop("blockingReasons", None)


def command_status(matter_dir: Path, run_dir: Path, matter_id: str, run_id: str) -> int:
    state = evaluate(matter_dir, run_dir)
    return emit({"status": "ok", **state_summary(state, matter_id, run_id)}, EXIT_OK)


def command_gate(
    matter_dir: Path, run_dir: Path, matter_id: str, run_id: str, require: str
) -> int:
    state = evaluate(matter_dir, run_dir)
    capability = state["releaseCapability"]
    satisfied = capability == require or (
        require == "lawyer-reviewed" and capability == "approved-external"
    )
    summary = state_summary(state, matter_id, run_id)
    if satisfied:
        return emit({"status": "ok", "require": require, "reasons": [], **summary}, EXIT_OK)
    return emit(
        {
            "status": "blocked",
            "require": require,
            "reasons": blocking_reasons(state, require),
            **summary,
        },
        EXIT_DRIFT_OR_STALE,
    )


def record_under_lock(
    root: Path,
    matter_dir: Path,
    run_dir: Path,
    matter_id: str,
    run_id: str,
    kind: str,
    decided_by: str,
    note: Optional[str],
) -> int:
    state = evaluate(matter_dir, run_dir)
    if any(state["drift"].values()) or state["stale"]:
        return failure(
            "the run's dependencies changed or the run is stale; nothing can be approved",
            EXIT_DRIFT_OR_STALE,
            reasons=blocking_reasons(state),
            **state_summary(state, matter_id, run_id),
        )

    passed, errors, raw = run_strict_validation(root, matter_id, run_id)
    if not passed:
        return failure(
            "validate_run.py --strict did not pass; fix the run before recording a decision",
            EXIT_STRICT_VALIDATION,
            errors=errors,
            validatorOutput=raw,
        )

    review_item = load_json(safe_path(run_dir, "review-queue-item.json", must_exist=True))
    if not isinstance(review_item, dict):
        raise ValueError("review-queue-item.json must be a JSON object")
    problem = review_item_prerequisite(kind, review_item, state["effectiveKinds"])
    if problem:
        return failure(problem, EXIT_REVIEW_ITEM_PREREQUISITE)

    if not actor_is_authorized(matter_dir, decided_by):
        return failure(
            f"{decided_by} is not an allowed user / review owner of matter {matter_id}",
            EXIT_ACTOR_NOT_AUTHORIZED,
        )

    reviewer = normalize_actor(review_item.get("reviewer"))
    if normalize_actor(decided_by) != reviewer:
        return failure(
            f"--by {decided_by!r} is not the reviewer recorded on the review queue item "
            f"({review_item.get('reviewer')!r}); the decision maker cannot differ from the reviewer",
            EXIT_DECIDER_MISMATCH,
        )

    review_item_id = review_item.get("reviewItemId")
    if not isinstance(review_item_id, str) or not review_item_id:
        return failure("review queue item is missing reviewItemId", EXIT_REVIEW_ITEM_PREREQUISITE)

    manifest = state["manifest"]
    revision = int(manifest.get("revision", 0)) + 1
    now = utc_now()
    decision: dict[str, Any] = {
        "decisionId": f"decision-{kind}-{revision:04d}",
        "kind": kind,
        "decidedBy": decided_by.strip(),
        "decidedAt": now,
        "boundRevision": revision,
        "boundDigest": state["current"]["digest"],
        "reviewItemId": review_item_id,
    }
    if kind == "approved-external":
        decision["destination"] = str(review_item.get("externalDestination")).strip()
    if note and note.strip():
        decision["note"] = note.strip()

    decisions = manifest.setdefault("reviewDecisions", [])
    if not isinstance(decisions, list):
        raise ValueError("run-manifest.json reviewDecisions must be an array")
    decisions.append(decision)
    manifest["revision"] = revision
    manifest["updatedAt"] = now
    manifest["reviewState"] = "lawyer-reviewed"
    manifest["externalRelease"] = (
        "approved" if kind == "approved-external" else "pending-explicit-approval"
    )
    retire_binding_blocking_reasons(manifest)
    atomic_write_json(state["manifestPath"], manifest)

    return emit(
        {
            "status": "recorded",
            "matterId": matter_id,
            "runId": run_id,
            "decisionId": decision["decisionId"],
            "kind": kind,
            "decidedBy": decision["decidedBy"],
            "boundRevision": revision,
            "boundDigest": decision["boundDigest"],
            "releaseCapability": "approved-external" if kind == "approved-external" else "lawyer-reviewed",
            "reviewState": manifest["reviewState"],
            "externalRelease": manifest["externalRelease"],
        },
        EXIT_OK,
    )


def command_record(
    root: Path,
    matter_dir: Path,
    run_dir: Path,
    matter_id: str,
    run_id: str,
    kind: str,
    decided_by: str,
    note: Optional[str],
) -> int:
    if not decided_by.strip():
        return failure("--by must name the person taking the decision", EXIT_USAGE_OR_IO)
    lock = file_lock(safe_path(matter_dir, ".writer.lock"), timeout_seconds=1.0)
    try:
        lock.__enter__()
    except ValueError as exc:
        return failure(str(exc), EXIT_LOCKED)
    try:
        # Recompute, validate, check and write are one critical section: a concurrent
        # writer between any two of them would bind the decision to bytes nobody read.
        return record_under_lock(
            root, matter_dir, run_dir, matter_id, run_id, kind, decided_by, note
        )
    finally:
        lock.__exit__(None, None, None)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    def add_common(subparser: argparse.ArgumentParser) -> None:
        subparser.add_argument("--root")
        subparser.add_argument("--matter-id", required=True)
        subparser.add_argument("--run-id", required=True)

    status_parser = subparsers.add_parser("status", help="report the run's release posture")
    add_common(status_parser)
    status_parser.add_argument("--json", action="store_true", help="accepted for symmetry; output is always JSON")

    record_parser = subparsers.add_parser("record", help="bind a review decision to the current bytes")
    add_common(record_parser)
    record_parser.add_argument("--kind", required=True, choices=list(DECISION_KINDS))
    record_parser.add_argument("--by", required=True)
    record_parser.add_argument("--note")

    gate_parser = subparsers.add_parser("gate", help="refuse release unless a bound decision allows it")
    add_common(gate_parser)
    gate_parser.add_argument("--require", required=True, choices=list(DECISION_KINDS))
    return parser


def main() -> int:
    os.umask(0o077)
    if hasattr(sys.stdout, "reconfigure"):
        # The payload carries reviewer names; the answer must not depend on the
        # console code page of the machine that happens to run this.
        sys.stdout.reconfigure(encoding="utf-8")
    args = build_parser().parse_args()

    try:
        matter_id = require_id("matter-id", args.matter_id)
        run_id = require_id("run-id", args.run_id)
        root = resolve_root(args.root, create=False)
        matter_dir = safe_path(root, "matters", matter_id, must_exist=True)
        if matter_is_pending(matter_dir):
            raise ValueError(f"{PENDING_MATTER_MESSAGE}: {matter_id}")
        run_dir = safe_path(matter_dir, "runs", run_id, must_exist=True)

        if args.command == "status":
            return command_status(matter_dir, run_dir, matter_id, run_id)
        if args.command == "gate":
            return command_gate(matter_dir, run_dir, matter_id, run_id, args.require)
        return command_record(
            root, matter_dir, run_dir, matter_id, run_id, args.kind, args.by, args.note
        )
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        # `status` only reports; it never converts anything into an exit code, so a
        # caller cannot read a posture (or a bad path) as a refusal. `record` and
        # `gate` act, so their refusals are exit codes.
        return failure(str(exc), EXIT_OK if args.command == "status" else EXIT_USAGE_OR_IO)


if __name__ == "__main__":
    raise SystemExit(main())
