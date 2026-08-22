#!/usr/bin/env python3
"""Migrate a crabcopyright-cn application manifest to schema v2.

Default mode prints migrated JSON to stdout without writing.

Usage:
    python3 migrate_manifest.py <manifest.json>
    python3 migrate_manifest.py <manifest.json> --out <new.json>
    python3 migrate_manifest.py <manifest.json> --in-place [--backup-suffix .v1.bak]
"""

from __future__ import annotations

import copy
import json
import os
import shutil
import sys
from pathlib import Path

from manifest_contract import (
    PLUGIN_VERSION,
    RULES_VERIFIED_AT,
    RULES_VERSION,
    SCHEMA_VERSION,
    atomic_write_json,
)


def migrate(value):
    if not isinstance(value, dict):
        raise ValueError("manifest 顶层必须是对象")
    version = value.get("schema_version", 1)
    if version not in {1, 2}:
        raise ValueError(f"不支持的 schema_version: {version!r}")
    result = copy.deepcopy(value)
    result["schema_version"] = SCHEMA_VERSION
    result["plugin_version"] = PLUGIN_VERSION
    result["rules_version"] = RULES_VERSION
    result["rules_verified_at"] = RULES_VERIFIED_AT

    source = result.setdefault("source", {})
    source.setdefault("root", "")
    source.setdefault("dirs", [])
    source.setdefault("include_files", [])
    source.setdefault("selected_files", [])
    source.setdefault("scope_confirmed", False)
    source.setdefault("processing", {
        "remove_comments": True,
        "remove_blank_lines": True,
        "mask_sensitive": True,
        "wrap_long_lines": True,
        "max_line_width": 78,
        "tab_width": 4,
    })
    source.setdefault("effective_lines", 0)
    source.setdefault("selection_path", "")
    source.setdefault("audit_path", "")
    source.setdefault("line_map_path", "")
    source.setdefault("page_manifest_path", "")

    result.setdefault("manual", {"source_path": "", "doc_type": "用户手册", "screenshot_plan": []})
    result.setdefault("materials", {})
    result.setdefault("steps", {})
    result.setdefault("artifacts", {})
    result.setdefault("audit_log_path", "audit-log.jsonl")
    result.setdefault("ai_assistance", {
        "code": "unknown",
        "manual": "unknown",
        "application_materials": "unknown",
        "current_workflow_used_ai": False,
        "provenance": [],
        "applicant_acknowledged": False,
    })
    return result


def parse_args(argv):
    if not argv:
        raise ValueError("缺少 manifest 路径")
    source = argv[0]
    output = None
    in_place = False
    backup_suffix = ".v1.bak"
    i = 1
    while i < len(argv):
        if argv[i] == "--out" and i + 1 < len(argv):
            output = argv[i + 1]
            i += 2
        elif argv[i] == "--in-place":
            in_place = True
            i += 1
        elif argv[i] == "--backup-suffix" and i + 1 < len(argv):
            backup_suffix = argv[i + 1]
            i += 2
        else:
            raise ValueError(f"未知或不完整参数: {argv[i]}")
    if in_place and output:
        raise ValueError("--in-place 与 --out 不能同时使用")
    if not backup_suffix or os.path.sep in backup_suffix:
        raise ValueError("--backup-suffix 必须是简单文件名后缀")
    return Path(source), Path(output) if output else None, in_place, backup_suffix


def main(argv):
    try:
        source, output, in_place, backup_suffix = parse_args(argv)
        if source.is_symlink():
            raise ValueError(f"拒绝读取符号链接 manifest: {source}")
        with source.open(encoding="utf-8") as handle:
            original = json.load(handle)
        migrated = migrate(original)
        if in_place:
            backup = source.with_name(source.name + backup_suffix)
            if backup.exists():
                raise ValueError(f"备份文件已存在，拒绝覆盖: {backup}")
            shutil.copy2(source, backup, follow_symlinks=False)
            atomic_write_json(source, migrated)
            print(f"已迁移: {source}\n备份: {backup}")
        elif output:
            atomic_write_json(output, migrated)
            print(f"已写入: {output}")
        else:
            print(json.dumps(migrated, ensure_ascii=False, indent=2))
        return 0
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"迁移失败: {exc}", file=sys.stderr)
        print(__doc__.strip(), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
