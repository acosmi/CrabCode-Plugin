import { afterAll, describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const script = path.resolve(import.meta.dir, '..', 'scripts', 'validate-local-test-attestation.py')
const fixtures: string[] = []
const commit = 'a'.repeat(40)
const tree = 'b'.repeat(40)
const matrixContractPath = path.resolve(
  import.meta.dir,
  '..',
  'docs/audit/evidence/2026-08-23-mcp-remediation/local-test-matrix-contract.json',
)
const matrixContract = JSON.parse(await readFile(matrixContractPath, 'utf8')) as {
  commands: Record<string, string>
  cells: Record<string, { commandId: string; environment: Record<string, string> }>
}
const cells = Object.keys(matrixContract.cells).sort()

function cellContract(cell: string) {
  const definition = matrixContract.cells[cell]!
  return {
    command: matrixContract.commands[definition.commandId]!,
    environment: definition.environment,
  }
}

afterAll(async () => {
  await Promise.all(fixtures.map((directory) => rm(directory, { recursive: true, force: true })))
})

async function invoke(
  overrides: Record<string, unknown> = {},
  releaseOverrides: Record<string, unknown> = {},
  fixtureMutation?: 'tamper-log' | 'wrong-command' | 'wrong-environment' | 'secret-log' | 'extra-file' | 'wrong-matrix-cell' | 'parent-commit',
) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'local-test-attestation-'))
  fixtures.push(root)
  const logsRoot = path.join(root, 'logs-repo')
  const file = path.join(logsRoot, 'attestation.json')
  const release = path.join(root, 'release.json')
  const matrix = path.join(root, 'matrix.json')
  const matrixPayload = structuredClone(matrixContract)
  if (fixtureMutation === 'wrong-matrix-cell') {
    const original = cells[0]!
    matrixPayload.cells['fake-replacement-cell'] = matrixPayload.cells[original]!
    delete matrixPayload.cells[original]
  }
  await writeFile(matrix, JSON.stringify({
    schemaVersion: 1,
    evidenceId: 'mcp-remediation-local-matrix-contract-v1',
    ...matrixPayload,
  }))
  const logDirectory = path.join(logsRoot, 'logs')
  await mkdir(logDirectory, { recursive: true })
  const runs = []
  for (const [index, cell] of cells.entries()) {
    const contract = cellContract(cell)
    const relativePath = `logs/${cell}.log`
    const bytes = Buffer.from(
      fixtureMutation === 'secret-log' && index === 0
        ? `token=${['gh', 'p_', 'A'.repeat(36)].join('')}\n`
        : `${cell}: pass\n`,
    )
    await writeFile(path.join(logsRoot, relativePath), bytes)
    runs.push({
      cell,
      command: fixtureMutation === 'wrong-command' && index === 0 ? 'run something else' : contract.command,
      environment: fixtureMutation === 'wrong-environment' && index === 0
        ? { ...contract.environment, os: 'wrong-os' }
        : contract.environment,
      startedAt: '2026-08-23T10:00:00Z',
      finishedAt: '2026-08-23T10:00:01Z',
      exitCode: 0,
      result: 'pass',
      log: {
        relativePath,
        sizeBytes: bytes.byteLength,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      },
    })
  }
  const manifestPath = path.join(logsRoot, 'manifest.json')
  await writeFile(manifestPath, `${JSON.stringify({
    schemaVersion: 1,
    evidenceId: 'mcp-remediation-local-logs-v1',
    testedCommit: commit,
    testedTree: tree,
    status: 'pass',
    secretsScanStatus: 'pass',
    runs,
  }, null, 2)}\n`)
  if (fixtureMutation === 'tamper-log') {
    await writeFile(path.join(logDirectory, `${cells[0]}.log`), 'tampered after manifest\n')
  }
  if (fixtureMutation === 'extra-file') await writeFile(path.join(logsRoot, 'extra.txt'), 'not allowed\n')
  const manifestBytes = await readFile(manifestPath)
  const logsManifestSha256 = createHash('sha256').update(manifestBytes).digest('hex')
  await writeFile(file, JSON.stringify({
    schemaVersion: 1,
    evidenceId: 'mcp-remediation-local-tests-v1',
    status: 'pass',
    testedCommit: commit,
    testedTree: tree,
    allRequiredLocalRunsPass: true,
    logsEvidenceRef: `refs/tags/mcp-remediation-logs-${commit}`,
    logsManifestSha256,
    supportMatrix: Object.fromEntries(cells.map((cell) => [cell, 'pass'])),
    ...overrides,
  }))
  const gitEnv = {
    ...process.env,
    GIT_AUTHOR_NAME: 'Local Matrix Fixture',
    GIT_AUTHOR_EMAIL: 'matrix@example.invalid',
    GIT_COMMITTER_NAME: 'Local Matrix Fixture',
    GIT_COMMITTER_EMAIL: 'matrix@example.invalid',
  }
  for (const args of [
    ['init', '-q'],
    ['add', '.'],
    ['commit', '-qm', 'local logs evidence'],
  ]) {
    const result = Bun.spawnSync(['git', ...args], { cwd: logsRoot, env: gitEnv })
    expect(result.exitCode).toBe(0)
  }
  if (fixtureMutation === 'parent-commit') {
    const result = Bun.spawnSync(
      ['git', 'commit', '--allow-empty', '-qm', 'forbidden parented evidence'],
      { cwd: logsRoot, env: gitEnv },
    )
    expect(result.exitCode).toBe(0)
  }
  const logsCommit = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], {
    cwd: logsRoot,
    stdout: 'pipe',
  }).stdout.toString().trim()
  const logsTree = Bun.spawnSync(['git', 'rev-parse', 'HEAD^{tree}'], {
    cwd: logsRoot,
    stdout: 'pipe',
  }).stdout.toString().trim()
  await writeFile(release, JSON.stringify({
    status: 'exact-main-annotated-tag-required',
    gateEligibility: {
      mode: 'runtime-computed-from-exact-main-annotated-tag',
      staticPassForbidden: true,
    },
    remediation: {
      commitBinding: {
        signatureFormat: 'ssh-ed25519',
        allowedSigners: 'docs/audit/keys/mcp-remediation-test-allowed-signers',
        requiredPrincipal: 'release-attestor',
      },
      logsBinding: {
        type: 'ssh-signed-annotated-git-tag',
        zeroParentCommitRequired: true,
        exactTreeAllowlistRequired: true,
        rawLogByteVerificationRequired: true,
      },
      testBinding: {
        evidenceId: 'mcp-remediation-local-tests-v1',
        validator: 'scripts/validate-local-test-attestation.py',
        matrixContract: 'docs/audit/evidence/2026-08-23-mcp-remediation/local-test-matrix-contract.json',
        requiredCellCount: 18,
      },
    },
    ...releaseOverrides,
  }))
  return Bun.spawnSync([
    'python3', script,
    '--attestation-json', file,
    '--expected-commit', commit,
    '--expected-tree', tree,
    '--release-contract-json', release,
    '--git-repo', logsRoot,
    '--logs-commit', logsCommit,
    '--logs-tree', logsTree,
    '--matrix-contract-json', matrix,
  ], { stdout: 'pipe', stderr: 'pipe' })
}

