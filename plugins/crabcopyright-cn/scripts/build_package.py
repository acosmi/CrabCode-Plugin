#!/usr/bin/env python3
"""Create a submission-only whitelist directory after all deterministic gates.

Usage:
    python3 build_package.py --manifest <manifest.json>
        [--compare-with <other-manifest-or-source>]...
        [--allow-warn --review-note <human review note>]
        [--out <new-directory>]

The target must not already exist. This script never deletes/replaces an existing package.
"""

from __future__ import annotations

import datetime as dt
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path

import check_all
from manifest_contract import atomic_write_json, contained_path

REQUIRED = [
    "01-软件著作权登记申请表.pdf",
    "02-源代码鉴别材料.pdf",
    "03-说明书鉴别材料.pdf",
    "04-身份证明文件.pdf",
]
OPTIONAL = "05-其他材料"


def parse_args(argv):
    opts = {"compare": [], "allow_warn": False, "review_note": "", "out": ""}
    i = 0
    while i < len(argv):
        if argv[i] == "--manifest" and i + 1 < len(argv):
            opts["manifest"] = argv[i + 1]
            i += 2
        elif argv[i] == "--compare-with" and i + 1 < len(argv):
            opts["compare"].append(argv[i + 1])
            i += 2
        elif argv[i] == "--allow-warn":
            opts["allow_warn"] = True
            i += 1
        elif argv[i] == "--review-note" and i + 1 < len(argv):
            opts["review_note"] = argv[i + 1].strip()
            i += 2
        elif argv[i] == "--out" and i + 1 < len(argv):
            opts["out"] = argv[i + 1]
            i += 2
        else:
            raise ValueError(f"未知或不完整参数: {argv[i]}")
    if "manifest" not in opts:
        raise ValueError("缺少 --manifest")
    if opts["allow_warn"] and not opts["review_note"]:
        raise ValueError("--allow-warn 必须同时提供 --review-note")
    return opts


def contained(base, value, expected_type="file"):
    if not isinstance(value, str) or not value or os.path.isabs(value) or ".." in Path(value).parts:
        raise ValueError(f"材料路径必须是申请目录内的相对路径: {value!r}")
    return contained_path(base, value, kind=expected_type)


def copy_tree_no_links(source, target):
    target.mkdir(parents=True)
    count = 0
    for root, dirs, files in os.walk(source, followlinks=False):
        rel = Path(root).relative_to(source)
        dirs[:] = sorted(dirs)
        for name in dirs:
            if (Path(root) / name).is_symlink():
                raise ValueError(f"补充材料目录含符号链接: {Path(root) / name}")
        for name in sorted(files):
            item = Path(root) / name
            if item.is_symlink() or not item.is_file():
                raise ValueError(f"补充材料含符号链接/特殊文件: {item}")
            count += 1
            if count > 200:
                raise ValueError("补充材料文件超过 200 个，拒绝无界复制")
            destination = target / rel / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(item, destination, follow_symlinks=False)


def render_report(report, review_note):
    lines = [
        f"# 软著申请材料自查对照表 · {report.get('application_name') or report.get('manifest')}",
        "",
        f"> 总体结论：{report['status'].upper()}；机器结果不得替代申请人真实性确认。",
    ]
    if review_note:
        lines += [f"> WARN 人工复核记录：{review_note}"]
    lines += [""]
    for section in report["results"]:
        lines += [f"## {section['check']} · {section['status'].upper()}", "", section.get("summary", ""), ""]
        for item in section.get("items", []):
            mark = "❌" if item.get("level") in {"fail", "blocked"} else "⚠️" if item.get("level") == "warn" else "✅"
            lines.append(f"- {mark} {item.get('message', '')}")
        lines.append("")
    lines += [
        "## 提交白名单",
        "",
        "提交件目录仅含 01–04 PDF 及适用的 05-其他材料；manifest、中间态、line map、audit log、本机路径和测试文件未复制。",
        "",
    ]
    return "\n".join(lines)


def append_log(base, manifest, event):
    log_path = contained_path(base, manifest.get("audit_log_path") or "audit-log.jsonl",
                              kind=None, allow_missing=True)
    with log_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps({"timestamp": dt.datetime.now(dt.timezone.utc).isoformat(), **event}, ensure_ascii=False) + "\n")


def atomic_write_text(path, value):
    if path.is_symlink():
        raise ValueError(f"拒绝覆盖符号链接报告: {path}")
    fd, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(value)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_name, path)
    except Exception:
        try:
            os.unlink(temp_name)
        except FileNotFoundError:
            pass
        raise


def main(argv):
    try:
        opts = parse_args(argv)
        manifest_input = Path(opts["manifest"])
        if manifest_input.is_symlink():
            raise ValueError("manifest 不得是符号链接")
        manifest_path = manifest_input.resolve(strict=True)
        base = manifest_path.parent
        with manifest_path.open(encoding="utf-8") as handle:
            manifest = json.load(handle)
        report = check_all.run_all(str(manifest_path), opts["compare"])
        if report["status"] == "fail":
            raise ValueError("check_all 总体 FAIL，拒绝生成提交件")
        if report["status"] == "warn" and not opts["allow_warn"]:
            raise ValueError("check_all 含 WARN；人工复核后使用 --allow-warn --review-note 明确记录")

        target = contained_path(base, opts["out"] or "提交件", kind=None, allow_missing=True)
        if target.exists():
            raise ValueError(f"提交件目录已存在，拒绝覆盖/删除: {target}")
        stage = Path(tempfile.mkdtemp(prefix=".提交件-", dir=base))
        try:
            materials = manifest.get("materials", {})
            for name in REQUIRED:
                entry = materials.get(name)
                if not isinstance(entry, dict):
                    raise ValueError(f"manifest 缺材料: {name}")
                source = contained(base, entry.get("path"), "file")
                shutil.copy2(source, stage / name, follow_symlinks=False)
            other = materials.get(OPTIONAL)
            if isinstance(other, dict) and other.get("status") == "✅" and other.get("path"):
                copy_tree_no_links(contained(base, other["path"], "dir"), stage / OPTIONAL)
            os.replace(stage, target)
        except Exception:
            shutil.rmtree(stage, ignore_errors=True)
            raise

        report_path = base / "材料自查对照表.md"
        atomic_write_text(report_path, render_report(report, opts["review_note"]))
        steps = manifest.setdefault("steps", {})
        steps["package-build"] = {"status": "done", "updated_at": dt.datetime.now(dt.timezone.utc).isoformat()}
        atomic_write_json(manifest_path, manifest)
        append_log(base, manifest, {"event": "package.build", "path": target.relative_to(base).as_posix(),
                                    "check_status": report["status"], "review_note": opts["review_note"]})
        print(json.dumps({"status": "done", "package": str(target), "report": str(report_path)}, ensure_ascii=False, indent=2))
        return 0
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"打包失败: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
