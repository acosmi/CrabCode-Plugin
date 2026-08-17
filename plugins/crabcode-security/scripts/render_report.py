#!/usr/bin/env python3
"""Render a scan's machine-readable artifacts from its run directory.

Writes CRABCODE-SECURITY-RESULTS.jsonl (one finding per line, fields in a fixed
order) and the CRABCODE-SECURITY-REVISION-<tag>.json stamp, places the report
markdown beside them, then removes the scan's run directory now that its
records are rendered. Filenames, JSONL field order, and verification.status
semantics are stable across releases.

Usage: render_report.py <run-dir> [--products-dir <dir>]
Python 3.9-compatible, stdlib only.
"""

from __future__ import annotations

import contextlib
import hashlib
import json
import ntpath
import os
import posixpath
import re
import shutil
import stat
import sys
import tempfile
import unicodedata
from collections.abc import Mapping
from datetime import datetime, timezone
from typing import NoReturn, TypedDict, cast

JsonMap = Mapping[str, object]
Finding = dict[str, object]


class Panel(TypedDict, total=False):
    """A validated panel round: an int vote count and the fixed voter count."""

    true: int
    false: int
    voters: int


class VerificationSummary(TypedDict, total=False):
    """The stamp's `verification` object; every path names why if not verified."""

    status: str
    candidates: int
    candidates_deduped: int
    panel_votes: int
    panel_reviewed_findings: int
    panel_quorum_findings: int
    unreviewed_candidate_sites: object
    attested_findings: int
    reason: str | None
    researchers_dispatched: int
    researchers_returned: int


REPORT_FIELDS = (
    "id",
    "title",
    "impact",
    "file",
    "line",
    "description",
    "exploit_scenario",
    "preconditions",
    "category",
    "severity",
    "confidence",
    "recommendation",
    "cwe_id",
    "snippet",
    "symbol",
)

SEPARATOR_ESCAPES = {0x85: "\\u0085", 0x2028: "\\u2028", 0x2029: "\\u2029"}

SEVERITIES = ("HIGH", "MEDIUM", "LOW")
CONFIDENCES = ("low", "medium", "high")
CONFIDENCE_RANK = {"low": 1, "medium": 2, "high": 3}

PANEL_VOTER_COUNT = 3
PANEL_KEEP_QUORUM = 2

REVISION_PREFIX = "CRABCODE-SECURITY-REVISION-"
RUN_DIR_NAME = ".crabcode-security-run"
FENCE_NAME = ".gitignore"
FENCE_CONTENT = "*\n"
OWNER_MARKER_NAME = ".crabcode-security-owner.json"
OWNER_SCHEMA = "crabcode-security-run-owner/v1"
OWNER_NAME = "crabcode-security"
# \Z, not $: `$` also matches before a trailing newline, and this names a file.
HEX_RE = re.compile(r"^[0-9a-fA-F]{7,64}\Z")
FINDING_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}\Z")
REPORT_DIR_RE = re.compile(
    r"^CRABCODE-SECURITY-([0-9]{8}-[0-9]{6})-([0-9a-f]{16})\Z"
)
REVISION_FILE_RE = re.compile(
    r"^CRABCODE-SECURITY-REVISION-(?:UNVERSIONED|[0-9a-fA-F]{7,12}(?:-dirty)?)\.json\Z"
)

CATEGORY_ALIASES = {
    "sqli": "sql-injection",
    "sql injection": "sql-injection",
    "rce": "command-injection",
    "command execution": "command-injection",
    "cmdi": "command-injection",
    "xss": "xss",
    "cross-site scripting": "xss",
    "csrf": "csrf",
    "cross-site request forgery": "csrf",
    "ssrf": "ssrf",
    "path traversal": "path-traversal",
    "directory traversal": "path-traversal",
    "idor": "idor",
    "authz bypass": "improper-authorization",
    "authn bypass": "auth-bypass",
    "hardcoded credentials": "hardcoded-secret",
    "hardcoded password": "hardcoded-secret",
    "secret": "hardcoded-secret",
    "weak cryptography": "weak-crypto",
    "insecure randomness": "weak-randomness",
    "uaf": "use-after-free",
    "oob read": "out-of-bounds-read",
    "oob write": "out-of-bounds-write",
    "denial of service": "dos",
    "prototype pollution": "prototype-pollution",
}


class RenderError(Exception):
    """A refusal; the message names what the caller must fix."""


def as_map(value: object) -> JsonMap | None:
    """The value as a str-keyed mapping, or None when it is not one."""
    if isinstance(value, dict):
        return cast("JsonMap", value)
    return None


def die(message: str) -> NoReturn:
    sys.stderr.write(f"render_report.py: {message}\n")
    sys.exit(1)


def read_regular_bytes(path: str, label: str, limit: int = 64 * 1024 * 1024) -> bytes:
    """Read one bounded regular file without following a final-component link."""
    try:
        before = os.lstat(path)
    except OSError as error:
        raise RenderError(f"{label} is missing or unreadable: {path}") from error
    if stat.S_ISLNK(before.st_mode) or not stat.S_ISREG(before.st_mode):
        raise RenderError(f"{label} must be a regular file, not a symlink or special file")
    flags = os.O_RDONLY | (os.O_NOFOLLOW if hasattr(os, "O_NOFOLLOW") else 0)
    try:
        descriptor = os.open(path, flags)
    except OSError as error:
        raise RenderError(f"could not open {label}: {error}") from error
    try:
        opened = os.fstat(descriptor)
        if (
            not stat.S_ISREG(opened.st_mode)
            or opened.st_dev != before.st_dev
            or opened.st_ino != before.st_ino
        ):
            raise RenderError(f"{label} changed while it was being opened")
        chunks: list[bytes] = []
        remaining = limit + 1
        while remaining:
            chunk = os.read(descriptor, min(1024 * 1024, remaining))
            if not chunk:
                break
            chunks.append(chunk)
            remaining -= len(chunk)
        payload = b"".join(chunks)
    finally:
        os.close(descriptor)
    if len(payload) > limit:
        raise RenderError(f"{label} exceeds the {limit}-byte safety limit")
    try:
        after = os.lstat(path)
    except OSError as error:
        raise RenderError(f"{label} changed while it was being read") from error
    if (
        stat.S_ISLNK(after.st_mode)
        or not stat.S_ISREG(after.st_mode)
        or after.st_dev != before.st_dev
        or after.st_ino != before.st_ino
        or after.st_size != len(payload)
    ):
        raise RenderError(f"{label} changed while it was being read")
    return payload


