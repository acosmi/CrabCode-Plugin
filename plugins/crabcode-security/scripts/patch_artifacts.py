#!/usr/bin/env python3
"""Render the suggested-fix products from a patch run directory.

Reads the run's `patches.json` and raw `F<n>.diff` files, and writes into the
report's `patches/` directory:

  * `F<n>.patch` -- the raw diff behind an explanatory comment header;
  * `F<n>.md` -- a short note per finding, whether or not a patch was written;
  * `PATCHES.md` and `patches.jsonl` -- the index, prose and machine form;
  * a hidden products-owner record created by `--prepare-run`.

Each written patch is checked read-only against the repository with
`git apply --check`. Marker-bound scratch workspaces and allowlisted run files
are removed once the products are written; any changed ownership, symlink,
special file, or unexpected entry is left in place with a warning.

Usage:
  patch_artifacts.py --validate-report <report_dir> <scan_root>
                     --base <sha> [--selection all|high|F1,F3]
  patch_artifacts.py --prepare-run <report_dir> <scan_root>
                     --base <sha> --selection all|high|F1,F3
  patch_artifacts.py <patch_dir> <patches_dir> <scan_root> --base <sha>
  patch_artifacts.py --remove-scratch <workspace>

Exits 0 on success (declined findings included), 1 on a refusal naming what is
wrong, 2 on a usage error. Python 3.9-compatible, stdlib only.
"""

from __future__ import annotations

import argparse
import contextlib
import hashlib
import json
import os
import re
import secrets
import shlex
import shutil
import stat
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from typing import TYPE_CHECKING, TypedDict, cast

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from render_report import RenderError, as_map, atomic_write

if TYPE_CHECKING:
    from collections.abc import Callable
    from types import TracebackType
    from typing import NoReturn

FINDING_ID_PATTERN = "F[0-9]{1,9}"
FINDING_ID_RE = re.compile(rf"^{FINDING_ID_PATTERN}\Z")
SURROGATE_RE = re.compile(r"[\ud800-\udfff]")
REGULAR_FILE_MODE = "100644"
# \Z, not $: `$` also matches before a trailing newline, and this is a fence.
REPORT_DIR_RE = re.compile(
    r"^CRABCODE-SECURITY-([0-9]{8}-[0-9]{6})-([0-9a-f]{16})\Z"
)
REVISION_FILE_RE = re.compile(
    r"^CRABCODE-SECURITY-REVISION-(?:UNVERSIONED|[0-9a-fA-F]{7,12}(?:-dirty)?)\.json\Z"
)
PATCHES_DIR_NAME = "patches"
SCRATCH_NAME_RE = re.compile(rf"^scratch-{FINDING_ID_PATTERN}\Z")
PATCH_DIR_RE = re.compile(r"^patch-[0-9]{8}-[0-9]{6}-[0-9a-f]{32}\Z")
RUN_DIR_NAME = ".crabcode-security-run"
RUN_MARKER = ".gitignore"
RUN_MARKER_CONTENT = "*\n"
SCAN_OWNER_FILE = ".crabcode-security-owner.json"
SCAN_OWNER_SCHEMA = "crabcode-security-run-owner/v1"
SCAN_OWNER_NAME = "crabcode-security"
PATCH_OWNER_FILE = ".crabcode-security-patch-owner.json"
PATCHES_OWNER_FILE = ".crabcode-security-patches-owner.json"
PATCH_OWNER_SCHEMA = 1
BASE_RE = re.compile(r"^(?:[0-9a-f]{40}|[0-9a-f]{64})\Z")
DIFF_HEADER = "diff --git "
CLAIM_KEYS = ("targeted", "no_new_vulnerability", "behaviour_unchanged")
CLAIM_LABELS = {
    "targeted": "the change is highly targeted to this finding",
    "no_new_vulnerability": "the change introduces no new security vulnerability",
    "behaviour_unchanged": (
        "beyond closing the finding, the change does not alter the code's "
        "behaviour or the inputs it accepts"
    ),
}
CLAIM_STATES = ("CONFIDENT", "NOT_CONFIDENT", "UNSURE")
STATUSES = ("patch_written", "declined", "skipped_stale")
GIT_ENV = {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}
GIT_ENV.update(
    GIT_TERMINAL_PROMPT="0",
    GIT_CONFIG_GLOBAL=os.devnull,
    GIT_CONFIG_NOSYSTEM="1",
    GIT_OPTIONAL_LOCKS="0",
)


class Claim(TypedDict):
    """One of the verifier's three confidence claims."""

    state: str
    evidence: str


class DiffStat(TypedDict):
    """Per-file added/deleted line counts."""

    path: str
    added: object
    deleted: object


class Unit(TypedDict):
    """A validated unit record, ready to be written out."""

    id: str
    title: str
    status: str
    summary: str
    claims: dict[str, Claim]
    untested: bool
    tests_run: str
    reviewed_paths: list[str]
    decline_reason: str
    recommendation: str


class ReportIdentity(TypedDict):
    """Canonical, machine-checked identity of the report and repository."""

    report_dir: str
    scan_root: str
    repo_root: str
    scan_prefix: str
    base: str
    revision_stamp: str
    revision_sha256: str
    results_sha256: str
    report_commit: str
    mode: str


class PatchError(Exception):
    """The run record or a raw diff is malformed; the caller must correct it."""


def die(message: str) -> NoReturn:
    """A refusal: the inputs are well-formed arguments but bad data. Exits 1."""
    sys.stderr.write(f"patch_artifacts.py: {message}\n")
    sys.exit(1)


def die_usage(message: str) -> NoReturn:
    """A usage error: the arguments themselves are wrong. Exits 2."""
    sys.stderr.write(f"patch_artifacts.py: {message}\n")
    sys.exit(2)


def field(value: object, what: str) -> str:
    """A record field as text; None reads as empty."""
    if value is None:
        return ""
    if not isinstance(value, str):
        msg = f"{what} must be a string"
        raise PatchError(msg)
    lone = SURROGATE_RE.search(value)
    if lone:
        msg = f"{what} contains an unpaired surrogate ({lone.group(0)!r}); it is not valid text"
        raise PatchError(msg)
    return value


def line_field(value: object, what: str) -> str:
    """A record field for the patch's one-line "#" header; line breaks folded to spaces."""
    return field(value, what).replace("\r", " ").replace("\n", " ")


def require_regular_file(path: str, what: str) -> os.stat_result:
    """Require one existing regular file, explicitly rejecting links/devices."""
    try:
        info = os.lstat(path)
    except OSError as error:
        raise PatchError(f"{what} is missing or unreadable: {path}") from error
    if stat.S_ISLNK(info.st_mode):
        raise PatchError(f"{what} must not be a symbolic link: {path}")
    if not stat.S_ISREG(info.st_mode):
        raise PatchError(f"{what} must be a regular file, not a special file: {path}")
    return info


def read_regular_bytes(path: str, what: str) -> bytes:
    """Open a regular file with no-follow where the platform supports it."""
    flags = os.O_RDONLY | (os.O_NOFOLLOW if hasattr(os, "O_NOFOLLOW") else 0)
    try:
        descriptor = os.open(path, flags)
    except OSError as error:
        raise PatchError(f"{what} is missing, linked, or unreadable: {path}") from error
    try:
        info = os.fstat(descriptor)
        if not stat.S_ISREG(info.st_mode):
            raise PatchError(f"{what} must be a regular file, not a special file: {path}")
        with os.fdopen(descriptor, "rb") as handle:
            descriptor = -1
            return handle.read()
    finally:
        if descriptor >= 0:
            os.close(descriptor)


def canonical_dir(path: str, what: str) -> str:
    """Return the canonical existing directory, rejecting a linked leaf."""
    absolute = os.path.abspath(path)
    try:
        info = os.lstat(absolute)
    except OSError as error:
        raise PatchError(f"{what} is missing or unreadable: {path}") from error
    if stat.S_ISLNK(info.st_mode):
        raise PatchError(f"{what} itself must not be a symbolic link: {path}")
    if not stat.S_ISDIR(info.st_mode):
        raise PatchError(f"{what} is not a directory: {path}")
    return os.path.realpath(absolute)


def direct_child(child: str, parent: str, name: str, what: str) -> str:
    """Require a canonical direct child with the expected basename."""
    child_real = canonical_dir(child, what)
    if os.path.basename(child_real) != name or os.path.dirname(child_real) != parent:
        raise PatchError(f"{what} must be the direct {name!r} child of {parent}")
    return child_real


def safe_relative_path(value: str, what: str) -> str:
    """Validate a portable, repository-relative path without normalizing it."""
    if not value:
        raise PatchError(f"{what} must not be empty")
    if any(ord(character) < 0x20 or ord(character) == 0x7F for character in value):
        raise PatchError(f"{what} contains a control character")
    if "\\" in value:
        raise PatchError(f"{what} contains a backslash; only '/' separators are accepted")
    if value.startswith("/") or re.match(r"^[A-Za-z]:", value):
        raise PatchError(f"{what} must be repository-relative, not absolute or drive-qualified")
    parts = value.split("/")
    if any(part in {"", ".", ".."} for part in parts):
        raise PatchError(f"{what} contains an empty, '.' or '..' path segment")
    if any(part.casefold() == ".git" for part in parts):
        raise PatchError(f"{what} must stay out of Git administrative paths")
    return "/".join(parts)


