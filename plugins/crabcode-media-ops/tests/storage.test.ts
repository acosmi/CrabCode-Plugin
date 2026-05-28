import { test, expect, describe, beforeEach, afterEach } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
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
})
