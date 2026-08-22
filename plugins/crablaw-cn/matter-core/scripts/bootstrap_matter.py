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
from typing import Any

from _matter_common import (
    append_jsonl,
    atomic_write_json,
    ensure_private_dir,
    file_lock,
    load_json,
    require_id,
    require_matter_type,
    resolve_root,
    safe_path,
    today,
    touch_private,
)


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


def existing_name_records(root: Path, current_matter_id: str) -> list[tuple[str, str, str]]:
    records: list[tuple[str, str, str]] = []
    for client_path in safe_path(root, "clients").glob("*/client.json"):
        if client_path.is_symlink():
            continue
        try:
            payload = load_json(client_path)
        except ValueError:
            continue
        for key in ("displayName", "unifiedSocialCreditCode"):
            value = payload.get(key)
            if value:
                records.append((normalize_name(str(value)), str(value), str(client_path.relative_to(root))))
        for key in ("formerNames", "englishNames", "aliases", "affiliates"):
            for value in payload.get(key, []) or []:
                records.append((normalize_name(str(value)), str(value), str(client_path.relative_to(root))))

    for parties_path in safe_path(root, "matters").glob("*/parties.json"):
        if parties_path.parent.name == current_matter_id or parties_path.is_symlink():
            continue
        try:
            payload = load_json(parties_path)
        except ValueError:
            continue
        for party in payload.get("parties", []) or []:
            values = [party.get("displayName"), party.get("unifiedSocialCreditCode")]
            values.extend(party.get("normalizedNames", []) or [])
            for value in values:
                if value:
                    records.append(
                        (normalize_name(str(value)), str(value), str(parties_path.relative_to(root)))
                    )
    return records


def conflict_hits(root: Path, matter_id: str, parties: list[dict[str, Any]]) -> list[dict[str, str]]:
    existing = existing_name_records(root, matter_id)
    hits: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for party in parties:
        values = [party.get("displayName"), *(party.get("normalizedNames", []) or [])]
        for value in values:
            if not value:
                continue
            normalized = normalize_name(str(value))
            for existing_normalized, existing_value, source in existing:
                if not normalized or normalized != existing_normalized:
                    continue
                key = (normalized, source)
                if key in seen:
                    continue
                seen.add(key)
                hits.append(
                    {
                        "source": source,
                        "summary": f"Local matter-store normalized-name match for {existing_value}",
                        "risk": "unknown",
                        "recommendedAction": "Stop substantive work until the responsible lawyer reviews the match.",
                    }
                )
    return hits


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
        if matter_dir.exists():
            raise ValueError(f"matter already exists; refusing to overwrite: {matter_id}")

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
            hits = conflict_hits(root, matter_id, parties)
            conflict_status = "hit-review-required" if hits else "no-hit"
            matter_status = "pending-conflict-review" if hits else "active"
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

            ensure_private_dir(matter_dir)
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
                    "tool": "bootstrap_matter.py",
                },
            )

        print(
            json.dumps(
                {
                    "status": "created",
                    "matterId": matter_id,
                    "conflictStatus": conflict_status,
                    "substantiveWorkAllowed": conflict_status == "no-hit",
                },
                ensure_ascii=False,
            )
        )
        return 10 if hits else 0
    except (OSError, ValueError) as exc:
        print(json.dumps({"status": "failed", "error": str(exc)}, ensure_ascii=False))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
