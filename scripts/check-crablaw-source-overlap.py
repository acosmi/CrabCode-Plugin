#!/usr/bin/env python3
"""Detect suspicious long text overlap between CrabLaw-CN and an external research snapshot.

This is a provenance preflight, not a copyright opinion. It reports file locations and overlap
sizes without printing the compared text. Exit 1 means one or more long exact normalized shingles
were found; exit 0 means none met the configured threshold.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from typing import Iterable


TEXT_SUFFIXES = {".md", ".txt", ".json", ".py", ".ts"}
SKIP_DIRS = {".git", "node_modules", "dist", "vendor", "__pycache__"}


def files(root: Path) -> Iterable[Path]:
    for path in root.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        if any(part in SKIP_DIRS for part in path.relative_to(root).parts):
            continue
        yield path


def normalize(text: str) -> str:
    text = re.sub(r"https?://\S+", "", text)
    # Remove fence markers/language labels but keep fenced content: copied templates
    # and code examples are still relevant to the provenance preflight.
    text = re.sub(r"```[^\n]*\n?", "", text)
    text = text.replace("```", "")
    text = re.sub(r"[\s`*_#>|\-]+", "", text)
    return text.casefold()


def shingles(text: str, size: int, step: int) -> Iterable[tuple[str, int]]:
    if len(text) < size:
        return
    for offset in range(0, len(text) - size + 1, step):
        chunk = text[offset : offset + size]
        yield hashlib.sha256(chunk.encode("utf-8")).hexdigest(), offset


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--upstream-root", required=True)
    parser.add_argument("--target-root", default="plugins/crablaw-cn")
    parser.add_argument("--shingle-size", type=int, default=96)
    parser.add_argument("--step", type=int, default=24)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    upstream_root = Path(args.upstream_root).expanduser().resolve()
    target_root = Path(args.target_root).expanduser().resolve()
    if not upstream_root.is_dir() or not target_root.is_dir():
        raise SystemExit("both roots must be existing directories")
    if args.shingle_size < 64 or args.step < 1:
        raise SystemExit("shingle-size must be >=64 and step must be positive")

    index: dict[str, tuple[str, int]] = {}
    for path in files(upstream_root):
        normalized = normalize(path.read_text(encoding="utf-8", errors="ignore"))
        for digest, offset in shingles(normalized, args.shingle_size, args.step):
            index.setdefault(digest, (str(path.relative_to(upstream_root)), offset))

    matches: list[dict[str, object]] = []
    seen: set[tuple[str, str]] = set()
    for path in files(target_root):
        normalized = normalize(path.read_text(encoding="utf-8", errors="ignore"))
        for digest, offset in shingles(normalized, args.shingle_size, args.step):
            upstream = index.get(digest)
            if upstream is None:
                continue
            pair = (str(path.relative_to(target_root)), upstream[0])
            if pair in seen:
                continue
            seen.add(pair)
            matches.append(
                {
                    "target": pair[0],
                    "upstream": pair[1],
                    "targetOffset": offset,
                    "upstreamOffset": upstream[1],
                    "minimumOverlapCharacters": args.shingle_size,
                }
            )

    result = {
        "status": "pass" if not matches else "review-required",
        "shingleSize": args.shingle_size,
        "matches": matches,
    }
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"source-overlap: {result['status']} ({len(matches)} match pair(s))")
        for match in matches:
            print(f"- {match['target']} <-> {match['upstream']} (>= {args.shingle_size} normalized chars)")
    return 1 if matches else 0


if __name__ == "__main__":
    raise SystemExit(main())