def _analysis_entries(root: str):
    """Yield the same path/mode/content universe captured by write_scan_meta."""
    for current, dirnames, filenames in os.walk(root, topdown=True, followlinks=False):
        dirnames.sort(key=os.fsencode)
        filenames.sort(key=os.fsencode)
        if current == root:
            dirnames[:] = [name for name in dirnames if name != ".git"]
            filenames = [name for name in filenames if name != ".git"]
        kept_dirs: list[str] = []
        names = list(filenames)
        for name in dirnames:
            path = os.path.join(current, name)
            info = os.lstat(path)
            if stat.S_ISLNK(info.st_mode):
                names.append(name)
            else:
                kept_dirs.append(name)
        dirnames[:] = kept_dirs
        for name in kept_dirs:
            path = os.path.join(current, name)
            yield os.path.relpath(path, root).replace(os.sep, "/"), os.lstat(path)
        for name in sorted(names, key=os.fsencode):
            path = os.path.join(current, name)
            yield os.path.relpath(path, root).replace(os.sep, "/"), os.lstat(path)


def analysis_content_digest(root: str) -> dict[str, object]:
    """Recompute the captured tree attestation immediately before rendering."""
    digest = hashlib.sha256()
    count = 0
    byte_count = 0
    for relative, info in _analysis_entries(root):
        path = os.path.join(root, *relative.split("/"))
        relative_bytes = os.fsencode(relative)
        if stat.S_ISREG(info.st_mode):
            kind = b"file"
            size = info.st_size
            payload: bytes | None = None
        elif stat.S_ISLNK(info.st_mode):
            kind = b"symlink"
            target = os.readlink(path)
            if "\0" in target or os.path.isabs(target):
                raise RenderError(f"analysis snapshot has unsafe symlink {relative!r}")
            resolved = os.path.realpath(os.path.join(os.path.dirname(path), target))
            try:
                contained = os.path.commonpath((resolved, root)) == root
            except ValueError:
                contained = False
            if not contained:
                raise RenderError(f"analysis snapshot symlink escapes the run: {relative!r}")
            payload = os.fsencode(target)
            size = len(payload)
        elif stat.S_ISDIR(info.st_mode):
            kind = b"directory"
            size = 0
            payload = b""
        else:
            raise RenderError(
                f"analysis snapshot contains unsupported special entry: {relative!r}"
            )
        digest.update(kind + b"\0")
        mode = 0 if stat.S_ISDIR(info.st_mode) else info.st_mode & 0o777
        digest.update(str(mode).encode("ascii") + b"\0")
        digest.update(
            str(len(relative_bytes)).encode("ascii")
            + b"\0"
            + relative_bytes
            + b"\0"
            + str(size).encode("ascii")
            + b"\0"
        )
        if payload is None:
            # Parent directories were traversed without following links; the
            # creator and renderer still document same-account TOCTOU as an OS
            # isolation boundary.
            with open(path, "rb") as handle:
                while True:
                    block = handle.read(1024 * 1024)
                    if not block:
                        break
                    digest.update(block)
        else:
            digest.update(payload)
        digest.update(b"\0")
        count += 1
        byte_count += size
    return {
        "algorithm": "sha256-path-mode-content-v1",
        "sha256": digest.hexdigest(),
        "entries": count,
        "bytes": byte_count,
    }


def read_json(run_dir: str, name: str, required: bool = True) -> object:
    path = os.path.join(run_dir, name)
    if not required and not os.path.lexists(path):
        return None
    try:
        payload = read_regular_bytes(path, name)
        return cast("object", json.loads(payload.decode("utf-8")))
    except (UnicodeError, ValueError) as error:
        msg = f"{name} is not valid JSON: {error}"
        raise RenderError(msg) from error


def normalize_category(raw: object) -> str:
    """Lowercase/slugify a category and fold known synonyms."""
    text = str(raw or "").strip().lower()
    if text in CATEGORY_ALIASES:
        return CATEGORY_ALIASES[text]
    slug = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return CATEGORY_ALIASES.get(slug, slug)


def confidence_value(raw: object) -> str:
    """A finding's stated confidence, normalized to low|medium|high; refuses others."""
    if isinstance(raw, str):
        word = raw.strip().lower()
        if word in CONFIDENCE_RANK:
            return word
    msg = "confidence {!r} is not one of {}".format(raw, "/".join(CONFIDENCES))
    raise RenderError(msg)


def repository_relative_file(raw: object, finding_id: str) -> str:
    """A canonical, portable repository-relative finding path.

    Report paths are security evidence and later tooling may consume them as
    paths. Refuse alternate spellings and platform-specific absolute forms
    instead of letting a model smuggle an external or ambiguous location into
    the signed report.
    """
    if not isinstance(raw, str) or not raw:
        raise RenderError(f"finding {finding_id} file must be a non-empty string")
    if raw != raw.strip():
        raise RenderError(
            f"finding {finding_id} file {raw!r} is not a normalized repository-relative path"
        )
    if "\\" in raw:
        raise RenderError(
            f"finding {finding_id} file {raw!r} must use '/' as its repository path separator"
        )
    if any(unicodedata.category(char).startswith("C") for char in raw):
        raise RenderError(f"finding {finding_id} file contains a control character")
    drive, _ = ntpath.splitdrive(raw)
    if drive or raw.startswith("/") or ntpath.isabs(raw):
        raise RenderError(
            f"finding {finding_id} file {raw!r} must be repository-relative, not absolute"
        )
    parts = raw.split("/")
    if any(part in ("", ".", "..") for part in parts) or posixpath.normpath(raw) != raw:
        raise RenderError(
            f"finding {finding_id} file {raw!r} is not a normalized repository-relative path"
        )
    return raw


