#!/usr/bin/env python3
"""Validate one JSON file against the JSON-Schema subset shipped with CrabLaw-CN."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from _matter_common import load_json
from schema_validation import validate_instance


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--file", required=True)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    try:
        schema_path = Path(args.schema).expanduser()
        file_path = Path(args.file).expanduser()
        schema = load_json(schema_path)
        payload = load_json(file_path)
        errors = validate_instance(payload, schema)
    except ValueError as exc:
        errors = [str(exc)]

    result = {
        "status": "ok" if not errors else "failed",
        "schema": str(Path(args.schema)),
        "file": str(Path(args.file)),
        "errors": errors,
    }
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    elif errors:
        print("VALIDATION FAILED", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
    else:
        print(f"VALIDATION OK: {args.file}")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
