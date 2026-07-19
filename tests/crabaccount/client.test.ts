import { afterEach, describe, expect, test } from 'bun:test'
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const repositoryRoot = resolve(import.meta.dir, '../..')
const client = join(repositoryRoot, 'plugins/crabaccount/scripts/crabaccount.sh')
const importFixture = join(import.meta.dir, 'fixtures/import-batch.json')
const fakeCurlFixture = join(import.meta.dir, 'fixtures/fake-curl.sh')
const temporaryRoots: string[] = []

type Harness = {
  root: string
  dataDir: string
  stateDir: string
  logFile: string
  run: (args: string[], extraEnv?: Record<string, string>) => {
    exitCode: number
    stdout: string
    stderr: string
  }
}

async function createHarness(): Promise<Harness> {
  const root = await mkdtemp(join(tmpdir(), 'crabaccount-test-'))
  temporaryRoots.push(root)
  const dataDir = join(root, 'data')
  const stateDir = join(root, 'fake-state')
  const fakeBin = join(root, 'bin')
  const logFile = join(root, 'curl-argv.log')
  await mkdir(fakeBin, { recursive: true })
  await writeFile(join(fakeBin, 'curl'), await readFile(fakeCurlFixture, 'utf8'), { mode: 0o755 })
  await chmod(join(fakeBin, 'curl'), 0o755)
  await writeFile(logFile, '')

  return {
    root,
    dataDir,
    stateDir,
    logFile,
    run(args, extraEnv = {}) {
      const result = Bun.spawnSync([client, '--data-dir', dataDir, ...args], {
        env: {
          ...process.env,
          PATH: fakeBin + ':' + (process.env.PATH ?? ''),
          CRABACCOUNT_RETRY_DELAY_SECONDS: '0',
          FAKE_CURL_STATE_DIR: stateDir,
          FAKE_CURL_LOG: logFile,
          ...extraEnv,
        },
      })
      return {
        exitCode: result.exitCode,
        stdout: new TextDecoder().decode(result.stdout),
        stderr: new TextDecoder().decode(result.stderr),
      }
    },
  }
}

async function configureAndDoctor(harness: Harness): Promise<void> {
  const configured = harness.run([
    'config',
    'set',
    '--base-url',
    'http://127.0.0.1:10669',
    '--username',
    'alice',
  ])
  expect(configured.exitCode, configured.stdout + configured.stderr).toBe(0)
  const doctor = harness.run(['doctor'])
  expect(doctor.exitCode, doctor.stdout + doctor.stderr).toBe(0)
  expect(JSON.parse(doctor.stdout)).toMatchObject({ ok: true, compatible: true, release: '2.7.9' })
}

async function storeToken(harness: Harness, token = 'top-secret-token'): Promise<void> {
  await writeFile(
    join(harness.dataDir, 'token.json'),
    JSON.stringify({
      schemaVersion: 1,
      apiBase: 'http://127.0.0.1:10669/api',
      token,
      savedAt: '2026-07-15T00:00:00Z',
    }),
    { mode: 0o600 },
  )
}

function addPreview(harness: Harness, note: string) {
  const result = harness.run([
    'flows',
    'add',
    '--account-id',
    '1',
    '--type-id',
    '10',
    '--action-id',
    '100',
    '--money',
    '12.3',
    '--date',
    '2026-07-15',
    '--note',
    note,
  ])
  expect(result.exitCode, result.stdout + result.stderr).toBe(0)
  return JSON.parse(result.stdout) as {
    previewDigest: string
    runId: string
    operationCount: number
    mode: string
  }
}

afterEach(async () => {
  while (temporaryRoots.length > 0) {
    await rm(temporaryRoots.pop()!, { recursive: true, force: true })
  }
})

// The CrabAccount client is a POSIX Bash script run via its shebang. Native
// Windows cannot exec a .sh directly (ENOENT), and this harness relies on a
// POSIX PATH (`:` separator) plus a Bash fake-curl, so the suite is POSIX-only.
// Linux CI is the authoritative environment and exercises every assertion below.
const describeClient = process.platform === 'win32' ? describe.skip : describe