def panel_counts(raw: object, label: str) -> Panel | None:
    """Validate one panel-shaped object, including legitimate partial returns.

    A partial panel (zero to two returned voters) is retained as evidence but
    is never complete and can never attest a finding. Every present panel must
    still be arithmetically honest.
    """
    if raw is None:
        return None
    panel = as_map(raw)
    if panel is None:
        raise RenderError(f"{label} must be an object")
    counts: dict[str, int] = {}
    for key in ("true", "false", "voters"):
        value = panel.get(key)
        if isinstance(value, bool) or not isinstance(value, int) or value < 0:
            raise RenderError(f"{label}.{key} must be a non-negative integer, not {value!r}")
        counts[key] = value
    if counts["true"] + counts["false"] != counts["voters"]:
        raise RenderError(
            f"{label} is inconsistent: true + false must equal voters "
            f"({counts['true']} + {counts['false']} != {counts['voters']})"
        )
    if counts["voters"] > PANEL_VOTER_COUNT:
        raise RenderError(
            f"{label}.voters must not exceed the fixed {PANEL_VOTER_COUNT}-voter panel"
        )
    return cast("Panel", counts)


def panel_complete(record: object, label: str = "panel") -> Panel | None:
    """The validated panel dict for one round record, or None.

    A complete panel has exactly PANEL_VOTER_COUNT returned votes, with
    non-negative true/false counts whose sum equals that fixed voter count.
    A well-formed partial return remains incomplete.
    """
    round_record = as_map(record)
    if round_record is None:
        return None
    panel = panel_counts(round_record.get("panel"), label)
    if panel is None or panel["voters"] != PANEL_VOTER_COUNT:
        return None
    return panel


def vote_confidence_ceiling(rounds: object, finding_id: str) -> str:
    """The vote-backed confidence ceiling for one finding.

    A unanimous panel yields `high`; a keep quorum below unanimity yields
    `medium`. A missing, partial, or rejecting panel cannot back more than
    `low` confidence.
    """
    panel = panel_complete(rounds, f"rounds[{finding_id!r}].panel")
    if panel is None:
        return "low"
    if panel["true"] >= PANEL_VOTER_COUNT:
        return "high"
    return "medium" if panel["true"] >= PANEL_KEEP_QUORUM else "low"


def build_finding(raw: object, index: int, rounds_by_id: JsonMap) -> Finding:
    """Validate one finding into exactly REPORT_FIELDS, in order."""
    item = as_map(raw)
    if item is None:
        msg = f"findings.json item {index} is not an object"
        raise RenderError(msg)
    finding_id = str(item.get("id") or f"F{index + 1}")
    if not FINDING_ID_RE.match(finding_id):
        msg = f"finding id {finding_id!r} is not a valid id"
        raise RenderError(msg)

    for required in ("title", "file", "description", "exploit_scenario"):
        if not item.get(required):
            msg = f"finding {finding_id} is missing required field {required!r}"
            raise RenderError(msg)

    severity = str(item.get("severity", "")).strip().upper()
    if severity not in SEVERITIES:
        msg = "finding {} severity {!r} is not one of {}".format(
            finding_id, item.get("severity"), "/".join(SEVERITIES)
        )
        raise RenderError(msg)

    confidence = confidence_value(item.get("confidence"))
    ceiling = vote_confidence_ceiling(rounds_by_id.get(finding_id), finding_id)
    if CONFIDENCE_RANK[confidence] > CONFIDENCE_RANK[ceiling]:
        confidence = ceiling

    file_path = repository_relative_file(item.get("file"), finding_id)
    raw_line = item.get("line")
    if isinstance(raw_line, bool) or not isinstance(raw_line, int) or raw_line <= 0:
        msg = "finding {} line {!r} must be a positive integer".format(finding_id, raw_line)
        raise RenderError(msg)
    line = raw_line

    preconditions_raw: object = item.get("preconditions") or []
    if not isinstance(preconditions_raw, list):
        msg = f"finding {finding_id} preconditions must be a list"
        raise RenderError(msg)

    cwe = item.get("cwe_id")
    if cwe:
        text = str(cwe).strip().upper().replace("_", "-")
        if re.match(r"^\d{1,5}$", text):
            text = "CWE-" + text
        cwe = text if re.match(r"^CWE-\d{1,5}$", text) else None
    else:
        cwe = None

    finding = {
        "id": finding_id,
        "title": item.get("title"),
        "impact": item.get("impact") or "",
        "file": file_path,
        "line": line,
        "description": item.get("description"),
        "exploit_scenario": item.get("exploit_scenario"),
        "preconditions": [str(p) for p in cast("list[object]", preconditions_raw)],
        "category": normalize_category(item.get("category")),
        "severity": severity,
        "confidence": confidence,
        "recommendation": item.get("recommendation") or "",
        "cwe_id": cwe,
        "snippet": item.get("snippet") or "",
        "symbol": item.get("symbol") or "",
    }
    return {k: finding[k] for k in REPORT_FIELDS}


def read_coverage(run_dir: str) -> tuple[JsonMap | None, str]:
    """The optional coverage.json for the informational run_shape field.

    Returns (map_or_None, source): source is "coverage.json" when the file
    is a usable object, "unavailable" when it is absent, and "unreadable" when
    it exists but is not a usable object.
    """
    name = "coverage.json"
    try:
        raw = read_json(run_dir, name, required=False)
    except RenderError:
        return None, "unreadable"
    if raw is None:
        present = os.path.exists(os.path.join(run_dir, name))
        return None, ("unreadable" if present else "unavailable")
    cov = as_map(raw)
    if cov is None:
        return None, "unreadable"
    return cov, name