describe('exact-main local test attestation gate', () => {
  test('accepts a complete exact commit/tree matrix attestation', async () => {
    const result = await invoke()
    expect(result.exitCode).toBe(0)
    expect(result.stdout.toString()).toContain('"requiredCellCount": 18')
  })

  test('rejects a missing cell, mismatched commit, or invalid logs digest', async () => {
    const missingMatrix = Object.fromEntries(cells.slice(1).map((cell) => [cell, 'pass']))
    for (const mutation of [
      { supportMatrix: missingMatrix },
      { testedCommit: 'd'.repeat(40) },
      { logsManifestSha256: null },
    ]) {
      const result = await invoke(mutation)
      expect(result.exitCode).not.toBe(0)
      expect(result.stderr.toString()).toContain('not exact-main release evidence')
    }
  })

  test('rejects a tracked release contract that statically claims pass', async () => {
    const result = await invoke({}, {
      gateEligibility: { mode: 'static-pass', staticPassForbidden: false },
    })
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr.toString()).toContain('release evidence contract is not runtime-bound')
  })

  test('recomputes the manifest and every raw log blob', async () => {
    const fakeDigest = await invoke({ logsManifestSha256: 'c'.repeat(64) })
    expect(fakeDigest.exitCode).not.toBe(0)
    expect(fakeDigest.stderr.toString()).toContain('logs manifest SHA-256 mismatch')

    const tamperedLog = await invoke({}, {}, 'tamper-log')
    expect(tamperedLog.exitCode).not.toBe(0)
    expect(tamperedLog.stderr.toString()).toContain('raw local test log manifest is invalid')
  })

  test('pins cell commands/environments and rejects secret or extra blobs', async () => {
    for (const mutation of [
      'wrong-command',
      'wrong-environment',
      'secret-log',
      'extra-file',
      'wrong-matrix-cell',
      'parent-commit',
    ] as const) {
      const result = await invoke({}, {}, mutation)
      expect(result.exitCode).not.toBe(0)
      expect(result.stderr.toString()).toMatch(
        /raw local test log manifest is invalid|local test matrix contract must define|logs evidence commit must be/u,
      )
    }
    const secretMetadata = await invoke({
      note: ['sk', '-', 'A'.repeat(32)].join(''),
    })
    expect(secretMetadata.exitCode).not.toBe(0)
    expect(secretMetadata.stderr.toString()).toContain(
      'local test evidence metadata contains credential-shaped bytes',
    )
  }, 20_000)
})
