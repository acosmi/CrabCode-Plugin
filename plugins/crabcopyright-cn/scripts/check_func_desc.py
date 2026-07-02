#!/usr/bin/env python3
"""软件主要功能说明字数校验。

口径见 apply-core/GUIDE.md §8:2026 新版申请表要求功能说明约 500–1300 字
(非《办法》条文,以填报时平台实际提示为准)。字数按去除空白后的字符数计。

用法:
    python3 check_func_desc.py <功能说明文本文件> [--json]
    echo "……" | python3 check_func_desc.py - [--json]
"""
import json
import sys

# GUIDE.md §8 口径(2026 新版申请表,约数;以平台实际提示为准)
MIN_CHARS = 500
MAX_CHARS = 1300


def count_chars(text):
    """字数 = 去除空白字符后的字符数(中英文均按字符计)。"""
    return sum(1 for ch in text if not ch.isspace())


def run_check(text):
    n = count_chars(text)
    items = []
    if n < MIN_CHARS:
        items.append({"level": "fail",
                      "message": f"字数 {n} 低于 2026 新版口径下限 {MIN_CHARS}(以平台实际提示为准)"})
    elif n > MAX_CHARS:
        items.append({"level": "fail",
                      "message": f"字数 {n} 超过 2026 新版口径上限 {MAX_CHARS}(以平台实际提示为准)"})
    else:
        items.append({"level": "info", "message": f"字数 {n},在 {MIN_CHARS}–{MAX_CHARS} 区间内"})
    status = "fail" if any(i["level"] == "fail" for i in items) else "pass"
    return {
        "check": "func-description",
        "status": status,
        "summary": f"功能说明 {n} 字(口径 {MIN_CHARS}–{MAX_CHARS})",
        "items": items,
        "data": {"chars": n, "min": MIN_CHARS, "max": MAX_CHARS},
    }


def print_report(result):
    print(f"[{result['status'].upper()}] {result['check']} — {result['summary']}")
    for it in result["items"]:
        print(f"  - ({it['level']}) {it['message']}")


def main(argv):
    as_json = "--json" in argv
    paths = [a for a in argv if a != "--json"]
    if len(paths) != 1:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    if paths[0] == "-":
        text = sys.stdin.read()
    else:
        with open(paths[0], encoding="utf-8") as fh:
            text = fh.read()
    result = run_check(text)
    if as_json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print_report(result)
    return 1 if result["status"] == "fail" else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
