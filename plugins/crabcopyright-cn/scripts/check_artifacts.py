#!/usr/bin/env python3
"""Check final PDF hashes and their binding to the current source/manual DOCX.

Usage:
    python3 check_artifacts.py --manifest <manifest.json> [--json]
"""

from __future__ import annotations

import json
import sys
from pathlib import Path, PurePosixPath

from manifest_contract import RULES_VERSION, contained_path, result, sha256_file, status_from_items

KINDS = {
    "source_pdf": ("02-源代码鉴别材料.pdf", "source_docx", "source_docx_sha256"),
    "manual_pdf": ("03-说明书鉴别材料.pdf", None, "manual_docx_sha256"),
}


def portable(value):
    if not isinstance(value, str) or not value or "\\" in value:
        return False
    path = PurePosixPath(value)
    return not path.is_absolute() and ".." not in path.parts


def file_hash(base_dir, value, label, items):
    if not portable(value):
        items.append({"level": "fail", "message": f"{label} 路径必须是申请目录内的可移植相对路径"})
        return ""
    try:
        path = contained_path(base_dir, value, kind="file")
    except (OSError, ValueError) as exc:
        items.append({"level": "fail", "message": f"{label} 文件不存在、越界或为符号链接: {value}（{exc}）"})
        return ""
    return sha256_file(path)


def run_check(manifest_path):
    with open(manifest_path, encoding="utf-8") as handle:
        manifest = json.load(handle)
    base_dir = Path(manifest_path).resolve().parent
    artifacts = manifest.get("artifacts", {})
    materials = manifest.get("materials", {})
    items = []
    data = {}

    source_docx = artifacts.get("source_docx")
    source_docx_hash = ""
    if not isinstance(source_docx, dict):
        items.append({"level": "fail", "message": "缺少 artifacts.source_docx"})
    else:
        source_docx_hash = file_hash(base_dir, source_docx.get("path"), "source_docx", items)
        if source_docx_hash and source_docx.get("sha256") != source_docx_hash:
            items.append({"level": "fail", "message": "source_docx SHA-256 已失效"})

    manual_value = manifest.get("intermediates", {}).get("manual_docx", "")
    manual_docx_hash = file_hash(base_dir, manual_value, "manual_docx", items) if manual_value else ""
    if not manual_value:
        items.append({"level": "fail", "message": "缺少 intermediates.manual_docx"})

    for kind, (material_name, _, source_field) in KINDS.items():
        entry = artifacts.get(kind)
        if not isinstance(entry, dict):
            items.append({"level": "fail", "message": f"缺少 artifacts.{kind}"})
            continue
        actual = file_hash(base_dir, entry.get("path"), kind, items)
        if actual and entry.get("sha256") != actual:
            items.append({"level": "fail", "message": f"{kind} SHA-256 已失效"})
        against = entry.get("validated_against", {})
        expected_source = source_docx_hash if kind == "source_pdf" else manual_docx_hash
        if against.get("rules_version") != RULES_VERSION or against.get(source_field) != expected_source:
            items.append({"level": "fail", "message": f"{kind} 未绑定当前 {source_field}/rules_version"})
        material = materials.get(material_name)
        if not isinstance(material, dict) or material.get("path") != entry.get("path") or material.get("status") != "✅":
            items.append({"level": "fail", "message": f"materials[{material_name}] 与 artifacts.{kind} 不一致"})
        data[kind] = {"path": entry.get("path"), "sha256": actual}

    if not items:
        items.append({"level": "info", "message": "最终源码/说明书 PDF 均绑定当前 DOCX 与规则版本"})
    status = status_from_items(items)
    return result("artifact-bindings", status,
                  f"{len([item for item in items if item['level'] != 'info'])} 个产物绑定问题", items, data)


def main(argv):
    as_json = "--json" in argv
    args = [arg for arg in argv if arg != "--json"]
    if len(args) != 2 or args[0] != "--manifest":
        print(__doc__.strip(), file=sys.stderr)
        return 2
    try:
        report = run_check(args[1])
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"执行失败: {exc}", file=sys.stderr)
        return 2
    if as_json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(f"[{report['status'].upper()}] {report['check']} — {report['summary']}")
        for item in report["items"]:
            print(f"  - ({item['level']}) {item['message']}")
    return 1 if report["status"] == "fail" else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