COVERAGE_TEXT_CAP = 300


def coverage_text(value: object, cap: int = COVERAGE_TEXT_CAP) -> str | None:
    """A coverage string, trimmed to `cap`, or None when the value is not a string."""
    if not isinstance(value, str):
        return None
    if len(value) > cap:
        return value[:cap] + f"...[+{len(value) - cap} chars]"
    return value


def skipped_components(raw: object) -> list[dict[str, object]] | None:
    """coverage.skippedComponents as [{name, paths, reason}], or None when unusable."""
    if not isinstance(raw, list):
        return None
    out: list[dict[str, object]] = []
    for entry in cast("list[object]", raw):
        item = as_map(entry)
        if item is None:
            continue
        paths_raw = item.get("paths")
        paths_in: list[object] = (
            cast("list[object]", paths_raw) if isinstance(paths_raw, list) else []
        )
        paths = [text for text in (coverage_text(p, 200) for p in paths_in) if text]
        out.append({
            "name": coverage_text(item.get("name"), 100) or "",
            "paths": paths,
            "reason": coverage_text(item.get("reason")) or "",
        })
    return out


def coverage_enum(value: object, allowed: tuple[str, ...]) -> str | None:
    """A coverage enum field, or None when absent or not one of the known values."""
    return value if isinstance(value, str) and value in allowed else None


def run_shape(coverage: JsonMap | None, source: str, effort: object) -> dict[str, object]:
    """What shape actually ran, distinct from the effort tier that was asked."""
    shape: dict[str, object] = {"requested_effort": effort, "collapsed": None, "source": source}
    if coverage is None:
        return shape
    shape["collapsed"] = coverage.get("collapsed")
    shape["diff_files"] = coverage.get("diffFiles")
    shape["diff_lines"] = coverage.get("diffLines")
    shape["scope_files"] = coverage.get("scopeFiles")
    shape["empty_diff"] = bool(coverage.get("emptyDiff"))
    shape["empty_scope"] = bool(coverage.get("emptyScope"))
    shape["researchers_dispatched"] = coverage.get("researchersDispatched")
    shape["skipped_components"] = skipped_components(coverage.get("skippedComponents"))
    shape["completeness_check_outcome"] = coverage_enum(
        coverage.get("completenessCheckOutcome"),
        ("checked", "partial", "not-checkable", "not-applicable"),
    )
    unaccounted_raw = coverage.get("unaccountedTopLevelDirs")
    unaccounted_in: list[object] = (
        cast("list[object]", unaccounted_raw) if isinstance(unaccounted_raw, list) else []
    )
    shape["unaccounted_top_level_dirs"] = [
        text for text in (coverage_text(x, 200) for x in unaccounted_in) if text
    ]
    shape["inventory_fallback"] = coverage_enum(
        coverage.get("inventoryFallback"),
        ("inventory-failed", "empty-partition", "incomplete-partition"),
    )
    top_count = coverage.get("topLevelCount")
    shape["top_level_dir_count"] = (
        top_count if isinstance(top_count, int) and not isinstance(top_count, bool) else None
    )
    return shape


def validate_round_ledger(rounds: JsonMap) -> tuple[int, int]:
    """Validate round ids and return (known votes, maximum unrecorded votes).

    Normal rounds account for every vote exactly. An `adversarial.incomplete`
    record is the workflow's fail-closed exception path: it deliberately keeps
    only that marker, so at most four extra votes (three repanel plus one
    red-team vote) may have occurred without their detailed record surviving.
    """
    known_votes = 0
    maximum_unrecorded_votes = 0
    for raw_id, raw_round in rounds.items():
        if not isinstance(raw_id, str) or not FINDING_ID_RE.match(raw_id):
            raise RenderError(f"votes.json round key {raw_id!r} is not a valid candidate id")
        round_record = as_map(raw_round)
        if round_record is None:
            raise RenderError(f"votes.json round {raw_id!r} must be an object")

        panel = panel_counts(round_record.get("panel"), f"rounds[{raw_id!r}].panel")
        if panel is None:
            maximum_unrecorded_votes += PANEL_VOTER_COUNT
        else:
            known_votes += panel["voters"]

        adversarial_raw = round_record.get("adversarial")
        if adversarial_raw is None:
            continue
        adversarial = as_map(adversarial_raw)
        if adversarial is None:
            raise RenderError(f"rounds[{raw_id!r}].adversarial must be an object")
        if panel is None or panel["voters"] != PANEL_VOTER_COUNT or panel["true"] < PANEL_KEEP_QUORUM:
            raise RenderError(
                f"rounds[{raw_id!r}].adversarial cannot exist without a complete "
                "first-panel keep quorum"
            )

        incomplete = adversarial.get("incomplete")
        if incomplete is True:
            if set(adversarial) != {"incomplete"}:
                raise RenderError(
                    f"rounds[{raw_id!r}].adversarial marked incomplete cannot also "
                    "claim detailed votes"
                )
            maximum_unrecorded_votes += PANEL_VOTER_COUNT + 1
            continue
        if incomplete not in (None, False):
            raise RenderError(
                f"rounds[{raw_id!r}].adversarial.incomplete must be a boolean"
            )

        repanel_raw = adversarial.get("repanel")
        repanel = panel_counts(
            repanel_raw,
            f"rounds[{raw_id!r}].adversarial.repanel",
        )
        if repanel is not None:
            if panel["true"] != PANEL_KEEP_QUORUM:
                raise RenderError(
                    f"rounds[{raw_id!r}].adversarial.repanel is only valid for a "
                    "marginal first-panel keep"
                )
            known_votes += repanel["voters"]

        redteam = adversarial.get("redteam")
        if redteam in ("TRUE_POSITIVE", "FALSE_POSITIVE"):
            if (
                repanel is not None
                and repanel["voters"] == PANEL_VOTER_COUNT
                and repanel["true"] < PANEL_KEEP_QUORUM
            ):
                raise RenderError(
                    f"rounds[{raw_id!r}].adversarial.redteam cannot follow a "
                    "complete repanel rejection"
                )
            known_votes += 1
        elif redteam not in (None, "no-vote"):
            raise RenderError(
                f"rounds[{raw_id!r}].adversarial.redteam has unknown value {redteam!r}"
            )
    return known_votes, maximum_unrecorded_votes


