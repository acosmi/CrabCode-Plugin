#!/usr/bin/env python3
"""Validate that mirror publication is bound to exact manual CI evidence."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import sys


REPOSITORY = "acosmi/CrabCode-Plugin"
WORKFLOW_PATH = ".github/workflows/ci.yml"
SHA = re.compile(r"[0-9a-f]{40}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-json", type=Path, required=True)
    parser.add_argument("--expected-run-id", type=int, required=True)
    parser.add_argument("--expected-sha", required=True)
    parser.add_argument("--dispatch-sha", required=True)
    parser.add_argument("--checked-out-sha", required=True)
    parser.add_argument("--origin-main-sha", required=True)
    return parser.parse_args()


def validate(args: argparse.Namespace) -> dict[str, object]:
    if args.expected_run_id <= 0:
        raise ValueError("expected run ID must be positive")
    for label in ("expected_sha", "dispatch_sha", "checked_out_sha", "origin_main_sha"):
        value = getattr(args, label)
        if SHA.fullmatch(value) is None:
            raise ValueError(f"{label} must be one full lowercase commit SHA: {value!r}")
    if args.dispatch_sha != args.expected_sha:
        raise ValueError(
            f"dispatch SHA {args.dispatch_sha} does not equal expected SHA {args.expected_sha}"
        )
    if args.checked_out_sha != args.expected_sha:
        raise ValueError(
            f"checkout SHA {args.checked_out_sha} does not equal expected SHA {args.expected_sha}"
        )
    if args.origin_main_sha != args.expected_sha:
        raise ValueError(
            f"origin/main is stale or advanced: {args.origin_main_sha} != {args.expected_sha}"
        )

    run = json.loads(args.run_json.read_text(encoding="utf-8"))
    required = {
        "id": args.expected_run_id,
        "event": "workflow_dispatch",
        "head_branch": "main",
        "head_sha": args.expected_sha,
        "status": "completed",
        "conclusion": "success",
        "path": WORKFLOW_PATH,
    }
    mismatches = {
        key: {"expected": expected, "actual": run.get(key)}
        for key, expected in required.items()
        if run.get(key) != expected
    }
    for field in ("repository", "head_repository"):
        actual = (run.get(field) or {}).get("full_name")
        if actual != REPOSITORY:
            mismatches[f"{field}.full_name"] = {
                "expected": REPOSITORY,
                "actual": actual,
            }
    actor = (run.get("actor") or {}).get("login")
    if not isinstance(actor, str) or not actor:
        mismatches["actor.login"] = {"expected": "non-empty", "actual": actor}
    if mismatches:
        raise ValueError(
            "ci_run_id is not exact successful manual main CI evidence: "
            + json.dumps(mismatches, ensure_ascii=False, sort_keys=True)
        )
    return {
        "actor": actor,
        "ciRunId": run["id"],
        "ciUrl": run.get("html_url"),
        "sha": args.expected_sha,
    }


def main() -> int:
    args = parse_args()
    try:
        evidence = validate(args)
    except (OSError, json.JSONDecodeError, ValueError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print(json.dumps(evidence, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
