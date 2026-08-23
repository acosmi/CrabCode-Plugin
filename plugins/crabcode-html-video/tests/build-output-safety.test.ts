import { afterEach, describe, expect, test } from 'bun:test'
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const buildScript = join(import.meta.dir, '..', 'scripts', 'build-mcp.ts')
const fixtures: string[] = []

afterEach(async () => {
  await Promise.all(
    fixtures.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  )
})

describe('MCP build output safety', () => {
  test('refuses to delete or overwrite an existing custom dist', async () => {
    const root = await mkdtemp(join(tmpdir(), 'html-video-build-safety-'))
    fixtures.push(root)
    const dist = join(root, 'dist')
    await mkdir(dist)
    const sentinel = join(dist, 'sentinel')
    await writeFile(sentinel, 'preserve me')

    const result = Bun.spawnSync(
      [process.execPath, buildScript, '--outdir', dist],
      { stdout: 'pipe', stderr: 'pipe' },
    )
    expect(result.exitCode).not.toBe(0)
    expect(await readFile(sentinel, 'utf8')).toBe('preserve me')
  })

  test('refuses a symlink parent before creating a custom dist', async () => {
    const root = await mkdtemp(join(tmpdir(), 'html-video-build-symlink-'))
    fixtures.push(root)
    const victim = join(root, 'victim')
    const link = join(root, 'link')
    await mkdir(victim)
    await symlink(victim, link)

    const result = Bun.spawnSync(
      [process.execPath, buildScript, '--outdir', join(link, 'dist')],
      { stdout: 'pipe', stderr: 'pipe' },
    )
    expect(result.exitCode).not.toBe(0)
    expect(await Bun.file(join(victim, 'dist')).exists()).toBe(false)
  })
})