def verification_summary(
    findings: list[Finding],
    votes: JsonMap,
    votes_present: bool = True,
) -> VerificationSummary:
    """Compute the stamp's verification object from the vote record.

    status is 'verified' only when the vote record proves the panel ran for
    every finding the report contains; otherwise 'unverified' with a `reason`.
    votes_present is False when votes.json was absent from the run directory.
    """
    rounds = as_map(votes.get("rounds")) or {}
    known_panel_votes, maximum_unrecorded_votes = validate_round_ledger(rounds)
    panel_reviewed = 0
    panel_quorum = 0
    incomplete: list[str] = []

    for finding in findings:
        finding_id = str(finding.get("id", ""))
        panel = panel_complete(
            rounds.get(finding_id),
            f"rounds[{finding_id!r}].panel",
        )
        if panel is None:
            incomplete.append(finding_id)
            continue
        panel_reviewed += 1
        if panel.get("true", 0) >= PANEL_KEEP_QUORUM:
            panel_quorum += 1

    def as_count(key: str) -> int:
        """A vote count as a non-negative int; a wrong shape is a refusal."""
        value = votes.get(key, 0)
        if isinstance(value, bool) or not isinstance(value, int) or value < 0:
            msg = (
                f"votes.json field {key!r} is not a non-negative integer ({value!r}); the "
                "vote record is malformed"
            )
            raise RenderError(msg)
        return value

    def optional_count(key: str) -> int | None:
        """A count that may be absent: None when so, else as_count's contract."""
        if key not in votes:
            return None
        return as_count(key)

    required_count_fields = (
        "candidates",
        "candidates_deduped",
        "panel_votes",
        "unreviewed_candidate_sites",
    )
    missing_count_fields = [key for key in required_count_fields if key not in votes]
    researchers_dispatched = optional_count("researchers_dispatched")
    researchers_returned = optional_count("researchers_returned")
    candidates = as_count("candidates")
    candidates_deduped = as_count("candidates_deduped")
    panel_votes = as_count("panel_votes")
    unreviewed_candidate_sites = as_count("unreviewed_candidate_sites")

    if "candidates" in votes and "candidates_deduped" in votes:
        if candidates_deduped > candidates:
            raise RenderError(
                "votes.json is inconsistent: candidates_deduped cannot exceed candidates"
            )
    if "candidates_deduped" in votes:
        if len(rounds) > candidates_deduped:
            raise RenderError(
                "votes.json is inconsistent: it has more panel round ids than "
                "deduplicated candidates"
            )
        if len(findings) > candidates_deduped:
            raise RenderError(
                "votes.json is inconsistent: it has fewer deduplicated candidates "
                "than reported findings"
            )
    if "candidates" in votes:
        if len(findings) > candidates:
            raise RenderError(
                "votes.json is inconsistent: it has fewer candidates than reported findings"
            )
        if "unreviewed_candidate_sites" in votes and (
            len(rounds) + unreviewed_candidate_sites > candidates
        ):
            raise RenderError(
                "votes.json is inconsistent: reviewed round ids plus unreviewed "
                "candidate sites exceed candidates"
            )
    if "candidates_deduped" in votes and "unreviewed_candidate_sites" in votes:
        missing_review_records = max(candidates_deduped - len(rounds), 0)
        if unreviewed_candidate_sites < missing_review_records:
            raise RenderError(
                "votes.json is inconsistent: unreviewed_candidate_sites does not "
                "account for deduplicated candidates without a panel round"
            )
    if "panel_votes" in votes:
        maximum_panel_votes = known_panel_votes + maximum_unrecorded_votes
        if not (known_panel_votes <= panel_votes <= maximum_panel_votes):
            raise RenderError(
                "votes.json panel_votes is inconsistent with rounds "
                f"({panel_votes} recorded; expected {known_panel_votes}"
                + (
                    f"..{maximum_panel_votes} because an incomplete round lost detail)"
                    if maximum_unrecorded_votes
                    else ")"
                )
            )
    if (
        researchers_dispatched is not None
        and researchers_returned is not None
        and researchers_returned > researchers_dispatched
    ):
        raise RenderError(
            "votes.json researchers_returned cannot exceed researchers_dispatched"
        )

    summary: dict[str, object] = {
        "status": "verified",
        "candidates": candidates,
        "candidates_deduped": candidates_deduped,
        "panel_votes": panel_votes,
        "panel_reviewed_findings": panel_reviewed,
        "panel_quorum_findings": panel_quorum,
        "unreviewed_candidate_sites": unreviewed_candidate_sites,
        "attested_findings": 0,
        "reason": None,
    }
    if researchers_dispatched is not None:
        summary["researchers_dispatched"] = researchers_dispatched
    if researchers_returned is not None:
        summary["researchers_returned"] = researchers_returned

    reportable: list[Finding] = findings
    if not votes_present:
        summary["status"] = "unverified"
        summary["reason"] = (
            "votes.json is absent from the run directory: the verification "
            "pipeline left no vote record, so nothing about this report can be "
            "attested"
        )
    elif missing_count_fields:
        summary["status"] = "unverified"
        summary["reason"] = (
            "votes.json is missing required count field(s) "
            f"{', '.join(repr(key) for key in missing_count_fields)}: the vote "
            "record does not prove the pipeline ran, so nothing about this report "
            "can be attested"
        )
    elif researchers_dispatched and researchers_returned == 0:
        summary["status"] = "unverified"
        summary["reason"] = (
            f"{researchers_dispatched} research agent(s) were dispatched but none returned; "
            "the scan examined nothing"
        )
    elif incomplete:
        summary["status"] = "unverified"
        summary["reason"] = (
            f"these findings have no complete {PANEL_VOTER_COUNT}-voter panel round: "
            f"{', '.join(sorted(incomplete))}"
        )
    elif reportable and panel_quorum != len(reportable):
        summary["status"] = "unverified"
        summary["reason"] = (
            f"{len(reportable) - panel_quorum} of {len(reportable)} reported findings did not "
            "reach the keep quorum, so the report contains findings the panel rejected"
        )
    elif not findings and not votes.get("rounds") and summary["candidates"]:
        summary["status"] = "unverified"
        summary["reason"] = f"{summary['candidates']} candidates were recorded but none was paneled"
    elif not findings and rounds and not any(
        panel_complete(record, f"rounds[{round_id!r}].panel")
        for round_id, record in rounds.items()
    ):
        summary["status"] = "unverified"
        summary["reason"] = (
            f"{len(rounds)} panel round(s) were dispatched but none completed a full "
            f"{PANEL_VOTER_COUNT}-voter review; no candidate was actually verified"
        )
    return cast("VerificationSummary", cast("object", summary))


