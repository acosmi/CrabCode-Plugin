import { afterAll, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const root = path.resolve(import.meta.dir, '..')
const builder = path.join(root, 'scripts', 'build-mcp-remediation-local-evidence.py')
const matrix = path.join(
  root,
  'docs/audit/evidence/2026-08-23-mcp-remediation/local-test-matrix-contract.json',
)
const fixtures: string[] = []

afterAll(async () => {
  await Promise.all(fixtures.map((directory) => rm(directory, { recursive: true, force: true })))
})

function run(args: string[], cwd: string) {
  return Bun.spawnSync(args, {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Evidence Builder Test',
      GIT_AUTHOR_EMAIL: 'builder@example.invalid',
      GIT_COMMITTER_NAME: 'Evidence Builder Test',
      GIT_COMMITTER_EMAIL: 'builder@example.invalid',
    },
  })
}

async function fixture(mutation?: 'secret' | 'symlink' | 'duplicate') {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'local-evidence-builder-'))
  fixtures.push(directory)
  const repo = path.join(directory, 'release')
  const logs = path.join(directory, 'input-logs')
  const output = path.join(directory, 'evidence')
  await mkdir(repo)
  await mkdir(logs)
  expect(run(['git', 'init', '-q'], repo).exitCode).toBe(0)
  await writeFile(path.join(repo, 'release.txt'), 'release\n')
  expect(run(['git', 'add', 'release.txt'], repo).exitCode).toBe(0)
  expect(run(['git', 'commit', '-qm', 'release'], repo).exitCode).toBe(0)
  const contract = JSON.parse(await readFile(matrix, 'utf8')) as { cells: Record<string, unknown> }
  const records: Record<string, unknown> = {}
  let firstLogPath = ''
  for (const [index, cell] of Object.keys(contract.cells).sort().entries()) {
    const logPath = path.join(logs, `${cell}.log`)
    await writeFile(
      logPath,
      mutation === 'secret' && index === 0
        ? `token=${['gh', 'p_', 'A'.repeat(36)].join('')}\n`
        : `${cell}: pass\n`,
    )
    if (index === 0) firstLogPath = logPath
    let recordLogPath = mutation === 'duplicate' && index === 1 ? firstLogPath : logPath
    if (mutation === 'symlink' && index === 0) {
      recordLogPath = path.join(logs, `${cell}.link.log`)
      await symlink(logPath, recordLogPath)
    }
    records[cell] = {
      startedAt: '2026-08-23T10:00:00Z',
      finishedAt: '2026-08-23T10:00:01Z',
      exitCode: 0,
      result: 'pass',
      logPath: recordLogPath,
    }
  }
  const recordsPath = path.join(directory, 'records.json')
  await writeFile(recordsPath, JSON.stringify({ records }))
  return { directory, repo, output, recordsPath }
}

describe('local remediation evidence builder', () => {
  test('builds the exact 18 sanitized logs plus manifest and attestation without refs', async () => {
    const item = await fixture()
    const result = run([
      'python3', builder,
      '--release-repo', item.repo,
      '--records-json', item.recordsPath,
      '--matrix-contract-json', matrix,
      '--output-root', item.output,
    ], root)
    expect(result.exitCode).toBe(0)
    const report = JSON.parse(result.stdout.toString()) as { cellCount: number; nextStep: string }
    expect(report.cellCount).toBe(18)
    expect(report.nextStep).toContain('no refs were created')
    expect((await readdir(path.join(item.output, 'logs'))).length).toBe(18)
    for (const relative of ['attestation.json', 'manifest.json']) {
      expect((await stat(path.join(item.output, relative))).mode & 0o777).toBe(0o644)
    }
    expect(run(['git', 'tag', '--list'], item.repo).stdout.toString()).toBe('')

    const overwrite = run([
      'python3', builder,
      '--release-repo', item.repo,
      '--records-json', item.recordsPath,
      '--matrix-contract-json', matrix,
      '--output-root', item.output,
    ], root)
    expect(overwrite.exitCode).not.toBe(0)
    expect(overwrite.stderr.toString()).toContain('output-root must not already exist')
  })

  test('refuses secrets, symlinks, and reused raw logs and removes partial output', async () => {
    for (const mutation of ['secret', 'symlink', 'duplicate'] as const) {
      const item = await fixture(mutation)
      const result = run([
        'python3', builder,
        '--release-repo', item.repo,
        '--records-json', item.recordsPath,
        '--matrix-contract-json', matrix,
        '--output-root', item.output,
      ], root)
      expect(result.exitCode).not.toBe(0)
      expect(result.stderr.toString()).toMatch(
        /credential-shaped bytes|ordinary file|reuses another cell's raw log/u,
      )
      await expect(stat(item.output)).rejects.toThrow()
    }
  })
})
