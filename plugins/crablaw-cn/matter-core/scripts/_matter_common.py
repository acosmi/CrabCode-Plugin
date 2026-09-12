#!/usr/bin/env python3
"""Shared, dependency-free helpers for the CrabLaw-CN local matter store."""

from __future__ import annotations

import contextlib
import datetime as dt
import hashlib
import json
import os
import re
import socket
import stat as stat_module
import tempfile
import time
from pathlib import Path
from typing import Any, Iterator, Optional


ID_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{1,120}$")
PENDING_MARKER_NAME = ".pending"
PENDING_MATTER_MESSAGE = "matter is pending (incomplete bootstrap)"
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


LINK_LIKE_REPARSE_TAGS = {
    tag
    for tag in (
        getattr(stat_module, "IO_REPARSE_TAG_SYMLINK", None),
        getattr(stat_module, "IO_REPARSE_TAG_MOUNT_POINT", None),
        getattr(stat_module, "IO_REPARSE_TAG_APPEXECLINK", None),
    )
    if tag is not None
}


def is_link_like(path: Path) -> bool:
    """True for anything that redirects to another location.

    POSIX symlinks are reported by ``S_ISLNK``. Windows directory junctions are
    NOT: ``Path.is_symlink()`` and ``os.path.islink()`` both return False for a
    junction on CPython 3.11 (``os.path.isjunction`` only exists from 3.12), and
    the only signal available is the reparse tag on ``lstat``. A junction is a
    redirection just like a symlink, so it must be refused the same way.
    """

    try:
        info = path.lstat()
    except (OSError, ValueError):
        return False
    if stat_module.S_ISLNK(info.st_mode):
        return True
    return getattr(info, "st_reparse_tag", 0) in LINK_LIKE_REPARSE_TAGS


def safe_path(root: Path, *parts: str, must_exist: bool = False) -> Path:
    candidate = root.joinpath(*parts)

    try:
        relative_parts = candidate.relative_to(root).parts
    except ValueError as exc:
        raise ValueError("managed path escapes the matter-store root") from exc
    current = root
    for part in relative_parts:
        current = current / part
        if is_link_like(current):
            raise ValueError(f"managed path crosses a symbolic link: {current.relative_to(root)}")

    resolved = candidate.resolve(strict=must_exist)
    try:
        common = Path(os.path.commonpath([str(root), str(resolved)]))
    except ValueError as exc:
        raise ValueError("managed path escapes the matter-store root") from exc
    if common != root:
        raise ValueError("managed path escapes the matter-store root")
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


def lock_payload() -> str:
    return f"pid={os.getpid()} host={socket.gethostname()} created={utc_now()}\n"


def parse_lock_metadata(content: str) -> dict[str, str]:
    metadata: dict[str, str] = {}
    for token in content.split():
        key, separator, value = token.partition("=")
        if separator and key and value:
            metadata.setdefault(key, value)
    return metadata


def process_is_alive(pid: int) -> bool:
    """Liveness probe that never disturbs the probed process.

    ``os.kill(pid, 0)`` must not be used on Windows: CPython implements
    ``os.kill`` there as ``TerminateProcess(handle, sig)``, so signal 0 would
    kill the holder instead of reporting on it. Windows therefore goes through
    ``OpenProcess`` + ``GetExitCodeProcess``. Every undecidable answer is
    resolved as "alive" so an ambiguous probe can never delete a live lock.
    """

    if pid <= 0:
        return False
    if os.name == "nt":
        import ctypes
        from ctypes import wintypes

        process_query_limited_information = 0x1000
        still_active = 259
        error_invalid_parameter = 87
        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
        kernel32.OpenProcess.restype = wintypes.HANDLE
        kernel32.GetExitCodeProcess.argtypes = [wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD)]
        kernel32.GetExitCodeProcess.restype = wintypes.BOOL
        kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
        handle = kernel32.OpenProcess(process_query_limited_information, False, pid)
        if not handle:
            # 87 is the only answer that means "no such process id"; every other
            # failure (for example access denied) means the process exists.
            return ctypes.get_last_error() != error_invalid_parameter
        try:
            exit_code = wintypes.DWORD()
            if not kernel32.GetExitCodeProcess(handle, ctypes.byref(exit_code)):
                return True
            return exit_code.value == still_active
        finally:
            kernel32.CloseHandle(handle)
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    except OSError:
        return True
    return True


