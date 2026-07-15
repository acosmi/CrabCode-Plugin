import { test, expect, describe, beforeEach, afterEach } from 'bun:test'
import { mkdtemp, rm, appendFile, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('storage append/list/get', () => {
  let dir: string
  let prev: string | undefined

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mediaops-test-'))
    prev = process.env.MEDIAOPS_DATA_DIR
    process.env.MEDIAOPS_DATA_DIR = dir
  })

  afterEach(async () => {
    if (prev === undefined) delete process.env.MEDIAOPS_DATA_DIR
    else process.env.MEDIAOPS_DATA_DIR = prev
    await rm(dir, { recursive: true, force: true })
  })

  test('appendRecord assigns id + createdAt and getRecord finds it', async () => {
    const { appendRecord, getRecord } = await import('../src/storage.ts')
    const rec = await appendRecord('content', { kind: 'draft', payload: { title: 'hi' } })
    expect(typeof rec.id).toBe('string')
    expect(typeof rec.createdAt).toBe('string')
    const found = await getRecord('content', rec.id)
    expect(found).not.toBeNull()
    expect(found?.kind).toBe('draft')
  })

  test('listRecords filters by exact key/value', async () => {
    const { appendRecord, listRecords } = await import('../src/storage.ts')
    await appendRecord('content', { kind: 'draft', payload: {} })
    await appendRecord('content', { kind: 'brief', payload: {} })
    await appendRecord('content', { kind: 'draft', payload: {} })
    const drafts = await listRecords('content', { kind: 'draft' })
    expect(drafts).toHaveLength(2)
    const all = await listRecords('content')
    expect(all).toHaveLength(3)
  })

  test('getRecord returns null for unknown id', async () => {
    const { getRecord } = await import('../src/storage.ts')
    expect(await getRecord('content', 'nope')).toBeNull()
  })

  test('fails closed on malformed JSONL instead of falling back to an older record', async () => {
    const { appendRecord, listRecords, StorageCorruptionError } = await import('../src/storage.ts')
    await appendRecord('approvals', { approvalId: 'first', state: 'approved' })
    await appendFile(join(dir, 'approvals.jsonl'), '{malformed\n', 'utf8')
    await expect(listRecords('approvals')).rejects.toBeInstanceOf(StorageCorruptionError)
  })

  test('detects record mutation and serializes concurrent appends', async () => {
    const { appendRecord, listRecords, StorageCorruptionError } = await import('../src/storage.ts')
    await Promise.all(Array.from({ length: 20 }, (_, index) => appendRecord('audit-events', { event: 'parallel', index })))
    expect(await listRecords('audit-events')).toHaveLength(20)
    const path = join(dir, 'audit-events.jsonl')
    const lines = (await readFile(path, 'utf8')).trim().split('\n')
    const first = JSON.parse(lines[0])
    first.index = 999
    lines[0] = JSON.stringify(first)
    await writeFile(path, `${lines.join('\n')}\n`, 'utf8')
    await expect(listRecords('audit-events')).rejects.toBeInstanceOf(StorageCorruptionError)
  })

  test('detects deletion of a complete tail record through the atomic head/count', async () => {
    const { appendRecord, listRecords, StorageCorruptionError } = await import('../src/storage.ts')
    await appendRecord('approvals', { approvalId: 'first', state: 'pending' })
    await appendRecord('approvals', { approvalId: 'first', state: 'revoked' })
    const path = join(dir, 'approvals.jsonl')
    const lines = (await readFile(path, 'utf8')).trim().split('\n')
    await writeFile(path, `${lines[0]}\n`, 'utf8')
    await expect(listRecords('approvals')).rejects.toBeInstanceOf(StorageCorruptionError)
  })
})
