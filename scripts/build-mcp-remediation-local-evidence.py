#!/usr/bin/env python3
"""Build deterministic, sanitized local-test manifest/attestation files.

This generator never pushes refs and never overwrites an output directory. Git
root-commit construction and SSH-signed tags remain explicit release-operator
steps documented in LOCAL-TEST-ATTESTATION.md.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys


RFC3339_UTC = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z")
SAFE_CELL = re.compile(r"[a-z0-9][a-z0-9._-]*")
SECRET_PATTERNS = (
    ("private-key", re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----")),
    ("aws-access-key", re.compile(rb"(?:A3T[A-Z0-9]|AKIA|ASIA)[A-Z0-9]{16}")),
    ("github-token", re.compile(rb"gh[pousr]_[A-Za-z0-9]{30,}")),
    ("api-style-key", re.compile(rb"sk-[A-Za-z0-9_-]{20,}")),
    ("slack-token", re.compile(rb"xox[baprs]-[A-Za-z0-9-]{10,}")),
    ("google-api-key", re.compile(rb"AIza[0-9A-Za-z_-]{30,}")),
    ("bearer-header", re.compile(rb"(?i)authorization:\s*bearer\s+\S{12,}")),
    ("cookie-header", re.compile(rb"(?im)^set-cookie:\s*\S|^cookie:\s*\S")),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--release-repo", type=Path, required=True)
    parser.add_argument("--records-json", type=Path, required=True)
    parser.add_argument("--matrix-contract-json", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--expected-commit")
    parser.add_argument("--expected-tree")
    return parser.parse_args()


def git_text(repo: Path, *args: str) -> str:
    completed = subprocess.run(
        ["git", "-C", str(repo), *args],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    return completed.stdout.strip()


def credential_findings(data: bytes) -> list[str]:
    return [name for name, pattern in SECRET_PATTERNS if pattern.search(data)]


def build(args: argparse.Namespace) -> dict[str, object]:
    release_repo = args.release_repo.resolve(strict=True)
    if git_text(release_repo, "status", "--porcelain", "--untracked-files=no"):
        raise ValueError("release repository has tracked changes; evidence must bind a clean commit")
    release_commit = git_text(release_repo, "rev-parse", "HEAD")
    release_tree = git_text(release_repo, "rev-parse", "HEAD^{tree}")
    if args.expected_commit and args.expected_commit != release_commit:
        raise ValueError(f"release commit mismatch: {release_commit} != {args.expected_commit}")
    if args.expected_tree and args.expected_tree != release_tree:
        raise ValueError(f"release tree mismatch: {release_tree} != {args.expected_tree}")

    contract = json.loads(args.matrix_contract_json.read_text(encoding="utf-8"))
    commands = contract.get("commands")
    cells = contract.get("cells")
    if (
        contract.get("schemaVersion") != 1
        or contract.get("evidenceId") != "mcp-remediation-local-matrix-contract-v1"
        or not isinstance(commands, dict)
        or not isinstance(cells, dict)
        or len(cells) != 18
    ):
        raise ValueError("invalid canonical local matrix contract")
    records_payload = json.loads(args.records_json.read_text(encoding="utf-8"))
    records = records_payload.get("records") if isinstance(records_payload, dict) else None
    if not isinstance(records, dict) or set(records) != set(cells):
        raise ValueError("records JSON must contain exactly every canonical matrix cell")

    output = args.output_root.resolve()
    if output.exists():
        raise ValueError("output-root must not already exist")
    logs_output = output / "logs"
    logs_output.mkdir(parents=True, mode=0o700)
    runs: list[dict[str, object]] = []
    seen_log_sources: set[tuple[int, int]] = set()
    try:
        for cell in sorted(cells):
            if SAFE_CELL.fullmatch(cell) is None:
                raise ValueError(f"unsafe matrix cell name: {cell}")
            definition = cells[cell]
            record = records[cell]
            if not isinstance(definition, dict) or not isinstance(record, dict):
                raise ValueError(f"invalid matrix definition/record for {cell}")
            command_id = definition.get("commandId")
            command = commands.get(command_id) if isinstance(command_id, str) else None
            environment = definition.get("environment")
            if not isinstance(command, str) or not isinstance(environment, dict):
                raise ValueError(f"invalid command/environment contract for {cell}")
            started = record.get("startedAt")
            finished = record.get("finishedAt")
            if (
                record.get("exitCode") != 0
                or record.get("result") != "pass"
                or not isinstance(started, str)
                or RFC3339_UTC.fullmatch(started) is None
                or not isinstance(finished, str)
                or RFC3339_UTC.fullmatch(finished) is None
                or finished < started
            ):
                raise ValueError(f"cell {cell} is not a completed passing UTC run")
            source_raw = record.get("logPath")
            if not isinstance(source_raw, str):
                raise ValueError(f"cell {cell} logPath must be a string")
            authored_source = Path(source_raw)
            if authored_source.is_symlink():
                raise ValueError(f"cell {cell} log must be an ordinary file")
            source = authored_source.resolve(strict=True)
            if not source.is_file():
                raise ValueError(f"cell {cell} log must be an ordinary file")
            source_stat = source.stat()
            source_identity = (source_stat.st_dev, source_stat.st_ino)
            if source_identity in seen_log_sources:
                raise ValueError(f"cell {cell} reuses another cell's raw log file")
            seen_log_sources.add(source_identity)
            data = source.read_bytes()
            if not data:
                raise ValueError(f"cell {cell} log is empty")
            findings = credential_findings(data)
            if findings:
                raise ValueError(f"cell {cell} log contains credential-shaped bytes: {findings}")
            destination = logs_output / f"{cell}.log"
            destination.write_bytes(data)
            destination.chmod(0o644)
            runs.append({
                "cell": cell,
                "command": command,
                "environment": environment,
                "startedAt": started,
                "finishedAt": finished,
                "exitCode": 0,
                "result": "pass",
                "log": {
                    "relativePath": f"logs/{cell}.log",
                    "sizeBytes": len(data),
                    "sha256": hashlib.sha256(data).hexdigest(),
                },
            })
        manifest_bytes = (json.dumps({
            "schemaVersion": 1,
            "evidenceId": "mcp-remediation-local-logs-v1",
            "testedCommit": release_commit,
            "testedTree": release_tree,
            "status": "pass",
            "secretsScanStatus": "pass",
            "runs": runs,
        }, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
        attestation_bytes = (json.dumps({
            "schemaVersion": 1,
            "evidenceId": "mcp-remediation-local-tests-v1",
            "status": "pass",
            "testedCommit": release_commit,
            "testedTree": release_tree,
            "allRequiredLocalRunsPass": True,
            "logsEvidenceRef": f"refs/tags/mcp-remediation-logs-{release_commit}",
            "logsManifestSha256": hashlib.sha256(manifest_bytes).hexdigest(),
            "supportMatrix": {cell: "pass" for cell in sorted(cells)},
        }, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
        if credential_findings(manifest_bytes + attestation_bytes):
            raise ValueError("generated evidence metadata contains credential-shaped bytes")
        (output / "manifest.json").write_bytes(manifest_bytes)
        (output / "attestation.json").write_bytes(attestation_bytes)
        (output / "manifest.json").chmod(0o644)
        (output / "attestation.json").chmod(0o644)
    except Exception:
        shutil.rmtree(output, ignore_errors=True)
        raise
    return {
        "releaseCommit": release_commit,
        "releaseTree": release_tree,
        "outputRoot": str(output),
        "cellCount": len(runs),
        "logsManifestSha256": hashlib.sha256((output / "manifest.json").read_bytes()).hexdigest(),
        "nextStep": "build a zero-parent commit and SSH-sign both deterministic tags; no refs were created",
    }


def main() -> int:
    args = parse_args()
    try:
        result = build(args)
    except (OSError, subprocess.CalledProcessError, UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
