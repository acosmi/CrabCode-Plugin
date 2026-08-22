#!/usr/bin/env python3
"""Shared, dependency-free helpers for the CrabLaw-CN local matter store."""

from __future__ import annotations

import contextlib
import datetime as dt
import hashlib
import json
import os
import re
import tempfile
import time
from pathlib import Path
from typing import Any, Iterator, Optional


ID_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{1,120}$")
MATTER_TYPES = {
    "contract",
    "data-compliance",
    "labor-employment",
    "corporate",
    "ip",
    "litigation",
    "ai-governance",
    "regulatory",
    "product",
    "legal-aid",
    "other",
}


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def today() -> str:
    return dt.date.today().isoformat()


def default_store_root() -> Path:
    configured = os.environ.get("CRABLAW_CN_HOME")
    if configured:
        return Path(configured).expanduser()
    return Path.home() / ".crabcode" / "plugins" / "config" / "crablaw-cn" / "matter-core"


def require_id(label: str, value: str) -> str:
    if not ID_RE.fullmatch(value):
        raise ValueError(
            f"{label} must match {ID_RE.pattern}; use lowercase ASCII, digits, '.', '_' or '-'"
        )
    return value


def require_matter_type(value: str) -> str:
    if value not in MATTER_TYPES:
        raise ValueError(f"matter-type must be one of: {', '.join(sorted(MATTER_TYPES))}")
    return value


def ensure_private_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True, mode=0o700)
    try:
        path.chmod(0o700)
    except OSError:
        pass
    return path


def resolve_root(raw: Optional[str], create: bool = True) -> Path:
    root = Path(raw).expanduser() if raw else default_store_root()
    if create:
        ensure_private_dir(root)
    elif not root.is_dir():
        raise ValueError(f"matter-store root does not exist: {root}")
    return root.resolve()


def safe_path(root: Path, *parts: str, must_exist: bool = False) -> Path:
    candidate = root.joinpath(*parts)
    resolved = candidate.resolve(strict=must_exist)
    try:
        common = Path(os.path.commonpath([str(root), str(resolved)]))
    except ValueError as exc:
        raise ValueError("managed path escapes the matter-store root") from exc
    if common != root:
        raise ValueError("managed path escapes the matter-store root")

    current = root
    for part in candidate.relative_to(root).parts:
        current = current / part
        if current.exists() and current.is_symlink():
            raise ValueError(f"managed path crosses a symbolic link: {current.relative_to(root)}")
    return resolved


def require_relative_path(label: str, value: str) -> str:
    path = Path(value)
    if path.is_absolute() or ".." in path.parts or value.strip() in {"", "."}:
        raise ValueError(f"{label} must be a non-empty path relative to the matter directory")
    return value


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValueError(f"missing JSON file: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"invalid JSON in {path}: {exc}") from exc


def load_jsonl(path: Path) -> list[Any]:
    if not path.exists():
        raise ValueError(f"missing JSONL file: {path}")
    rows: list[Any] = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError as exc:
            raise ValueError(f"invalid JSONL in {path}:{line_number}: {exc}") from exc
    return rows


def atomic_write_text(path: Path, text: str) -> None:
    ensure_private_dir(path.parent)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=str(path.parent))
    temporary_path = Path(temporary)
    try:
        os.chmod(temporary_path, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            handle.write(text)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_path, path)
        try:
            path.chmod(0o600)
        except OSError:
            pass
    finally:
        if temporary_path.exists():
            temporary_path.unlink()


def atomic_write_json(path: Path, payload: Any) -> None:
    atomic_write_text(path, json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n")


def touch_private(path: Path) -> None:
    ensure_private_dir(path.parent)
    descriptor = os.open(path, os.O_CREAT | os.O_APPEND, 0o600)
    os.close(descriptor)
    try:
        path.chmod(0o600)
    except OSError:
        pass


def append_jsonl(path: Path, payload: Any) -> None:
    ensure_private_dir(path.parent)
    with path.open("a", encoding="utf-8") as handle:
        try:
            os.chmod(path, 0o600)
        except OSError:
            pass
        handle.write(json.dumps(payload, ensure_ascii=False, sort_keys=True) + "\n")
        handle.flush()
        os.fsync(handle.fileno())


@contextlib.contextmanager
def file_lock(path: Path, timeout_seconds: float = 0.0) -> Iterator[None]:
    ensure_private_dir(path.parent)
    deadline = time.monotonic() + max(timeout_seconds, 0.0)
    descriptor: Optional[int] = None
    while descriptor is None:
        try:
            descriptor = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            os.write(descriptor, f"pid={os.getpid()} created={utc_now()}\n".encode("utf-8"))
        except FileExistsError:
            if time.monotonic() >= deadline:
                raise ValueError(f"matter store is locked: {path}")
            time.sleep(0.05)
    try:
        yield
    finally:
        if descriptor is not None:
            os.close(descriptor)
        try:
            path.unlink()
        except FileNotFoundError:
            pass


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()
