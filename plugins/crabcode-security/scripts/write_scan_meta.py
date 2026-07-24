#!/usr/bin/env python3
"""Create an owned scan run and record the exact content that will be analysed.

The production form is:

  write_scan_meta.py <source-root> --create-run
      --mode scan|changes|commit --effort low|medium|high|max
      [--scope a,b] [--base <ref>] [--merge-base <sha>]
      [--commit <sha>] [--endpoint <sha>] [--reports-root <dir>]

It atomically creates a nonce-qualified report directory and its run directory,
materialises an immutable-by-convention analysis snapshot, and writes
``scan-meta.json``.  The script prints the canonical ``report_dir``,
``run_dir``, and ``analysis_root`` for direct hand-off to the workflow.

The historical two-positional form remains available for compatibility:

  write_scan_meta.py <existing-run-dir> <source-root> ...

That form records the live source root and does not create a report directory
or snapshot.  The shipped jobs use ``--create-run``.

Python 3.9-compatible, standard library only.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import posixpath
import re
import secrets
import shutil
import stat
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from typing import Iterable, NoReturn, TypedDict, cast

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from render_report import RenderError, atomic_write

PLUGIN_NAME = "crabcode-security"
REPORT_DIR_PREFIX = "CRABCODE-SECURITY-"
RUN_DIR_NAME = ".crabcode-security-run"
ANALYSIS_DIR_NAME = "analysis-root"
OWNER_MARKER_NAME = ".crabcode-security-owner.json"
OWNER_SCHEMA = "crabcode-security-run-owner/v1"
REPORT_NAME_RE = re.compile(
    r"^CRABCODE-SECURITY-([0-9]{8}-[0-9]{6})-([0-9a-f]{16})\Z"
)
GIT_ENV = dict(
    os.environ,
    GIT_CONFIG_GLOBAL="/dev/null",
    GIT_OPTIONAL_LOCKS="0",
    GIT_TERMINAL_PROMPT="0",
)


class Revision(TypedDict, total=False):
    """The content revision analysed by the workflow."""

    versioned: bool
    commit: str | None
    parent: str | None
    branch: str | None
    dirty: bool | None
    base: str | None
    merge_base: str | None


class Options(TypedDict):
    """Parsed command-line options."""

    locations: list[str]
    create_run: bool
    reports_root: str | None
    mode: str
    effort: str
    scope: str
    base: str | None
    merge_base: str | None
    commit: str | None
    endpoint: str | None


class ContentDigest(TypedDict):
    """Deterministic digest of the files and symlinks in an analysis tree."""

    algorithm: str
    sha256: str
    entries: int
    bytes: int


class MetaError(Exception):
    """A caller or source-state error for which the scan must fail closed."""


def _opt_str(value: object) -> str | None:
    return None if value is None else str(value)


def _fail(message: str) -> NoReturn:
    raise MetaError(message)


def git_bytes(cwd: str, *args: str) -> bytes | None:
    """Run one read-only Git command with prompts and index refresh disabled."""
    try:
        out = subprocess.run(
            ["git", "-C", cwd, *args],
            env=GIT_ENV,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            timeout=60,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    return out.stdout if out.returncode == 0 else None


def git(cwd: str, *args: str) -> str | None:
    out = git_bytes(cwd, *args)
    if out is None:
        return None
    return os.fsdecode(out).rstrip("\r\n")


def _is_within(path: str, root: str) -> bool:
    try:
        return os.path.commonpath((path, root)) == root
    except ValueError:
        return False


def _relative_exclusion(source_root: str, report_dir: str | None) -> str | None:
    if report_dir is None or not _is_within(report_dir, source_root):
        return None
    relative = os.path.relpath(report_dir, source_root)
    if relative in (".", os.pardir) or relative.startswith(os.pardir + os.sep):
        return None
    return relative.replace(os.sep, "/")


def _is_excluded(path: str, exact_report_relative: str | None) -> bool:
    if exact_report_relative is None:
        return False
    normalized = path.replace(os.sep, "/").rstrip("/")
    return normalized == exact_report_relative or normalized.startswith(
        exact_report_relative + "/"
    )


def _status_records(scan_root: str) -> list[str] | None:
    raw = git_bytes(
        scan_root,
        "status",
        "--porcelain=v1",
        "-z",
        "--untracked-files=all",
    )
    if raw is None:
        return None
    fields = raw.split(b"\0")
    records: list[str] = []
    index = 0
    while index < len(fields):
        field = fields[index]
        index += 1
        if not field:
            continue
        if len(field) < 4:
            records.append(os.fsdecode(field))
            continue
        status_code = field[:2]
        records.append(os.fsdecode(field[3:]))
        if b"R" in status_code or b"C" in status_code:
            if index < len(fields) and fields[index]:
                records.append(os.fsdecode(fields[index]))
                index += 1
    return records


def worktree_state(
    scan_root: str, exact_report_relative: str | None
) -> tuple[bool | None, tuple[str, ...] | None]:
    """Return dirty state and stable status paths, excluding this exact run only."""
    records = _status_records(scan_root)
    if records is None:
        return None, None
    visible = tuple(sorted(path for path in records if not _is_excluded(path, exact_report_relative)))
    return bool(visible), visible


def _git_visible_paths(scan_root: str, exact_report_relative: str | None) -> list[str]:
    raw = git_bytes(
        scan_root,
        "ls-files",
        "-z",
        "--cached",
        "--others",
        "--exclude-standard",
    )
    if raw is None:
        _fail("could not list the Git-visible working tree")
    paths = [
        os.fsdecode(item)
        for item in raw.split(b"\0")
        if item and not _is_excluded(os.fsdecode(item), exact_report_relative)
    ]
    return sorted(set(paths), key=os.fsencode)


def _safe_relative_path(raw: str, label: str) -> str:
    if "\0" in raw or not raw:
        _fail(f"{label} contains an empty or NUL path")
    if "\\" in raw:
        _fail(f"{label} contains a non-portable backslash path: {raw!r}")
    normalized = raw
    if normalized.startswith("/") or posixpath.normpath(normalized) in (".", ".."):
        _fail(f"{label} contains an unsafe path: {raw!r}")
    if any(part in ("", ".", "..") for part in normalized.split("/")):
        _fail(f"{label} contains an unsafe path: {raw!r}")
    return normalized


def _ensure_regular_directory(path: str, label: str) -> str:
    absolute = os.path.abspath(path)
    try:
        info = os.lstat(absolute)
    except OSError as error:
        raise MetaError(f"{label} is missing or unreadable: {absolute}") from error
    if stat.S_ISLNK(info.st_mode) or not stat.S_ISDIR(info.st_mode):
        _fail(f"{label} must be a real directory, not a symlink or special file: {absolute}")
    return os.path.realpath(absolute)


def _exclusive_write(path: str, payload: bytes, mode: int = 0o600) -> None:
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    descriptor = os.open(path, flags, mode)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            descriptor = -1
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
    finally:
        if descriptor >= 0:
            os.close(descriptor)


def _owner_payload(
    run_id: str, source_root: str, report_dir: str, run_dir: str
) -> bytes:
    value = {
        "schema": OWNER_SCHEMA,
        "owner": PLUGIN_NAME,
        "run_id": run_id,
        "source_root": source_root,
        "report_dir": report_dir,
        "run_dir": run_dir,
    }
    return (json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")


def create_owned_run(source_root: str, reports_root_arg: str | None) -> tuple[str, str]:
    """Atomically create a never-reused report/run pair and bind owner markers."""
    reports_root = _ensure_regular_directory(
        reports_root_arg or source_root, "reports root"
    )
    if reports_root != source_root:
        _fail("reports root must be the canonical source root")
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    for _attempt in range(32):
        nonce = secrets.token_hex(8)
        run_id = f"{timestamp}-{nonce}"
        report_dir = os.path.join(reports_root, REPORT_DIR_PREFIX + run_id)
        try:
            os.mkdir(report_dir, 0o700)
        except FileExistsError:
            continue
        run_dir = os.path.join(report_dir, RUN_DIR_NAME)
        try:
            os.mkdir(run_dir, 0o700)
            report_dir = os.path.realpath(report_dir)
            run_dir = os.path.realpath(run_dir)
            payload = _owner_payload(run_id, source_root, report_dir, run_dir)
            _exclusive_write(os.path.join(report_dir, OWNER_MARKER_NAME), payload)
            _exclusive_write(os.path.join(run_dir, OWNER_MARKER_NAME), payload)
            _exclusive_write(os.path.join(report_dir, ".gitignore"), b"*\n")
            _exclusive_write(os.path.join(run_dir, ".gitignore"), b"*\n")
            return report_dir, run_dir
        except BaseException:
            shutil.rmtree(report_dir, ignore_errors=True)
            raise
    _fail("could not allocate a unique report directory after 32 nonce attempts")


def _acquire_source_lock(source_root: str):
    """Serialize run capture for one source so concurrent copies cannot interleave."""
    try:
        import fcntl
    except ImportError as error:  # pragma: no cover - CrabCode targets macOS/Linux
        raise MetaError("atomic run capture requires POSIX file locking") from error
    identity = hashlib.sha256(os.fsencode(source_root)).hexdigest()
    lock_path = os.path.join(
        tempfile.gettempdir(), f"crabcode-security-create-{identity}.lock"
    )
    descriptor = os.open(lock_path, os.O_RDWR | os.O_CREAT, 0o600)
    try:
        fcntl.flock(descriptor, fcntl.LOCK_EX)
    except BaseException:
        os.close(descriptor)
        raise
    return descriptor


def _release_source_lock(descriptor: int) -> None:
    try:
        import fcntl

        fcntl.flock(descriptor, fcntl.LOCK_UN)
    finally:
        os.close(descriptor)


def _is_active_owned_report(path: str, source_root: str) -> bool:
    """Recognise a fully bound active run; a basename prefix alone never counts."""
    if REPORT_NAME_RE.match(os.path.basename(path)) is None:
        return False
    report_marker = os.path.join(path, OWNER_MARKER_NAME)
    run_dir = os.path.join(path, RUN_DIR_NAME)
    run_marker = os.path.join(run_dir, OWNER_MARKER_NAME)
    try:
        for candidate in (report_marker, run_marker):
            info = os.lstat(candidate)
            if stat.S_ISLNK(info.st_mode) or not stat.S_ISREG(info.st_mode):
                return False
        with open(report_marker, "rb") as handle:
            report_payload = handle.read()
        with open(run_marker, "rb") as handle:
            run_payload = handle.read()
        if report_payload != run_payload:
            return False
        owner = json.loads(report_payload.decode("utf-8"))
    except (OSError, UnicodeError, ValueError):
        return False
    if not isinstance(owner, dict):
        return False
    expected_run_id = os.path.basename(path).removeprefix(REPORT_DIR_PREFIX)
    return (
        owner.get("schema") == OWNER_SCHEMA
        and owner.get("owner") == PLUGIN_NAME
        and owner.get("run_id") == expected_run_id
        and owner.get("source_root") == source_root
        and owner.get("report_dir") == os.path.realpath(path)
        and owner.get("run_dir") == os.path.realpath(run_dir)
    )


def _validate_link_target(target: str, link_parent: str, snapshot_root: str) -> None:
    if "\0" in target or os.path.isabs(target):
        _fail(f"snapshot contains an absolute or NUL symlink target: {target!r}")
    resolved = os.path.realpath(os.path.join(link_parent, target))
    if not _is_within(resolved, snapshot_root):
        _fail(f"snapshot symlink escapes the analysis root: {target!r}")


def _clone_git_endpoint(
    scan_root: str, endpoint: str, run_dir: str, analysis_root: str
) -> None:
    """Create an independent detached checkout with local history for diff reads."""
    tree = git_bytes(scan_root, "ls-tree", "-r", "-z", endpoint)
    if tree is None:
        _fail(f"could not inspect endpoint tree {endpoint}")
    gitlinks: list[str] = []
    for record in tree.split(b"\0"):
        if not record:
            continue
        header, separator, raw_path = record.partition(b"\t")
        if not separator:
            _fail(f"endpoint tree {endpoint} returned a malformed entry")
        mode = header.split(b" ", 1)[0]
        if mode == b"160000":
            gitlinks.append(os.fsdecode(raw_path))
    if gitlinks:
        shown = ", ".join(repr(path) for path in gitlinks[:8])
        suffix = "" if len(gitlinks) <= 8 else f" (+{len(gitlinks) - 8} more)"
        _fail(
            "endpoint contains submodule gitlinks whose source is not stored in "
            f"this repository: {shown}{suffix}; materialise and scan them separately"
        )
    git_dir = os.path.join(run_dir, "analysis-git")
    if os.path.lexists(git_dir):
        _fail(f"analysis Git directory already exists: {git_dir}")
    try:
        result = subprocess.run(
            [
                "git",
                "clone",
                "--quiet",
                "--local",
                "--no-hardlinks",
                "--no-checkout",
                f"--separate-git-dir={git_dir}",
                scan_root,
                analysis_root,
            ],
            env=GIT_ENV,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=120,
            check=False,
        )
    except (OSError, subprocess.SubprocessError) as error:
        raise MetaError(f"could not clone endpoint {endpoint}: {error}") from error
    if result.returncode != 0:
        detail = os.fsdecode(result.stderr).strip() or "git clone failed"
        _fail(f"could not clone endpoint {endpoint}: {detail}")
    checkout = subprocess.run(
        ["git", "-C", analysis_root, "checkout", "--quiet", "--detach", "--force", endpoint],
        env=GIT_ENV,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=120,
        check=False,
    )
    if checkout.returncode != 0:
        detail = os.fsdecode(checkout.stderr).strip() or "git checkout failed"
        _fail(f"could not check out endpoint {endpoint}: {detail}")
    # The clone has all objects needed for the already resolved two-sided
    # range.  Remove its source remote so a researcher cannot accidentally
    # refresh the snapshot from the moving checkout.
    remove_remote = subprocess.run(
        ["git", "-C", analysis_root, "remote", "remove", "origin"],
        env=GIT_ENV,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=30,
        check=False,
    )
    if remove_remote.returncode != 0:
        detail = os.fsdecode(remove_remote.stderr).strip() or "git remote remove failed"
        _fail(f"could not seal analysis snapshot remote: {detail}")


def _copy_one_visible(source_root: str, analysis_root: str, relative: str) -> None:
    safe = _safe_relative_path(relative, "Git-visible tree")
    source = os.path.join(source_root, *safe.split("/"))
    destination = os.path.join(analysis_root, *safe.split("/"))
    current = source_root
    for component in safe.split("/")[:-1]:
        current = os.path.join(current, component)
        try:
            ancestor = os.lstat(current)
        except OSError as error:
            raise MetaError(
                f"could not inspect Git-visible ancestor {current!r}: {error}"
            ) from error
        if stat.S_ISLNK(ancestor.st_mode):
            _fail(
                f"Git-visible path {relative!r} traverses a source symlink; "
                "the external target is not snapshot content"
            )
    try:
        info = os.lstat(source)
    except FileNotFoundError:
        if os.path.lexists(destination):
            destination_info = os.lstat(destination)
            if stat.S_ISDIR(destination_info.st_mode):
                shutil.rmtree(destination)
            else:
                os.unlink(destination)
        return  # a tracked deletion is part of the working-tree state
    except OSError as error:
        raise MetaError(f"could not inspect Git-visible path {relative!r}: {error}") from error
    parent = analysis_root
    for component in safe.split("/")[:-1]:
        parent = os.path.join(parent, component)
        if os.path.lexists(parent):
            parent_info = os.lstat(parent)
            if stat.S_ISLNK(parent_info.st_mode) or not stat.S_ISDIR(parent_info.st_mode):
                _fail(
                    f"analysis destination for {relative!r} traverses a symlink "
                    "or non-directory"
                )
        else:
            os.mkdir(parent, 0o700)
    if os.path.lexists(destination):
        destination_info = os.lstat(destination)
        if stat.S_ISDIR(destination_info.st_mode):
            shutil.rmtree(destination)
        else:
            os.unlink(destination)
    if stat.S_ISREG(info.st_mode):
        shutil.copy2(source, destination, follow_symlinks=False)
    elif stat.S_ISLNK(info.st_mode):
        target = os.readlink(source)
        _validate_link_target(target, os.path.dirname(destination), analysis_root)
        os.symlink(target, destination)
    elif stat.S_ISDIR(info.st_mode):
        _fail(
            f"Git-visible path {relative!r} is a directory (likely a submodule); "
            "materialise and scan it separately"
        )
    else:
        _fail(f"Git-visible path {relative!r} is not a regular file or symlink")


def _overlay_git_visible_tree(
    source_root: str, analysis_root: str, exact_report_relative: str | None
) -> list[str]:
    paths = _git_visible_paths(source_root, exact_report_relative)
    for relative in paths:
        _copy_one_visible(source_root, analysis_root, relative)
    return paths


def _copy_directory_tree(
    source_root: str, analysis_root: str, excluded_report_dir: str | None
) -> None:
    os.mkdir(analysis_root, 0o700)

    def copy_dir(source: str, target: str) -> None:
        with os.scandir(source) as entries:
            ordered = sorted(entries, key=lambda entry: os.fsencode(entry.name))
        for entry in ordered:
            source_path = entry.path
            canonical_source_path = os.path.realpath(source_path)
            if (
                excluded_report_dir is not None
                and canonical_source_path == excluded_report_dir
            ):
                continue
            if entry.is_dir(follow_symlinks=False) and _is_active_owned_report(
                source_path, source_root
            ):
                # This is not prefix filtering: both canonical owner records
                # prove it is another active tool run.  Serial capture makes
                # this check race-free and prevents runs copying one another.
                continue
            target_path = os.path.join(target, entry.name)
            info = entry.stat(follow_symlinks=False)
            if stat.S_ISDIR(info.st_mode):
                os.mkdir(target_path, 0o700)
                copy_dir(source_path, target_path)
            elif stat.S_ISREG(info.st_mode):
                shutil.copy2(source_path, target_path, follow_symlinks=False)
            elif stat.S_ISLNK(info.st_mode):
                link_target = os.readlink(source_path)
                _validate_link_target(link_target, target, analysis_root)
                os.symlink(link_target, target_path)
            else:
                _fail(f"source contains unsupported special file: {source_path}")

    copy_dir(source_root, analysis_root)


def _iter_content_entries(
    root: str, excluded_root: str | None = None
) -> Iterable[tuple[str, os.stat_result]]:
    for current, dirnames, filenames in os.walk(root, topdown=True, followlinks=False):
        dirnames.sort(key=os.fsencode)
        filenames.sort(key=os.fsencode)
        if current == root:
            dirnames[:] = [name for name in dirnames if name != ".git"]
            filenames = [name for name in filenames if name != ".git"]
        # Symlinked directories appear in dirnames but must be hashed as links,
        # never traversed.
        kept_dirs: list[str] = []
        names = list(filenames)
        for name in dirnames:
            path = os.path.join(current, name)
            if excluded_root is not None and os.path.realpath(path) == excluded_root:
                continue
            if stat.S_ISLNK(os.lstat(path).st_mode):
                names.append(name)
            else:
                kept_dirs.append(name)
        dirnames[:] = kept_dirs
        for name in kept_dirs:
            path = os.path.join(current, name)
            relative = os.path.relpath(path, root).replace(os.sep, "/")
            yield relative, os.lstat(path)
        for name in sorted(names, key=os.fsencode):
            path = os.path.join(current, name)
            relative = os.path.relpath(path, root).replace(os.sep, "/")
            yield relative, os.lstat(path)


def content_digest(root: str, excluded_root: str | None = None) -> ContentDigest:
    digest = hashlib.sha256()
    count = 0
    byte_count = 0
    for relative, info in _iter_content_entries(root, excluded_root):
        path_bytes = os.fsencode(relative)
        path = os.path.join(root, *relative.split("/"))
        if stat.S_ISREG(info.st_mode):
            kind = b"file"
            size = info.st_size
            payload: bytes | None = None
        elif stat.S_ISLNK(info.st_mode):
            kind = b"symlink"
            payload = os.fsencode(os.readlink(path))
            size = len(payload)
        elif stat.S_ISDIR(info.st_mode):
            kind = b"directory"
            payload = b""
            size = 0
        else:
            _fail(f"analysis snapshot contains unsupported special entry: {relative!r}")
        digest.update(kind + b"\0")
        mode = 0 if stat.S_ISDIR(info.st_mode) else info.st_mode & 0o777
        digest.update(str(mode).encode("ascii") + b"\0")
        digest.update(str(len(path_bytes)).encode("ascii") + b"\0" + path_bytes)
        digest.update(b"\0" + str(size).encode("ascii") + b"\0")
        if payload is not None:
            digest.update(payload)
        else:
            with open(path, "rb") as handle:
                while True:
                    block = handle.read(1024 * 1024)
                    if not block:
                        break
                    digest.update(block)
        digest.update(b"\0")
        count += 1
        byte_count += size
    return {
        "algorithm": "sha256-path-mode-content-v1",
        "sha256": digest.hexdigest(),
        "entries": count,
        "bytes": byte_count,
    }


def validate_snapshot_links(root: str) -> None:
    """Reject links that make reads leave the captured analysis tree."""
    for relative, info in _iter_content_entries(root):
        if not stat.S_ISLNK(info.st_mode):
            continue
        path = os.path.join(root, *relative.split("/"))
        _validate_link_target(os.readlink(path), os.path.dirname(path), root)


def top_level_entries(
    analysis_root: str, excluded_report_dir: str | None = None
) -> list[str] | None:
    """Immediate files and directories that define whole-tree coverage extent."""
    try:
        with os.scandir(analysis_root) as entries:
            return sorted(
                (
                    entry.name
                    for entry in entries
                    if entry.name != ".git"
                    and (
                        excluded_report_dir is None
                        or os.path.realpath(entry.path) != excluded_report_dir
                    )
                ),
                key=os.fsencode,
            )
    except OSError:
        return None


def _resolve_commit(scan_root: str, value: str, label: str) -> str:
    sha = git(scan_root, "rev-parse", "--verify", "--quiet", value + "^{commit}")
    if not sha:
        _fail(f"{label} {value!r} does not resolve to a commit")
    return sha


def _source_revision(
    scan_root: str, exact_report_relative: str | None
) -> Revision:
    versioned = git(scan_root, "rev-parse", "--is-inside-work-tree") == "true"
    if not versioned:
        return {"versioned": False}
    dirty, _records = worktree_state(scan_root, exact_report_relative)
    return {
        "versioned": True,
        "commit": git(scan_root, "rev-parse", "HEAD"),
        "branch": git(scan_root, "rev-parse", "--abbrev-ref", "HEAD"),
        "dirty": dirty,
    }


def _capture_live_revision(
    scan_root: str, opts: Options, exact_report_relative: str | None
) -> Revision:
    """Compatibility-mode revision, describing the live source root."""
    source = _source_revision(scan_root, exact_report_relative)
    if opts["mode"] == "commit":
        if not source["versioned"]:
            _fail(f"--mode commit needs a git repository; {scan_root!r} is not one")
        commit_arg = opts["commit"] or ""
        sha = _resolve_commit(scan_root, commit_arg, "--commit")
        return {
            "versioned": True,
            "commit": sha,
            "parent": git(scan_root, "rev-parse", "--verify", "--quiet", sha + "^") or None,
            "branch": source.get("branch"),
            "dirty": False,
        }
    if opts["mode"] == "changes":
        source["base"] = opts["base"]
        source["merge_base"] = opts["merge_base"]
    return source


def _snapshot(
    scan_root: str,
    run_dir: str,
    report_dir: str,
    opts: Options,
) -> tuple[str, Revision, Revision, str, ContentDigest]:
    """Materialise and attest the tree consumed by researchers."""
    analysis_root = os.path.join(run_dir, ANALYSIS_DIR_NAME)
    if os.path.lexists(analysis_root):
        _fail(f"analysis snapshot path already exists: {analysis_root}")
    excluded = _relative_exclusion(scan_root, report_dir)
    source_before = _source_revision(scan_root, excluded)
    _dirty_before, status_before = worktree_state(scan_root, excluded)

    if opts["mode"] == "commit":
        if not source_before["versioned"]:
            _fail(f"--mode commit needs a git repository; {scan_root!r} is not one")
        commit_arg = opts["commit"] or ""
        endpoint = _resolve_commit(scan_root, commit_arg, "--commit")
        _clone_git_endpoint(scan_root, endpoint, run_dir, analysis_root)
        revision: Revision = {
            "versioned": True,
            "commit": endpoint,
            "parent": git(scan_root, "rev-parse", "--verify", "--quiet", endpoint + "^")
            or None,
            "branch": source_before.get("branch"),
            "dirty": False,
        }
        snapshot_kind = "git-commit-detached-clone"
    elif opts["mode"] == "changes":
        if not source_before["versioned"]:
            _fail(f"--mode changes needs a git repository; {scan_root!r} is not one")
        endpoint_arg = opts["endpoint"] or ""
        if not endpoint_arg:
            _fail("--create-run --mode changes requires --endpoint <sha>")
        endpoint = _resolve_commit(scan_root, endpoint_arg, "--endpoint")
        _clone_git_endpoint(scan_root, endpoint, run_dir, analysis_root)
        revision = {
            "versioned": True,
            "commit": endpoint,
            "parent": git(scan_root, "rev-parse", "--verify", "--quiet", endpoint + "^")
            or None,
            "branch": source_before.get("branch"),
            "dirty": False,
            "base": opts["base"],
            "merge_base": opts["merge_base"],
        }
        snapshot_kind = "git-endpoint-detached-clone"
    elif source_before["versioned"]:
        endpoint = source_before.get("commit")
        if not endpoint:
            _fail("Git repository has no resolvable HEAD; scan a named commit instead")
        if source_before.get("dirty"):
            _clone_git_endpoint(scan_root, endpoint, run_dir, analysis_root)
            validate_snapshot_links(analysis_root)
            visible_paths = _overlay_git_visible_tree(scan_root, analysis_root, excluded)
            digest = content_digest(analysis_root)
            # Hash the same Git-visible set from the source after copying.  A
            # mismatch means the working tree changed while it was snapshotted.
            verify_root = os.path.join(run_dir, ".analysis-verify")
            try:
                os.mkdir(verify_root, 0o700)
                for relative in visible_paths:
                    _copy_one_visible(scan_root, verify_root, relative)
                source_digest = content_digest(verify_root)
            finally:
                shutil.rmtree(verify_root, ignore_errors=True)
            if source_digest != digest:
                _fail("working tree changed while its analysis snapshot was being created")
            revision = {
                "versioned": True,
                "commit": endpoint,
                "branch": source_before.get("branch"),
                "dirty": True,
            }
            snapshot_kind = "git-visible-worktree-detached-clone"
        else:
            _clone_git_endpoint(scan_root, endpoint, run_dir, analysis_root)
            revision = {
                "versioned": True,
                "commit": endpoint,
                "branch": source_before.get("branch"),
                "dirty": False,
            }
            snapshot_kind = "git-head-detached-clone"
    else:
        _copy_directory_tree(scan_root, analysis_root, report_dir)
        snapshot_digest = content_digest(analysis_root)
        verify_root = os.path.join(run_dir, ".analysis-verify")
        try:
            _copy_directory_tree(scan_root, verify_root, report_dir)
            source_digest = content_digest(verify_root)
        finally:
            shutil.rmtree(verify_root, ignore_errors=True)
        if source_digest != snapshot_digest:
            _fail("source directory changed while its analysis snapshot was being created")
        revision = {"versioned": False}
        snapshot_kind = "directory-copy"

    validate_snapshot_links(analysis_root)
    digest = content_digest(analysis_root)
    source_after = _source_revision(scan_root, excluded)
    _dirty_after, status_after = worktree_state(scan_root, excluded)
    if source_before != source_after or status_before != status_after:
        _fail("source HEAD, branch, index, or working tree changed while the run was created")
    return (
        os.path.realpath(analysis_root),
        revision,
        source_before,
        snapshot_kind,
        digest,
    )


def parse_options(argv: list[str]) -> Options:
    parser = argparse.ArgumentParser(prog="write_scan_meta")
    parser.add_argument("locations", nargs="+")
    parser.add_argument("--create-run", action="store_true")
    parser.add_argument("--reports-root", default=None)
    parser.add_argument("--mode", required=True, choices=["scan", "changes", "commit"])
    parser.add_argument("--effort", required=True, choices=["low", "medium", "high", "max"])
    parser.add_argument("--scope", default="")
    parser.add_argument("--base", default=None)
    parser.add_argument("--merge-base", dest="merge_base", default=None)
    parser.add_argument("--commit", default=None)
    parser.add_argument("--endpoint", default=None)
    namespace = parser.parse_args(argv)
    locations = [str(value) for value in cast("list[object]", namespace.locations)]
    return {
        "locations": locations,
        "create_run": bool(cast("object", namespace.create_run)),
        "reports_root": _opt_str(cast("object", namespace.reports_root)),
        "mode": str(cast("object", namespace.mode)),
        "effort": str(cast("object", namespace.effort)),
        "scope": str(cast("object", namespace.scope)),
        "base": _opt_str(cast("object", namespace.base)),
        "merge_base": _opt_str(cast("object", namespace.merge_base)),
        "commit": _opt_str(cast("object", namespace.commit)),
        "endpoint": _opt_str(cast("object", namespace.endpoint)),
    }


def _parse_locations(opts: Options) -> tuple[str | None, str]:
    if opts["create_run"]:
        if len(opts["locations"]) != 1:
            _fail("--create-run takes exactly one positional <source-root>")
        return None, opts["locations"][0]
    if len(opts["locations"]) != 2:
        _fail("compatibility mode takes <existing-run-dir> <source-root>")
    return opts["locations"][0], opts["locations"][1]


def main(argv: list[str]) -> int:
    opts = parse_options(argv)
    if opts["mode"] == "commit" and not opts["commit"]:
        _fail("--mode commit requires --commit <sha>")
    if opts["reports_root"] and not opts["create_run"]:
        _fail("--reports-root is only valid with --create-run")

    run_arg, source_arg = _parse_locations(opts)
    source_root = _ensure_regular_directory(source_arg, "source root")
    created_report: str | None = None
    source_lock: int | None = None
    try:
        if opts["create_run"]:
            source_lock = _acquire_source_lock(source_root)
            report_dir, run_dir = create_owned_run(source_root, opts["reports_root"])
            created_report = report_dir
        else:
            if run_arg is None:
                _fail("missing run directory")
            run_dir = _ensure_regular_directory(run_arg, "run directory")
            report_dir = os.path.dirname(run_dir)

        scope = [item.strip() for item in opts["scope"].split(",") if item.strip()]
        if scope and all(item in {".", "./"} for item in scope):
            scope = []
        whole_repo = opts["mode"] == "scan" and not scope

        if opts["create_run"]:
            (
                analysis_root,
                revision,
                source_revision,
                snapshot_kind,
                digest,
            ) = _snapshot(source_root, run_dir, report_dir, opts)
            excluded_from_live_analysis = None
        else:
            analysis_root = source_root
            exact_report = (
                report_dir if _is_within(report_dir, source_root) else None
            )
            exact_relative = _relative_exclusion(source_root, exact_report)
            revision = _capture_live_revision(source_root, opts, exact_relative)
            source_revision = revision.copy()
            snapshot_kind = "live-source-compatibility"
            excluded_from_live_analysis = exact_report
            digest = content_digest(analysis_root, excluded_from_live_analysis)

        extent = (
            top_level_entries(analysis_root, excluded_from_live_analysis)
            if whole_repo
            else None
        )
        if whole_repo and extent is None:
            sys.stderr.write(
                f"write_scan_meta: could not list {analysis_root}; "
                "top_level_entries unknown\n"
            )
        meta: dict[str, object] = {
            # scan_root is retained for report-format compatibility and means
            # the user's source checkout.  Workflow jobs consume analysis_root.
            "scan_root": source_root,
            "source_root": source_root,
            "analysis_root": analysis_root,
            "report_dir": report_dir,
            "run_dir": run_dir,
            "flow": "scan" if opts["mode"] == "scan" else "changes",
            "agent": f"{PLUGIN_NAME}:{PLUGIN_NAME}",
            "mode": opts["mode"],
            "scope": scope,
            "effort": opts["effort"],
            "model": None,
            "revision": revision,
            "source_revision": source_revision,
            "revision_source": "tool-captured",
            "snapshot_kind": snapshot_kind,
            "analysis_content": digest,
            "top_level_entries": extent,
            # Compatibility alias: as of v1 this contains immediate files and
            # directories, despite the historical field name.
            "top_level_dirs": extent,
        }
        meta_path = os.path.join(run_dir, "scan-meta.json")
        atomic_write(meta_path, json.dumps(meta, indent=2) + "\n")
    except BaseException:
        if created_report is not None:
            shutil.rmtree(created_report, ignore_errors=True)
        raise
    finally:
        if source_lock is not None:
            _release_source_lock(source_lock)

    sys.stdout.write(f"report_dir: {json.dumps(report_dir)}\n")
    sys.stdout.write(f"run_dir: {json.dumps(run_dir)}\n")
    sys.stdout.write(f"analysis_root: {json.dumps(analysis_root)}\n")
    sys.stdout.write(f"scan-meta.json written: {meta_path}\n")
    sys.stdout.write(f"revision: {revision.get('commit') or 'UNVERSIONED'}\n")
    sys.stdout.write(f"top_level_entries: {json.dumps(extent)}\n")
    sys.stdout.write(f"top_level_dirs: {json.dumps(extent)}\n")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except (MetaError, RenderError) as error:
        sys.stderr.write(f"write_scan_meta: {error}\n")
        sys.exit(2)
    except OSError as error:
        sys.stderr.write(f"write_scan_meta: could not create the run: {error}\n")
        sys.exit(2)
