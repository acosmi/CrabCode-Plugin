import { Database } from 'bun:sqlite'
import { test, expect, describe, beforeEach, afterEach } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('transactional SQLite storage', () => {
  let dir: string
  let prev: string | undefined
  let prevUnverified: string | undefined

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mediaops-test-'))
    prev = process.env.MEDIAOPS_DATA_DIR
    prevUnverified = process.env.MEDIAOPS_ALLOW_UNVERIFIED_LEGACY_IMPORT
    process.env.MEDIAOPS_DATA_DIR = dir
    delete process.env.MEDIAOPS_ALLOW_UNVERIFIED_LEGACY_IMPORT
  })

  afterEach(async () => {
    if (prev === undefined) delete process.env.MEDIAOPS_DATA_DIR
    else process.env.MEDIAOPS_DATA_DIR = prev
    if (prevUnverified === undefined) delete process.env.MEDIAOPS_ALLOW_UNVERIFIED_LEGACY_IMPORT
    else process.env.MEDIAOPS_ALLOW_UNVERIFIED_LEGACY_IMPORT = prevUnverified
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
    expect(await listRecords('content')).toHaveLength(3)
  })

  test('getRecord returns null for unknown id', async () => {
    const { getRecord } = await import('../src/storage.ts')
    expect(await getRecord('content', 'nope')).toBeNull()
  })

  test('fails closed while importing malformed legacy JSONL', async () => {
    const { listRecords, StorageCorruptionError } = await import('../src/storage.ts')
    await writeFile(join(dir, 'approvals.jsonl'), '{malformed\n', 'utf8')
    await expect(listRecords('approvals')).rejects.toBeInstanceOf(StorageCorruptionError)
  })

  test('refuses unhashed legacy history by default', async () => {
    const { listRecords, StorageCorruptionError } = await import('../src/storage.ts')
    await writeFile(join(dir, 'approvals.jsonl'), `${JSON.stringify({ id: 'legacy-1', createdAt: new Date().toISOString(), approvalId: 'a', state: 'approved' })}\n`, 'utf8')
    await expect(listRecords('approvals')).rejects.toBeInstanceOf(StorageCorruptionError)
  })

  test('explicitly acknowledged unhashed legacy records are re-chained during import', async () => {
    const { listRecords, storageWarnings } = await import('../src/storage.ts')
    process.env.MEDIAOPS_ALLOW_UNVERIFIED_LEGACY_IMPORT = 'I_ACCEPT_UNVERIFIED_HISTORY'
    await writeFile(join(dir, 'audit-events.jsonl'), `${JSON.stringify({ id: 'legacy-1', createdAt: new Date().toISOString(), event: 'legacy' })}\n`, 'utf8')
    const [record] = await listRecords('audit-events')
    expect(record?.previousRecordHash).toBeNull()
    expect(record?.recordHash).toMatch(/^[a-f0-9]{64}$/)
    expect(storageWarnings().join('|')).toContain('pre-migration history cannot be authenticated')
  })

  test('cross-collection append rolls back business state when audit preflight fails', async () => {
    const { appendRecordsAtomically, listRecords, StorageCorruptionError } = await import('../src/storage.ts')
    await writeFile(join(dir, 'audit-events.jsonl'), '{malformed\n', 'utf8')
    await expect(appendRecordsAtomically([
      { collection: 'content', record: { id: 'content-1', kind: 'draft' } },
      { collection: 'audit-events', record: { event: 'content.saved' } },
    ])).rejects.toBeInstanceOf(StorageCorruptionError)
    expect(await listRecords('content')).toHaveLength(0)
  })

  test('detects SQLite payload mutation', async () => {
    const { appendRecord, databasePath, listRecords, StorageCorruptionError } = await import('../src/storage.ts')
    await appendRecord('audit-events', { event: 'original', index: 1 })
    const database = new Database(databasePath())
    const row = database.query<{ sequence: number; payload: string }, []>(
      "SELECT sequence, payload FROM records WHERE collection = 'audit-events' ORDER BY sequence LIMIT 1",
    ).get()!
    const payload = JSON.parse(row.payload)
    payload.index = 999
    database.run('UPDATE records SET payload = ? WHERE sequence = ?', [JSON.stringify(payload), row.sequence])
    database.close()
    await expect(listRecords('audit-events')).rejects.toBeInstanceOf(StorageCorruptionError)
  })

  test('detects deletion of a complete SQLite tail row through the transactional head/count', async () => {
    const { appendRecord, databasePath, listRecords, StorageCorruptionError } = await import('../src/storage.ts')
    await appendRecord('approvals', { approvalId: 'first', state: 'pending' })
    await appendRecord('approvals', { approvalId: 'first', state: 'revoked' })
    const database = new Database(databasePath())
    database.run("DELETE FROM records WHERE sequence = (SELECT MAX(sequence) FROM records WHERE collection = 'approvals')")
    database.close()
    await expect(listRecords('approvals')).rejects.toBeInstanceOf(StorageCorruptionError)
  })

  test('serializes multi-process WAL appends without breaking the hash chain', async () => {
    const { listRecords } = await import('../src/storage.ts')
    const worker = join(import.meta.dir, 'fixtures', 'storage-worker.ts')
    const processes = Array.from({ length: 8 }, (_, index) => Bun.spawn({
      cmd: [process.execPath, 'run', worker, dir, String(index), '30'],
      stdout: 'pipe',
      stderr: 'pipe',
    }))
    const exits = await Promise.all(processes.map((child) => child.exited))
    if (exits.some((code) => code !== 0)) {
      const errors = await Promise.all(processes.map((child) => new Response(child.stderr).text()))
      throw new Error(`storage workers failed: ${JSON.stringify({ exits, errors })}`)
    }
    const records = await listRecords('audit-events')
    expect(records).toHaveLength(240)
    expect(new Set(records.map((record) => `${record.worker}:${record.index}`)).size).toBe(240)
  }, 30_000)

  test('entity compare-and-append has one winner across processes', async () => {
    const { getEntityVersion, listRecords } = await import('../src/storage.ts')
    const worker = join(import.meta.dir, 'fixtures', 'storage-cas-worker.ts')
    const processes = Array.from({ length: 12 }, (_, index) => Bun.spawn({
      cmd: [process.execPath, 'run', worker, dir, String(index)],
      stdout: 'pipe',
      stderr: 'pipe',
    }))
    const exits = await Promise.all(processes.map((child) => child.exited))
    expect(exits.every((code) => code === 0)).toBe(true)
    const outputs = await Promise.all(processes.map((child) => new Response(child.stdout).text()))
    expect(outputs.filter((output) => output.trim() === 'won')).toHaveLength(1)
    expect(outputs.filter((output) => output.trim() === 'conflict')).toHaveLength(11)
    expect(await getEntityVersion('approvals', 'shared-approval')).toBe(1)
    expect(await listRecords('approvals')).toHaveLength(1)
  }, 30_000)

  test('entity leases are exclusive, expire safely and require the owning token to release', async () => {
    const { acquireEntityLease, getEntityLease, releaseEntityLease, renewEntityLease } = await import('../src/storage.ts')
    const first = await acquireEntityLease('approvals', 'approval-1', 'package-a', 1_000)
    expect(first?.owner).toBe('package-a')
    expect(await acquireEntityLease('approvals', 'approval-1', 'package-b', 1_000)).toBeNull()
    expect(await releaseEntityLease('approvals', 'approval-1', 'package-b')).toBe(false)
    expect((await renewEntityLease('approvals', 'approval-1', 'package-a', 2_000))?.owner).toBe('package-a')
    expect(await renewEntityLease('approvals', 'approval-1', 'package-b', 2_000)).toBeNull()
    expect((await getEntityLease('approvals', 'approval-1'))?.owner).toBe('package-a')
    expect(await releaseEntityLease('approvals', 'approval-1', 'package-a')).toBe(true)
    expect(await getEntityLease('approvals', 'approval-1')).toBeNull()
  })
})
