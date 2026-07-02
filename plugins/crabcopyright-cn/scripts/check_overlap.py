#!/usr/bin/env python3
"""跨申请源码材料重叠检测。

红线见 apply-core/GUIDE.md §3 与 application-planning:公共代码不得在多个申请里
重复充数,跨申请代码雷同会被查重驳回。本脚本对多个申请的源码集合做两级比对:
① 内容完全相同的文件(哈希一致,判 fail);② 行集合高相似的文件对与申请对整体
行重叠率(经验阈值,判 warn)。

用法:
    python3 check_overlap.py <申请A源码目录或文件>... --vs <申请B源码目录或文件>... [--vs ...] [--json]

每组 --vs 分隔一个申请的源码集合,至少两组。
"""
import hashlib
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from check_source import collect_files, read_lines  # noqa: E402  复用同目录采集逻辑

# ---- 经验阈值(非官方口径,超限告警由人工复核) ----
FILE_JACCARD_WARN = 0.6   # 文件对行集合 Jaccard 相似度告警线
PAIR_OVERLAP_WARN = 0.2   # 申请对整体行重叠率(交集/较小行集)告警线
MIN_LINE_LEN = 8          # 短行(花括号、import 等)不计入相似度


def file_profile(path):
    lines = read_lines(path)
    raw = "\n".join(lines).encode("utf-8", errors="replace")
    lineset = {s for s in (l.strip() for l in lines) if len(s) >= MIN_LINE_LEN}
    return {"path": path, "sha256": hashlib.sha256(raw).hexdigest(), "lineset": lineset}


def jaccard(a, b):
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def run_check(groups):
    """groups: [(标签, [路径...]), ...],每组为一个申请的源码集合。"""
    profiles = []
    for label, paths in groups:
        files = [file_profile(f) for f in collect_files(paths)]
        union = set().union(*(f["lineset"] for f in files)) if files else set()
        profiles.append({"label": label, "files": files, "union": union})

    items = []
    pairs = []
    for i in range(len(profiles)):
        for j in range(i + 1, len(profiles)):
            a, b = profiles[i], profiles[j]
            # ① 完全相同文件
            hash_b = {}
            for fb in b["files"]:
                hash_b.setdefault(fb["sha256"], []).append(fb["path"])
            for fa in a["files"]:
                for pb in hash_b.get(fa["sha256"], []):
                    items.append({"level": "fail",
                                  "message": f"文件内容完全相同: {fa['path']} ⇔ {pb}(公共代码不得重复计入两个申请)"})
            # ② 高相似文件对
            for fa in a["files"]:
                for fb in b["files"]:
                    if fa["sha256"] == fb["sha256"]:
                        continue
                    sim = jaccard(fa["lineset"], fb["lineset"])
                    if sim >= FILE_JACCARD_WARN:
                        items.append({"level": "warn",
                                      "message": f"文件高度相似({sim:.0%}): {fa['path']} ⇔ {fb['path']}"})
            # ③ 申请对整体行重叠率
            smaller = min(len(a["union"]), len(b["union"]))
            ratio = len(a["union"] & b["union"]) / smaller if smaller else 0.0
            pairs.append({"a": a["label"], "b": b["label"], "overlap_ratio": round(ratio, 4)})
            if ratio >= PAIR_OVERLAP_WARN:
                items.append({"level": "warn",
                              "message": f"申请「{a['label']}」与「{b['label']}」整体行重叠率 {ratio:.1%} 超经验阈值 {PAIR_OVERLAP_WARN:.0%}"})

    if not items:
        items.append({"level": "info", "message": "未发现相同文件或超阈值重叠"})
    if any(i["level"] == "fail" for i in items):
        status = "fail"
    elif any(i["level"] == "warn" for i in items):
        status = "warn"
    else:
        status = "pass"
    return {
        "check": "cross-application-overlap",
        "status": status,
        "summary": f"{len(profiles)} 个申请,{sum(len(p['files']) for p in profiles)} 个文件,"
                   f"{len([i for i in items if i['level'] != 'info'])} 条重叠发现",
        "items": items,
        "data": {"pairs": pairs},
    }


def print_report(result):
    print(f"[{result['status'].upper()}] {result['check']} — {result['summary']}")
    for it in result["items"]:
        print(f"  - ({it['level']}) {it['message']}")


def main(argv):
    as_json = "--json" in argv
    args = [a for a in argv if a != "--json"]
    groups, current = [], []
    for a in args:
        if a == "--vs":
            groups.append(current)
            current = []
        else:
            current.append(a)
    groups.append(current)
    groups = [g for g in groups if g]
    if len(groups) < 2:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    result = run_check([(" ".join(g), g) for g in groups])
    if as_json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print_report(result)
    return 1 if result["status"] == "fail" else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