def reclaim_stale_lock(path: Path) -> bool:
    """Remove a lock whose owning process is provably gone. Never age-based.

    The lock is retired by renaming it to a private name first: on Windows that
    rename fails while any process still holds the file open, and on every
    platform only one racing reclaimer can win the rename, so a live lock cannot
    be deleted by a slow read followed by a fast unlink.
    """

    try:
        content = path.read_text(encoding="utf-8", errors="replace")
    except FileNotFoundError:
        return True
    except OSError:
        return False
    metadata = parse_lock_metadata(content)
    raw_pid = metadata.get("pid")
    host = metadata.get("host")
    if not raw_pid or not host:
        return False
    if host != socket.gethostname():
        return False
    try:
        pid = int(raw_pid)
    except ValueError:
        return False
    if process_is_alive(pid):
        return False
    staged = path.with_name(f"{path.name}.stale-{os.getpid()}-{time.monotonic_ns()}")
    try:
        os.rename(path, staged)
    except OSError:
        return False
    try:
        os.unlink(staged)
    except OSError:
        pass
    return True


@contextlib.contextmanager
def file_lock(path: Path, timeout_seconds: float = 0.0) -> Iterator[None]:
    ensure_private_dir(path.parent)
    deadline = time.monotonic() + max(timeout_seconds, 0.0)
    descriptor: Optional[int] = None
    while descriptor is None:
        try:
            descriptor = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            os.write(descriptor, lock_payload().encode("utf-8"))
        except FileExistsError:
            if reclaim_stale_lock(path):
                continue
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


def pending_marker_path(matter_dir: Path) -> Path:
    return matter_dir / PENDING_MARKER_NAME


def matter_is_pending(matter_dir: Path) -> bool:
    return pending_marker_path(matter_dir).exists()


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def canonical_json(payload: Any) -> str:
    """One byte-stable rendering, so the same content always hashes the same."""

    return json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


# One spelling of the reason `sync_run_manifest.py` records and `finalize_run.py`
# retires, so the two can never drift into writing and matching different strings.
REVIEW_BINDING_BLOCKING_REASON_PREFIX = "review decisions no longer bind to the current bytes"


def review_binding_blocking_reason(revision: int) -> str:
    return f"{REVIEW_BINDING_BLOCKING_REASON_PREFIX} (revision {revision})"


CONFLICT_POLICY_FILE_NAME = "conflict-policy.json"
CONFLICT_RELATIONS = (
    "same-side-existing-client",
    "potential-adverse",
    "name-match-unclassified",
)
CONFLICT_DISPOSITIONS = ("lawyer-review-required", "informational")


class ConflictPolicyError(ValueError):
    """A policy that cannot be read is never a reason to let a hit through.

    Screening without a disposition policy would have to guess what a match means,
    and the only convenient guess — "clear it" — is the one a firm can never
    accept. Every failure to load raises, and the caller refuses to screen at all.
    """


def plugin_conflict_policy_path() -> Path:
    return Path(__file__).resolve().parents[1] / CONFLICT_POLICY_FILE_NAME


def conflict_policy_schema_path() -> Path:
    return Path(__file__).resolve().parents[1] / "schemas" / "conflict-policy.schema.json"


def load_conflict_policy(root: Path) -> dict[str, Any]:
    """Load the firm's policy if the store carries one, else the shipped default.

    The result carries provenance and a digest: a screening record states which
    policy produced it, so a later policy change is detectable instead of
    retroactively rewriting what an old screen meant.
    """

    from schema_validation import validate_instance

    try:
        store_path = safe_path(root, CONFLICT_POLICY_FILE_NAME)
        source = "store" if store_path.exists() else "plugin-default"
        path = store_path if source == "store" else plugin_conflict_policy_path()
        payload = load_json(path)
        schema = load_json(conflict_policy_schema_path())
    except (OSError, ValueError) as exc:
        raise ConflictPolicyError(f"conflict policy could not be loaded: {exc}") from exc

    if not isinstance(payload, dict):
        raise ConflictPolicyError(f"conflict policy must be a JSON object: {path}")
    schema_errors = validate_instance(payload, schema)
    if schema_errors:
        raise ConflictPolicyError(
            f"conflict policy is invalid ({source} {path.name}): {'; '.join(schema_errors)}"
        )

    # The schema pins the relations a policy must cover; this pins the ones the
    # screening code can actually produce. Adding a relation to the code without
    # adding it to the schema would otherwise reach a screen unclassified.
    uncovered = [relation for relation in CONFLICT_RELATIONS if relation not in payload["rules"]]
    if uncovered:
        raise ConflictPolicyError(
            f"conflict policy does not classify every screening relation "
            f"({source} {path.name}): {', '.join(uncovered)}"
        )

    return {
        "policy": payload,
        "source": source,
        "path": path,
        "policyVersion": payload["policyVersion"],
        "approvedBy": payload["approvedBy"],
        "policyDigest": sha256_text(canonical_json(payload)),
    }


