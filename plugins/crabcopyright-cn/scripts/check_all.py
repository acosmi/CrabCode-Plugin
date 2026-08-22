#!/usr/bin/env python3
"""软著申请材料确定性校验总入口。

读取 outputs/<申请名>/manifest.json(结构见 apply-core/MANIFEST.md),依次执行:
manifest 必填字段与名称版本规范检查 → 必交材料存在性检查 → 源码行数/页数/注水检查
→ 源码选择完整性检查 → 功能说明字数检查 → 说明书中间态结构检查 → PDF 成品基础验收
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
import check_ai  # noqa: E402
import check_artifacts  # noqa: E402
import check_func_desc  # noqa: E402
import check_manual  # noqa: E402
import check_manifest  # noqa: E402
import check_materials  # noqa: E402
import check_overlap  # noqa: E402
import check_pdf  # noqa: E402
import check_rules  # noqa: E402
import check_source   # noqa: E402
import check_source_artifacts  # noqa: E402
from manifest_contract import (  # noqa: E402
    PLUGIN_VERSION,
    RULES_VERIFIED_AT,
    RULES_VERSION,
    SCHEMA_VERSION,
)

VERSION_RE = re.compile(r"^V?\d+(\.\d+)*$")  # GUIDE.md §5:V1.0 或 1.0,写法全材料统一


def resolve(base_dir, p):
    return p if os.path.isabs(p) else os.path.join(base_dir, p)


def manifest_source_paths(manifest, base_dir):
    src = manifest.get("source", {})
    paths = src.get("selected_files") or src.get("dirs") or []
    root_value = src.get("root", "")
    root_dir = resolve(base_dir, root_value) if root_value else base_dir
    return [resolve(root_dir, p) for p in paths]


def material_path(manifest, base_dir, key):
    entry = manifest.get("materials", {}).get(key, {})
    if not isinstance(entry, dict) or not entry.get("path"):
        return ""
    return resolve(base_dir, entry["path"])


def result(check, status, summary, items=None, data=None):
    return {"check": check, "status": status, "summary": summary,
            "items": items or [], "data": data or {}}


def check_manifest_fields(manifest):
    """必填字段非空 + 名称/版本号规范(GUIDE.md §5)的机械检查。"""
    items = []
    sw = manifest.get("software", {})
    required = [
        ("application_name", manifest.get("application_name")),
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
    for key, actual, expected in (
        ("schema_version", manifest.get("schema_version"), SCHEMA_VERSION),
        ("plugin_version", manifest.get("plugin_version"), PLUGIN_VERSION),
        ("rules_version", manifest.get("rules_version"), RULES_VERSION),
        ("rules_verified_at", manifest.get("rules_verified_at"), RULES_VERIFIED_AT),
    ):
        if actual != expected:
            items.append({
                "level": "fail",
                "message": f"{key}={actual!r}，预期 {expected!r}；请先运行 migrate_manifest.py",
            })
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


def check_source_selection(manifest, base_dir):
    """核验入选源码是否满足 60 页规则;不足 60 页时必须覆盖全部源码。"""
    src = manifest.get("source", {})
    root_value = src.get("root", "")
    root_dir = resolve(base_dir, root_value) if root_value else base_dir
    dirs = [resolve(root_dir, p) for p in src.get("dirs", [])]
    selected = [resolve(root_dir, p) for p in src.get("selected_files", [])]
    items = []
    data = {"dirs": dirs, "selected_files": selected}

    if not dirs:
        return result("source-selection", "fail", "manifest.source.dirs 为空",
                      [{"level": "fail", "message": "缺少 source.dirs,无法判断是否已覆盖全部可提交源码"}], data)

    try:
        all_files = check_source.collect_files(dirs)
        selected_files = check_source.collect_files(selected) if selected else []
        all_result = check_source.run_check(dirs)
        selected_result = check_source.run_check(selected) if selected else all_result
    except OSError as exc:
        return result("source-selection", "fail", "源码路径无法读取",
                      [{"level": "fail", "message": f"源码路径无法读取: {exc}"}], data)
    all_total = all_result["data"]["total_lines"]
    selected_total = selected_result["data"]["total_lines"]
    data.update({"all_total_lines": all_total, "selected_total_lines": selected_total,
                 "all_file_count": len(all_files), "selected_file_count": len(selected_files)})

    if not selected:
        items.append({"level": "warn", "message": "未填写 source.selected_files,将 source.dirs 视为提交范围"})
    if all_total >= check_source.REQUIRED_LINES and selected_total < check_source.REQUIRED_LINES:
        items.append({"level": "fail",
                      "message": f"源码目录共有 {all_total} 行,足够组成 60 页,但入选材料仅 {selected_total} 行"})
    if all_total < check_source.REQUIRED_LINES and selected:
        all_set = {os.path.abspath(p) for p in all_files}
        selected_set = {os.path.abspath(p) for p in selected_files}
        missing = sorted(all_set - selected_set)
        if missing:
            items.append({"level": "fail",
                          "message": f"源码总行数不足 3000 时应提交全部代码,但入选文件遗漏 {len(missing)} 个"})
            data["missing_when_submit_all"] = missing[:50]
    if not items:
        items.append({"level": "info", "message": "源码选择满足 60 页/不足则全部提交规则"})

    if any(i["level"] == "fail" for i in items):
        status = "fail"
    elif any(i["level"] == "warn" for i in items):
        status = "warn"
    else:
        status = "pass"
    return result("source-selection", status,
                  f"源码目录 {all_total} 行 / 入选 {selected_total} 行", items, data)


def check_final_pdfs(manifest, base_dir):
    sw = manifest.get("software", {})
    name = sw.get("full_name", "")
    version = sw.get("version", "")
    results = []

    source_pdf = material_path(manifest, base_dir, "02-源代码鉴别材料.pdf")
    if source_pdf:
        source = manifest.get("source", {})
        total_lines = source.get("effective_lines") or source.get("total_lines") or 0
        if not total_lines:
            try:
                src_paths = manifest_source_paths(manifest, base_dir)
                total_lines = check_source.run_check(src_paths)["data"]["total_lines"] if src_paths else 0
            except OSError:
                total_lines = 0
        expected_pages = 60 if total_lines >= check_source.REQUIRED_LINES else None
        results.append(check_pdf.run_check(source_pdf, name, version, kind="source",
                                           expected_pages=expected_pages, max_pages=60))
    else:
        results.append(result("pdf-final:source", "fail", "源代码鉴别材料 PDF 路径为空",
                              [{"level": "fail", "message": "materials['02-源代码鉴别材料.pdf'].path 为空"}]))

    manual_pdf = material_path(manifest, base_dir, "03-说明书鉴别材料.pdf")
    if manual_pdf:
        # 文档不足 60 页交全部;超过 60 页通常是封面 + 前后 30 页,故给 61 页上限。
        results.append(check_pdf.run_check(manual_pdf, name, version, kind="manual", max_pages=61))
    else:
        results.append(result("pdf-final:manual", "fail", "说明书鉴别材料 PDF 路径为空",
                              [{"level": "fail", "message": "materials['03-说明书鉴别材料.pdf'].path 为空"}]))
    return results


def run_all(manifest_path, compare_with=()):
    with open(manifest_path, encoding="utf-8") as fh:
        manifest = json.load(fh)
    base_dir = os.path.dirname(os.path.abspath(manifest_path))
    results = [check_manifest.run_check(manifest), check_manifest_fields(manifest)]
    results.append(check_rules.run_check())
    results.append(check_ai.run_check(manifest))
    results.append(check_materials.run_check(manifest_path))

    src_paths = manifest_source_paths(manifest, base_dir)
    if src_paths:
        raw_result = check_source.run_check(src_paths)
        raw_result["check"] = "source-raw-risk"
        raw_result["summary"] = "原始源码补充风险统计(最终页数以 source-core artifacts 为准): " + raw_result["summary"]
        results.append(raw_result)
    else:
        results.append(result("source-raw-risk", "fail",
                              "manifest 未填 source.selected_files/dirs",
                              [{"level": "fail", "message": "缺少源码目录或入选文件,无法生成源程序鉴别材料"}]))

    has_core = all(manifest.get("source", {}).get(key) for key in (
        "selection_path", "audit_path", "line_map_path", "page_manifest_path"
    ))
    if has_core:
        results.append(check_source_artifacts.run_check(manifest_path))
    else:
        results.append(result("source-core-artifacts", "fail",
                              "缺少确定性 source-core 中间态",
                              [{"level": "fail", "message": "请先运行 dist/source-core.js generate --manifest <manifest.json>"}]))

    desc_path = manifest.get("func_description_path")
    if desc_path and os.path.isfile(resolve(base_dir, desc_path)):
        with open(resolve(base_dir, desc_path), encoding="utf-8") as fh:
            results.append(check_func_desc.run_check(fh.read()))
    else:
        results.append(result("func-description", "fail",
                              "manifest 未填 func_description_path 或文件不存在",
                              [{"level": "fail", "message": "2026 新版申请表需要 500–1300 字主要功能说明"}]))

    results.append(check_manual.run_manifest(manifest_path))
    results.append(check_artifacts.run_check(manifest_path))
    results.extend(check_final_pdfs(manifest, base_dir))

    dates = manifest.get("dates", {})
    if dates.get("dev_complete"):
        results.append(check_dates.run_check(
            dates["dev_complete"],
            first_publish=dates.get("first_publish"),
            apply_date=dates.get("apply_date"),
            company_established=dates.get("company_established")))
    else:
        results.append(result("date-logic", "fail",
                              "manifest 未填 dates.dev_complete",
                              [{"level": "fail", "message": "缺少开发完成日期,申请表无法提交"}]))

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
              ("warn" if any(r["status"] in {"warn", "skip"} for r in results) else "pass")
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