def revision_tag(revision: object) -> str:
    """The stamp's filename tag: <sha12>[-dirty], or UNVERSIONED."""
    rev = as_map(revision) or {}
    sha = rev.get("commit") or rev.get("head")
    if not sha:
        return "UNVERSIONED"
    if not (isinstance(sha, str) and HEX_RE.match(sha)):
        msg = f"the run's revision {sha!r} is not a hex commit id, so it cannot name the stamp file"
        raise RenderError(msg)
    return sha[:12] + ("" if rev.get("dirty") is False else "-dirty")


def canonical_report_paths(run_dir: str, products_dir: str) -> tuple[str, str]:
    """Resolve and validate the one owned report/run hierarchy."""
    products_arg = os.path.abspath(products_dir)
    run_arg = os.path.abspath(run_dir)
    if os.path.islink(products_arg):
        raise RenderError("products directory itself must not be a symbolic link")
    if os.path.islink(run_arg):
        raise RenderError("run directory itself must not be a symbolic link")

    products = os.path.realpath(products_arg)
    run = os.path.realpath(run_arg)
    match = REPORT_DIR_RE.match(os.path.basename(products))
    if match is None:
        raise RenderError(
            "products directory must be named "
            "CRABCODE-SECURITY-<UTC YYYYMMDD-HHMMSS>-<16 lowercase hex nonce>"
        )
    try:
        datetime.strptime(match.group(1), "%Y%m%d-%H%M%S")
    except ValueError as error:
        raise RenderError(
            "products directory has an invalid UTC YYYYMMDD-HHMMSS timestamp"
        ) from error

    if os.path.basename(run) != RUN_DIR_NAME:
        raise RenderError(f"run directory basename must be exactly {RUN_DIR_NAME!r}")
    try:
        inside = os.path.commonpath((run, products)) == products
    except ValueError:
        inside = False
    if not inside or os.path.dirname(run) != products:
        raise RenderError(
            f"run directory must resolve to the direct {RUN_DIR_NAME} child of products directory"
        )
    return run, products


def validate_report_ownership(run_dir: str, products_dir: str) -> None:
    """Require the creator's byte-identical owner records and inert fences."""
    run_owner = os.path.join(run_dir, OWNER_MARKER_NAME)
    products_owner = os.path.join(products_dir, OWNER_MARKER_NAME)
    run_fence = os.path.join(run_dir, FENCE_NAME)
    products_fence = os.path.join(products_dir, FENCE_NAME)
    meta = os.path.join(run_dir, "scan-meta.json")
    # Touch metadata through the same regular-file/no-follow reader before any
    # later parser consumes it.
    read_regular_bytes(meta, "scan metadata")
    for fence, label in (
        (products_fence, "products fence"),
        (run_fence, "run fence"),
    ):
        if read_regular_bytes(fence, label, 16) != FENCE_CONTENT.encode("utf-8"):
            raise RenderError(f"{label} {FENCE_NAME!r} must contain exactly '*\\n'")

    products_payload = read_regular_bytes(
        products_owner, "products ownership marker", 16 * 1024
    )
    run_payload = read_regular_bytes(run_owner, "run ownership marker", 16 * 1024)
    if products_payload != run_payload:
        raise RenderError("products and run ownership markers must be byte-identical")
    try:
        owner_raw = cast("object", json.loads(products_payload.decode("utf-8")))
    except (UnicodeError, ValueError) as error:
        raise RenderError(f"ownership marker is not valid UTF-8 JSON: {error}") from error
    owner = as_map(owner_raw)
    if owner is None:
        raise RenderError("ownership marker must be a JSON object")
    expected_run_id = os.path.basename(products_dir).removeprefix(
        "CRABCODE-SECURITY-"
    )
    expected: dict[str, object] = {
        "schema": OWNER_SCHEMA,
        "owner": OWNER_NAME,
        "run_id": expected_run_id,
        "source_root": os.path.dirname(products_dir),
        "report_dir": products_dir,
        "run_dir": run_dir,
    }
    if set(owner) != set(expected):
        raise RenderError("ownership marker fields do not match the run-owner schema")
    for key, value in expected.items():
        if owner.get(key) != value:
            raise RenderError(f"ownership marker field {key!r} does not match this run")


