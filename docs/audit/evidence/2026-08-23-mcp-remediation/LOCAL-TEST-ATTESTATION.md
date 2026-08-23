# Exact-main 本机测试与签名证据

最终 release commit 合入 `main` 后，18 个本机 cell 必须对该 exact commit/tree 重跑。发布证据使用两个 SSH-signed annotated tag，避免把证据写回 release tree 形成自引用：

```text
mcp-remediation-tested-<40-lowercase-main-sha>  → exact main release commit
mcp-remediation-logs-<40-lowercase-main-sha>    → zero-parent logs evidence commit
```

两个 tag 都必须用 `docs/audit/keys/mcp-remediation-test-allowed-signers` 钉住的 `release-attestor` Ed25519 key 签名。私钥只由发布操作者本地保管，禁止写入仓库、日志或 evidence commit。

## 1. Evidence tree

logs evidence 必须是 zero-parent root commit；禁止用普通工作分支 `git commit`，否则签名 tag 会让父历史一并公开可达。tree 文件集必须逐字节等于：

```text
attestation.json
manifest.json
logs/<18 个 canonical cell 各 1 个>.log
```

所有文件 mode 固定 `100644`，不得有额外 blob、symlink 或 submodule。canonical cell、真实可执行命令及 OS/architecture/runtime 合同只取：

```text
docs/audit/evidence/2026-08-23-mcp-remediation/local-test-matrix-contract.json
```

`manifest.json` schema：

```json
{
  "schemaVersion": 1,
  "evidenceId": "mcp-remediation-local-logs-v1",
  "testedCommit": "<exact main SHA>",
  "testedTree": "<exact tree SHA>",
  "status": "pass",
  "secretsScanStatus": "pass",
  "runs": [
    {
      "cell": "<canonical cell>",
      "command": "<matrix contract exact command>",
      "environment": { "<exact matrix environment>": "<value>" },
      "startedAt": "<UTC RFC3339 seconds>",
      "finishedAt": "<UTC RFC3339 seconds>",
      "exitCode": 0,
      "result": "pass",
      "log": {
        "relativePath": "logs/<safe-name>.log",
        "sizeBytes": 1,
        "sha256": "<SHA-256 of exact raw log bytes>"
      }
    }
  ]
}
```

`attestation.json` 与上面 manifest/logs 位于同一 signed root commit：

```json
{
  "schemaVersion": 1,
  "evidenceId": "mcp-remediation-local-tests-v1",
  "status": "pass",
  "testedCommit": "<exact main SHA>",
  "testedTree": "<exact tree SHA>",
  "allRequiredLocalRunsPass": true,
  "logsEvidenceRef": "refs/tags/mcp-remediation-logs-<exact main SHA>",
  "logsManifestSha256": "<SHA-256 of exact manifest.json bytes>",
  "supportMatrix": { "<all 18 canonical cells>": "pass" }
}
```

先准备 `records.json`：顶层 `records` 必须逐项覆盖 matrix contract 的 18 个 cell，每项只提供本次运行的 `startedAt`、`finishedAt`、`exitCode`、`result` 与本机 raw `logPath`。command/environment 由 canonical contract 注入，不能由操作者自报。然后运行默认不创建 ref、不 push、拒绝覆盖 output 的生成器：

```bash
EVIDENCE_ROOT=/absolute/path/new-evidence-directory
test "$(git branch --show-current)" = main
test -z "$(git status --porcelain --untracked-files=no)"
python3 scripts/build-mcp-remediation-local-evidence.py \
  --release-repo "$(git rev-parse --show-toplevel)" \
  --records-json /absolute/path/records.json \
  --matrix-contract-json \
    docs/audit/evidence/2026-08-23-mcp-remediation/local-test-matrix-contract.json \
  --output-root "${EVIDENCE_ROOT}" \
  --expected-commit "$(git rev-parse HEAD)" \
  --expected-tree "$(git rev-parse 'HEAD^{tree}')"
```

生成器会复制并固定 18 个 raw logs、重算 size/SHA-256、执行 credential-shape 扫描并生成 manifest/attestation；任一 cell 非 pass、时间非法、日志为空/含高信号 secret 或 output 已存在均失败并清理 partial output。

## 2. 生成 zero-parent commit

假设 `$EVIDENCE_ROOT` 只含上述 20 个文件，使用一次性 index 生成无 parent commit：

```bash
release_sha="$(git rev-parse HEAD)"
release_tree="$(git rev-parse 'HEAD^{tree}')"
evidence_index="$(mktemp)"
rm -f "${evidence_index}"

GIT_INDEX_FILE="${evidence_index}" git read-tree --empty
GIT_INDEX_FILE="${evidence_index}" git --work-tree="${EVIDENCE_ROOT}" \
  add -f -- attestation.json manifest.json logs
evidence_tree="$(GIT_INDEX_FILE="${evidence_index}" git write-tree)"
evidence_commit="$(printf '%s\n' "MCP remediation local logs for ${release_sha}" | \
  git commit-tree "${evidence_tree}")"
```

`git rev-list --parents -n 1 "${evidence_commit}"` 必须只输出该 commit 自身。

## 3. 本机验证并签名

```bash
python3 scripts/validate-local-test-attestation.py \
  --attestation-json "${EVIDENCE_ROOT}/attestation.json" \
  --expected-commit "${release_sha}" \
  --expected-tree "${release_tree}" \
  --release-contract-json \
    docs/audit/evidence/2026-08-23-mcp-remediation/remediation-release.json \
  --git-repo "$(git rev-parse --show-toplevel)" \
  --logs-commit "${evidence_commit}" \
  --logs-tree "${evidence_tree}" \
  --matrix-contract-json \
    docs/audit/evidence/2026-08-23-mcp-remediation/local-test-matrix-contract.json

git -c gpg.format=ssh -c user.signingkey="${SIGNING_KEY}" tag -s \
  -m mcp-remediation-local-logs-v1 \
  "mcp-remediation-logs-${release_sha}" "${evidence_commit}"
git -c gpg.format=ssh -c user.signingkey="${SIGNING_KEY}" tag -s \
  -m mcp-remediation-local-tests-v1 \
  "mcp-remediation-tested-${release_sha}" "${release_sha}"

git -c gpg.format=ssh \
  -c gpg.ssh.allowedSignersFile=docs/audit/keys/mcp-remediation-test-allowed-signers \
  verify-tag "mcp-remediation-logs-${release_sha}"
git -c gpg.format=ssh \
  -c gpg.ssh.allowedSignersFile=docs/audit/keys/mcp-remediation-test-allowed-signers \
  verify-tag "mcp-remediation-tested-${release_sha}"

git push --atomic origin \
  "refs/tags/mcp-remediation-logs-${release_sha}" \
  "refs/tags/mcp-remediation-tested-${release_sha}"
```

publisher/auditor 会重新验证两个 tag 的 SSH 签名，从 signed logs commit 读取 `attestation.json`/`manifest.json`/18 个 raw logs，重算 Git tree、manifest/log size/SHA-256、exact command/environment、时间/exit code、文件 allowlist 与高信号 secret 规则。任一不符即 fail-close。