def ensure_contained_path(root: str, relative: str, what: str) -> str:
    """Resolve a safe relative path beneath root and reject linked components.

    The leaf may be absent (for a newly added file), but every existing
    component must be a real directory and an existing leaf must be regular.
    """
    relative = safe_relative_path(relative, what)
    current = root
    parts = relative.split("/")
    for index, part in enumerate(parts):
        current = os.path.join(current, part)
        try:
            info = os.lstat(current)
        except FileNotFoundError:
            break
        except OSError as error:
            raise PatchError(f"could not inspect {what} component {current!r}: {error}") from error
        if stat.S_ISLNK(info.st_mode):
            raise PatchError(f"{what} crosses a symbolic link at {current!r}")
        last = index == len(parts) - 1
        if not last and not stat.S_ISDIR(info.st_mode):
            raise PatchError(f"{what} crosses a non-directory component at {current!r}")
        if last and not (stat.S_ISREG(info.st_mode) or stat.S_ISDIR(info.st_mode)):
            raise PatchError(f"{what} resolves to a special file at {current!r}")
    candidate = os.path.abspath(os.path.join(root, *parts))
    try:
        inside = os.path.commonpath((candidate, root)) == root
    except ValueError:
        inside = False
    if not inside:
        raise PatchError(f"{what} escapes its canonical root")
    return candidate


def load_json_object(path: str, what: str) -> dict[str, object]:
    """Load a regular JSON file and require an object."""
    try:
        raw = cast("object", json.loads(read_regular_bytes(path, what).decode("utf-8")))
    except (OSError, UnicodeError, ValueError) as error:
        raise PatchError(f"{what} is not readable JSON: {error}") from error
    value = as_map(raw)
    if value is None:
        raise PatchError(f"{what} must be a JSON object")
    return value