describeClient('CrabAccount Bash client', () => {
  test('passes shell syntax checks and enforces URL, permission, and symlink policy', async () => {
    const syntax = Bun.spawnSync([
      'bash',
      '-n',
      client,
      join(repositoryRoot, 'plugins/crabaccount/scripts/lib/common.sh'),
      join(repositoryRoot, 'plugins/crabaccount/scripts/lib/auth.sh'),
      join(repositoryRoot, 'plugins/crabaccount/scripts/lib/api.sh'),
      join(repositoryRoot, 'plugins/crabaccount/scripts/lib/journal.sh'),
    ])
    expect(syntax.exitCode).toBe(0)

    const harness = await createHarness()
    const publicHttp = harness.run(['config', 'set', '--base-url', 'http://example.com'])
    expect(publicHttp.exitCode).toBe(1)
    expect(JSON.parse(publicHttp.stdout).error.code).toBe('INSECURE_HTTP_BLOCKED')

    const loopbackLookalike = harness.run([
      'config',
      'set',
      '--base-url',
      'http://127.example.com',
    ])
    expect(loopbackLookalike.exitCode).toBe(1)
    expect(JSON.parse(loopbackLookalike.stdout).error.code).toBe('INSECURE_HTTP_BLOCKED')

    const ipv6Suffix = harness.run(['config', 'set', '--base-url', 'http://[::1].example'])
    expect(ipv6Suffix.exitCode).toBe(1)
    expect(JSON.parse(ipv6Suffix.stdout).error.code).toBe('VALIDATION_ERROR')

    const userInfo = harness.run(['config', 'set', '--base-url', 'https://user@example.com'])
    expect(userInfo.exitCode).toBe(1)
    expect(JSON.parse(userInfo.stdout).error.code).toBe('VALIDATION_ERROR')

    const ipv6 = harness.run(['config', 'set', '--base-url', 'http://[::1]:10669'])
    expect(ipv6.exitCode, ipv6.stdout + ipv6.stderr).toBe(0)
    expect((await stat(harness.dataDir)).mode & 0o777).toBe(0o700)
    expect((await stat(join(harness.dataDir, 'config.json'))).mode & 0o777).toBe(0o600)

    const outside = join(harness.root, 'outside.json')
    await writeFile(outside, 'unchanged')
    await unlink(join(harness.dataDir, 'config.json'))
    await symlink(outside, join(harness.dataDir, 'config.json'))
    const symlinkAttempt = harness.run([
      'config',
      'set',
      '--base-url',
      'http://127.0.0.1:10669',
    ])
    expect(symlinkAttempt.exitCode).toBe(1)
    expect(JSON.parse(symlinkAttempt.stdout).error.code).toBe('UNSAFE_PATH')
    expect(await readFile(outside, 'utf8')).toBe('unchanged')
  })

  test('keeps password and token out of curl argv', async () => {
    const harness = await createHarness()
    const configured = harness.run([
      'config',
      'set',
      '--base-url',
      'http://127.0.0.1:10669',
      '--username',
      'alice',
    ])
    expect(configured.exitCode).toBe(0)
    const login = harness.run(['auth', 'login'], { CRABACCOUNT_PASSWORD: 'plain-password' })
    expect(login.exitCode, login.stdout + login.stderr).toBe(0)

    const argv = await readFile(harness.logFile, 'utf8')
    const requestBodies = await readFile(join(harness.stateDir, 'request-bodies'), 'utf8')
    expect(argv).not.toContain('plain-password')
    expect(argv).not.toContain('fake-login-token')
    expect(requestBodies).not.toContain('plain-password')
    expect(await readFile(join(harness.stateDir, 'password-env'), 'utf8')).toBe('')
    expect(JSON.parse(await readFile(join(harness.dataDir, 'token.json'), 'utf8')).token).toBe(
      'fake-login-token',
    )
  })

  test('previews without writes, binds confirmation, verifies success, and prevents replay', async () => {
    const harness = await createHarness()
    await configureAndDoctor(harness)
    await storeToken(harness)

    const preview = addPreview(harness, '验证成功路径')
    expect(preview).toMatchObject({ mode: 'preview', operationCount: 1 })
    expect(await readFile(harness.logFile, 'utf8')).not.toContain('/api/flow/addFlow')

    const applied = harness.run([
      'flows',
      'add',
      '--apply',
      '--digest',
      preview.previewDigest,
    ])
    expect(applied.exitCode, applied.stdout + applied.stderr).toBe(0)
    expect(JSON.parse(applied.stdout)).toMatchObject({
      ok: true,
      state: 'completed',
      summary: { success: 1, commitUnknown: 0 },
    })
    expect(await readFile(join(harness.stateDir, 'write-count'), 'utf8')).toBe('1')
    const journal = JSON.parse(
      await readFile(join(harness.dataDir, 'journal', preview.runId + '.json'), 'utf8'),
    )
    expect(journal.previewDigest).toBe(preview.previewDigest)
    expect(journal.rows[0].status).toBe('success')

    const argv = await readFile(harness.logFile, 'utf8')
    const authConfig = await readFile(join(harness.stateDir, 'auth-config'), 'utf8')
    expect(argv).not.toContain('top-secret-token')
    expect(authConfig).toContain('top-secret-token')

    const replay = harness.run([
      'flows',
      'add',
      '--apply',
      '--digest',
      preview.previewDigest,
    ])
    expect(replay.exitCode).toBe(3)
    expect(JSON.parse(replay.stdout).error.code).toBe('PREVIEW_NOT_FOUND')
    expect(await readFile(join(harness.stateDir, 'write-count'), 'utf8')).toBe('1')
  })

  test('rejects modified previews before writing', async () => {
    const harness = await createHarness()
    await configureAndDoctor(harness)
    const preview = addPreview(harness, '原始备注')
    const pendingPath = join(harness.dataDir, 'pending', preview.previewDigest + '.json')
    const pending = JSON.parse(await readFile(pendingPath, 'utf8'))
    pending.binding.operations[0].payload.note = '被篡改'
    await writeFile(pendingPath, JSON.stringify(pending), { mode: 0o600 })

    const result = harness.run([
      'flows',
      'add',
      '--apply',
      '--digest',
      preview.previewDigest,
    ])
    expect(result.exitCode).toBe(3)
    expect(JSON.parse(result.stdout).error.code).toBe('DIGEST_MISMATCH')
    await expect(readFile(join(harness.stateDir, 'write-count'), 'utf8')).rejects.toThrow()
  })

  test('does not retry an ambiguous write and blocks a second apply attempt', async () => {
    const harness = await createHarness()
    await configureAndDoctor(harness)
    const preview = addPreview(harness, '未知提交路径')
    const first = harness.run(
      ['flows', 'add', '--apply', '--digest', preview.previewDigest],
      { FAKE_CURL_FAIL_WRITE: '1' },
    )
    expect(first.exitCode).toBe(4)
    expect(JSON.parse(first.stdout)).toMatchObject({
      ok: false,
      state: 'commit_unknown',
      summary: { commitUnknown: 1 },
    })
    expect(await readFile(join(harness.stateDir, 'write-count'), 'utf8')).toBe('1')

    const second = harness.run([
      'flows',
      'add',
      '--apply',
      '--digest',
      preview.previewDigest,
    ])
    expect(second.exitCode).toBe(3)
    expect(JSON.parse(second.stdout).error.code).toBe('PREVIEW_NOT_FOUND')
    expect(await readFile(join(harness.stateDir, 'write-count'), 'utf8')).toBe('1')
  })

  test('supports clearing a note and validates canonical imports before confirmed writes', async () => {
    const harness = await createHarness()
    await configureAndDoctor(harness)

    const update = harness.run(['flows', 'update', '--flow-id', '900', '--note', ''])
    expect(update.exitCode, update.stdout + update.stderr).toBe(0)
    const updateDigest = JSON.parse(update.stdout).previewDigest
    const updatePending = JSON.parse(
      await readFile(join(harness.dataDir, 'pending', updateDigest + '.json'), 'utf8'),
    )
    expect(updatePending.binding.operations[0].payload.note).toBe('')

    const imported = harness.run(['import', 'preview', '--file', importFixture])
    expect(imported.exitCode, imported.stdout + imported.stderr).toBe(0)
    const importedJson = JSON.parse(imported.stdout)
    expect(importedJson).toMatchObject({
      mode: 'preview',
      operationCount: 1,
      preview: {
        totalRows: 2,
        importRows: 1,
        skippedDuplicates: 1,
        expenseTotal: '8.00',
        incomeTotal: '0.00',
      },
    })
    expect(await readFile(harness.logFile, 'utf8')).not.toContain('/api/flow/addFlow')

    const invalidPath = join(harness.root, 'invalid-import.json')
    const invalid = JSON.parse(await readFile(importFixture, 'utf8'))
    invalid.transactions[0].currency = 'USD'
    invalid.transactions[0].duplicateStatus = 'possible'
    invalid.transactions[0].duplicateDecision = 'review'
    await writeFile(invalidPath, JSON.stringify(invalid))
    const rejected = harness.run(['import', 'preview', '--file', invalidPath])
    expect(rejected.exitCode).toBe(1)
    expect(JSON.parse(rejected.stdout).error.code).toBe('VALIDATION_ERROR')

    const applied = harness.run(['import', 'apply', '--digest', importedJson.previewDigest])
    expect(applied.exitCode, applied.stdout + applied.stderr).toBe(0)
    expect(JSON.parse(applied.stdout)).toMatchObject({ state: 'completed' })
    const importJournal = JSON.parse(
      await readFile(join(harness.dataDir, 'journal', importedJson.runId + '.json'), 'utf8'),
    )
    expect(importJournal.rows).toHaveLength(1)
    expect(importJournal.rows[0]).toMatchObject({
      index: 1,
      status: 'success',
      reconcile: { accountId: 1, money: '8.00', fDate: '2026-07-02' },
    })
  })
})
