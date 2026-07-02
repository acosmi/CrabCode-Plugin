#!/usr/bin/env python3
"""软著申请材料确定性校验总入口。

读取 outputs/<申请名>/manifest.json(结构见 apply-core/MANIFEST.md),依次执行:
manifest 必填字段与名称版本规范检查 → 源码行数/页数/注水检查 → 功能说明字数检查
→ 日期逻辑检查 → (可选)跨申请重叠检查。人可读输出为主,--json 输出机器可读汇总。

用法:
    python3 check_all.py --manifest outputs/<申请名>/manifest.json
        [--compare-with 另一申请的manifest.json或源码目录]... [--json]

manifest 内相对路径按 manifest 所在目录解析。退出码:0 全过(含 warn)、1 有 fail、2 用法/解析错误。
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import check_dates    # noqa: E402
import check_func_desc  # noqa: E402
import check_overlap  # noqa: E402
import check_source   # noqa: E402

VERSION_RE = re.compile(r"^V?\d+(\.\d+)*$")  # GUIDE.md §5:V1.0 或 1.0,写法全材料统一


def resolve(base_dir, p):
    return p if os.path.isabs(p) else os.path.join(base_dir, p)


def manifest_source_paths(manifest, base_dir):
    src = manifest.get("source", {})
    paths = src.get("selected_files") or src.get("dirs") or []
    return [resolve(base_dir, p) for p in paths]


def check_manifest_fields(manifest):
    """必填字段非空 + 名称/版本号规范(GUIDE.md §5)的机械检查。"""
    items = []
    sw = manifest.get("software", {})
    required = [
        ("software.full_name", sw.get("full_name")),
        ("software.version", sw.get("version")),
        ("dates.dev_complete", manifest.get("dates", {}).get("dev_complete")),
        ("applicant.copyright_owner", manifest.get("applicant", {}).get("copyright_owner")),
    ]
    for key, val in required:
        if not val:
            items.append({"level": "fail", "message": f"必填字段缺失或为空: {key}"})
    version = sw.get("version", "")
    if version and not VERSION_RE.match(version):
        items.append({"level": "warn", "message": f"版本号 {version!r} 不符合 V1.0/1.0 惯例写法"})
    short = sw.get("short_name", "")
    if short and short == sw.get("full_name"):
        items.append({"level": "fail", "message": "软件简称不得与全称完全相同(GUIDE.md §5)"})
    if not items:
        items.append({"level": "info", "message": "必填字段齐全,名称/版本号规范"})
    if any(i["level"] == "fail" for i in items):
        status = "fail"
    elif any(i["level"] == "warn" for i in items):
        status = "warn"
    else:
        status = "pass"
    return {"check": "manifest-fields", "status": status,
            "summary": f"{len([i for i in items if i['level'] != 'info'])} 个字段问题",
            "items": items, "data": {}}


def run_all(manifest_path, compare_with=()):
    with open(manifest_path, encoding="utf-8") as fh:
        manifest = json.load(fh)
    base_dir = os.path.dirname(os.path.abspath(manifest_path))
    results = [check_manifest_fields(manifest)]

    src_paths = manifest_source_paths(manifest, base_dir)
    if src_paths:
        results.append(check_source.run_check(src_paths))
    else:
        results.append({"check": "source-material", "status": "skip",
                        "summary": "manifest 未填 source.selected_files/dirs,跳过",
                        "items": [], "data": {}})

    desc_path = manifest.get("func_description_path")
    if desc_path and os.path.isfile(resolve(base_dir, desc_path)):
        with open(resolve(base_dir, desc_path), encoding="utf-8") as fh:
            results.append(check_func_desc.run_check(fh.read()))
    else:
        results.append({"check": "func-description", "status": "skip",
                        "summary": "manifest 未填 func_description_path 或文件不存在,跳过",
                        "items": [], "data": {}})

    dates = manifest.get("dates", {})
    if dates.get("dev_complete"):
        results.append(check_dates.run_check(
            dates["dev_complete"],
            first_publish=dates.get("first_publish"),
            apply_date=dates.get("apply_date"),
            company_established=dates.get("company_established")))
    else:
        results.append({"check": "date-logic", "status": "skip",
                        "summary": "manifest 未填 dates.dev_complete,跳过", "items": [], "data": {}})

    if compare_with:
        groups = [(manifest.get("application_name") or manifest_path, src_paths)]
        for other in compare_with:
            if other.endswith(".json"):
                with open(other, encoding="utf-8") as fh:
                    om = json.load(fh)
                groups.append((om.get("application_name") or other,
                               manifest_source_paths(om, os.path.dirname(os.path.abspath(other)))))
            else:
                groups.append((other, [other]))
        results.append(check_overlap.run_check(groups))

    overall = "fail" if any(r["status"] == "fail" for r in results) else \
              ("warn" if any(r["status"] == "warn" for r in results) else "pass")
    return {"check": "check-all", "status": overall,
            "manifest": manifest_path,
            "application_name": manifest.get("application_name", ""),
            "results": results}


def main(argv):
    as_json = "--json" in argv
    args = [a for a in argv if a != "--json"]
    manifest_path, compare_with = None, []
    i = 0
    while i < len(args):
        if args[i] == "--manifest" and i + 1 < len(args):
            manifest_path = args[i + 1]
            i += 2
        elif args[i] == "--compare-with" and i + 1 < len(args):
            compare_with.append(args[i + 1])
            i += 2
        else:
            print(__doc__.strip(), file=sys.stderr)
            return 2
    if not manifest_path:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    try:
        report = run_all(manifest_path, compare_with)
    except (OSError, ValueError, json.JSONDecodeError) as e:
        print(f"执行失败: {e}", file=sys.stderr)
        return 2
    if as_json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(f"== 软著材料自查 · {report['application_name'] or report['manifest']} ==")
        for r in report["results"]:
            print(f"[{r['status'].upper()}] {r['check']} — {r['summary']}")
            for it in r["items"]:
                print(f"  - ({it['level']}) {it['message']}")
        print(f"总体结论: {report['status'].upper()}")
    return 1 if report["status"] == "fail" else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
