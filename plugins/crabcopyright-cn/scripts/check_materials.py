#!/usr/bin/env python3
"""软著申请包材料存在性校验。

第一性原理:平台最终受理的是一组文件,所以自查不能只看 manifest 字段。
本脚本核对必交材料是否登记在 manifest.materials 中、状态是否为已完成、路径是否存在。

用法:
    python3 check_materials.py --manifest outputs/<申请名>/manifest.json [--json]
"""
import json
import os
import sys

REQUIRED_FILES = [
    "01-软件著作权登记申请表.pdf",
    "02-源代码鉴别材料.pdf",
    "03-说明书鉴别材料.pdf",
    "04-身份证明文件.pdf",
]

OPTIONAL_DIR = "05-其他材料"
DONE = "✅"

SUPPLEMENT_REQUIRED_METHODS = {
    "合作", "合作开发", "委托", "委托开发", "下达任务", "下达任务开发",
    "继受", "继受取得", "二次开发", "修改", "受让", "继承",
}


def resolve(base_dir, path):
    return path if os.path.isabs(path) else os.path.join(base_dir, path)


def status_of(entry):
    return entry.get("status", "") if isinstance(entry, dict) else ""


def path_of(entry):
    return entry.get("path", "") if isinstance(entry, dict) else ""


def supplemental_required(manifest):
    applicant = manifest.get("applicant", {})
    dev_method = applicant.get("dev_method", "")
    acquisition = applicant.get("acquisition", "")
    if acquisition == "继受取得":
        return True
    return any(token in dev_method for token in SUPPLEMENT_REQUIRED_METHODS)


def run_check(manifest_path):
    with open(manifest_path, encoding="utf-8") as fh:
        manifest = json.load(fh)
    base_dir = os.path.dirname(os.path.abspath(manifest_path))
    materials = manifest.get("materials", {})
    items = []
    data = {"files": []}

    for name in REQUIRED_FILES:
        entry = materials.get(name)
        if not isinstance(entry, dict):
            items.append({"level": "fail", "message": f"必交材料未登记在 manifest.materials: {name}"})
            data["files"].append({"name": name, "status": "missing-entry", "path": ""})
            continue
        rel_path = path_of(entry)
        state = status_of(entry)
        if state != DONE:
            items.append({"level": "fail", "message": f"必交材料状态不是已完成: {name} status={state or '空'}"})
        if not rel_path:
            items.append({"level": "fail", "message": f"必交材料路径为空: {name}"})
            data["files"].append({"name": name, "status": state, "path": ""})
            continue
        abs_path = resolve(base_dir, rel_path)
        exists = os.path.isfile(abs_path)
        if not exists:
            items.append({"level": "fail", "message": f"必交材料文件不存在: {name} -> {abs_path}"})
        elif os.path.getsize(abs_path) == 0:
            items.append({"level": "fail", "message": f"必交材料文件为空: {name} -> {abs_path}"})
        elif not abs_path.lower().endswith(".pdf"):
            items.append({"level": "warn", "message": f"必交材料不是 PDF 后缀,请确认平台是否接受: {name} -> {abs_path}"})
        data["files"].append({"name": name, "status": state, "path": abs_path, "exists": exists})

    other = materials.get(OPTIONAL_DIR)
    needs_other = supplemental_required(manifest)
    if needs_other:
        if not isinstance(other, dict):
            items.append({"level": "fail", "message": "当前开发/取得方式需要补充证明,但 manifest.materials 缺少 05-其他材料"})
        else:
            rel_path = path_of(other)
            state = status_of(other)
            if state != DONE:
                items.append({"level": "fail", "message": f"当前情形需要补充证明,05-其他材料状态不是已完成: {state or '空'}"})
            if not rel_path:
                items.append({"level": "fail", "message": "当前情形需要补充证明,05-其他材料路径为空"})
            else:
                abs_path = resolve(base_dir, rel_path)
                if not os.path.exists(abs_path):
                    items.append({"level": "fail", "message": f"05-其他材料路径不存在: {abs_path}"})
                elif os.path.isdir(abs_path) and not os.listdir(abs_path):
                    items.append({"level": "fail", "message": f"05-其他材料目录为空: {abs_path}"})
    elif isinstance(other, dict) and path_of(other):
        abs_path = resolve(base_dir, path_of(other))
        if status_of(other) == DONE and not os.path.exists(abs_path):
            items.append({"level": "warn", "message": f"05-其他材料标为已完成但路径不存在: {abs_path}"})

    if not items:
        items.append({"level": "info", "message": "必交材料均已登记且路径存在"})

    if any(i["level"] == "fail" for i in items):
        status = "fail"
    elif any(i["level"] == "warn" for i in items):
        status = "warn"
    else:
        status = "pass"

    return {
        "check": "materials-existence",
        "status": status,
        "summary": f"{len([i for i in items if i['level'] != 'info'])} 个材料存在性问题",
        "items": items,
        "data": data,
    }


def print_report(result):
    print(f"[{result['status'].upper()}] {result['check']} — {result['summary']}")
    for item in result["items"]:
        print(f"  - ({item['level']}) {item['message']}")


def main(argv):
    as_json = "--json" in argv
    args = [a for a in argv if a != "--json"]
    if len(args) != 2 or args[0] != "--manifest":
        print(__doc__.strip(), file=sys.stderr)
        return 2
    try:
        result = run_check(args[1])
    except (OSError, json.JSONDecodeError) as exc:
        print(f"执行失败: {exc}", file=sys.stderr)
        return 2
    if as_json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print_report(result)
    return 1 if result["status"] == "fail" else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
