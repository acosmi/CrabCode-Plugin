#!/usr/bin/env python3
"""Fail closed unless the historical credential-bearing publisher stays disabled."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys


RETIRED_WORKFLOW_ID = 336369746
RETIRED_WORKFLOW_PATH = ".github/workflows/publish-to-cn-mirror.yml"
REQUIRED_STATE = "disabled_manually"
SAFE_WORKFLOW_PATH = ".github/workflows/publish-safe-to-cn-mirror.yml"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workflow-json", type=Path, required=True)
    parser.add_argument("--safe-workflow-json", type=Path, required=True)
    parser.add_argument("--control-evidence-json", type=Path, required=True)
    parser.add_argument("--historical-runs-json", type=Path, required=True)
    return parser.parse_args()


def validate(
    path: Path,
    safe_path: Path,
    control_path: Path,
    historical_runs_path: Path,
) -> dict[str, object]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    required = {
        "id": RETIRED_WORKFLOW_ID,
        "path": RETIRED_WORKFLOW_PATH,
        "state": REQUIRED_STATE,
    }
    mismatches = {
        key: {"expected": expected, "actual": payload.get(key)}
        for key, expected in required.items()
        if payload.get(key) != expected
    }
    if mismatches:
        raise ValueError(
            "historical publisher is not safely retired: "
            + json.dumps(mismatches, ensure_ascii=False, sort_keys=True)
        )
    safe = json.loads(safe_path.read_text(encoding="utf-8"))
    safe_id = safe.get("id")
    safe_required = {
        "path": SAFE_WORKFLOW_PATH,
        "state": "active",
    }
    safe_mismatches = {
        key: {"expected": expected, "actual": safe.get(key)}
        for key, expected in safe_required.items()
        if safe.get(key) != expected
    }
    if not isinstance(safe_id, int) or safe_id <= 0 or safe_id == RETIRED_WORKFLOW_ID:
        safe_mismatches["id"] = {
            "expected": "positive ID distinct from 336369746",
            "actual": safe_id,
        }
    if safe_mismatches:
        raise ValueError(
            "safe publisher does not have a distinct active workflow identity: "
            + json.dumps(safe_mismatches, ensure_ascii=False, sort_keys=True)
        )
    control_evidence = json.loads(control_path.read_text(encoding="utf-8"))
    control = control_evidence.get("control")
    control_status = control.get("status") if isinstance(control, dict) else None
    control_type = control.get("verifiedUnbypassableControl") if isinstance(control, dict) else None
    if (
        control_status != "unbypassable-control-verified"
        or control_type != "historical-runs-deleted"
    ):
        raise ValueError(
            "P1-REL-02 remains blocked: disabled workflow metadata is reversible and no verified unbypassable control is recorded"
        )
    historical_runs = json.loads(historical_runs_path.read_text(encoding="utf-8"))
    total_count = historical_runs.get("total_count")
    runs = historical_runs.get("workflow_runs")
    if total_count != 0 or runs != []:
        raise ValueError(
            "P1-REL-02 remains blocked: GitHub API still reports historical publisher runs"
        )
    return {
        "retiredWorkflowId": RETIRED_WORKFLOW_ID,
        "path": RETIRED_WORKFLOW_PATH,
        "state": REQUIRED_STATE,
        "updatedAt": payload.get("updated_at"),
        "safePublisherId": safe_id,
        "safePublisherPath": SAFE_WORKFLOW_PATH,
        "safePublisherState": "active",
        "verifiedUnbypassableControl": control_type,
    }


def main() -> int:
    args = parse_args()
    try:
        result = validate(
            args.workflow_json,
            args.safe_workflow_json,
            args.control_evidence_json,
            args.historical_runs_json,
        )
    except (OSError, json.JSONDecodeError, ValueError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
