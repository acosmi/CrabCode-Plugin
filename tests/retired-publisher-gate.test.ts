import { afterAll, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const script = path.resolve(import.meta.dir, '..', 'scripts', 'validate-retired-publisher.py')
const fixtures: string[] = []

afterAll(async () => {
  await Promise.all(fixtures.map((directory) => rm(directory, { recursive: true, force: true })))
})

async function invoke(
  overrides: Record<string, unknown> = {},
  safeOverrides: Record<string, unknown> = {},
  controlOverrides: Record<string, unknown> = {},
  historicalRuns: Record<string, unknown> = { total_count: 0, workflow_runs: [] },
) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'retired-publisher-'))
  fixtures.push(root)
  const json = path.join(root, 'workflow.json')
  const safeJson = path.join(root, 'safe-workflow.json')
  const controlJson = path.join(root, 'control.json')
  const historicalRunsJson = path.join(root, 'historical-runs.json')
  await writeFile(json, JSON.stringify({
    id: 336369746,
    path: '.github/workflows/publish-to-cn-mirror.yml',
    state: 'disabled_manually',
    updated_at: '2026-08-23T10:52:51Z',
    ...overrides,
  }))
  await writeFile(historicalRunsJson, JSON.stringify(historicalRuns))
  await writeFile(controlJson, JSON.stringify({
    control: {
      status: 'unbypassable-control-verified',
      verifiedUnbypassableControl: 'historical-runs-deleted',
      ...controlOverrides,
    },
  }))
  await writeFile(safeJson, JSON.stringify({
    id: 400000001,
    path: '.github/workflows/publish-safe-to-cn-mirror.yml',
    state: 'active',
    ...safeOverrides,
  }))
  return Bun.spawnSync(
    [
      'python3', script,
      '--workflow-json', json,
      '--safe-workflow-json', safeJson,
      '--control-evidence-json', controlJson,
      '--historical-runs-json', historicalRunsJson,
    ],
    { stdout: 'pipe', stderr: 'pipe' },
  )
}

describe('retired historical publisher gate', () => {
  test('accepts only the exact disabled historical workflow identity', async () => {
    const result = await invoke()
    expect(result.exitCode).toBe(0)
    expect(result.stdout.toString()).toContain('"state": "disabled_manually"')
  })

  test('rejects re-enabled state, another ID, or another path', async () => {
    for (const mutation of [
      { state: 'active' },
      { id: 336369747 },
      { path: '.github/workflows/publish-safe-to-cn-mirror.yml' },
    ]) {
      const result = await invoke(mutation)
      expect(result.exitCode).not.toBe(0)
      expect(result.stderr.toString()).toContain('historical publisher is not safely retired')
    }
  })

  test('rejects a missing distinction or inactive safe replacement identity', async () => {
    for (const mutation of [
      { id: 336369746 },
      { path: '.github/workflows/publish-to-cn-mirror.yml' },
      { state: 'disabled_manually' },
    ]) {
      const result = await invoke({}, mutation)
      expect(result.exitCode).not.toBe(0)
      expect(result.stderr.toString()).toContain('safe publisher does not have a distinct active workflow identity')
    }
  })

  test('rejects reversible disabled-only metadata without a final P1-REL-02 control', async () => {
    for (const mutation of [
      { status: 'defense-in-depth-disabled-awaiting-unbypassable-control' },
      { verifiedUnbypassableControl: null },
      { verifiedUnbypassableControl: 'disabled-manually' },
    ]) {
      const result = await invoke({}, {}, mutation)
      expect(result.exitCode).not.toBe(0)
      expect(result.stderr.toString()).toContain('P1-REL-02 remains blocked')
    }
  })

  test('requires runtime GitHub API proof that no historical runs remain', async () => {
    const result = await invoke({}, {}, {}, {
      total_count: 1,
      workflow_runs: [{ id: 32579374255, status: 'completed' }],
    })
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr.toString()).toContain('GitHub API still reports historical publisher runs')
  })
})
