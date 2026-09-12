#!/usr/bin/env python3
"""Create a private CrabLaw-CN matter store and perform a local conflict pre-screen.

This command never overwrites an existing matter and never represents its local
name-match screen as a final lawyer conflict decision.
"""

from __future__ import annotations

import argparse
import json
import os
import re
from pathlib import Path
from typing import Any, Optional

from _matter_common import (
    PENDING_MATTER_MESSAGE,
    append_jsonl,
    atomic_write_json,
    ensure_private_dir,
    file_lock,
    load_json,
    matter_is_pending,
    pending_marker_path,
    require_id,
    require_matter_type,
    resolve_root,
    safe_path,
    today,
    touch_private,
)


EXIT_OK = 0
EXIT_USAGE_OR_IO = 2
EXIT_CONFLICT = 3
EXIT_REVIEW_REQUIRED = 10

CLIENT_SIDE_ROLES = {"client", "client-record"}
ADVERSE_ROLES = {"counterparty"}
SCAN_SCOPES = ("clients", "matters", "matters/_archived")

PARTY_ROLES = {
    "client",
    "counterparty",
    "affiliate",
    "third-party",
    "natural-person",
    "opposing-counsel",
    "beneficial-owner",
    "actual-controller",
    "other",
}


def normalize_name(value: str) -> str:
    return re.sub(r"[\s,，.。()（）【】\[\]_-]+", "", value).casefold()


def parse_party(raw: str) -> dict[str, Any]:
    parts = raw.split(":", 2)
    if len(parts) < 2:
        raise ValueError(f"party must be role:name[:alias1|alias2], got {raw!r}")
    role, display_name = parts[0].strip(), parts[1].strip()
    if role not in PARTY_ROLES:
        raise ValueError(f"party role must be one of: {', '.join(sorted(PARTY_ROLES))}")
    if not display_name:
        raise ValueError("party display name must not be empty")
    aliases = []
    if len(parts) == 3:
        aliases = [item.strip() for item in parts[2].split("|") if item.strip()]
    normalized_names = sorted({display_name, *aliases})
    return {"role": role, "displayName": display_name, "normalizedNames": normalized_names}


class NameRecord:
    """One searchable name taken from an existing client or party record."""

    __slots__ = ("normalized", "value", "source", "role")

    def __init__(self, normalized: str, value: str, source: str, role: str) -> None:
        self.normalized = normalized
        self.value = value
        self.source = source
        self.role = role


def new_coverage() -> dict[str, Any]:
    return {
        "status": "complete",
        "scanned": 0,
        "corrupt": [],
        "refused": [],
        "typeErrors": [],
        "scopes": list(SCAN_SCOPES),
    }


def _relative_label(root: Path, *parts: str) -> str:
    return "/".join(parts)


def _candidate_directories(root: Path, scope_parts: tuple[str, ...], coverage: dict[str, Any]) -> list[str]:
    """List the child directory names of one scope without following redirections."""

    try:
        scope_dir = safe_path(root, *scope_parts)
    except ValueError as exc:
        coverage["refused"].append(f"{_relative_label(root, *scope_parts)}: {exc}")
        return []
    if not scope_dir.is_dir():
        return []
    try:
        return sorted(entry.name for entry in scope_dir.iterdir())
    except OSError as exc:
        coverage["refused"].append(f"{_relative_label(root, *scope_parts)}: {exc}")
        return []


