#!/usr/bin/env python3
"""Validate manifest v2 structural and privacy invariants with stdlib only.

Usage:
    python3 check_manifest.py --manifest <manifest.json> [--json]
"""

from __future__ import annotations

import json
import sys
from pathlib import PurePosixPath

from manifest_contract import (
    PLUGIN_VERSION, RULES_VERIFIED_AT, RULES_VERSION, SCHEMA_VERSION,
    result, status_from_items,
)

REQUIRED_TOP = {
    "schema_version", "plugin_version", "rules_version", "rules_verified_at",
    "application_name", "software", "applicant", "dates", "source", "manual",
    "ai_assistance", "materials", "steps",
}
PROCESSING = {
    "remove_comments": bool,
    "remove_blank_lines": bool,
    "mask_sensitive": bool,
    "wrap_long_lines": bool,
    "max_line_width": int,
    "tab_width": int,
}
MATERIAL_STATES = {"✅", "❌", "⚠️"}
STEP_STATES = {"pending", "in_progress", "done", "blocked"}
PII_KEYS = {"id_number", "id_card", "idcard", "身份证号", "身份证号码"}


def portable_source_rel(value):
    if not isinstance(value, str) or not value or "\\" in value:
        return False
    path = PurePosixPath(value)
    return not path.is_absolute() and ".." not in path.parts


def find_pii_keys(value, prefix=""):
    findings = []
    if isinstance(value, dict):
        for key, child in value.items():
            current = f"{prefix}.{key}" if prefix else key
            if str(key).lower() in PII_KEYS or any(token in str(key).lower() for token in ("id_number", "idcard")):
                if child is not None and child != "":
                    findings.append(current)
            findings.extend(find_pii_keys(child, current))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            findings.extend(find_pii_keys(child, f"{prefix}[{index}]"))
    return findings


def run_check(manifest):
    items = []
    if not isinstance(manifest, dict):
        return result("manifest-schema", "fail", "manifest 顶层不是对象",
                      [{"level": "fail", "message": "manifest 顶层必须是对象"}], {})
    missing = sorted(REQUIRED_TOP - set(manifest))
    if missing:
        items.append({"level": "fail", "message": f"manifest 缺顶层字段: {', '.join(missing)}"})
    for key, actual, expected in (
        ("schema_version", manifest.get("schema_version"), SCHEMA_VERSION),
        ("plugin_version", manifest.get("plugin_version"), PLUGIN_VERSION),
        ("rules_version", manifest.get("rules_version"), RULES_VERSION),
        ("rules_verified_at", manifest.get("rules_verified_at"), RULES_VERIFIED_AT),
    ):
        if actual != expected:
            items.append({"level": "fail", "message": f"{key}={actual!r}，预期 {expected!r}"})

    source = manifest.get("source")
    if not isinstance(source, dict):
        items.append({"level": "fail", "message": "source 必须是对象"})
        source = {}
    if not source.get("root"):
        items.append({"level": "fail", "message": "source.root 不能为空"})
    if source.get("scope_confirmed") is not True:
        items.append({"level": "fail", "message": "source.scope_confirmed 必须由申请人确认为 true"})
    dirs = source.get("dirs")
    if not isinstance(dirs, list) or not dirs or any(value != "." and not portable_source_rel(value) for value in dirs):
        items.append({"level": "fail", "message": "source.dirs 必须是非空、源码根相对 POSIX 路径数组"})
    for key in ("include_files", "selected_files"):
        values = source.get(key)
        if not isinstance(values, list) or any(not portable_source_rel(value) for value in values):
            items.append({"level": "fail", "message": f"source.{key} 必须是源码根相对 POSIX 路径数组"})
    processing = source.get("processing")
    if not isinstance(processing, dict):
        items.append({"level": "fail", "message": "source.processing 必须是对象"})
    else:
        for key, expected_type in PROCESSING.items():
            value = processing.get(key)
            if type(value) is not expected_type:
                items.append({"level": "fail", "message": f"source.processing.{key} 类型无效"})
        if isinstance(processing.get("max_line_width"), int) and not 40 <= processing["max_line_width"] <= 240:
            items.append({"level": "fail", "message": "max_line_width 必须为 40–240"})
        if isinstance(processing.get("tab_width"), int) and not 1 <= processing["tab_width"] <= 16:
            items.append({"level": "fail", "message": "tab_width 必须为 1–16"})

    for name, entry in manifest.get("materials", {}).items() if isinstance(manifest.get("materials"), dict) else []:
        if not isinstance(entry, dict) or entry.get("status") not in MATERIAL_STATES or not isinstance(entry.get("path", ""), str):
            items.append({"level": "fail", "message": f"materials[{name}] 结构或 status 无效"})
    for name, entry in manifest.get("steps", {}).items() if isinstance(manifest.get("steps"), dict) else []:
        if not isinstance(entry, dict) or entry.get("status") not in STEP_STATES:
            items.append({"level": "fail", "message": f"steps[{name}] 结构或 status 无效"})

    pii = find_pii_keys(manifest)
    if pii:
        items.append({"level": "fail", "message": f"manifest 不得保存身份证号字段: {pii}"})
    if not items:
        items.append({"level": "info", "message": "manifest v2 结构、路径与隐私字段通过"})
    status = status_from_items(items)
    return result("manifest-schema", status,
                  f"{len([item for item in items if item['level'] != 'info'])} 个结构/隐私问题", items,
                  {"schema_version": manifest.get("schema_version"), "rules_version": manifest.get("rules_version")})


def main(argv):
    as_json = "--json" in argv
    args = [arg for arg in argv if arg != "--json"]
    if len(args) != 2 or args[0] != "--manifest":
        print(__doc__.strip(), file=sys.stderr)
        return 2
    try:
        with open(args[1], encoding="utf-8") as handle:
            manifest = json.load(handle)
        report = run_check(manifest)
    except (OSError, json.JSONDecodeError) as exc:
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