def stale_revision_paths(products_dir: str) -> list[str]:
    """Preflight only regular, owned revision stamps for later deletion."""
    stale: list[str] = []
    for name in os.listdir(products_dir):
        if not REVISION_FILE_RE.match(name):
            continue
        path = os.path.join(products_dir, name)
        try:
            info = os.lstat(path)
        except OSError as error:
            raise RenderError(f"could not inspect stale revision stamp {name!r}: {error}") from error
        if stat.S_ISLNK(info.st_mode):
            raise RenderError(f"refusing to remove stale revision symlink {name!r}")
        if not stat.S_ISREG(info.st_mode):
            raise RenderError(f"refusing to remove non-file stale revision path {name!r}")
        if os.path.dirname(os.path.realpath(path)) != products_dir:
            raise RenderError(f"stale revision stamp {name!r} resolves outside products directory")
        stale.append(path)
    return stale


def unlink_stale_revision(path: str, products_dir: str) -> None:
    """Recheck a preflighted revision stamp immediately before unlinking it."""
    if os.path.dirname(os.path.abspath(path)) != products_dir:
        raise RenderError("stale revision deletion escaped products directory")
    info = os.lstat(path)
    if stat.S_ISLNK(info.st_mode) or not stat.S_ISREG(info.st_mode):
        raise RenderError(
            f"stale revision path {os.path.basename(path)!r} changed before deletion"
        )
    if os.path.dirname(os.path.realpath(path)) != products_dir:
        raise RenderError("stale revision path changed to resolve outside products directory")
    os.unlink(path)


def atomic_write(path: str, text: str) -> None:
    """Write `text` atomically: a temp file in the same directory, then replace."""
    directory = os.path.dirname(path)
    handle, temp = tempfile.mkstemp(dir=directory, prefix=".render.")
    try:
        with os.fdopen(handle, "w", encoding="utf-8") as out:
            out.write(text)
            out.flush()
            os.fsync(out.fileno())
        os.replace(temp, path)
    except BaseException:
        with contextlib.suppress(OSError):
            os.unlink(temp)
        raise


def jsonl_line(finding: Finding) -> str:
    """One finding, fixed field order, separators escaped."""
    text = json.dumps(finding, ensure_ascii=False, sort_keys=False)
    return text.translate(SEPARATOR_ESCAPES)


def render(run_dir: str, products_dir: str) -> tuple[list[Finding], VerificationSummary, str]:
    meta_raw = read_json(run_dir, "scan-meta.json")
    findings_raw = read_json(run_dir, "findings.json")
    votes: object = read_json(run_dir, "votes.json", required=False)
    coverage, coverage_source = read_coverage(run_dir)
    votes_present = votes is not None
    if votes is None:
        votes = {}

    if not isinstance(findings_raw, list):
        raise RenderError("findings.json must be a JSON array (use [] for no findings)")
    meta = as_map(meta_raw)
    if meta is None:
        raise RenderError("scan-meta.json must be a JSON object")
    recorded_run_dir = meta.get("run_dir")
    if not isinstance(recorded_run_dir, str) or os.path.realpath(recorded_run_dir) != run_dir:
        raise RenderError(
            "scan-meta.json run_dir must record the canonical run directory being rendered"
        )
    recorded_scan_root = meta.get("scan_root")
    recorded_source_root = meta.get("source_root")
    if (
        not isinstance(recorded_scan_root, str)
        or os.path.dirname(products_dir) != os.path.realpath(recorded_scan_root)
        or not isinstance(recorded_source_root, str)
        or os.path.realpath(recorded_source_root) != os.path.realpath(recorded_scan_root)
    ):
        raise RenderError(
            "scan-meta.json scan_root/source_root must both name the canonical "
            "parent of the products directory"
        )
    recorded_report_dir = meta.get("report_dir")
    if (
        not isinstance(recorded_report_dir, str)
        or os.path.realpath(recorded_report_dir) != products_dir
    ):
        raise RenderError(
            "scan-meta.json report_dir must record the canonical products directory"
        )
    recorded_analysis_root = meta.get("analysis_root")
    if (
        not isinstance(recorded_analysis_root, str)
        or os.path.realpath(recorded_analysis_root)
        != os.path.realpath(os.path.join(run_dir, "analysis-root"))
    ):
        raise RenderError(
            "scan-meta.json analysis_root must record the run's direct analysis-root"
        )
    try:
        analysis_info = os.lstat(recorded_analysis_root)
    except OSError as error:
        raise RenderError("the captured analysis_root is missing") from error
    if stat.S_ISLNK(analysis_info.st_mode) or not stat.S_ISDIR(
        analysis_info.st_mode
    ):
        raise RenderError("the captured analysis_root must be a real directory")
    snapshot_kind = meta.get("snapshot_kind")
    if not isinstance(snapshot_kind, str) or not snapshot_kind:
        raise RenderError("scan-meta.json snapshot_kind must be a non-empty string")
    analysis_content = as_map(meta.get("analysis_content"))
    if (
        analysis_content is None
        or analysis_content.get("algorithm") != "sha256-path-mode-content-v1"
        or not isinstance(analysis_content.get("sha256"), str)
        or re.fullmatch(r"[0-9a-f]{64}", cast(str, analysis_content.get("sha256")))
        is None
        or isinstance(analysis_content.get("entries"), bool)
        or not isinstance(analysis_content.get("entries"), int)
        or cast(int, analysis_content.get("entries")) < 0
        or isinstance(analysis_content.get("bytes"), bool)
        or not isinstance(analysis_content.get("bytes"), int)
        or cast(int, analysis_content.get("bytes")) < 0
    ):
        raise RenderError("scan-meta.json analysis_content is malformed")
    actual_analysis_content = analysis_content_digest(recorded_analysis_root)
    if dict(analysis_content) != actual_analysis_content:
        raise RenderError(
            "analysis_root content no longer matches scan-meta.json analysis_content"
        )
    source_revision = as_map(meta.get("source_revision"))
    if source_revision is None:
        raise RenderError("scan-meta.json source_revision must be an object")
    if meta.get("revision_source") != "tool-captured":
        raise RenderError("scan-meta.json revision_source must be 'tool-captured'")
    votes_map = as_map(votes)
    if votes_map is None:
        raise RenderError("votes.json must be a JSON object mapping the vote record")
    rounds_raw = votes_map.get("rounds")
    rounds_by_id: JsonMap = {} if rounds_raw is None else (as_map(rounds_raw) or {})
    if rounds_raw is not None and not isinstance(rounds_raw, dict):
        kind = type(rounds_raw).__name__
        msg = f"votes.json 'rounds' must be an object keyed by finding id, not {kind}"
        raise RenderError(msg)
    findings = [
        build_finding(raw, i, rounds_by_id)
        for i, raw in enumerate(cast("list[object]", findings_raw))
    ]

    seen = {}
    for finding in findings:
        if finding["id"] in seen:
            msg = "finding id {!r} appears twice in findings.json".format(finding["id"])
            raise RenderError(msg)
        seen[finding["id"]] = True

    markdown_path = os.path.join(run_dir, "CRABCODE-SECURITY-RESULTS.md")
    if not os.path.lexists(markdown_path):
        raise RenderError(
            "CRABCODE-SECURITY-RESULTS.md is missing. Write the human-readable "
            "report before running this script."
        )
    try:
        markdown = read_regular_bytes(
            markdown_path, "CRABCODE-SECURITY-RESULTS.md"
        ).decode("utf-8")
    except UnicodeError as error:
        raise RenderError("CRABCODE-SECURITY-RESULTS.md is not valid UTF-8") from error

    counts: dict[str, int] = dict.fromkeys(SEVERITIES, 0)
    for finding in findings:
        counts[str(finding.get("severity", ""))] += 1

    verification = verification_summary(findings, votes_map, votes_present=votes_present)
    revision: object = meta.get("revision") or {}
    tag = revision_tag(revision)
    stale_revisions = stale_revision_paths(products_dir)

    atomic_write(
        os.path.join(products_dir, "CRABCODE-SECURITY-RESULTS.jsonl"),
        "".join(jsonl_line(f) + "\n" for f in findings),
    )
    markdown_out = os.path.join(products_dir, "CRABCODE-SECURITY-RESULTS.md")
    if os.path.realpath(markdown_path) != os.path.realpath(markdown_out):
        atomic_write(markdown_out, markdown)
        os.unlink(markdown_path)

    stamp: dict[str, object] = {
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "scan_root": meta.get("scan_root"),
        "source_root": meta.get("source_root"),
        "products_dir": products_dir,
        "mode": meta.get("mode"),
        "scope": meta.get("scope") or [],
        "revision": revision,
        "source_revision": dict(source_revision),
        "revision_source": "tool-captured",
        "analysis": {
            "snapshot_kind": snapshot_kind,
            "revision": revision,
            "content": dict(analysis_content),
        },
        "model": meta.get("model"),
        "effort": meta.get("effort"),
        "run_shape": run_shape(coverage, coverage_source, meta.get("effort")),
        "findings": {
            "total": len(findings),
            "high": counts["HIGH"],
            "medium": counts["MEDIUM"],
            "low": counts["LOW"],
        },
        "verification": verification,
    }
    for stale in stale_revisions:
        unlink_stale_revision(stale, products_dir)
    atomic_write(
        os.path.join(products_dir, f"{REVISION_PREFIX}{tag}.json"),
        json.dumps(stamp, indent=2) + "\n",
    )

    return findings, verification, tag


