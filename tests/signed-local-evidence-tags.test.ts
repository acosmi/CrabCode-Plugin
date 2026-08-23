import { afterAll, describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const fixtures: string[] = []
const root = path.resolve(import.meta.dir, '..')

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
      GIT_AUTHOR_NAME: 'Signed Evidence Test',
      GIT_AUTHOR_EMAIL: 'evidence@example.invalid',
      GIT_COMMITTER_NAME: 'Signed Evidence Test',
      GIT_COMMITTER_EMAIL: 'evidence@example.invalid',
    },
  })
}

describe('SSH-signed local evidence tags', () => {
  test('verifies the approved principal and keeps JSON out of signed tag contents', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'signed-evidence-tag-'))
    fixtures.push(directory)
    const key = path.join(directory, 'signing-key')
    const allowed = path.join(directory, 'allowed-signers')
    expect(run(['ssh-keygen', '-q', '-t', 'ed25519', '-N', '', '-f', key], directory).exitCode).toBe(0)
    const publicKey = (await readFile(`${key}.pub`, 'utf8')).trim().split(/\s+/).slice(0, 2).join(' ')
    await writeFile(allowed, `release-attestor namespaces="git" ${publicKey}\n`)
    expect(run(['git', 'init', '-q'], directory).exitCode).toBe(0)
    await writeFile(path.join(directory, 'release.txt'), 'release\n')
    expect(run(['git', 'add', 'release.txt'], directory).exitCode).toBe(0)
    expect(run(['git', 'commit', '-qm', 'release'], directory).exitCode).toBe(0)
    expect(run([
      'git', '-c', 'gpg.format=ssh', '-c', `user.signingkey=${key}`,
      'tag', '-s', '-m', 'mcp-remediation-local-tests-v1', 'evidence-tag',
    ], directory).exitCode).toBe(0)
    const verified = run([
      'git', '-c', 'gpg.format=ssh', '-c', `gpg.ssh.allowedSignersFile=${allowed}`,
      'verify-tag', 'evidence-tag',
    ], directory)
    expect(verified.exitCode).toBe(0)
    expect(verified.stderr.toString()).toContain('Good "git" signature for release-attestor')

    const wrongKey = path.join(directory, 'wrong-key')
    const wrongAllowed = path.join(directory, 'wrong-allowed-signers')
    expect(run(['ssh-keygen', '-q', '-t', 'ed25519', '-N', '', '-f', wrongKey], directory).exitCode).toBe(0)
    const wrongPublic = (await readFile(`${wrongKey}.pub`, 'utf8')).trim().split(/\s+/).slice(0, 2).join(' ')
    await writeFile(wrongAllowed, `release-attestor namespaces="git" ${wrongPublic}\n`)
    expect(run([
      'git', '-c', 'gpg.format=ssh', '-c', `gpg.ssh.allowedSignersFile=${wrongAllowed}`,
      'verify-tag', 'evidence-tag',
    ], directory).exitCode).not.toBe(0)

    const contents = run(['git', 'for-each-ref', '--format=%(contents)', 'refs/tags/evidence-tag'], directory)
      .stdout.toString()
    expect(contents).toContain('BEGIN SSH SIGNATURE')
    const publisher = await readFile(
      path.join(root, '.github', 'workflows', 'publish-safe-to-cn-mirror.yml'),
      'utf8',
    )
    const auditor = await readFile(path.join(root, '.github', 'workflows', 'notify-mirror.yml'), 'utf8')
    for (const workflow of [publisher, auditor]) {
      expect(workflow).not.toContain("--format='%(contents)'")
      expect(workflow).toContain('show "${LOGS_COMMIT}:attestation.json"')
      expect(workflow).toContain('gpg.ssh.allowedSignersFile')
      expect(workflow).toContain('verify-tag "refs/tags/${EVIDENCE_TAG}"')
      expect(workflow).toContain('verify-tag "refs/tags/${LOGS_TAG}"')
    }
  })
})
