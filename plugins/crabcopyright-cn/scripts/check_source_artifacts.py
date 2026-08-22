#!/usr/bin/env python3
"""Validate deterministic source-core outputs and their manifest bindings.

Usage:
    python3 check_source_artifacts.py --manifest <manifest.json> [--json]
"""

from __future__ import annotations

import json
import os
import sys
import zipfile
from pathlib import Path, PurePosixPath

from manifest_contract import PLUGIN_VERSION, RULES_VERSION, result, sha256_file, status_from_items

LINES_PER_PAGE = 50
MAX_PAGES = 60
UPSTREAM_COMMIT = "2e39375cf6891b9d958c277f1c6eb3b5104814d9"


def resolve(base_dir, value):
    return value if os.path.isabs(value) else os.path.join(base_dir, value)


def source_root(manifest, base_dir):
    value = manifest.get("source", {}).get("root", "")
    return os.path.realpath(resolve(base_dir, value)) if value else os.path.realpath(base_dir)


def source_path(manifest, base_dir, key):
    value = manifest.get("source", {}).get(key, "")
    return resolve(base_dir, value) if value else ""


def intermediate_path(manifest, base_dir, key):
    value = manifest.get("intermediates", {}).get(key, "")
    return resolve(base_dir, value) if value else ""


def portable_rel(value):
    if not isinstance(value, str) or not value or "\\" in value:
        return False
    path = PurePosixPath(value)
    return not path.is_absolute() and ".." not in path.parts and "" not in path.parts


def read_json(path):
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def check_regular(path, label, items):
    if not path:
        items.append({"level": "fail", "message": f"缺少 {label} 路径"})
        return False
    if os.path.islink(path):
        items.append({"level": "fail", "message": f"{label} 不得是符号链接: {path}"})
        return False
    if not os.path.isfile(path) or os.path.getsize(path) == 0:
        items.append({"level": "fail", "message": f"{label} 文件不存在或为空: {path}"})
        return False
    return True


