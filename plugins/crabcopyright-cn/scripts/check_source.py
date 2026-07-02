#!/usr/bin/env python3
"""源代码鉴别材料确定性校验:行数统计、页数折算、注水启发式。

官方口径见 apply-core/GUIDE.md §3:每页不少于 50 行,前 30 页 + 后 30 页共 60 页;
总行数不足 3000 行(即不足 60 页)时提交全部。注水阈值为经验值,超限只告警,由人工复核。

用法:
    python3 check_source.py <源码文件或目录>... [--json]

目录会递归扫描常见源码扩展名,自动跳过 node_modules 等生成目录。
零依赖:仅用 Python 标准库。
"""
import json
import math
import os
import sys
from collections import Counter

# ---- 官方口径(GUIDE.md §3) ----
LINES_PER_PAGE = 50                              # 每页不少于 50 行
REQUIRED_PAGES = 60                              # 前 30 页 + 后 30 页
REQUIRED_LINES = LINES_PER_PAGE * REQUIRED_PAGES  # 3000 行才够 60 页

# ---- 注水启发式阈值(经验值,非官方口径) ----
BLANK_RATIO_MAX = 0.25    # 空行占比上限
COMMENT_RATIO_MAX = 0.40  # 注释行占比上限
DUP_RATIO_MAX = 0.30      # 重复行(多余副本)占比上限
DUP_MIN_LINE_LEN = 6      # 短于此长度的行(如单个花括号)不计入重复统计

EXCLUDE_DIRS = {"node_modules", "vendor", "target", "dist", "build",
                "__pycache__", "out", "coverage", "venv"}
EXCLUDE_SUFFIXES = (".min.js", ".bundle.js", ".map", ".lock", ".svg", ".png",
                    ".jpg", ".jpeg", ".gif", ".ico", ".pdf", ".woff", ".woff2")
CODE_EXTS = {".c", ".cc", ".cpp", ".h", ".hpp", ".cs", ".java", ".kt", ".go",
             ".rs", ".py", ".rb", ".php", ".js", ".jsx", ".ts", ".tsx", ".vue",
             ".swift", ".m", ".mm", ".scala", ".dart", ".lua", ".sql", ".sh",
             ".html", ".css", ".scss", ".less"}
COMMENT_PREFIXES = ("//", "#", "/*", "*", "--", "<!--", ";")


def collect_files(paths):
    """把文件/目录参数展开为源码文件列表(目录递归,按扩展名过滤)。"""
    files = []
    for p in paths:
        if os.path.isfile(p):
            files.append(p)
        elif os.path.isdir(p):
            for root, dirs, names in os.walk(p):
                dirs[:] = sorted(d for d in dirs
                                 if d not in EXCLUDE_DIRS and not d.startswith("."))
                for n in sorted(names):
                    if n.lower().endswith(EXCLUDE_SUFFIXES):
                        continue
                    if os.path.splitext(n)[1].lower() in CODE_EXTS:
                        files.append(os.path.join(root, n))
        else:
            raise FileNotFoundError(f"路径不存在: {p}")
    return files


def read_lines(path):
    with open(path, encoding="utf-8", errors="replace") as fh:
        return fh.read().splitlines()


def run_check(paths):
    """统计行数并折算页数,跑注水启发式。返回统一结果字典。"""
    files = collect_files(paths)
    total = blank = comment = 0
    line_counter = Counter()
    per_file = []
    for f in files:
        lines = read_lines(f)
        per_file.append({"path": f, "lines": len(lines)})
        total += len(lines)
        for line in lines:
            s = line.strip()
            if not s:
                blank += 1
            elif s.startswith(COMMENT_PREFIXES):
                comment += 1
            if len(s) >= DUP_MIN_LINE_LEN:
                line_counter[s] += 1

    nonblank = total - blank
    extra_dup = sum(c - 1 for c in line_counter.values() if c > 1)
    blank_ratio = blank / total if total else 0.0
    comment_ratio = comment / total if total else 0.0
    dup_ratio = extra_dup / nonblank if nonblank else 0.0
    pages = math.ceil(total / LINES_PER_PAGE)

    items = []
    if total == 0:
        items.append({"level": "fail", "message": "未找到任何源码行,无法组成鉴别材料"})
    elif total >= REQUIRED_LINES:
        items.append({"level": "info",
                      "message": f"总行数 {total} ≥ {REQUIRED_LINES},按前 30 + 后 30 共 {REQUIRED_PAGES} 页提交"})
    else:
        items.append({"level": "info",
                      "message": f"总行数 {total} < {REQUIRED_LINES}(约 {pages} 页),须提交全部代码并标注总行数"})
    for name, ratio, limit in (("空行", blank_ratio, BLANK_RATIO_MAX),
                               ("注释行", comment_ratio, COMMENT_RATIO_MAX),
                               ("重复行", dup_ratio, DUP_RATIO_MAX)):
        if ratio > limit:
            items.append({"level": "warn",
                          "message": f"{name}占比 {ratio:.1%} 超过经验阈值 {limit:.0%},疑似注水,请人工复核"})

    if any(i["level"] == "fail" for i in items):
        status = "fail"
    elif any(i["level"] == "warn" for i in items):
        status = "warn"
    else:
        status = "pass"
    return {
        "check": "source-material",
        "status": status,
        "summary": f"{len(files)} 个文件 / {total} 行 / 折算 {pages} 页(每页 {LINES_PER_PAGE} 行)",
        "items": items,
        "data": {"files": per_file, "total_lines": total, "pages": pages,
                 "blank_ratio": round(blank_ratio, 4),
                 "comment_ratio": round(comment_ratio, 4),
                 "dup_ratio": round(dup_ratio, 4)},
    }


def print_report(result):
    print(f"[{result['status'].upper()}] {result['check']} — {result['summary']}")
    for it in result["items"]:
        print(f"  - ({it['level']}) {it['message']}")


def main(argv):
    as_json = "--json" in argv
    paths = [a for a in argv if a != "--json"]
    if not paths:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    result = run_check(paths)
    if as_json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print_report(result)
    return 1 if result["status"] == "fail" else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