def conflict_disposition(loaded_policy: dict[str, Any], relation: str) -> str:
    """The schema guarantees every relation is covered, so this never invents one."""

    rule = loaded_policy["policy"]["rules"].get(relation)
    if not isinstance(rule, dict) or rule.get("disposition") not in CONFLICT_DISPOSITIONS:
        raise ConflictPolicyError(f"conflict policy does not classify relation {relation!r}")
    return rule["disposition"]


def conflict_policy_record(loaded_policy: dict[str, Any]) -> dict[str, str]:
    return {
        "policyVersion": loaded_policy["policyVersion"],
        "policyDigest": loaded_policy["policyDigest"],
        "approvedBy": loaded_policy["approvedBy"],
        "source": loaded_policy["source"],
    }


def source_digests(matter_dir: Path) -> list[dict[str, str]]:
    """Hash every source record so a source edit is as detectable as a document edit."""

    sources_path = safe_path(matter_dir, "sources.jsonl")
    if not sources_path.exists():
        return []
    digests: dict[str, str] = {}
    for row in load_jsonl(safe_path(matter_dir, "sources.jsonl", must_exist=True)):
        if not isinstance(row, dict):
            continue
        source_id = row.get("sourceId")
        if not isinstance(source_id, str) or not source_id:
            continue
        digests[source_id] = sha256_text(json.dumps(row, sort_keys=True))
    return [{"sourceId": key, "sha256": digests[key]} for key in sorted(digests)]


# A review-queue item changes *because* a decision was recorded on it, so it can
# never be part of the digest that decision binds to: including it would make
# every decision invalidate itself the moment it is taken.
DIGEST_EXCLUDED_ARTIFACT_TYPES = {"review-item"}


def _managed_file_digest(matter_dir: Path, relative_path: str, label: str) -> str:
    try:
        managed = safe_path(matter_dir, *Path(relative_path).parts, must_exist=True)
        return sha256_file(managed)
    except OSError as exc:
        raise ValueError(f"{label} is missing or unreadable: {relative_path} ({exc})") from exc


def run_dependency_digest(matter_dir: Path, run_dir: Path, manifest: dict[str, Any]) -> dict[str, Any]:
    """Recompute, from the bytes on disk, everything a review decision depends on.

    The digest is deliberately derived from the files themselves rather than from
    the hashes a previous sync wrote into the manifest: a decision must bind to
    what is actually there, not to what the manifest remembers.
    """

    documents: list[dict[str, str]] = []
    document_index = load_json(safe_path(run_dir, "document-index.json", must_exist=True))
    for document in document_index.get("documents", []) or []:
        if not isinstance(document, dict):
            continue
        document_id = document.get("documentId")
        relative_path = document.get("path")
        if not document_id or not relative_path:
            raise ValueError("document-index entry requires documentId and path")
        documents.append(
            {
                "documentId": document_id,
                "sha256": _managed_file_digest(matter_dir, relative_path, f"document {document_id}"),
            }
        )

    artifacts: list[dict[str, str]] = []
    for artifact in manifest.get("artifacts", []) or []:
        if not isinstance(artifact, dict):
            continue
        if artifact.get("type") in DIGEST_EXCLUDED_ARTIFACT_TYPES:
            continue
        artifact_id = artifact.get("artifactId")
        relative_path = artifact.get("path")
        if not artifact_id or not relative_path:
            raise ValueError("run-manifest artifact requires artifactId and path")
        artifacts.append(
            {
                "artifactId": artifact_id,
                "sha256": _managed_file_digest(matter_dir, relative_path, f"artifact {artifact_id}"),
            }
        )

    documents.sort(key=lambda item: item["documentId"])
    artifacts.sort(key=lambda item: item["artifactId"])
    body = {"documents": documents, "sources": source_digests(matter_dir), "artifacts": artifacts}
    return {"digest": sha256_text(canonical_json(body)), **body}