def git_output(cwd: str, *args: str) -> str | None:
    """Run one local, read-only Git query with prompts/config/hooks disabled."""
    try:
        result = subprocess.run(
            ["git", "-C", cwd, *args],
            env=GIT_ENV,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            timeout=30,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if result.returncode != 0:
        return None
    return result.stdout.decode("utf-8", "replace").rstrip("\r\n")


def resolve_commit(repo_root: str, revision: str) -> str | None:
    """Resolve one revision to its complete commit id without option ambiguity."""
    return git_output(
        repo_root,
        "rev-parse",
        "--verify",
        "--quiet",
        "--end-of-options",
        f"{revision}^{{commit}}",
    )


def field_list(value: object, what: str) -> list[str]:
    """A list-of-strings record field."""
    if value is None:
        return []
    if not isinstance(value, list):
        msg = f"{what} must be a list of strings"
        raise PatchError(msg)
    items = cast("list[object]", value)
    return [field(item, f"{what}[{index}]") for index, item in enumerate(items)]


def build_claims(raw: object, unit_id: str, status: str) -> dict[str, Claim]:
    """Validate the three named claims. A written patch needs all three CONFIDENT."""
    claims_map = as_map(raw) or {}
    out: dict[str, Claim] = {}
    for key in CLAIM_KEYS:
        claim = as_map(claims_map.get(key))
        if claim is None:
            if status == "patch_written":
                msg = f"{unit_id}: status is patch_written but claim {key!r} is missing"
                raise PatchError(msg)
            continue
        state = field(claim.get("state"), f"{unit_id} claim {key}.state").upper()
        if state not in CLAIM_STATES:
            msg = (
                f"{unit_id}: claim {key!r} has state {state!r}; want one of "
                f"{', '.join(CLAIM_STATES)}"
            )
            raise PatchError(msg)
        evidence = line_field(claim.get("evidence"), f"{unit_id} claim {key}.evidence")
        out[key] = Claim(state=state, evidence=evidence)
    if status == "patch_written":
        not_confident = [k for k in CLAIM_KEYS if out[k]["state"] != "CONFIDENT"]
        if not_confident:
            msg = (
                f"{unit_id}: status is patch_written but {', '.join(not_confident)} "
                "is not CONFIDENT -- a patch is written only when all three claims "
                "are; record the unit as declined instead."
            )
            raise PatchError(msg)
    return out


def build_unit(raw: object, index: int) -> Unit:
    """Validate one unit from patches.json into the shape the writers use."""
    item = as_map(raw)
    if item is None:
        msg = f"patches.json unit {index} is not an object"
        raise PatchError(msg)
    unit_id = field(item.get("id"), f"unit {index} id")
    if not FINDING_ID_RE.match(unit_id):
        msg = f"unit {index} id {unit_id!r} is not a finding id (want F<number>, at most 9 digits)"
        raise PatchError(msg)
    status = field(item.get("status"), f"{unit_id} status")
    if status not in STATUSES:
        msg = f"{unit_id}: status {status!r} is not one of {', '.join(STATUSES)}"
        raise PatchError(msg)
    claims = build_claims(item.get("claims"), unit_id, status)
    decline_reason = field(item.get("decline_reason"), f"{unit_id} decline_reason")
    if status != "patch_written" and not decline_reason:
        msg = f"{unit_id}: status {status} needs a decline_reason saying why no patch was written"
        raise PatchError(msg)
    untested = item.get("untested")
    if untested is None and status == "patch_written":
        msg = (
            f'{unit_id}: status is patch_written but "untested" is missing -- it must '
            "say (true/false) whether the project's own tests exercise the patched "
            "code, because the patch header tells the reader exactly that."
        )
        raise PatchError(msg)
    if untested is not None and not isinstance(untested, bool):
        msg = f'{unit_id}: "untested" must be true or false'
        raise PatchError(msg)
    return Unit(
        id=unit_id,
        title=line_field(item.get("title"), f"{unit_id} title") or unit_id,
        status=status,
        summary=line_field(item.get("summary"), f"{unit_id} summary"),
        claims=claims,
        untested=untested is True,
        tests_run=line_field(item.get("tests_run"), f"{unit_id} tests_run"),
        reviewed_paths=field_list(item.get("reviewed_paths"), f"{unit_id} reviewed_paths"),
        decline_reason=decline_reason,
        recommendation=field(item.get("recommendation"), f"{unit_id} recommendation"),
    )


def load_units(patch_dir: str) -> list[Unit]:
    """Read and validate patches.json (an object with a `units` array)."""
    path = os.path.join(patch_dir, "patches.json")
    try:
        raw = cast(
            "object",
            json.loads(read_regular_bytes(path, "patches.json").decode("utf-8")),
        )
    except OSError as error:
        msg = "patches.json is missing from the patch directory. Write it before running this."
        raise PatchError(msg) from error
    except (UnicodeError, ValueError) as error:
        msg = f"patches.json is not valid JSON: {error}"
        raise PatchError(msg) from error
    record = as_map(raw)
    units_raw: object = record.get("units") if record is not None else raw
    if not isinstance(units_raw, list):
        msg = 'patches.json must be an object with a "units" array'
        raise PatchError(msg)
    units = [build_unit(item, i) for i, item in enumerate(cast("list[object]", units_raw))]
    seen: set[str] = set()
    for unit in units:
        if unit["id"] in seen:
            msg = f"{unit['id']} appears more than once in patches.json"
            raise PatchError(msg)
        seen.add(unit["id"])
    return units


def read_diff(patch_dir: str, unit_id: str, required: bool) -> bytes | None:
    """The raw diff git wrote for this unit; None only if absent and optional.

    A required one (a written patch) must exist and hold at least one
    `diff --git` section, since the patch and its diffstat are built from it.
    """
    path = os.path.join(patch_dir, f"{unit_id}.diff")
    if not os.path.lexists(path):
        if required:
            msg = (
                f"{unit_id}: status is patch_written but {unit_id}.diff is missing from the "
                "patch directory. Write the staged diff with git diff --output before "
                "running this script."
            )
            raise PatchError(msg)
        return None
    data = read_regular_bytes(path, f"{unit_id}.diff")
    if required and DIFF_HEADER.encode("ascii") not in data:
        msg = f"{unit_id}.diff contains no '{DIFF_HEADER.strip()}' header; it is not a git diff"
        raise PatchError(msg)
    return data


def safe_diff_path(raw: bytes) -> bool:
    """Whether one path parsed by git is repository-relative and non-traversing."""
    if raw == b"/dev/null":
        return True
    if (
        not raw
        or raw.startswith(b"/")
        or b"\\" in raw
        or any(value < 0x20 or value == 0x7F for value in raw)
    ):
        return False
    if len(raw) >= 2 and raw[:1].isalpha() and raw[1:2] == b":":
        return False
    parts = raw.split(b"/")
    if any(part in {b"", b".", b".."} for part in parts):
        return False
    # A generated patch must never address Git's own administrative data.
    logical = parts[1:] if len(parts) > 1 and parts[0] in {b"a", b"b"} else parts
    return bool(logical) and all(part.lower() != b".git" for part in logical)


def git_quoted_token(data: bytes, what: str) -> tuple[bytes, bytes]:
    """Decode one token using Git's C-style path quoting."""
    data = data.lstrip(b" ")
    if not data:
        raise PatchError(f"{what} has no path")
    if not data.startswith(b'"'):
        token, separator, rest = data.partition(b" ")
        if not separator:
            rest = b""
        return token, rest

    out = bytearray()
    index = 1
    escapes = {
        ord("a"): 7,
        ord("b"): 8,
        ord("t"): 9,
        ord("n"): 10,
        ord("v"): 11,
        ord("f"): 12,
        ord("r"): 13,
        ord('"'): 34,
        ord("\\"): 92,
    }
    while index < len(data):
        current = data[index]
        index += 1
        if current == ord('"'):
            return bytes(out), data[index:]
        if current != ord("\\"):
            out.append(current)
            continue
        if index >= len(data):
            raise PatchError(f"{what} ends in an incomplete Git path escape")
        escaped = data[index]
        index += 1
        if ord("0") <= escaped <= ord("7"):
            digits = bytearray([escaped])
            while (
                len(digits) < 3
                and index < len(data)
                and ord("0") <= data[index] <= ord("7")
            ):
                digits.append(data[index])
                index += 1
            value = int(digits.decode("ascii"), 8)
            if value > 255:
                raise PatchError(f"{what} contains an invalid Git octal path escape")
            out.append(value)
        else:
            out.append(escapes.get(escaped, escaped))
    raise PatchError(f"{what} has an unterminated quoted Git path")


def require_safe_header_path(
    raw: bytes,
    unit_id: str,
    header: str,
    prefix: bytes | None,
    allow_dev_null: bool = False,
) -> None:
    """Validate one decoded path carried by a patch header."""
    if allow_dev_null and raw == b"/dev/null":
        return
    if prefix is not None and not raw.startswith(prefix):
        shown = os.fsdecode(raw)
        raise PatchError(
            f"{unit_id}.diff has non-canonical {header} path {shown!r}; "
            f"expected the generated {os.fsdecode(prefix)!r} prefix"
        )
    if not safe_diff_path(raw):
        shown = os.fsdecode(raw)
        raise PatchError(
            f"{unit_id}.diff contains unsafe path {shown!r}; patch paths must "
            "be repository-relative, contain no '..' segment, and stay out of .git"
        )


def validate_diff_headers(diff: bytes, unit_id: str) -> None:
    """Validate every path-bearing raw header before Git applies strip rules."""
    sections = 0
    for raw_line in diff.splitlines():
        line = raw_line.rstrip(b"\r")
        if line.startswith(b"diff --git "):
            sections += 1
            payload = line[len(b"diff --git ") :]
            if payload.startswith(b'"'):
                first, rest = git_quoted_token(
                    payload, f"{unit_id}.diff diff --git"
                )
                second, trailing = git_quoted_token(
                    rest, f"{unit_id}.diff diff --git"
                )
                if trailing.strip():
                    raise PatchError(
                        f"{unit_id}.diff has extra data in a diff --git header"
                    )
                require_safe_header_path(first, unit_id, "diff --git", b"a/")
                require_safe_header_path(second, unit_id, "diff --git", b"b/")
            else:
                # Git leaves ordinary spaces unquoted in this header, so its
                # own parser below is the authority for the complete paths.
                # Here we only require the generator's canonical prefixes,
                # before Git's default one-component strip can hide an
                # absolute path.
                if not payload.startswith(b"a/") or b" b/" not in payload:
                    shown = payload.decode("utf-8", "backslashreplace")
                    raise PatchError(
                        f"{unit_id}.diff has non-canonical diff --git paths "
                        f"{shown!r}; expected generated a/ and b/ prefixes"
                    )
            continue
        for marker, prefix, allow_dev_null in (
            (b"--- ", b"a/", True),
            (b"+++ ", b"b/", True),
        ):
            if line.startswith(marker):
                field_bytes = line[len(marker) :].split(b"\t", 1)[0]
                if field_bytes.startswith(b'"'):
                    field_bytes, trailing = git_quoted_token(
                        field_bytes, f"{unit_id}.diff {marker.decode().strip()}"
                    )
                    if trailing.strip():
                        raise PatchError(
                            f"{unit_id}.diff has extra data in a {marker.decode().strip()} header"
                        )
                require_safe_header_path(
                    field_bytes,
                    unit_id,
                    marker.decode().strip(),
                    prefix,
                    allow_dev_null,
                )
                break
        else:
            for marker in (b"rename from ", b"rename to ", b"copy from ", b"copy to "):
                if not line.startswith(marker):
                    continue
                field_bytes = line[len(marker) :]
                if field_bytes.startswith(b'"'):
                    field_bytes, trailing = git_quoted_token(
                        field_bytes, f"{unit_id}.diff {marker.decode().strip()}"
                    )
                    if trailing.strip():
                        raise PatchError(
                            f"{unit_id}.diff has extra data in a {marker.decode().strip()} header"
                        )
                require_safe_header_path(
                    field_bytes,
                    unit_id,
                    marker.decode().strip(),
                    None,
                )
                break
    if sections == 0:
        raise PatchError(f"{unit_id}.diff contains no '{DIFF_HEADER.strip()}' header")


def parsed_diff_paths(diff: bytes, unit_id: str) -> list[bytes]:
    """Ask git's patch parser for every raw path, then enforce the path fence.

    Raw headers are checked before Git's normal one-component strip, while
    `-z` preserves arbitrary filename bytes in the parsed result. No patch is
    applied and no repository is needed.
    """
    validate_diff_headers(diff, unit_id)
    try:
        parsed = subprocess.run(
            ["git", "apply", "--numstat", "-z"],
            input=diff,
            env=GIT_ENV,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=30,
            check=False,
        )
    except (OSError, subprocess.SubprocessError) as error:
        msg = f"{unit_id}.diff could not be parsed safely by git: {error}"
        raise PatchError(msg) from error
    if parsed.returncode != 0:
        detail = parsed.stderr.decode("utf-8", "replace").strip().splitlines()
        suffix = f": {detail[0]}" if detail else ""
        msg = f"{unit_id}.diff is not a valid git diff{suffix}"
        raise PatchError(msg)

    paths: list[bytes] = []
    for field_bytes in parsed.stdout.split(b"\0"):
        if not field_bytes:
            continue
        match = re.match(rb"^(?:[0-9]+|-)\t(?:[0-9]+|-)\t", field_bytes)
        candidate = field_bytes[match.end() :] if match else field_bytes
        # A rename record may put the counts in their own empty-path field,
        # followed by separate old/new NUL fields.
        if candidate:
            paths.append(candidate)
    if not paths:
        msg = f"{unit_id}.diff names no changed path"
        raise PatchError(msg)
    for raw in paths:
        if not safe_diff_path(raw):
            shown = os.fsdecode(raw)
            msg = (
                f"{unit_id}.diff contains unsafe path {shown!r}; patch paths must "
                "be repository-relative, contain no '..' segment, and stay out of .git"
            )
            raise PatchError(msg)
    return paths


def reviewed_path_set(items: list[str], unit_id: str) -> set[bytes]:
    """Parse the verifier's exact `git diff --name-status` records."""
    paths: set[bytes] = set()
    for index, item in enumerate(items):
        if "\t" in item:
            fields = item.split("\t")
            status, names = fields[0], fields[1:]
        else:
            match = re.match(r"^([A-Z][0-9]*)\s+(.+)\Z", item)
            if match is None:
                raise PatchError(
                    f"{unit_id} reviewed_paths[{index}] is not name-status output"
                )
            status, names = match.group(1), [match.group(2)]
        if not re.match(r"^[ACDMRTUXB][0-9]*\Z", status):
            raise PatchError(
                f"{unit_id} reviewed_paths[{index}] has invalid status {status!r}"
            )
        expected_names = 2 if status.startswith(("R", "C")) else 1
        if len(names) != expected_names or any(not name for name in names):
            raise PatchError(
                f"{unit_id} reviewed_paths[{index}] has {len(names)} path(s); "
                f"status {status!r} requires {expected_names}"
            )
        for name in names:
            raw = os.fsencode(name)
            if not safe_diff_path(raw):
                raise PatchError(
                    f"{unit_id} reviewed_paths[{index}] contains unsafe path {name!r}"
                )
            paths.add(raw)
    if not paths:
        raise PatchError(f"{unit_id}: patch_written requires non-empty reviewed_paths")
    return paths


def normalized_diff_path_set(paths: list[bytes]) -> set[bytes]:
    """Remove Git's conventional a/ or b/ prefix for path-set comparison."""
    return {
        raw[2:] if raw.startswith((b"a/", b"b/")) else raw
        for raw in paths
        if raw != b"/dev/null"
    }


def atomic_write_bytes(path: str, data: bytes) -> None:
    """Byte-faithful counterpart of render_report.atomic_write."""
    handle, temp = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".render.")
    try:
        with os.fdopen(handle, "wb") as out:
            out.write(data)
            out.flush()
            os.fsync(out.fileno())
        os.replace(temp, path)
    except BaseException:
        with contextlib.suppress(OSError):
            os.unlink(temp)
        raise


def display_name(name: str | None) -> str | None:
    """A `--- `/`+++ ` line's file name for display: a/ or b/ dropped, None for /dev/null."""
    if name is None:
        return None
    name = name.rstrip("\r")
    if not name.startswith('"'):
        name = name.split("\t", 1)[0]
    if name == "/dev/null":
        return None
    if name.startswith(('"a/', '"b/')):
        return '"' + name[3:]
    return name[2:] if name[:2] in {"a/", "b/"} else name


