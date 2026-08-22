#!/usr/bin/env python3
"""Shared manifest/rule constants and safe file helpers for crabcopyright-cn."""

from __future__ import annotations

import hashlib
import json
import os
import tempfile
from pathlib import Path

SCHEMA_VERSION = 2
PLUGIN_VERSION = "0.3.0"
RULES_VERSION = "2026.03.15.1"
RULES_VERIFIED_AT = "2026-08-21"

SCRIPT_DIR = Path(__file__).resolve().parent
PLUGIN_ROOT = SCRIPT_DIR.parent
RULES_PATH = PLUGIN_ROOT / "apply-core" / "rules" / "rules.json"
MANIFEST_SCHEMA_PATH = PLUGIN_ROOT / "apply-core" / "schemas" / "manifest.schema.json"


def contained_path(base_dir, value, *, kind="file", allow_missing=False) -> Path:
    """Resolve an application path without accepting symlinks in any component.

    `Path.resolve()` erases the fact that the original leaf was a symlink.  Check the
    lexical path first, then every component, and only then return the canonical path.
    Absolute inputs are accepted only when they still reside below `base_dir`.
    """
    base = Path(base_dir).resolve(strict=True)
    raw = Path(value)
    candidate = raw if raw.is_absolute() else base / raw
    lexical = Path(os.path.abspath(candidate))
    target = lexical.resolve(strict=not allow_missing)
    try:
        target.relative_to(base)
    except ValueError as exc:
        raise ValueError(f"路径解析后越出申请目录: {target}") from exc

    # Walk the caller-visible path back to the first ancestor that resolves to
    # the canonical application root. This detects in-application links without
    # rejecting macOS's system-level /var -> /private/var alias.
    cursor = lexical
    while True:
        if cursor.is_symlink():
            raise ValueError(f"路径不得包含符号链接: {cursor}")
        if cursor.resolve(strict=False) == base:
            break
        parent = cursor.parent
        if parent == cursor:
            raise ValueError(f"路径无法追溯到申请目录: {lexical}")
        cursor = parent

    if not allow_missing:
        if kind == "file" and not target.is_file():
            raise ValueError(f"文件不存在: {target}")
        if kind == "dir" and not target.is_dir():
            raise ValueError(f"目录不存在: {target}")
    return target


def load_json(path: os.PathLike[str] | str):
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def canonical_json_bytes(value) -> bytes:
    """Stable UTF-8 JSON used for hashes; timestamps belong outside hashed payloads."""
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")


def sha256_file(path: os.PathLike[str] | str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def atomic_write_json(path: os.PathLike[str] | str, value) -> None:
    """Write JSON beside the target and atomically replace it without following target symlinks."""
    target = Path(path)
    if target.is_symlink():
        raise ValueError(f"拒绝写入符号链接 manifest: {target}")
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=f".{target.name}.", suffix=".tmp", dir=str(target.parent))
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(json.dumps(value, ensure_ascii=False, indent=2).encode("utf-8"))
            handle.write(b"\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_name, target)
    except Exception:
        try:
            os.unlink(temp_name)
        except FileNotFoundError:
            pass
        raise


def result(check: str, status: str, summary: str, items=None, data=None):
    return {
        "check": check,
        "status": status,
        "summary": summary,
        "items": items or [],
        "data": data or {},
    }


def status_from_items(items) -> str:
    if any(item.get("level") in {"fail", "blocked"} for item in items):
        return "fail"
    if any(item.get("level") == "warn" for item in items):
        return "warn"
    return "pass"
