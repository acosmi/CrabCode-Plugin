#!/usr/bin/env python3
"""Validate the out-of-tree annotated-tag attestation for exact-main local tests."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys


SHA = re.compile(r"[0-9a-f]{40}")
SHA256 = re.compile(r"[0-9a-f]{64}")
EVIDENCE_ID = "mcp-remediation-local-tests-v1"
LOGS_EVIDENCE_ID = "mcp-remediation-local-logs-v1"
RFC3339_UTC = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z")
LOG_PATH = re.compile(r"logs/[a-z0-9][a-z0-9._-]*\.log")
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
REQUIRED_CELL_NAMES = frozenset({
    "root-macos-arm64",
    "root-linux-arm64",
    "html-video-macos-arm64",
    "html-video-linux-arm64",
    "media-ops-macos-arm64",
    "media-ops-linux-playwright-arm64",
    "media-publisher-macos-arm64",
    "media-publisher-linux-playwright-arm64",
    "crabcopyright-macos-python3.9",
    "crabcopyright-macos-python3.13",
    "crabcopyright-linux-python3.9",
    "crabcopyright-linux-python3.13",
    "security-macos-python3.9",
    "security-macos-python3.13",
    "security-linux-python3.9",
    "security-linux-python3.13",
    "host-plugin-mcp-unit-suite",
    "old-to-safe-dual-process-fixture",
})


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--attestation-json", type=Path, required=True)
    parser.add_argument("--expected-commit", required=True)
    parser.add_argument("--expected-tree", required=True)
    parser.add_argument("--release-contract-json", type=Path, required=True)
    parser.add_argument("--git-repo", type=Path, required=True)
    parser.add_argument("--logs-commit", required=True)
    parser.add_argument("--logs-tree", required=True)
    parser.add_argument("--matrix-contract-json", type=Path, required=True)
    return parser.parse_args()


def git(repo: Path, *args: str) -> bytes:
    completed = subprocess.run(
        ["git", "-C", str(repo), *args],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return completed.stdout


def git_text(repo: Path, *args: str) -> str:
    return git(repo, *args).decode("utf-8").strip()


def secret_findings(data: bytes) -> list[str]:
    return [name for name, pattern in SECRET_PATTERNS if pattern.search(data)]


def validate(
    path: Path,
    release_contract_path: Path,
    git_repo: Path,
    logs_commit: str,
    logs_tree: str,
    matrix_contract_path: Path,
    expected_commit: str,
    expected_tree: str,
) -> dict[str, object]:
    if SHA.fullmatch(expected_commit) is None or SHA.fullmatch(expected_tree) is None:
        raise ValueError("expected commit/tree must be full lowercase Git object IDs")
    payload = json.loads(path.read_text(encoding="utf-8"))
    contract = json.loads(release_contract_path.read_text(encoding="utf-8"))
    matrix_contract = json.loads(matrix_contract_path.read_text(encoding="utf-8"))
    commands = matrix_contract.get("commands")
    cells = matrix_contract.get("cells")
    if (
        matrix_contract.get("schemaVersion") != 1
        or matrix_contract.get("evidenceId") != "mcp-remediation-local-matrix-contract-v1"
        or not isinstance(commands, dict)
        or not isinstance(cells, dict)
        or set(cells) != REQUIRED_CELL_NAMES
    ):
        raise ValueError("local test matrix contract must define the canonical 18 cells and commands")
    cell_contracts: dict[str, dict[str, object]] = {}
    for cell, definition in cells.items():
        if not isinstance(cell, str) or not isinstance(definition, dict):
            raise ValueError("local test matrix cell definitions must be named objects")
        command_id = definition.get("commandId")
        environment_value = definition.get("environment")
        command_value = commands.get(command_id) if isinstance(command_id, str) else None
        if not isinstance(command_value, str) or not command_value.strip() or not isinstance(environment_value, dict):
            raise ValueError(f"invalid local test matrix contract for {cell}")
        cell_contracts[cell] = {"command": command_value, "environment": environment_value}
    required_cells = tuple(sorted(cell_contracts))
    eligibility = contract.get("gateEligibility")
    remediation = contract.get("remediation")
    binding = remediation.get("testBinding") if isinstance(remediation, dict) else None
    commit_binding = remediation.get("commitBinding") if isinstance(remediation, dict) else None
    logs_binding_contract = remediation.get("logsBinding") if isinstance(remediation, dict) else None
    contract_required = {
        "status": "exact-main-annotated-tag-required",
        "eligibility.mode": "runtime-computed-from-exact-main-annotated-tag",
        "eligibility.staticPassForbidden": True,
        "binding.evidenceId": EVIDENCE_ID,
        "binding.validator": "scripts/validate-local-test-attestation.py",
        "binding.requiredCellCount": len(required_cells),
        "binding.matrixContract": "docs/audit/evidence/2026-08-23-mcp-remediation/local-test-matrix-contract.json",
        "commitBinding.signatureFormat": "ssh-ed25519",
        "commitBinding.allowedSigners": "docs/audit/keys/mcp-remediation-test-allowed-signers",
        "commitBinding.requiredPrincipal": "release-attestor",
        "logsBinding.type": "ssh-signed-annotated-git-tag",
        "logsBinding.zeroParentCommitRequired": True,
        "logsBinding.exactTreeAllowlistRequired": True,
        "logsBinding.rawLogByteVerificationRequired": True,
    }
    contract_actual = {
        "status": contract.get("status"),
        "eligibility.mode": eligibility.get("mode") if isinstance(eligibility, dict) else None,
        "eligibility.staticPassForbidden": eligibility.get("staticPassForbidden") if isinstance(eligibility, dict) else None,
        "binding.evidenceId": binding.get("evidenceId") if isinstance(binding, dict) else None,
        "binding.validator": binding.get("validator") if isinstance(binding, dict) else None,
        "binding.requiredCellCount": binding.get("requiredCellCount") if isinstance(binding, dict) else None,
        "binding.matrixContract": binding.get("matrixContract") if isinstance(binding, dict) else None,
        "commitBinding.signatureFormat": commit_binding.get("signatureFormat") if isinstance(commit_binding, dict) else None,
        "commitBinding.allowedSigners": commit_binding.get("allowedSigners") if isinstance(commit_binding, dict) else None,
        "commitBinding.requiredPrincipal": commit_binding.get("requiredPrincipal") if isinstance(commit_binding, dict) else None,
        "logsBinding.type": logs_binding_contract.get("type") if isinstance(logs_binding_contract, dict) else None,
        "logsBinding.zeroParentCommitRequired": logs_binding_contract.get("zeroParentCommitRequired") if isinstance(logs_binding_contract, dict) else None,
        "logsBinding.exactTreeAllowlistRequired": logs_binding_contract.get("exactTreeAllowlistRequired") if isinstance(logs_binding_contract, dict) else None,
        "logsBinding.rawLogByteVerificationRequired": logs_binding_contract.get("rawLogByteVerificationRequired") if isinstance(logs_binding_contract, dict) else None,
    }
    contract_mismatches = {
        key: {"expected": expected, "actual": contract_actual.get(key)}
        for key, expected in contract_required.items()
        if contract_actual.get(key) != expected
    }
    if contract_mismatches:
        raise ValueError(
            "release evidence contract is not runtime-bound: "
            + json.dumps(contract_mismatches, ensure_ascii=False, sort_keys=True)
        )
    required = {
        "schemaVersion": 1,
        "evidenceId": EVIDENCE_ID,
        "status": "pass",
        "testedCommit": expected_commit,
        "testedTree": expected_tree,
        "allRequiredLocalRunsPass": True,
    }
    mismatches = {
        key: {"expected": expected, "actual": payload.get(key)}
        for key, expected in required.items()
        if payload.get(key) != expected
    }
    matrix = payload.get("supportMatrix")
    if not isinstance(matrix, dict):
        mismatches["supportMatrix"] = {"expected": "object", "actual": matrix}
    else:
        for cell in required_cells:
            if matrix.get(cell) != "pass":
                mismatches[f"supportMatrix.{cell}"] = {
                    "expected": "pass",
                    "actual": matrix.get(cell),
                }
        if set(matrix) != set(required_cells):
            mismatches["supportMatrix.keys"] = {
                "expected": sorted(required_cells),
                "actual": sorted(str(key) for key in matrix),
            }
    logs_digest = payload.get("logsManifestSha256")
    if not isinstance(logs_digest, str) or SHA256.fullmatch(logs_digest) is None:
        mismatches["logsManifestSha256"] = {
            "expected": "64 lowercase hex",
            "actual": logs_digest,
        }
    expected_logs_ref = f"refs/tags/mcp-remediation-logs-{expected_commit}"
    logs_binding = {"logsEvidenceRef": expected_logs_ref}
    for key, expected in logs_binding.items():
        if payload.get(key) != expected:
            mismatches[key] = {"expected": expected, "actual": payload.get(key)}
    if SHA.fullmatch(logs_commit) is None or SHA.fullmatch(logs_tree) is None:
        mismatches["logsGitObjects"] = {
            "expected": "full lowercase commit/tree IDs",
            "actual": [logs_commit, logs_tree],
        }
    if mismatches:
        raise ValueError(
            "local test attestation is not exact-main release evidence: "
            + json.dumps(mismatches, ensure_ascii=False, sort_keys=True)
        )

    actual_logs_commit = git_text(git_repo, "rev-parse", "--verify", f"{logs_commit}^{{commit}}")
    actual_logs_tree = git_text(git_repo, "rev-parse", "--verify", f"{logs_commit}^{{tree}}")
    if actual_logs_commit != logs_commit or actual_logs_tree != logs_tree:
        raise ValueError(
            f"logs evidence Git binding mismatch: commit={actual_logs_commit} tree={actual_logs_tree}"
        )
    commit_line = git_text(git_repo, "rev-list", "--parents", "-n", "1", logs_commit)
    if commit_line != logs_commit:
        raise ValueError("logs evidence commit must be a zero-parent orphan/root commit")
    manifest_bytes = git(git_repo, "show", f"{logs_commit}:manifest.json")
    manifest_entry = git_text(git_repo, "ls-tree", logs_commit, "--", "manifest.json")
    if re.fullmatch(r"100644 blob [0-9a-f]{40}\tmanifest\.json", manifest_entry) is None:
        raise ValueError(f"logs manifest must be an ordinary 100644 blob: {manifest_entry!r}")
    actual_manifest_digest = hashlib.sha256(manifest_bytes).hexdigest()
    if actual_manifest_digest != logs_digest:
        raise ValueError(
            f"logs manifest SHA-256 mismatch: attested={logs_digest} actual={actual_manifest_digest}"
        )
    attestation_git_bytes = git(git_repo, "show", f"{logs_commit}:attestation.json")
    attestation_entry = git_text(git_repo, "ls-tree", logs_commit, "--", "attestation.json")
    if re.fullmatch(r"100644 blob [0-9a-f]{40}\tattestation\.json", attestation_entry) is None:
        raise ValueError(f"attestation must be an ordinary 100644 blob: {attestation_entry!r}")
    if attestation_git_bytes != path.read_bytes():
        raise ValueError("attestation bytes do not match signed logs evidence commit")
    metadata_secrets = {
        "attestation.json": secret_findings(attestation_git_bytes),
        "manifest.json": secret_findings(manifest_bytes),
    }
    metadata_secrets = {name: findings for name, findings in metadata_secrets.items() if findings}
    if metadata_secrets:
        raise ValueError(
            "local test evidence metadata contains credential-shaped bytes: "
            + json.dumps(metadata_secrets, sort_keys=True)
        )
    manifest = json.loads(manifest_bytes)
    manifest_required = {
        "schemaVersion": 1,
        "evidenceId": LOGS_EVIDENCE_ID,
        "testedCommit": expected_commit,
        "testedTree": expected_tree,
        "status": "pass",
        "secretsScanStatus": "pass",
    }
    manifest_mismatches = {
        key: {"expected": expected, "actual": manifest.get(key)}
        for key, expected in manifest_required.items()
        if manifest.get(key) != expected
    }
    runs = manifest.get("runs")
    if not isinstance(runs, list):
        manifest_mismatches["runs"] = {"expected": "array", "actual": runs}
        runs = []
    seen_cells: set[str] = set()
    seen_paths: set[str] = set()
    for index, run in enumerate(runs):
        prefix = f"runs[{index}]"
        if not isinstance(run, dict):
            manifest_mismatches[prefix] = {"expected": "object", "actual": run}
            continue
        cell = run.get("cell")
        if not isinstance(cell, str) or cell not in required_cells or cell in seen_cells:
            manifest_mismatches[f"{prefix}.cell"] = {
                "expected": "one unique required cell",
                "actual": cell,
            }
        else:
            seen_cells.add(cell)
        if run.get("result") != "pass" or run.get("exitCode") != 0:
            manifest_mismatches[f"{prefix}.result"] = {
                "expected": {"result": "pass", "exitCode": 0},
                "actual": {"result": run.get("result"), "exitCode": run.get("exitCode")},
            }
        command = run.get("command")
        environment_value = run.get("environment")
        expected_contract = cell_contracts.get(cell) if isinstance(cell, str) else None
        expected_command = expected_contract.get("command") if expected_contract else None
        expected_environment = expected_contract.get("environment") if expected_contract else None
        if command != expected_command:
            manifest_mismatches[f"{prefix}.command"] = {
                "expected": expected_command,
                "actual": command,
            }
        if not isinstance(environment_value, dict) or not isinstance(expected_environment, dict):
            manifest_mismatches[f"{prefix}.environment"] = {
                "expected": expected_environment,
                "actual": environment_value,
            }
        else:
            if environment_value != expected_environment:
                manifest_mismatches[f"{prefix}.environment"] = {
                    "expected": expected_environment,
                    "actual": environment_value,
                }
        started = run.get("startedAt")
        finished = run.get("finishedAt")
        if (
            not isinstance(started, str)
            or RFC3339_UTC.fullmatch(started) is None
            or not isinstance(finished, str)
            or RFC3339_UTC.fullmatch(finished) is None
            or finished < started
        ):
            manifest_mismatches[f"{prefix}.timestamps"] = {
                "expected": "ordered UTC RFC3339 second timestamps",
                "actual": [started, finished],
            }
        log_record = run.get("log")
        if not isinstance(log_record, dict):
            manifest_mismatches[f"{prefix}.log"] = {"expected": "object", "actual": log_record}
            continue
        log_path = log_record.get("relativePath")
        size = log_record.get("sizeBytes")
        digest = log_record.get("sha256")
        if (
            not isinstance(log_path, str)
            or LOG_PATH.fullmatch(log_path) is None
            or log_path in seen_paths
        ):
            manifest_mismatches[f"{prefix}.log.relativePath"] = {
                "expected": "unique logs/<safe-name>.log",
                "actual": log_path,
            }
            continue
        seen_paths.add(log_path)
        if not isinstance(size, int) or isinstance(size, bool) or size <= 0:
            manifest_mismatches[f"{prefix}.log.sizeBytes"] = {"expected": "positive integer", "actual": size}
        if not isinstance(digest, str) or SHA256.fullmatch(digest) is None:
            manifest_mismatches[f"{prefix}.log.sha256"] = {"expected": "64 lowercase hex", "actual": digest}
            continue
        tree_record = git_text(git_repo, "ls-tree", logs_commit, "--", log_path)
        match = re.fullmatch(r"100644 blob [0-9a-f]{40}\t(.+)", tree_record)
        if match is None or match.group(1) != log_path:
            manifest_mismatches[f"{prefix}.log.gitEntry"] = {
                "expected": "ordinary tracked blob at exact path",
                "actual": tree_record,
            }
            continue
        log_bytes = git(git_repo, "show", f"{logs_commit}:{log_path}")
        if len(log_bytes) != size or hashlib.sha256(log_bytes).hexdigest() != digest:
            manifest_mismatches[f"{prefix}.log.bytes"] = {
                "expected": {"sizeBytes": size, "sha256": digest},
                "actual": {
                    "sizeBytes": len(log_bytes),
                    "sha256": hashlib.sha256(log_bytes).hexdigest(),
                },
            }
        log_secret_findings = secret_findings(log_bytes)
        if log_secret_findings:
            manifest_mismatches[f"{prefix}.log.secrets"] = {
                "expected": [],
                "actual": log_secret_findings,
            }
    if seen_cells != set(required_cells) or len(runs) != len(required_cells):
        manifest_mismatches["runCells"] = {
            "expected": sorted(required_cells),
            "actual": sorted(seen_cells),
        }
    actual_tree_files = {
        value.decode("utf-8")
        for value in git(git_repo, "ls-tree", "-r", "-z", "--name-only", logs_commit).split(b"\0")
        if value
    }
    expected_tree_files = {"attestation.json", "manifest.json", *seen_paths}
    if actual_tree_files != expected_tree_files:
        manifest_mismatches["logsEvidenceTree.files"] = {
            "expected": sorted(expected_tree_files),
            "actual": sorted(actual_tree_files),
        }
    if manifest_mismatches:
        raise ValueError(
            "raw local test log manifest is invalid: "
            + json.dumps(manifest_mismatches, ensure_ascii=False, sort_keys=True)
        )
    return {
        "evidenceId": EVIDENCE_ID,
        "testedCommit": expected_commit,
        "testedTree": expected_tree,
        "logsManifestSha256": logs_digest,
        "logsEvidenceCommit": logs_commit,
        "logsEvidenceTree": logs_tree,
        "requiredCellCount": len(required_cells),
    }


def main() -> int:
    args = parse_args()
    try:
        result = validate(
            args.attestation_json,
            args.release_contract_json,
            args.git_repo,
            args.logs_commit,
            args.logs_tree,
            args.matrix_contract_json,
            args.expected_commit,
            args.expected_tree,
        )
    except (OSError, subprocess.CalledProcessError, UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
