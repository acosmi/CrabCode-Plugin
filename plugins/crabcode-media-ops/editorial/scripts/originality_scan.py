#!/usr/bin/env python3
"""Heuristic phrase-overlap scanner for user-supplied texts only."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


def normalize(text: str) -> str:
    return re.sub(r"\s+", "", re.sub(r"[^0-9A-Za-z\u4e00-\u9fff]+", " ", text)).lower()


def shingles(text: str, size: int) -> set[str]:
    clean = normalize(text)
    return {clean[i : i + size] for i in range(max(0, len(clean) - size + 1))}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("draft", type=Path)
    parser.add_argument("references", nargs="+", type=Path)
    parser.add_argument("--size", type=int, default=12)
    args = parser.parse_args()
    draft = shingles(args.draft.read_text(encoding="utf-8"), args.size)
    results = []
    for path in args.references:
        reference = shingles(path.read_text(encoding="utf-8"), args.size)
        overlap = sorted(draft & reference)
        results.append({"file": str(path), "matchedPhrases": overlap[:50], "matchCount": len(overlap)})
    print(json.dumps({"scope": "user-supplied-texts-only", "guarantee": "none", "shingleSize": args.size, "results": results}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