def section_stat(lines: list[str]) -> DiffStat:
    """One `diff --git` section's file name and added/deleted line counts."""
    names: dict[str, str] = {}
    modes: dict[str, str] = {}
    added = deleted = 0
    binary = False
    in_hunk = False
    for line in lines[1:]:
        if in_hunk:
            if line.startswith("+"):
                added += 1
            elif line.startswith("-"):
                deleted += 1
        elif line.startswith(("GIT binary patch", "Binary files ")):
            binary = True
        elif line.startswith("@@ "):
            in_hunk = True
        else:
            for key in ("--- ", "+++ "):
                if line.startswith(key):
                    names[key.strip()] = line[4:]
            for key in ("old mode", "new mode", "new file mode", "rename from", "rename to"):
                if line.startswith(key + " "):
                    modes[key] = line[len(key) + 1 :].strip()
    if modes.get("rename from") and modes.get("rename to"):
        path = f"{modes['rename from']} => {modes['rename to']}"
    else:
        header = lines[0][len(DIFF_HEADER) :].rstrip("\r")
        cut = header.rfind(" b/")
        fallback = header[cut + 3 :] if cut >= 0 else header
        path = display_name(names.get("+++")) or display_name(names.get("---")) or fallback
    old_mode, new_mode = modes.get("old mode"), modes.get("new mode")
    if old_mode and new_mode and old_mode != new_mode:
        path += f" (mode {old_mode} -> {new_mode})"
    elif modes.get("new file mode") not in {None, REGULAR_FILE_MODE}:
        path += f" (new file, mode {modes['new file mode']})"
    return DiffStat(path=path, added="-" if binary else added, deleted="-" if binary else deleted)


def numstat(diff: bytes) -> list[DiffStat]:
    """Per-file added/deleted line counts, parsed from the diff itself."""
    stats: list[DiffStat] = []
    section: list[str] = []
    for line in diff.decode("utf-8", "replace").splitlines():
        if line.startswith(DIFF_HEADER):
            if section:
                stats.append(section_stat(section))
            section = [line]
        elif section:
            section.append(line)
    if section:
        stats.append(section_stat(section))
    return stats


def report_timestamp(name: str) -> None:
    """Validate the report name and its UTC timestamp, not merely its shape."""
    match = REPORT_DIR_RE.match(name)
    if match is None:
        raise PatchError(
            "report directory must be named "
            "CRABCODE-SECURITY-<UTC YYYYMMDD-HHMMSS>-<16 lowercase hex nonce>"
        )
    try:
        datetime.strptime(match.group(1), "%Y%m%d-%H%M%S")
    except ValueError as error:
        raise PatchError("report directory timestamp is not a real UTC date/time") from error


def require_exact_marker(path: str, what: str) -> None:
    """Require the exact inert ownership/fence marker emitted by the scan."""
    try:
        content = read_regular_bytes(path, what)
    except OSError as error:
        raise PatchError(f"could not read {what}: {error}") from error
    if content != RUN_MARKER_CONTENT.encode("utf-8"):
        raise PatchError(f"{what} must contain exactly '*\\n'")


def require_scan_owner(report_dir: str, scan_root: str) -> dict[str, object]:
    """Bind a rendered report to the exact creator-issued run identity."""
    marker = os.path.join(report_dir, SCAN_OWNER_FILE)
    owner = load_json_object(marker, "scan owner marker")
    run_id = os.path.basename(report_dir).removeprefix("CRABCODE-SECURITY-")
    expected: dict[str, object] = {
        "schema": SCAN_OWNER_SCHEMA,
        "owner": SCAN_OWNER_NAME,
        "run_id": run_id,
        "source_root": scan_root,
        "report_dir": report_dir,
        # The scan run is removed after rendering, but its canonical original
        # identity remains part of the report provenance.
        "run_dir": os.path.join(report_dir, RUN_DIR_NAME),
    }
    if set(owner) != set(expected):
        raise PatchError("scan owner marker fields do not match the run-owner schema")
    for key, value in expected.items():
        if owner.get(key) != value:
            raise PatchError(f"scan owner marker field {key!r} does not match this report")
    return owner


def revision_stamp_path(report_dir: str) -> str:
    """Return the report's one regular revision stamp."""
    candidates: list[str] = []
    try:
        names = os.listdir(report_dir)
    except OSError as error:
        raise PatchError(f"could not list report directory: {error}") from error
    for name in names:
        if REVISION_FILE_RE.match(name):
            path = os.path.join(report_dir, name)
            require_regular_file(path, f"revision stamp {name!r}")
            candidates.append(path)
    if len(candidates) != 1:
        raise PatchError(
            f"report must contain exactly one canonical revision stamp; found {len(candidates)}"
        )
    return candidates[0]


def load_report_findings(
    report_dir: str, results_bytes: bytes | None = None
) -> list[dict[str, object]]:
    """Read the rendered JSONL as untrusted data and validate acted-on fields."""
    results = os.path.join(report_dir, "CRABCODE-SECURITY-RESULTS.jsonl")
    findings: list[dict[str, object]] = []
    seen: set[str] = set()
    try:
        data = (
            read_regular_bytes(results, "report findings")
            if results_bytes is None
            else results_bytes
        )
        lines = data.decode("utf-8").splitlines(keepends=True)
    except (OSError, UnicodeError) as error:
        raise PatchError(f"could not read report findings: {error}") from error
    for line_number, line in enumerate(lines, 1):
        if not line.strip():
            raise PatchError(f"report findings line {line_number} is blank")
        try:
            raw = cast("object", json.loads(line))
        except ValueError as error:
            raise PatchError(
                f"report findings line {line_number} is not valid JSON: {error}"
            ) from error
        finding = as_map(raw)
        if finding is None:
            raise PatchError(f"report findings line {line_number} must be an object")
        finding_id = field(finding.get("id"), f"finding line {line_number} id")
        if not FINDING_ID_RE.match(finding_id):
            raise PatchError(
                f"finding line {line_number} id {finding_id!r} is not F<number>"
            )
        if finding_id in seen:
            raise PatchError(f"finding id {finding_id!r} occurs more than once")
        seen.add(finding_id)
        finding_file = field(finding.get("file"), f"{finding_id} file")
        safe_relative_path(finding_file, f"{finding_id} file")
        severity = field(finding.get("severity"), f"{finding_id} severity").upper()
        if severity not in {"HIGH", "MEDIUM", "LOW"}:
            raise PatchError(f"{finding_id} severity is not HIGH, MEDIUM, or LOW")
        finding["id"] = finding_id
        finding["file"] = finding_file
        finding["severity"] = severity
        findings.append(finding)
    return findings


def select_findings(
    findings: list[dict[str, object]], selection: str | None
) -> list[dict[str, object]]:
    """Resolve all/high/F<n>,... without treating report text as instructions."""
    if selection is None:
        return findings
    if selection == "all":
        return findings
    if selection == "high":
        return [item for item in findings if item.get("severity") == "HIGH"]
    ids = selection.split(",")
    if not ids or any(not FINDING_ID_RE.match(item) for item in ids):
        raise PatchError("selection must be 'all', 'high', or comma-separated F<number> ids")
    if len(ids) != len(set(ids)):
        raise PatchError("selection repeats a finding id")
    by_id = {cast(str, item["id"]): item for item in findings}
    missing = [item for item in ids if item not in by_id]
    if missing:
        raise PatchError(f"selection names findings not present in the report: {missing}")
    return [by_id[item] for item in ids]