def remove_run_dir(run_dir: str, products_dir: str) -> str:
    """Remove the scan's run directory once rendered; returns a one-line status."""
    try:
        target, products = canonical_report_paths(run_dir, products_dir)
        validate_report_ownership(target, products)
    except RenderError as error:
        return f"kept {run_dir} ({error})"
    try:
        info = os.lstat(target)
    except OSError as error:
        return f"kept {run_dir} (could not recheck run directory: {error})"
    if stat.S_ISLNK(info.st_mode) or not stat.S_ISDIR(info.st_mode):
        return f"kept {run_dir} (run directory changed before deletion)"
    if os.path.dirname(os.path.realpath(target)) != products:
        return f"kept {run_dir} (run directory escaped products before deletion)"
    try:
        shutil.rmtree(target)
    except OSError as error:
        detail = error.args[0] if error.args else error
        return f"WARNING: could not remove run directory {run_dir}: {detail}"
    return f"removed run directory {run_dir}"


def main(argv: list[str]) -> int:
    products_dir: str | None = None
    args = list(argv)
    if len(args) == 3 and args[1] == "--products-dir":
        products_dir = args.pop(2)
        args.pop(1)
    if len(args) != 1:
        die("usage: render_report.py <run-dir> [--products-dir <dir>]")
    run_dir = args[0]
    if not os.path.isdir(run_dir):
        die(f"not a directory: {run_dir}")
    products_dir = products_dir or os.path.dirname(os.path.abspath(run_dir))
    if not os.path.isdir(products_dir):
        die(f"products directory is not a directory: {products_dir}")
    try:
        run_dir, products_dir = canonical_report_paths(run_dir, products_dir)
        validate_report_ownership(run_dir, products_dir)
        findings, verification, tag = render(run_dir, products_dir)
    except RenderError as error:
        die(str(error))
    except OSError as error:
        die(f"could not read or write the report's files: {error}")
    removal = remove_run_dir(run_dir, products_dir)
    print(
        f"wrote CRABCODE-SECURITY-RESULTS.jsonl ({len(findings)} finding"
        f"{'' if len(findings) == 1 else 's'}) and {REVISION_PREFIX}{tag}.json "
        f"into {products_dir}"
    )
    print(f"stamp: {REVISION_PREFIX}{tag}.json")
    print(f"verification.status: {verification.get('status')}")
    reason = verification.get("reason")
    if reason:
        print(f"verification.reason: {reason}")
    print(removal)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