def _read_scanned_payload(
    root: Path,
    parts: tuple[str, ...],
    coverage: dict[str, Any],
) -> Optional[dict[str, Any]]:
    """Read one record file, accounting for every way it can fail to be scanned."""

    label = _relative_label(root, *parts)
    try:
        managed = safe_path(root, *parts)
    except ValueError as exc:
        coverage["refused"].append(f"{label}: {exc}")
        return None
    if not managed.is_file():
        return None
    try:
        # Re-run the guard with strict resolution now that the file must exist.
        managed = safe_path(root, *parts, must_exist=True)
    except ValueError as exc:
        coverage["refused"].append(f"{label}: {exc}")
        return None
    except OSError as exc:
        coverage["refused"].append(f"{label}: {exc}")
        return None
    coverage["scanned"] += 1
    try:
        payload = load_json(managed)
    except ValueError as exc:
        coverage["corrupt"].append(f"{label}: {exc}")
        return None
    except OSError as exc:
        coverage["refused"].append(f"{label}: {exc}")
        return None
    if not isinstance(payload, dict):
        coverage["typeErrors"].append(
            f"{label}: expected a JSON object, got {type(payload).__name__}"
        )
        return None
    return payload


def _collect_party_names(
    payload: dict[str, Any],
    label: str,
    records: list[NameRecord],
    coverage: dict[str, Any],
) -> None:
    parties = payload.get("parties", []) or []
    if not isinstance(parties, list):
        coverage["typeErrors"].append(f"{label}: parties must be an array")
        return
    for position, party in enumerate(parties, 1):
        if not isinstance(party, dict):
            coverage["typeErrors"].append(f"{label}: parties[{position}] must be an object")
            continue
        role = party.get("role")
        role = str(role) if isinstance(role, str) and role else "unknown"
        values = [party.get("displayName"), party.get("unifiedSocialCreditCode")]
        aliases = party.get("normalizedNames", []) or []
        if isinstance(aliases, list):
            values.extend(aliases)
        else:
            coverage["typeErrors"].append(f"{label}: parties[{position}].normalizedNames must be an array")
        for value in values:
            if value:
                records.append(NameRecord(normalize_name(str(value)), str(value), label, role))


def existing_name_records(
    root: Path, current_matter_id: str
) -> tuple[list[NameRecord], dict[str, Any]]:
    records: list[NameRecord] = []
    coverage = new_coverage()

    for client_id in _candidate_directories(root, ("clients",), coverage):
        parts = ("clients", client_id, "client.json")
        label = _relative_label(root, *parts)
        payload = _read_scanned_payload(root, parts, coverage)
        if payload is None:
            continue
        for key in ("displayName", "unifiedSocialCreditCode"):
            value = payload.get(key)
            if value:
                records.append(NameRecord(normalize_name(str(value)), str(value), label, "client-record"))
        for key in ("formerNames", "englishNames", "aliases", "affiliates"):
            values = payload.get(key, []) or []
            if not isinstance(values, list):
                coverage["typeErrors"].append(f"{label}: {key} must be an array")
                continue
            for value in values:
                if value:
                    records.append(
                        NameRecord(normalize_name(str(value)), str(value), label, "client-record")
                    )

    for matter_id in _candidate_directories(root, ("matters",), coverage):
        if matter_id == current_matter_id or matter_id == "_archived":
            continue
        parts = ("matters", matter_id, "parties.json")
        payload = _read_scanned_payload(root, parts, coverage)
        if payload is None:
            continue
        _collect_party_names(payload, _relative_label(root, *parts), records, coverage)

    for matter_id in _candidate_directories(root, ("matters", "_archived"), coverage):
        if matter_id == current_matter_id:
            continue
        parts = ("matters", "_archived", matter_id, "parties.json")
        payload = _read_scanned_payload(root, parts, coverage)
        if payload is None:
            continue
        _collect_party_names(payload, _relative_label(root, *parts), records, coverage)

    if coverage["corrupt"] or coverage["refused"] or coverage["typeErrors"]:
        coverage["status"] = "partial"
    return records, coverage


def classify_relation(existing_role: str, new_role: str) -> str:
    if existing_role in CLIENT_SIDE_ROLES and new_role in CLIENT_SIDE_ROLES:
        return "same-side-existing-client"
    if existing_role in CLIENT_SIDE_ROLES and new_role in ADVERSE_ROLES:
        return "potential-adverse"
    if existing_role in ADVERSE_ROLES and new_role in CLIENT_SIDE_ROLES:
        return "potential-adverse"
    return "name-match-unclassified"