def run_check(manifest_path):
    manifest = read_json(manifest_path)
    base_dir = os.path.dirname(os.path.abspath(manifest_path))
    source = manifest.get("source", {})
    selection_path = source_path(manifest, base_dir, "selection_path")
    audit_path = source_path(manifest, base_dir, "audit_path")
    line_map_path = source_path(manifest, base_dir, "line_map_path")
    pages_path = source_path(manifest, base_dir, "page_manifest_path")
    text_path = intermediate_path(manifest, base_dir, "source_text")
    docx_path = intermediate_path(manifest, base_dir, "source_docx")
    paths = {
        "selection": selection_path, "audit": audit_path, "lineMap": line_map_path,
        "pages": pages_path, "sourceText": text_path, "sourceDocx": docx_path,
    }
    labels = {
        "selection": "source-selection.json", "audit": "source-audit.json",
        "lineMap": "source-line-map.jsonl", "pages": "source-pages.json",
        "sourceText": "源代码材料.txt", "sourceDocx": "源代码材料.docx",
    }
    items = []
    valid = {key: check_regular(value, labels[key], items) for key, value in paths.items()}
    data = {"paths": paths, "hashes": {}}
    if not all(valid.values()):
        return result("source-core-artifacts", "fail", "确定性源码中间态不完整", items, data)

    try:
        selection = read_json(selection_path)
        audit = read_json(audit_path)
        pages_doc = read_json(pages_path)
    except (OSError, json.JSONDecodeError) as exc:
        items.append({"level": "fail", "message": f"源码中间态 JSON 无法解析: {exc}"})
        return result("source-core-artifacts", "fail", "JSON 解析失败", items, data)

    if selection.get("pluginVersion") != PLUGIN_VERSION:
        items.append({"level": "fail", "message": "source-selection pluginVersion 与当前插件不一致"})
    if selection.get("rulesVersion") != RULES_VERSION or audit.get("rulesVersion") != RULES_VERSION:
        items.append({"level": "fail", "message": "源码中间态 rulesVersion 与当前规则不一致"})
    if selection.get("upstream", {}).get("commit") != UPSTREAM_COMMIT:
        items.append({"level": "fail", "message": "源码中间态的 CodeSucker 上游 commit 不匹配"})

    selected_files = selection.get("selectedFiles", [])
    if not isinstance(selected_files, list) or not selected_files:
        items.append({"level": "fail", "message": "source-selection.selectedFiles 为空"})
    elif any(not portable_rel(value) for value in selected_files):
        items.append({"level": "fail", "message": "source-selection 包含绝对路径、反斜杠或父目录跳转"})
    manifest_selected = source.get("selected_files", [])
    if selected_files != manifest_selected:
        items.append({"level": "fail", "message": "manifest.source.selected_files 与 source-selection 不一致"})

    pages = pages_doc.get("pages", [])
    if pages_doc.get("linesPerPage") != LINES_PER_PAGE or pages_doc.get("maxPages") != MAX_PAGES:
        items.append({"level": "fail", "message": "source-pages 的分页常量不匹配"})
    if not isinstance(pages, list) or not pages or len(pages) > MAX_PAGES:
        items.append({"level": "fail", "message": f"source-pages 页数无效: {len(pages) if isinstance(pages, list) else '非数组'}"})
        pages = []
    for index, page in enumerate(pages):
        expected_no = index + 1
        if page.get("page") != expected_no:
            items.append({"level": "fail", "message": f"源码页码不连续: 期望 {expected_no}"})
        count = page.get("lineCount")
        is_last = index == len(pages) - 1
        if not isinstance(count, int) or count <= 0 or count > LINES_PER_PAGE:
            items.append({"level": "fail", "message": f"第 {expected_no} 页 lineCount 无效: {count}"})
        elif not is_last and count != LINES_PER_PAGE:
            items.append({"level": "fail", "message": f"第 {expected_no} 页不足 {LINES_PER_PAGE} 行"})
        for boundary in (page.get("start", {}), page.get("end", {})):
            if not portable_rel(boundary.get("file")):
                items.append({"level": "fail", "message": f"第 {expected_no} 页边界路径不可移植"})

    truncated = bool(selection.get("truncated"))
    picked_lines = selection.get("pickedLines")
    if truncated and (len(pages) != MAX_PAGES or picked_lines != LINES_PER_PAGE * MAX_PAGES):
        items.append({"level": "fail", "message": "截断模式必须恰好 60 页/3000 行"})

    line_records = []
    try:
        with open(line_map_path, encoding="utf-8") as handle:
            for line_no, line in enumerate(handle, 1):
                if line_no > LINES_PER_PAGE * MAX_PAGES:
                    items.append({"level": "fail", "message": "line map 超过 3000 条"})
                    break
                line_records.append(json.loads(line))
    except (OSError, json.JSONDecodeError) as exc:
        items.append({"level": "fail", "message": f"line map 无法解析: {exc}"})
    if isinstance(picked_lines, int) and len(line_records) != picked_lines:
        items.append({"level": "fail", "message": f"line map {len(line_records)} 条，与 pickedLines {picked_lines} 不一致"})
    for index, record in enumerate(line_records):
        if record.get("outputLine") != index + 1:
            items.append({"level": "fail", "message": f"line map outputLine 在 {index + 1} 处不连续"})
            break
        if not portable_rel(record.get("file")):
            items.append({"level": "fail", "message": f"line map 第 {index + 1} 条路径不可移植"})
            break

    with open(text_path, encoding="utf-8") as handle:
        text_lines = handle.read().splitlines()
    if isinstance(picked_lines, int) and len(text_lines) != picked_lines:
        items.append({"level": "fail", "message": f"源码文本 {len(text_lines)} 行，与 pickedLines {picked_lines} 不一致"})

    try:
        with zipfile.ZipFile(docx_path) as archive:
            names = set(archive.namelist())
            required_parts = {"word/document.xml", "word/header1.xml", "[Content_Types].xml"}
            missing = required_parts - names
            if missing:
                items.append({"level": "fail", "message": f"DOCX 缺少 OOXML 部件: {sorted(missing)}"})
            else:
                document = archive.read("word/document.xml")
                header = archive.read("word/header1.xml").decode("utf-8", errors="replace")
                breaks = document.count(b"w:pageBreakBefore")
                if pages and breaks != len(pages) - 1:
                    items.append({"level": "fail", "message": f"DOCX 显式分页 {breaks} 与页数 {len(pages)} 不一致"})
                title = f"{manifest.get('software', {}).get('full_name', '')} {manifest.get('software', {}).get('version', '')}".strip()
                if title and title not in header:
                    items.append({"level": "fail", "message": "DOCX 页眉未发现软件全称+版本号"})
                if "PAGE" not in header:
                    items.append({"level": "fail", "message": "DOCX 页眉缺少 PAGE 页码域"})
    except (OSError, zipfile.BadZipFile) as exc:
        items.append({"level": "fail", "message": f"DOCX 无法打开: {exc}"})

    hashes = {key: sha256_file(value) for key, value in paths.items()}
    data["hashes"] = hashes
    artifacts = manifest.get("artifacts", {})
    artifact_mapping = {"source_text": "sourceText", "source_docx": "sourceDocx", "source_audit": "audit"}
    selection_hash = hashes["selection"]
    pages_hash = hashes["pages"]
    for artifact_key, path_key in artifact_mapping.items():
        entry = artifacts.get(artifact_key)
        if not isinstance(entry, dict):
            items.append({"level": "fail", "message": f"manifest.artifacts.{artifact_key} 缺失"})
            continue
        if entry.get("sha256") != hashes[path_key]:
            items.append({"level": "fail", "message": f"artifact {artifact_key} SHA-256 已失效"})
        against = entry.get("validated_against", {})
        if against.get("rules_version") != RULES_VERSION or against.get("source_selection_sha256") != selection_hash or against.get("source_pages_sha256") != pages_hash:
            items.append({"level": "fail", "message": f"artifact {artifact_key} validated_against 已失效"})

    if audit.get("status") == "fail":
        items.append({"level": "fail", "message": "source-audit.json 含 fail 项"})
    elif audit.get("status") == "warn":
        items.append({"level": "warn", "message": "source-audit.json 含需人工复核的 warn 项"})

    root = source_root(manifest, base_dir)
    data.update({"source_root": root, "selected_files": selected_files, "pages": len(pages),
                 "picked_lines": picked_lines, "truncated": truncated})
    if not items:
        items.append({"level": "info", "message": "确定性源码中间态、行映射、DOCX 和哈希绑定通过"})
    status = status_from_items(items)
    return result("source-core-artifacts", status,
                  f"{len(selected_files)} 个文件 / {picked_lines or 0} 行 / {len(pages)} 页", items, data)


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