def git_path_mode(repo_root: str, base: str, relative: str) -> str | None:
    """Return the exact tree mode for a path at base, or None when absent."""
    try:
        result = subprocess.run(
            [
                "git",
                "-C",
                repo_root,
                "ls-tree",
                "-z",
                "--full-tree",
                base,
                "--",
                relative,
            ],
            env=GIT_ENV,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            timeout=30,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if result.returncode != 0:
        return None
    wanted = os.fsencode(relative)
    for record in result.stdout.split(b"\0"):
        if not record or b"\t" not in record:
            continue
        metadata, name = record.split(b"\t", 1)
        if name != wanted:
            continue
        mode = metadata.split(b" ", 1)[0]
        return mode.decode("ascii", "replace")
    return None


def validate_report(
    report_dir: str,
    scan_root: str,
    base: str,
    selection: str | None = None,
    require_selected_at_base: bool = False,
) -> tuple[ReportIdentity, list[dict[str, object]]]:
    """Bind a rendered report to one canonical repository and patch base."""
    if not BASE_RE.match(base):
        raise PatchError("--base must be a complete lowercase 40- or 64-hex commit id")
    scan = canonical_dir(scan_root, "scan root")
    report = canonical_dir(report_dir, "report directory")
    report_timestamp(os.path.basename(report))
    if os.path.dirname(report) != scan:
        raise PatchError("report directory must be the direct child of the canonical scan root")
    require_exact_marker(os.path.join(report, RUN_MARKER), "report fence")
    require_scan_owner(report, scan)
    results_path = os.path.join(report, "CRABCODE-SECURITY-RESULTS.jsonl")
    results_bytes = read_regular_bytes(results_path, "report findings")
    stamp_path = revision_stamp_path(report)
    stamp_bytes = read_regular_bytes(stamp_path, "revision stamp")
    try:
        stamp_raw = cast("object", json.loads(stamp_bytes.decode("utf-8")))
    except (UnicodeError, ValueError) as error:
        raise PatchError(f"revision stamp is not readable JSON: {error}") from error
    stamp = as_map(stamp_raw)
    if stamp is None:
        raise PatchError("revision stamp must be a JSON object")

    stamped_scan_root = stamp.get("scan_root")
    stamped_source_root = stamp.get("source_root")
    stamped_products = stamp.get("products_dir")
    if not isinstance(stamped_scan_root, str) or os.path.realpath(stamped_scan_root) != scan:
        raise PatchError("revision stamp scan_root does not match the current canonical scan root")
    if (
        not isinstance(stamped_source_root, str)
        or os.path.realpath(stamped_source_root) != scan
    ):
        raise PatchError(
            "revision stamp source_root does not match the current canonical scan root"
        )
    if not isinstance(stamped_products, str) or os.path.realpath(stamped_products) != report:
        raise PatchError("revision stamp products_dir does not match this report directory")

    repo_root_raw = git_output(scan, "rev-parse", "--show-toplevel")
    prefix = git_output(scan, "rev-parse", "--show-prefix")
    if not repo_root_raw or prefix is None:
        raise PatchError("scan root is not inside a local Git work tree")
    repo_root = canonical_dir(repo_root_raw, "repository root")
    if resolve_commit(repo_root, base) != base:
        raise PatchError("--base does not resolve to that exact complete commit in this repository")
    if resolve_commit(repo_root, "HEAD") != base:
        raise PatchError("--base is not the repository's current HEAD; the report is stale here")

    revision = as_map(stamp.get("revision"))
    if revision is None or revision.get("versioned") is not True:
        raise PatchError("patches require a versioned report")
    if revision.get("dirty") is not False:
        raise PatchError("patches require a report explicitly stamped from committed, clean code")
    report_commit = field(revision.get("commit"), "revision.commit").lower()
    resolved_report_commit = resolve_commit(repo_root, report_commit)
    if resolved_report_commit is None:
        raise PatchError("the report's commit is not present in the current repository")
    mode = field(stamp.get("mode"), "report mode")
    if mode in {"scan", "changes"}:
        if resolved_report_commit != base:
            raise PatchError(
                "full/scoped/changes report revision does not match the requested patch base"
            )
    elif mode == "commit":
        try:
            ancestor = subprocess.run(
                [
                    "git",
                    "-C",
                    repo_root,
                    "merge-base",
                    "--is-ancestor",
                    resolved_report_commit,
                    base,
                    "--",
                ],
                env=GIT_ENV,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=30,
                check=False,
            )
        except (OSError, subprocess.SubprocessError) as error:
            raise PatchError(f"could not validate commit-report ancestry: {error}") from error
        if ancestor.returncode != 0:
            raise PatchError("commit report revision is not an ancestor of the patch base")
    else:
        raise PatchError(f"report mode {mode!r} is not scan, changes, or commit")

    findings = load_report_findings(report, results_bytes)
    stamped_findings = as_map(stamp.get("findings"))
    expected_counts = {
        "total": len(findings),
        "high": sum(1 for item in findings if item["severity"] == "HIGH"),
        "medium": sum(1 for item in findings if item["severity"] == "MEDIUM"),
        "low": sum(1 for item in findings if item["severity"] == "LOW"),
    }
    if stamped_findings is None or any(
        stamped_findings.get(key) != value for key, value in expected_counts.items()
    ):
        raise PatchError("revision stamp finding counts do not match the rendered JSONL")
    verification = as_map(stamp.get("verification"))
    if findings and (
        verification is None or verification.get("status") != "verified"
    ):
        raise PatchError("a report with findings must carry a verified panel status")
    selected = select_findings(findings, selection)
    normalized_prefix = prefix.replace(os.sep, "/")
    for finding in findings:
        finding_id = cast(str, finding["id"])
        finding_file = cast(str, finding["file"])
        ensure_contained_path(scan, finding_file, f"{finding_id} file")
        repo_relative = safe_relative_path(
            normalized_prefix + finding_file, f"{finding_id} repository path"
        )
        finding["repo_relative_file"] = repo_relative
    if require_selected_at_base:
        for finding in selected:
            finding_id = cast(str, finding["id"])
            repo_relative = cast(str, finding["repo_relative_file"])
            mode_at_base = git_path_mode(repo_root, base, repo_relative)
            if mode_at_base is None:
                raise PatchError(
                    f"{finding_id} file is absent at patch base; drop it as stale before preparing"
                )
            if not mode_at_base.startswith("100"):
                raise PatchError(
                    f"{finding_id} file at patch base is a symlink, submodule, or special tree entry"
                )

    identity = ReportIdentity(
        report_dir=report,
        scan_root=scan,
        repo_root=repo_root,
        scan_prefix=normalized_prefix,
        base=base,
        revision_stamp=os.path.basename(stamp_path),
        revision_sha256=hashlib.sha256(stamp_bytes).hexdigest(),
        results_sha256=hashlib.sha256(results_bytes).hexdigest(),
        report_commit=resolved_report_commit,
        mode=mode,
    )
    return identity, selected


def owner_core(identity: ReportIdentity) -> dict[str, object]:
    """Stable report/product owner fields."""
    return {
        "schema": PATCH_OWNER_SCHEMA,
        "report_dir": identity["report_dir"],
        "scan_root": identity["scan_root"],
        "repo_root": identity["repo_root"],
        "base": identity["base"],
        "revision_stamp": identity["revision_stamp"],
        "revision_sha256": identity["revision_sha256"],
        "results_sha256": identity["results_sha256"],
    }


def exclusive_json(path: str, value: dict[str, object]) -> None:
    """Create a marker exactly once; an existing path is always a collision."""
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    try:
        descriptor = os.open(path, flags, 0o600)
    except OSError as error:
        raise PatchError(f"could not exclusively create owner marker {path!r}: {error}") from error
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(value, handle, ensure_ascii=False, sort_keys=True, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
    except BaseException:
        with contextlib.suppress(OSError):
            os.unlink(path)
        raise


def require_owner(path: str, expected: dict[str, object], what: str) -> dict[str, object]:
    """Require a regular owner marker containing every expected binding."""
    actual = load_json_object(path, what)
    for key, value in expected.items():
        if actual.get(key) != value:
            raise PatchError(f"{what} field {key!r} does not match the validated report")
    return actual


def prepare_run(
    report_dir: str, scan_root: str, base: str, selection: str
) -> dict[str, object]:
    """Atomically reserve a unique patch run and bind its products to the report."""
    identity, selected = validate_report(
        report_dir,
        scan_root,
        base,
        selection=selection,
        require_selected_at_base=True,
    )
    if not selected:
        raise PatchError("selection resolves to no findings; no patch run is needed")
    report = identity["report_dir"]
    patches = os.path.join(report, PATCHES_DIR_NAME)
    run_root = os.path.join(report, RUN_DIR_NAME)
    core = owner_core(identity)

    if os.path.lexists(patches):
        patches = direct_child(patches, report, PATCHES_DIR_NAME, "patches directory")
        require_owner(
            os.path.join(patches, PATCHES_OWNER_FILE),
            core,
            "patch products owner marker",
        )
    else:
        try:
            os.mkdir(patches, 0o700)
        except OSError as error:
            raise PatchError(f"could not atomically create patches directory: {error}") from error
        try:
            exclusive_json(os.path.join(patches, PATCHES_OWNER_FILE), core)
        except BaseException:
            with contextlib.suppress(OSError):
                os.rmdir(patches)
            raise

    nonce = secrets.token_hex(16)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    patch_name = f"patch-{timestamp}-{nonce}"
    patch_dir = os.path.join(run_root, patch_name)
    run_root_created = False
    try:
        try:
            os.mkdir(run_root, 0o700)
            run_root_created = True
        except FileExistsError as error:
            raise PatchError(
                f"an active or interrupted {RUN_DIR_NAME} already exists; "
                "refusing concurrent reuse"
            ) from error
        except OSError as error:
            raise PatchError(
                f"could not atomically create patch run directory: {error}"
            ) from error
        marker_path = os.path.join(run_root, RUN_MARKER)
        descriptor = os.open(
            marker_path,
            os.O_WRONLY | os.O_CREAT | os.O_EXCL
            | (os.O_NOFOLLOW if hasattr(os, "O_NOFOLLOW") else 0),
            0o600,
        )
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="") as handle:
            handle.write(RUN_MARKER_CONTENT)
            handle.flush()
            os.fsync(handle.fileno())
        os.mkdir(patch_dir, 0o700)
        run_owner = dict(core)
        run_owner.update(
            {
                "nonce": nonce,
                "patch_dir": patch_dir,
                "selected_ids": [item["id"] for item in selected],
                "selected_paths": [item["repo_relative_file"] for item in selected],
            }
        )
        exclusive_json(os.path.join(patch_dir, PATCH_OWNER_FILE), run_owner)
    except BaseException:
        # A losing concurrent process must never remove the winning process's
        # lease. Roll back only after this process successfully created the
        # run root. The products owner remains published so a retry can safely
        # reuse it, including when another process already relied on it.
        if run_root_created:
            with contextlib.suppress(OSError):
                os.unlink(os.path.join(patch_dir, PATCH_OWNER_FILE))
            with contextlib.suppress(OSError):
                os.rmdir(patch_dir)
            with contextlib.suppress(OSError):
                os.unlink(os.path.join(run_root, RUN_MARKER))
            with contextlib.suppress(OSError):
                os.rmdir(run_root)
        raise
    return {
        **identity,
        "patch_dir": patch_dir,
        "patches_dir": patches,
        "nonce": nonce,
        "selected": selected,
    }


def apply_check(top: str | None, patch_path: str) -> str:
    """`git apply --check` against the user's tree: 'clean', 'conflicts: ...', or 'not_run'."""
    if top is None:
        return "not_run"
    try:
        out = subprocess.run(
            ["git", "-C", top, "apply", "--check", "--", os.path.abspath(patch_path)],
            env=GIT_ENV,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            timeout=60,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return "not_run"
    if out.returncode == 0:
        return "clean"
    first = out.stderr.decode("utf-8", "replace").strip().splitlines()
    return "conflicts" + (f": {first[0]}" if first else "")


def diffstat_lines(stats: list[DiffStat] | None) -> list[str]:
    """Diffstat as markdown bullets, or a one-line fallback when git was unavailable."""
    if stats is None:
        return ["- _(no attempt diff was saved)_"]
    if not stats:
        return ["- _(no file changes recorded)_"]
    return [f"- `{s['path']}` (+{s['added']} -{s['deleted']})" for s in stats]


def header_comment(unit: Unit, base: str, report_ref: str) -> str:
    """The comment block prepended above the first `diff --git`; git apply ignores it."""
    lines = [
        f"# CrabCode Security -- suggested patch for {unit['id']}: {unit['title']}",
        f"# Applies to revision {base[:12]} (the revision the scan report describes).",
        "#",
        "# Verified by a panel of agents: an independent verifier reviewed this",
        "# change against the finding, and a second, fresh reviewer re-challenged",
        "# the bare diff for new vulnerabilities. The patch was written only",
        "# because the panel stated all three of these with confidence:",
    ]
    for key in CLAIM_KEYS:
        claim = unit["claims"][key]
        lines.append(f"#   - {CLAIM_LABELS[key]}: {claim['evidence'] or claim['state']}")
    if unit["untested"]:
        lines += [
            "#",
            "# NOTE: no test exercises the patched code. The claim that behaviour is",
            "# unchanged rests on review of the change and its callers, not on a test",
            "# run -- weigh it accordingly before applying.",
        ]
    if unit["summary"]:
        lines += ["#", f"# {unit['summary']}"]
    if unit["tests_run"]:
        lines += [f"# Tests run: {unit['tests_run']}"]
    lines += [
        "#",
        (f"# Apply, from the repository root:  git apply {report_ref}/patches/{unit['id']}.patch"),
        "#",
        "",
    ]
    return "\n".join(lines)


def note_written(unit: Unit, stats: list[DiffStat] | None, check: str, report_ref: str) -> str:
    """The F<n>.md note for a finding that earned a patch."""
    lines = [
        f"# {unit['id']}: {unit['title']}",
        "",
        f"**Status:** patch written -> `{unit['id']}.patch`",
        "",
        (
            "**Verified by a panel of agents.** An independent verifier reviewed the "
            "change against the finding and stated the three claims below with "
            "confidence, and a second, fresh reviewer re-challenged the bare diff "
            "for new vulnerabilities. The patch was written only because the "
            "panel could vouch for it; nothing here was applied for you."
        ),
        "",
    ]
    if unit["summary"]:
        lines += [unit["summary"], ""]
    lines += ["## Confidence", ""]
    for key in CLAIM_KEYS:
        claim = unit["claims"][key]
        lines.append(f"- **{CLAIM_LABELS[key]}** -- {claim['state']}: {claim['evidence']}")
    if unit["untested"]:
        lines += [
            "",
            (
                "**No test exercises the patched code.** The behaviour claim rests on "
                "review of the change and its callers, not on a test run."
            ),
        ]
    lines += ["", f"**Tests run:** {unit['tests_run'] or 'none recorded'}", ""]
    lines += ["## Change", ""]
    lines += diffstat_lines(stats)
    lines += ["", "## Applying it", ""]
    if check == "clean":
        lines.append("Applies cleanly to the working tree (checked with `git apply --check`).")
    elif check == "not_run":
        lines.append("The clean-apply check could not run here (git unavailable); try it yourself.")
    else:
        detail = check.split(": ", 1)[-1]
        lines.append(
            f"`git apply --check` reported a conflict ({detail}). The patch was built against the "
            "recorded revision, so this usually means the working tree has uncommitted or newer "
            "changes in these files -- apply it to a checkout of that revision, or merge by "
            "hand."
        )
    lines += [
        "",
        "```",
        f"git apply {report_ref}/patches/{unit['id']}.patch",
        "```",
        "",
        "Or ask CrabCode Security to apply it, or to open a pull request for it.",
        "",
    ]
    return "\n".join(lines)


def note_declined(unit: Unit, stats: list[DiffStat] | None) -> str:
    """The F<n>.md note for a finding with no patch."""
    lines = [
        f"# {unit['id']}: {unit['title']}",
        "",
        "**Status:** no patch produced",
        "",
        unit["decline_reason"],
        "",
    ]
    blocking = [(k, c) for k, c in unit["claims"].items() if c["state"] != "CONFIDENT"]
    if blocking:
        lines += ["## The claim that could not be made with confidence", ""]
        for key, claim in blocking:
            lines.append(f"- **{CLAIM_LABELS[key]}** -- {claim['state']}: {claim['evidence']}")
        lines.append("")
    if stats is not None:
        lines += ["## What the rejected attempt changed", ""]
        lines += diffstat_lines(stats)
        lines.append("")
    if unit["recommendation"]:
        lines += ["## The report's original recommendation", "", unit["recommendation"], ""]
    return "\n".join(lines)


def index_markdown(units: list[Unit], base: str, report_dir_name: str, report_ref: str) -> str:
    """PATCHES.md: the one-page index of every unit's outcome."""
    patched = [u for u in units if u["status"] == "patch_written"]
    declined = [u for u in units if u["status"] != "patch_written"]
    lines = [
        "# Suggested patches",
        "",
        (
            f"Targeted patches for findings in `{report_dir_name}`, each written against "
            f"revision `{base[:12]}` and verified by a panel of agents before it was "
            "written. Nothing here is applied, committed, or opened as a pull request "
            "until you choose to do so."
        ),
        "",
    ]
    if patched:
        lines += ["## Patches written", ""]
        for unit in patched:
            caveat = " _(no tests cover the patched code)_" if unit["untested"] else ""
            lines.append(f"- **{unit['id']}** -- {unit['title']}: `{unit['id']}.patch`{caveat}")
        lines.append("")
    if declined:
        lines += ["## No patch produced", ""]
        for unit in declined:
            lines.append(f"- **{unit['id']}** -- {unit['title']}: {unit['decline_reason']}")
        lines.append("")
    lines += [
        "## Applying a patch",
        "",
        "From the repository root:",
        "",
        "```",
        f"git apply {report_ref}/patches/F<n>.patch",
        "```",
        "",
        (
            "Each `F<n>.md` beside the patch explains the change and what was verified. "
            "The job that wrote these applied, committed, pushed, and opened nothing; "
            "if you want one applied, or turned into a pull request, ask CrabCode "
            "Security and it handles that as a separate request."
        ),
        "",
    ]
    return "\n".join(lines)


def jsonl(
    units: list[Unit],
    base: str,
    stats_by_id: dict[str, list[DiffStat] | None],
    checks: dict[str, str],
) -> str:
    """patches.jsonl: one record per unit, machine-readable for tooling."""
    rows: list[str] = []
    for unit in units:
        record: dict[str, object] = {
            "id": unit["id"],
            "status": unit["status"],
            "base": base,
            "patch": f"{unit['id']}.patch" if unit["status"] == "patch_written" else None,
            "note": f"{unit['id']}.md",
            "claims": unit["claims"],
            "untested": unit["untested"],
            "tests_run": unit["tests_run"] or None,
            "reviewed_paths": unit["reviewed_paths"],
            "diffstat": stats_by_id.get(unit["id"]),
            "apply_check": checks.get(unit["id"]),
            "decline_reason": unit["decline_reason"] or None,
        }
        rows.append(json.dumps(record, ensure_ascii=False, sort_keys=False))
    return "\n".join(rows) + ("\n" if rows else "")


def owned_product_names(patches_dir: str) -> list[str]:
    """Preflight every script-owned product name and reject unsafe collisions."""
    owned: list[str] = []
    for name in sorted(os.listdir(patches_dir)):
        managed = name in {"PATCHES.md", "patches.jsonl"} or bool(
            re.match(rf"^{FINDING_ID_PATTERN}\.(?:patch|md)\Z", name)
        )
        if not managed:
            continue
        path = os.path.join(patches_dir, name)
        require_regular_file(path, f"existing patch product {name!r}")
        if os.path.dirname(os.path.realpath(path)) != patches_dir:
            raise PatchError(f"existing patch product {name!r} resolves outside patches directory")
        owned.append(name)
    return owned


def clear_stale_products(
    patches_dir: str, produced: set[str], preflighted: list[str]
) -> list[str]:
    """Remove F<n>.patch / F<n>.md files an earlier run left that this run did not write.

    Only the script's own product names (F<n>.patch, F<n>.md) are removed;
    every other file in the folder is left alone.
    """
    removed: list[str] = []
    for name in preflighted:
        stem, dot, ext = name.rpartition(".")
        if not dot or ext not in {"patch", "md"} or not FINDING_ID_RE.match(stem):
            continue
        if name in produced:
            continue
        path = os.path.join(patches_dir, name)
        require_regular_file(path, f"stale patch product {name!r}")
        if os.path.dirname(os.path.realpath(path)) != patches_dir:
            raise PatchError(f"stale patch product {name!r} changed containment before deletion")
        os.unlink(path)
        removed.append(name)
    return removed


def ensure_gitignore(report_dir: str) -> str:
    """Validate the scan-created report fence; never create trust retroactively."""
    path = os.path.join(report_dir, ".gitignore")
    require_exact_marker(path, "report fence")
    return "present"


def contained_relpath(target: str, root: str) -> str | None:
    """`target` as a path from `root`, or None when it does not sit inside root."""
    rel = os.path.relpath(os.path.realpath(target), os.path.realpath(root))
    if rel == ".." or rel.startswith(".." + os.sep) or os.path.isabs(rel):
        return None
    return rel


def report_path_from_root(report_dir: str, top: str | None, fallback: str) -> str:
    """The report directory as a path from the repository root, for the apply command.

    Falls back to the bare folder name when git cannot name a root or the
    folder sits outside it.
    """
    if top is None:
        return fallback
    return contained_relpath(report_dir, top) or fallback


def resolve_report_dir(patches_dir: str) -> tuple[str, str]:
    """The report directory holding `patches_dir`, validated by name."""
    patches_abs = canonical_dir(patches_dir, "patches directory")
    report_dir = os.path.dirname(patches_abs)
    report_dir_name = os.path.basename(report_dir)
    if os.path.basename(patches_abs) != PATCHES_DIR_NAME:
        msg = (
            f"patches dir must be a directory named {PATCHES_DIR_NAME!r} inside the "
            f"report directory; got {patches_abs}"
        )
        raise PatchError(msg)
    report_timestamp(report_dir_name)
    if os.path.realpath(report_dir) != report_dir:
        raise PatchError("report directory must be canonical and must not cross a symlink")
    return report_dir, report_dir_name


def validate_run_bindings(
    patch_dir: str, patches_dir: str, scan_root: str, base: str
) -> tuple[str, str, ReportIdentity, dict[str, object]]:
    """Revalidate every owner binding immediately before consuming a run."""
    scan = canonical_dir(scan_root, "scan root")
    report_dir, report_name = resolve_report_dir(patches_dir)
    if os.path.dirname(report_dir) != scan:
        raise PatchError("patches report is not a direct child of this scan root")
    run_root = direct_child(
        os.path.dirname(canonical_dir(patch_dir, "patch directory")),
        report_dir,
        RUN_DIR_NAME,
        "patch run root",
    )
    patch = canonical_dir(patch_dir, "patch directory")
    if os.path.dirname(patch) != run_root or not PATCH_DIR_RE.match(os.path.basename(patch)):
        raise PatchError("patch directory is not a unique nonce-bearing child of the patch run root")
    require_exact_marker(os.path.join(run_root, RUN_MARKER), "patch run marker")

    owner_path = os.path.join(patch, PATCH_OWNER_FILE)
    owner = load_json_object(owner_path, "patch run owner marker")
    selected_raw = owner.get("selected_ids")
    if (
        not isinstance(selected_raw, list)
        or not selected_raw
        or any(not isinstance(item, str) or not FINDING_ID_RE.match(item) for item in selected_raw)
        or len(cast("list[object]", selected_raw)) != len(set(cast("list[str]", selected_raw)))
    ):
        raise PatchError("patch run owner marker has invalid selected_ids")
    selected_ids = cast("list[str]", selected_raw)
    identity, selected = validate_report(
        report_dir,
        scan,
        base,
        selection=",".join(selected_ids),
        require_selected_at_base=True,
    )
    expected = owner_core(identity)
    expected.update(
        {
            "nonce": os.path.basename(patch).rsplit("-", 1)[-1],
            "patch_dir": patch,
            "selected_ids": selected_ids,
            "selected_paths": [item["repo_relative_file"] for item in selected],
        }
    )
    require_owner(owner_path, expected, "patch run owner marker")
    require_owner(
        os.path.join(patches_dir, PATCHES_OWNER_FILE),
        owner_core(identity),
        "patch products owner marker",
    )
    ensure_gitignore(report_dir)
    return report_dir, report_name, identity, owner


def run(patch_dir: str, patches_dir: str, scan_root: str, base: str) -> int:
    patch_dir = canonical_dir(patch_dir, "patch directory")
    patches_dir = canonical_dir(patches_dir, "patches directory")
    scan_root = canonical_dir(scan_root, "scan root")
    report_dir, report_dir_name, identity, owner = validate_run_bindings(
        patch_dir, patches_dir, scan_root, base
    )
    units = load_units(patch_dir)
    unit_ids = [unit["id"] for unit in units]
    selected_ids = cast("list[str]", owner["selected_ids"])
    if unit_ids != selected_ids:
        raise PatchError(
            "patches.json units must exactly match selected_ids in the run owner marker "
            f"(units={unit_ids}, selected={selected_ids})"
        )
    top = identity["repo_root"]
    report_ref = shlex.quote(report_path_from_root(report_dir, top, report_dir_name))
    stats_by_id: dict[str, list[DiffStat] | None] = {}
    checks: dict[str, str] = {}
    produced: set[str] = set()
    prepared: list[tuple[Unit, bytes | None, list[DiffStat] | None]] = []
    preflighted_products = owned_product_names(patches_dir)

    # Preflight every raw diff before writing or deleting any product. A bad
    # later unit must not leave a partially refreshed patches directory.
    for unit in units:
        written = unit["status"] == "patch_written"
        diff = read_diff(patch_dir, unit["id"], required=written)
        if diff is not None:
            parsed_paths = parsed_diff_paths(diff, unit["id"])
            actual = normalized_diff_path_set(parsed_paths)
            for raw_path in actual:
                decoded = os.fsdecode(raw_path)
                lone = SURROGATE_RE.search(decoded)
                if lone:
                    raise PatchError(
                        f"{unit['id']}.diff path is not valid text and cannot be canonicalized"
                    )
                ensure_contained_path(top, decoded, f"{unit['id']}.diff path")
            if written:
                reviewed = reviewed_path_set(unit["reviewed_paths"], unit["id"])
                if reviewed != actual:
                    missing = sorted(os.fsdecode(path) for path in actual - reviewed)
                    extra = sorted(os.fsdecode(path) for path in reviewed - actual)
                    raise PatchError(
                        f"{unit['id']}: diff paths do not match reviewed_paths "
                        f"(unreviewed={missing}, not-in-diff={extra})"
                    )
        stats = numstat(diff) if diff is not None else None
        stats_by_id[unit["id"]] = stats
        prepared.append((unit, diff, stats))

    for unit, diff, stats in prepared:
        written = unit["status"] == "patch_written"
        if written and diff is not None:
            patch_path = os.path.join(patches_dir, f"{unit['id']}.patch")
            header = header_comment(unit, base, report_ref)
            atomic_write_bytes(patch_path, header.encode("utf-8") + diff)
            check = apply_check(top, patch_path)
            checks[unit["id"]] = check
            note = note_written(unit, stats, check, report_ref)
            produced.add(f"{unit['id']}.patch")
            print(f"{unit['id']}: patch written -> {patch_path} (apply check: {check})")
        else:
            note = note_declined(unit, stats)
            print(f"{unit['id']}: no patch ({unit['status']}) -> {unit['id']}.md")
        atomic_write(os.path.join(patches_dir, f"{unit['id']}.md"), note)
        produced.add(f"{unit['id']}.md")
    index_text = index_markdown(units, base, report_dir_name, report_ref)
    atomic_write(os.path.join(patches_dir, "PATCHES.md"), index_text)
    atomic_write(
        os.path.join(patches_dir, "patches.jsonl"), jsonl(units, base, stats_by_id, checks)
    )
    for name in clear_stale_products(patches_dir, produced, preflighted_products):
        print(f"removed stale {name} (not produced by this run)")
    swept, warnings = remove_workspaces_in(patch_dir)
    for name in swept:
        print(f"removed workspace {name}")
    removed, more_warnings = remove_patch_run(patch_dir)
    for path in removed:
        print(f"removed {path}")
    for warning in warnings + more_warnings:
        print(f"WARNING: {warning}")
    ensure_gitignore(report_dir)
    patched = sum(1 for u in units if u["status"] == "patch_written")
    print(
        f"wrote PATCHES.md and patches.jsonl into {patches_dir} "
        f"({patched} patched, {len(units) - patched} declined)"
    )
    return 0


def owner_for_patch_dir(patch_dir: str) -> tuple[dict[str, object], ReportIdentity]:
    """Validate a patch directory from its marker alone for fenced cleanup."""
    patch = canonical_dir(patch_dir, "patch directory")
    run_root = os.path.dirname(patch)
    report = os.path.dirname(run_root)
    if not PATCH_DIR_RE.match(os.path.basename(patch)):
        raise PatchError("patch directory name lacks the required timestamp and nonce")
    if os.path.basename(run_root) != RUN_DIR_NAME or os.path.dirname(run_root) != report:
        raise PatchError(f"patch directory is not inside a direct {RUN_DIR_NAME} child")
    report_timestamp(os.path.basename(report))
    require_exact_marker(os.path.join(run_root, RUN_MARKER), "patch run marker")
    owner_path = os.path.join(patch, PATCH_OWNER_FILE)
    owner = load_json_object(owner_path, "patch run owner marker")
    for key in ("report_dir", "scan_root", "base"):
        if not isinstance(owner.get(key), str):
            raise PatchError(f"patch run owner marker lacks string field {key!r}")
    selected_raw = owner.get("selected_ids")
    if not isinstance(selected_raw, list) or not selected_raw:
        raise PatchError("patch run owner marker lacks selected_ids")
    selected = cast("list[object]", selected_raw)
    if any(not isinstance(item, str) or not FINDING_ID_RE.match(item) for item in selected):
        raise PatchError("patch run owner marker selected_ids are malformed")
    identity, selected_findings = validate_report(
        cast(str, owner["report_dir"]),
        cast(str, owner["scan_root"]),
        cast(str, owner["base"]),
        selection=",".join(cast("list[str]", selected)),
        require_selected_at_base=True,
    )
    expected = owner_core(identity)
    expected.update(
        {
            "nonce": os.path.basename(patch).rsplit("-", 1)[-1],
            "patch_dir": patch,
            "selected_ids": selected,
            "selected_paths": [
                item["repo_relative_file"] for item in selected_findings
            ],
        }
    )
    require_owner(owner_path, expected, "patch run owner marker")
    return owner, identity


def refuse_reason(path: str) -> str | None:
    """Why `path` may NOT be deleted as a scratch workspace, or None when it may.

    Only `<report>/.crabcode-security-run/patch-<ts>/scratch-F<n>` holding its
    own `.git` may be deleted; every other shape is refused.
    """
    try:
        leaf = canonical_dir(path, "scratch workspace")
    except PatchError as error:
        return str(error)
    if not SCRATCH_NAME_RE.match(os.path.basename(leaf)):
        return "its name is not scratch-F<n>"
    run = os.path.dirname(leaf)
    top = os.path.dirname(run)
    if not PATCH_DIR_RE.match(os.path.basename(run)):
        return "it is not inside a patch-<timestamp> run directory"
    if os.path.basename(top) != RUN_DIR_NAME:
        return f"its run directory is not inside {RUN_DIR_NAME}/"
    try:
        owner, _identity = owner_for_patch_dir(run)
    except PatchError as error:
        return f"its patch owner binding is invalid: {error}"
    if os.path.basename(leaf)[len("scratch-") :] not in cast(
        "list[str]", owner["selected_ids"]
    ):
        return "its finding id is not selected by the patch owner marker"
    git_dir = os.path.join(leaf, ".git")
    try:
        info = os.lstat(git_dir)
    except OSError:
        return "it holds no .git directory of its own"
    if stat.S_ISLNK(info.st_mode) or not stat.S_ISDIR(info.st_mode):
        return "its .git entry is a symlink or non-directory"
    return None


def clear_readonly(
    func: Callable[..., object],
    path: str,
    exc_info: tuple[type[BaseException], BaseException, TracebackType],
) -> None:
    """Make `path` writable and retry the removal rmtree could not do."""
    # Git writes read-only objects, which Windows will not delete.
    if func not in {os.unlink, os.rmdir}:
        raise exc_info[1]
    os.chmod(path, stat.S_IWRITE)
    func(path)


def remove_workspace(path: str) -> None:
    """Delete one scratch workspace, refusing anything off the fenced layout."""
    reason = refuse_reason(path)
    if reason is not None:
        msg = f"refusing to remove {path!r}: {reason}"
        raise PatchError(msg)
    target = canonical_dir(path, "scratch workspace")
    try:
        shutil.rmtree(target, onerror=clear_readonly)
    except OSError as error:
        detail = error.args[0] if error.args else error
        msg = f"could not remove {path!r}: {detail}"
        raise PatchError(msg) from error


def remove_workspaces_in(patch_dir: str) -> tuple[list[str], list[str]]:
    """Remove every scratch workspace in a patch run directory.

    Returns (removed names, warnings). Never raises: a workspace that cannot
    be removed is reported as a warning.
    """
    removed: list[str] = []
    warnings: list[str] = []
    try:
        names = sorted(os.listdir(patch_dir))
    except OSError as error:
        return removed, [f"could not list {patch_dir!r}: {error}"]
    for name in names:
        if not name.startswith("scratch-"):
            continue
        path = os.path.join(patch_dir, name)
        try:
            remove_workspace(path)
        except PatchError as error:
            warnings.append(str(error))
        else:
            removed.append(name)
    return removed, warnings


def remove_patch_run(patch_dir: str) -> tuple[list[str], list[str]]:
    """Remove a finished patch run directory, and its run directory if now empty.

    Returns (removed paths, warnings). Never raises; only the recipe's own
    `<report>/.crabcode-security-run/patch-<ts>` layout is deleted.
    """
    removed: list[str] = []
    try:
        target = canonical_dir(patch_dir, "patch directory")
        owner_for_patch_dir(target)
    except PatchError as error:
        return removed, [f"left {patch_dir!r} in place: {error}"]
    run_dir = os.path.dirname(target)
    if not PATCH_DIR_RE.match(os.path.basename(target)):
        return removed, [f"left {patch_dir!r} in place: its name is not patch-<timestamp>"]
    if os.path.basename(run_dir) != RUN_DIR_NAME:
        return removed, [f"left {patch_dir!r} in place: it is not inside {RUN_DIR_NAME}/"]
    try:
        entries = sorted(os.listdir(target))
    except OSError as error:
        return removed, [f"could not inspect {patch_dir!r}: {error}"]
    allowed_files = {PATCH_OWNER_FILE, "patches.json"}
    for name in entries:
        path = os.path.join(target, name)
        if SCRATCH_NAME_RE.match(name):
            return removed, [f"left {patch_dir!r} in place: scratch workspace {name!r} remains"]
        if re.match(rf"^{FINDING_ID_PATTERN}\.diff\Z", name):
            allowed_files.add(name)
        if name not in allowed_files:
            return removed, [f"left {patch_dir!r} in place: unexpected entry {name!r}"]
        try:
            require_regular_file(path, f"patch run entry {name!r}")
        except PatchError as error:
            return removed, [f"left {patch_dir!r} in place: {error}"]
    try:
        for name in entries:
            path = os.path.join(target, name)
            require_regular_file(path, f"patch run entry {name!r}")
            os.unlink(path)
        os.rmdir(target)
    except (OSError, PatchError) as error:
        return removed, [f"could not remove {patch_dir!r}: {error}"]
    removed.append(target)
    marker = os.path.join(run_dir, RUN_MARKER)
    try:
        require_exact_marker(marker, "patch run marker")
        os.unlink(marker)
    except (OSError, PatchError) as error:
        return removed, [f"could not remove patch run marker: {error}"]
    try:
        os.rmdir(run_dir)
    except OSError:
        return removed, []
    removed.append(run_dir)
    return removed, []


def main(argv: list[str]) -> int:
    if argv and argv[0] in {"--validate-report", "--prepare-run"}:
        action = argv.pop(0)
        parser = argparse.ArgumentParser(prog=f"patch_artifacts.py {action}")
        parser.add_argument("report_dir")
        parser.add_argument("scan_root")
        parser.add_argument("--base", required=True)
        parser.add_argument("--selection")
        args = parser.parse_args(argv)
        report_dir = str(cast("object", args.report_dir))
        scan_root = str(cast("object", args.scan_root))
        base = str(cast("object", args.base))
        selection_raw = args.selection
        selection = None if selection_raw is None else str(selection_raw)
        if action == "--prepare-run" and selection is None:
            die_usage("--prepare-run requires --selection")
        try:
            if action == "--prepare-run":
                result = prepare_run(report_dir, scan_root, base, cast(str, selection))
            else:
                identity, selected = validate_report(
                    report_dir,
                    scan_root,
                    base,
                    selection=selection,
                    require_selected_at_base=False,
                )
                result = {
                    **identity,
                    "selected": [
                        {
                            "id": item["id"],
                            "severity": item["severity"],
                            "file": item["file"],
                            "repo_relative_file": item["repo_relative_file"],
                        }
                        for item in selected
                    ],
                }
        except (PatchError, RenderError) as error:
            die(str(error))
        except OSError as error:
            die(f"could not validate or prepare the report: {error}")
        sys.stdout.write(json.dumps(result, ensure_ascii=False, sort_keys=True) + "\n")
        return 0
    if argv and argv[0] == "--remove-scratch":
        if len(argv) != 2:
            die_usage("--remove-scratch takes exactly one workspace path")
        try:
            remove_workspace(argv[1])
        except PatchError as error:
            die(str(error))
        print(f"removed workspace {argv[1]!r}")
        return 0
    parser = argparse.ArgumentParser(
        prog="patch_artifacts.py",
        description="Render suggested-fix patch files and notes from a patch run directory.",
        epilog=(
            "Use --validate-report before consuming a report, --prepare-run to reserve "
            "owned paths, or --remove-scratch for one fenced workspace."
        ),
    )
    parser.add_argument("patch_dir", help="the patch run dir holding patches.json and F<n>.diff")
    parser.add_argument("patches_dir", help="the report's patches/ directory to write into")
    parser.add_argument("scan_root", help="the user's repository root (for git apply --check)")
    parser.add_argument("--base", required=True, help="the revision every patch applies to")
    args = parser.parse_args(argv)
    patch_dir = str(cast("object", args.patch_dir))
    patches_dir = str(cast("object", args.patches_dir))
    scan_root = str(cast("object", args.scan_root))
    base = str(cast("object", args.base))
    for label, path in (("patch dir", patch_dir), ("patches dir", patches_dir)):
        if not os.path.isdir(path):
            die_usage(f"{label} is not a directory: {path}")
    if not BASE_RE.match(base):
        die_usage(f"--base {base!r} is not a complete lowercase 40- or 64-hex commit id")
    try:
        return run(patch_dir, patches_dir, scan_root, base)
    except (PatchError, RenderError) as error:
        die(str(error))
    except OSError as error:
        die(f"could not read or write the report's files: {error}")


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