def conflict_hits(
    root: Path, matter_id: str, parties: list[dict[str, Any]]
) -> tuple[list[dict[str, str]], dict[str, Any]]:
    existing, coverage = existing_name_records(root, matter_id)
    hits: list[dict[str, str]] = []
    seen: set[tuple[str, str, str, str]] = set()
    for party in parties:
        new_role = str(party.get("role") or "unknown")
        values = [party.get("displayName"), *(party.get("normalizedNames", []) or [])]
        for value in values:
            if not value:
                continue
            normalized = normalize_name(str(value))
            if not normalized:
                continue
            for record in existing:
                if normalized != record.normalized:
                    continue
                key = (normalized, record.source, record.role, new_role)
                if key in seen:
                    continue
                seen.add(key)
                hits.append(
                    {
                        "source": record.source,
                        "matchedValue": record.value,
                        "existingRole": record.role,
                        "newRole": new_role,
                        "relation": classify_relation(record.role, new_role),
                        "summary": f"Local matter-store normalized-name match for {record.value}",
                        "risk": "unknown",
                        "recommendedAction": "Stop substantive work until the responsible lawyer reviews the match.",
                    }
                )
    return hits, coverage


def main() -> int:
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root")
    parser.add_argument("--matter-id", required=True)
    parser.add_argument("--client-id", required=True)
    parser.add_argument("--client-name", required=True)
    parser.add_argument("--title", required=True)
    parser.add_argument("--scope", required=True)
    parser.add_argument("--matter-type", required=True)
    parser.add_argument("--responsible-lawyer", required=True)
    parser.add_argument("--review-owner", required=True)
    parser.add_argument("--allowed-user", action="append", required=True)
    parser.add_argument("--party", action="append", required=True)
    parser.add_argument("--access-mode", choices=["standard", "heightened", "clean-team"], default="standard")
    parser.add_argument("--confidentiality", choices=["standard", "heightened", "clean-team"], default="standard")
    args = parser.parse_args()

    try:
        matter_id = require_id("matter-id", args.matter_id)
        client_id = require_id("client-id", args.client_id)
        matter_type = require_matter_type(args.matter_type)
        if not all(value.strip() for value in (args.client_name, args.title, args.scope, args.responsible_lawyer, args.review_owner)):
            raise ValueError("client-name, title, scope, responsible-lawyer and review-owner must not be empty")
        root = resolve_root(args.root)
        ensure_private_dir(safe_path(root, "clients"))
        ensure_private_dir(safe_path(root, "matters"))
        matter_dir = safe_path(root, "matters", matter_id)

        parties = [parse_party(raw) for raw in args.party]
        if not any(party["role"] == "client" for party in parties):
            parties.insert(
                0,
                {
                    "role": "client",
                    "displayName": args.client_name,
                    "normalizedNames": [args.client_name],
                },
            )

        with file_lock(safe_path(root, ".matter-store.lock"), timeout_seconds=1.0):
            # Claim the matter id exclusively before anything else: the existence
            # check and the creation must be the same filesystem operation, or two
            # writers that both passed a separate check will both create.
            try:
                os.mkdir(matter_dir)
            except FileExistsError:
                reason = (
                    PENDING_MATTER_MESSAGE
                    if matter_is_pending(matter_dir)
                    else "matter already exists; refusing to overwrite"
                )
                print(
                    json.dumps(
                        {"status": "conflict", "matterId": matter_id, "error": f"{reason}: {matter_id}"},
                        ensure_ascii=False,
                    )
                )
                return EXIT_CONFLICT
            try:
                matter_dir.chmod(0o700)
            except OSError:
                pass
            touch_private(pending_marker_path(matter_dir))

            hits, coverage = conflict_hits(root, matter_id, parties)
            if coverage["status"] != "complete":
                conflict_status = "coverage-incomplete"
            elif hits:
                conflict_status = "hit-review-required"
            else:
                conflict_status = "no-hit"
            matter_status = "active" if conflict_status == "no-hit" else "pending-conflict-review"
            opened_at = today()

            client_dir = ensure_private_dir(safe_path(root, "clients", client_id))
            client_path = safe_path(client_dir, "client.json")
            if client_path.exists():
                existing_client = load_json(client_path)
                if existing_client.get("clientId") != client_id:
                    raise ValueError("existing client record has a mismatched clientId")
            else:
                atomic_write_json(
                    client_path,
                    {
                        "clientId": client_id,
                        "displayName": args.client_name,
                        "status": "active",
                        "confidentiality": args.confidentiality,
                    },
                )

            ensure_private_dir(safe_path(matter_dir, "outputs"))
            ensure_private_dir(safe_path(matter_dir, "runs"))

            matter = {
                "matterId": matter_id,
                "clientId": client_id,
                "title": args.title,
                "matterType": matter_type,
                "status": matter_status,
                "engagementScope": args.scope,
                "responsibleLawyer": args.responsible_lawyer,
                "reviewOwner": args.review_owner,
                "openedAt": opened_at,
                "retentionPolicy": "Retain according to the user's and responsible lawyer's instruction.",
                "sourcePolicy": "Every factual and legal assertion requires a source record or source-needs-check entry.",
                "notes": "Created by the CrabLaw-CN local matter bootstrap; local conflict screening is preliminary only.",
            }
            permissions = {
                "matterId": matter_id,
                "accessMode": args.access_mode,
                "allowedUsers": sorted(set(args.allowed_user)),
                "crossMatterAccess": {"enabled": False},
            }
            conflict = {
                "matterId": matter_id,
                "status": conflict_status,
                "screenedAt": opened_at,
                "screenedBy": "bootstrap_matter.py local normalized-name pre-screen",
                "queries": sorted(
                    {
                        str(value)
                        for party in parties
                        for value in [party.get("displayName"), *(party.get("normalizedNames", []) or [])]
                        if value
                    }
                ),
                "hits": hits,
                "coverage": coverage,
                "lawyerConfirmation": {
                    "status": "not-reviewed",
                    "notes": "Preliminary local screen only; final conflict decision remains with the responsible lawyer.",
                },
            }

            atomic_write_json(safe_path(matter_dir, "matter.json"), matter)
            atomic_write_json(safe_path(matter_dir, "parties.json"), {"matterId": matter_id, "parties": parties})
            atomic_write_json(safe_path(matter_dir, "permissions.json"), permissions)
            atomic_write_json(safe_path(matter_dir, "conflict-check.json"), conflict)
            for filename in ("sources.jsonl", "review-queue.jsonl", "audit-log.jsonl"):
                touch_private(safe_path(matter_dir, filename))
            append_jsonl(
                safe_path(matter_dir, "audit-log.jsonl"),
                {
                    "event": "matter-bootstrap",
                    "matterId": matter_id,
                    "createdAt": opened_at,
                    "conflictStatus": conflict_status,
                    "coverageStatus": coverage["status"],
                    "tool": "bootstrap_matter.py",
                },
            )

            # Every file is written and readable back; only now is the matter complete.
            for filename in ("matter.json", "parties.json", "permissions.json", "conflict-check.json"):
                load_json(safe_path(matter_dir, filename, must_exist=True))
            pending_marker_path(matter_dir).unlink()

        print(
            json.dumps(
                {
                    "status": "created",
                    "matterId": matter_id,
                    "conflictStatus": conflict_status,
                    "substantiveWorkAllowed": conflict_status == "no-hit",
                    "coverage": coverage,
                },
                ensure_ascii=False,
            )
        )
        return EXIT_OK if conflict_status == "no-hit" else EXIT_REVIEW_REQUIRED
    except (OSError, ValueError) as exc:
        print(json.dumps({"status": "failed", "error": str(exc)}, ensure_ascii=False))
        return EXIT_USAGE_OR_IO


if __name__ == "__main__":
    raise SystemExit(main())
