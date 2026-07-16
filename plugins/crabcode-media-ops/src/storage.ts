/**
 * Transactional, fail-closed persistence for mediaops.
 *
 * New writes use SQLite WAL transactions. The previous JSONL/hash-head format
 * is verified in full and imported exactly once per collection; malformed or
 * truncated legacy data is never silently skipped.
 */

import { Database } from 'bun:sqlite'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export type Collection =
  | 'content'
  | 'approvals'
  | 'publish-history'
  | 'audit-events'
  | 'style-forms'
  | 'profile-proposals'
  | 'profiles'
  | 'references'
  | 'research-captures'
  | 'research-reviews'
  | 'originality-scans'
  | 'editorial-reviews'
  | 'delivery-manifests'
  | 'package-operations'

export type StoredRecord = {
  id: string
  createdAt: string
  previousRecordHash?: string | null
  recordHash?: string
  [key: string]: unknown
}

export type AppendGuard = {
  entityKey: string
  expectedEntityVersion: number | null
  entityVersion?: number
  requireNoLease?: boolean
}

export type EntityLease = {
  collection: Collection
  entityKey: string
  owner: string
  acquiredAt: string
  expiresAt: string
}

export class StorageCorruptionError extends Error {
  readonly code = 'STORAGE_CORRUPT'

  constructor(message: string) {
    super(message)
    this.name = 'StorageCorruptionError'
  }
}

export class StorageConflictError extends Error {
  readonly code = 'STORAGE_CONFLICT'

  constructor(message: string) {
    super(message)
    this.name = 'StorageConflictError'
  }
}

export class StorageLeaseError extends Error {
  readonly code = 'STORAGE_ENTITY_LEASED'

  constructor(message: string) {
    super(message)
    this.name = 'StorageLeaseError'
  }
}

const FALLBACK_DIR = join(tmpdir(), 'crabcode-media-ops-data')
const SQLITE_FILE = 'mediaops.sqlite'
const BUSY_TIMEOUT_MS = 10_000

type RecordRow = {
  sequence: number
  id: string
  previous_record_hash: string | null
  record_hash: string | null
  entity_key: string | null
  entity_version: number | null
  payload: string
}

type CollectionHeadRow = { record_hash: string; record_count: number }
type EntityHeadRow = { entity_version: number; record_hash: string }
type LeaseRow = { owner: string; acquired_at: string; expires_at: string }

export function resolveDataDir(): { dir: string; usedFallback: boolean } {
  const fromEnv = process.env.MEDIAOPS_DATA_DIR
  if (fromEnv && fromEnv.trim()) return { dir: fromEnv, usedFallback: false }
  return { dir: FALLBACK_DIR, usedFallback: true }
}

export function dataDir(): string {
  return resolveDataDir().dir
}

export function storageWarnings(): string[] {
  const warnings: string[] = []
  if (resolveDataDir().usedFallback) warnings.push('MEDIAOPS_DATA_DIR is not set; using a temporary directory. Stored data is not durable across restarts.')
  if (process.env.MEDIAOPS_ALLOW_UNVERIFIED_LEGACY_IMPORT === 'I_ACCEPT_UNVERIFIED_HISTORY') {
    warnings.push('Unverified legacy JSONL import is explicitly enabled; records are re-chained on import, but their pre-migration history cannot be authenticated.')
  }
  return warnings
}

export async function ensureDir(dir: string): Promise<void> {
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
}

export function databasePath(): string {
  return join(dataDir(), SQLITE_FILE)
}

function codeUnitCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => codeUnitCompare(left, right))
        .map(([key, item]) => [key, canonicalize(item)]),
    )
  }
  return value
}

function hashRecord(record: Omit<StoredRecord, 'recordHash'>): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(record))).digest('hex')
}

function openDatabase(): Database {
  mkdirSync(dataDir(), { recursive: true })
  const database = new Database(databasePath(), { create: true, strict: true })
  database.exec(`
    PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS};
    PRAGMA foreign_keys = ON;
    PRAGMA synchronous = FULL;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS records (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT,
      collection TEXT NOT NULL,
      id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      previous_record_hash TEXT,
      record_hash TEXT,
      entity_key TEXT,
      entity_version INTEGER,
      payload TEXT NOT NULL,
      UNIQUE(collection, entity_key, entity_version)
    );
    CREATE INDEX IF NOT EXISTS records_collection_sequence
      ON records(collection, sequence);
    CREATE INDEX IF NOT EXISTS records_collection_id
      ON records(collection, id);
    CREATE INDEX IF NOT EXISTS records_collection_entity
      ON records(collection, entity_key, entity_version);
    CREATE TABLE IF NOT EXISTS collection_heads (
      collection TEXT PRIMARY KEY,
      record_hash TEXT NOT NULL,
      record_count INTEGER NOT NULL CHECK(record_count > 0)
    );
    CREATE TABLE IF NOT EXISTS entity_heads (
      collection TEXT NOT NULL,
      entity_key TEXT NOT NULL,
      entity_version INTEGER NOT NULL CHECK(entity_version > 0),
      record_hash TEXT NOT NULL,
      PRIMARY KEY(collection, entity_key)
    );
    CREATE TABLE IF NOT EXISTS entity_leases (
      collection TEXT NOT NULL,
      entity_key TEXT NOT NULL,
      owner TEXT NOT NULL,
      acquired_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      PRIMARY KEY(collection, entity_key)
    );
    CREATE TABLE IF NOT EXISTS storage_migrations (
      migration_key TEXT PRIMARY KEY,
      completed_at TEXT NOT NULL,
      imported_records INTEGER NOT NULL
    );
  `)
  const integrity = database.query<{ quick_check: string }, []>('PRAGMA quick_check(1)').get()
  if (!integrity || integrity.quick_check !== 'ok') {
    database.close()
    throw new StorageCorruptionError(`SQLite quick_check failed: ${integrity?.quick_check ?? 'no result'}`)
  }
  return database
}

function legacyCollectionPath(collection: Collection): string {
  return join(dataDir(), `${collection}.jsonl`)
}

function legacyHeadPath(collection: Collection): string {
  return join(dataDir(), `${collection}.head.json`)
}

function parseStoredLine(collection: Collection, line: string, index: number): StoredRecord {
  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch (error) {
    throw new StorageCorruptionError(
      `${collection}.jsonl line ${index + 1} is malformed JSON (${error instanceof Error ? error.message : String(error)}).`,
    )
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new StorageCorruptionError(`${collection}.jsonl line ${index + 1} is not a JSON object.`)
  }
  const record = parsed as StoredRecord
  if (typeof record.id !== 'string' || typeof record.createdAt !== 'string') {
    throw new StorageCorruptionError(`${collection}.jsonl line ${index + 1} is missing id or createdAt.`)
  }
  return record
}

function verifyRecordSequence(collection: Collection, records: StoredRecord[], expectedHead?: CollectionHeadRow | null): void {
  let previousNewHash: string | null = null
  for (const [index, record] of records.entries()) {
    if (record.recordHash !== undefined) {
      if (!/^[a-f0-9]{64}$/.test(record.recordHash)) {
        throw new StorageCorruptionError(`${collection} record ${index + 1} has an invalid recordHash.`)
      }
      const { recordHash, ...payload } = record
      const actual = hashRecord(payload)
      if (actual !== recordHash) {
        throw new StorageCorruptionError(`${collection} record ${index + 1} failed recordHash verification.`)
      }
      if ((record.previousRecordHash ?? null) !== previousNewHash) {
        throw new StorageCorruptionError(`${collection} record ${index + 1} breaks the record hash chain.`)
      }
      previousNewHash = recordHash
    } else if (previousNewHash !== null) {
      throw new StorageCorruptionError(`${collection} record ${index + 1} is unhashed after hashed records began.`)
    }
  }
  if (previousNewHash !== null) {
    if (!expectedHead || expectedHead.record_hash !== previousNewHash || expectedHead.record_count !== records.length) {
      throw new StorageCorruptionError(`${collection} head does not match the record tail/count.`)
    }
  } else if (expectedHead) {
    throw new StorageCorruptionError(`${collection} has a head record but no hashed records.`)
  }
}

function readLegacyRecords(collection: Collection): { records: StoredRecord[]; head: CollectionHeadRow | null; historyVerified: boolean } {
  const path = legacyCollectionPath(collection)
  const headPath = legacyHeadPath(collection)
  if (!existsSync(path)) {
    if (existsSync(headPath)) throw new StorageCorruptionError(`${collection} legacy head exists but its JSONL file is missing.`)
    return { records: [], head: null, historyVerified: true }
  }
  const records = readFileSync(path, 'utf8')
    .split('\n')
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.trim())
    .map(({ line, index }) => parseStoredLine(collection, line, index))
  let head: CollectionHeadRow | null = null
  if (existsSync(headPath)) {
    let parsed: unknown
    try {
      parsed = JSON.parse(readFileSync(headPath, 'utf8'))
    } catch (error) {
      throw new StorageCorruptionError(`${collection} legacy head is malformed (${error instanceof Error ? error.message : String(error)}).`)
    }
    if (!parsed || typeof parsed !== 'object' || (parsed as any).collection !== collection ||
      typeof (parsed as any).recordHash !== 'string' || !Number.isInteger((parsed as any).recordCount)) {
      throw new StorageCorruptionError(`${collection} legacy head has an invalid shape.`)
    }
    head = { record_hash: (parsed as any).recordHash, record_count: (parsed as any).recordCount }
  }
  verifyRecordSequence(collection, records, head)
  const historyVerified = records.every((record) => typeof record.recordHash === 'string')
  if (!historyVerified && process.env.MEDIAOPS_ALLOW_UNVERIFIED_LEGACY_IMPORT !== 'I_ACCEPT_UNVERIFIED_HISTORY') {
    throw new StorageCorruptionError(
      `${collection} legacy JSONL contains records without a verifiable hash chain. Refuse automatic import; inspect and back up the data, then set MEDIAOPS_ALLOW_UNVERIFIED_LEGACY_IMPORT=I_ACCEPT_UNVERIFIED_HISTORY only if accepting unauthenticated pre-migration history.`,
    )
  }
  return { records, head, historyVerified }
}

function legacyEntity(
  collection: Collection,
  record: StoredRecord,
  versions: Map<string, number>,
): { entityKey: string; entityVersion: number } | null {
  const candidate = collection === 'content' ? record.contentId
    : collection === 'approvals' ? record.approvalId
      : collection === 'originality-scans' ? record.scanId
        : collection === 'delivery-manifests' ? record.deliveryId
          : null
  if (typeof candidate !== 'string' || !candidate) return null
  const explicit = collection === 'content' && Number.isInteger(record.revision) ? Number(record.revision) : null
  const next = explicit ?? ((versions.get(candidate) ?? 0) + 1)
  versions.set(candidate, next)
  return { entityKey: candidate, entityVersion: next }
}

function ensureLegacyImported(database: Database, collection: Collection): void {
  const key = `legacy-jsonl-v1:${collection}`
  const done = database.query<{ migration_key: string }, [string]>(
    'SELECT migration_key FROM storage_migrations WHERE migration_key = ?',
  ).get(key)
  if (done) return
  const legacy = readLegacyRecords(collection)
  const migrate = database.transaction(() => {
    const recheck = database.query<{ migration_key: string }, [string]>(
      'SELECT migration_key FROM storage_migrations WHERE migration_key = ?',
    ).get(key)
    if (recheck) return
    const existing = database.query<{ count: number }, [Collection]>(
      'SELECT COUNT(*) AS count FROM records WHERE collection = ?',
    ).get(collection)?.count ?? 0
    if (existing > 0 && legacy.records.length > 0) {
      throw new StorageCorruptionError(`${collection} has both unmigrated JSONL and SQLite records.`)
    }
    if (existing === 0 && legacy.records.length > 0) {
      const versions = new Map<string, number>()
      const insert = database.prepare(`
        INSERT INTO records(collection, id, created_at, previous_record_hash, record_hash, entity_key, entity_version, payload)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      let migratedHead: CollectionHeadRow | null = legacy.head
      let migratedPreviousHash: string | null = null
      for (const original of legacy.records) {
        let record = original
        if (!legacy.historyVerified) {
          const clean = { ...original } as Record<string, unknown>
          delete clean.previousRecordHash
          delete clean.recordHash
          const base = { ...clean, previousRecordHash: migratedPreviousHash } as unknown as Omit<StoredRecord, 'recordHash'>
          const recordHash = hashRecord(base)
          record = { ...base, recordHash } as StoredRecord
          migratedPreviousHash = recordHash
        }
        const entity = legacyEntity(collection, record, versions)
        insert.run(
          collection,
          record.id,
          record.createdAt,
          record.previousRecordHash ?? null,
          record.recordHash ?? null,
          entity?.entityKey ?? null,
          entity?.entityVersion ?? null,
          JSON.stringify(record),
        )
        if (entity && record.recordHash) {
          database.run(`
            INSERT INTO entity_heads(collection, entity_key, entity_version, record_hash)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(collection, entity_key) DO UPDATE SET
              entity_version = excluded.entity_version,
              record_hash = excluded.record_hash
          `, [collection, entity.entityKey, entity.entityVersion, record.recordHash])
        }
      }
      if (!legacy.historyVerified && migratedPreviousHash) {
        migratedHead = { record_hash: migratedPreviousHash, record_count: legacy.records.length }
      }
      if (migratedHead) {
        database.run(
          'INSERT INTO collection_heads(collection, record_hash, record_count) VALUES (?, ?, ?)',
          [collection, migratedHead.record_hash, migratedHead.record_count],
        )
      }
    }
    database.run(
      'INSERT INTO storage_migrations(migration_key, completed_at, imported_records) VALUES (?, ?, ?)',
      [key, new Date().toISOString(), legacy.records.length],
    )
  })
  migrate.immediate()
}

function readAllFromDatabase(database: Database, collection: Collection): StoredRecord[] {
  const rows = database.query<RecordRow, [Collection]>(`
    SELECT sequence, id, previous_record_hash, record_hash, entity_key, entity_version, payload
    FROM records WHERE collection = ? ORDER BY sequence ASC
  `).all(collection)
  const records = rows.map((row, index) => {
    let record: StoredRecord
    try {
      record = JSON.parse(row.payload) as StoredRecord
    } catch (error) {
      throw new StorageCorruptionError(`${collection} SQLite row ${row.sequence} has malformed payload JSON (${error instanceof Error ? error.message : String(error)}).`)
    }
    if (!record || typeof record !== 'object' || Array.isArray(record) || record.id !== row.id) {
      throw new StorageCorruptionError(`${collection} SQLite row ${row.sequence} payload/id mismatch.`)
    }
    if ((record.previousRecordHash ?? null) !== row.previous_record_hash || (record.recordHash ?? null) !== row.record_hash) {
      throw new StorageCorruptionError(`${collection} SQLite row ${row.sequence} hash columns do not match its payload.`)
    }
    if ((row.entity_key === null) !== (row.entity_version === null)) {
      throw new StorageCorruptionError(`${collection} SQLite row ${row.sequence} has a partial entity binding.`)
    }
    if (row.entity_version !== null && (!Number.isInteger(row.entity_version) || row.entity_version < 1)) {
      throw new StorageCorruptionError(`${collection} SQLite row ${row.sequence} has an invalid entity version.`)
    }
    if (typeof record.createdAt !== 'string') {
      throw new StorageCorruptionError(`${collection} SQLite row ${index + 1} is missing createdAt.`)
    }
    return record
  })
  const head = database.query<CollectionHeadRow, [Collection]>(
    'SELECT record_hash, record_count FROM collection_heads WHERE collection = ?',
  ).get(collection) ?? null
  verifyRecordSequence(collection, records, head)
  return records
}

function closeSafely(database: Database): void {
  try {
    database.close()
  } catch {
    // The operation result is authoritative; a close failure must not mask it.
  }
}

export type AtomicAppend = {
  collection: Collection
  record: Record<string, unknown>
  guard?: AppendGuard
}

function appendRecordInDatabase<T extends Record<string, unknown>>(
  database: Database,
  collection: Collection,
  record: T,
  guard?: AppendGuard,
): StoredRecord & T {
  const all = readAllFromDatabase(database, collection)
  const head = database.query<CollectionHeadRow, [Collection]>(
    'SELECT record_hash, record_count FROM collection_heads WHERE collection = ?',
  ).get(collection) ?? null
  if (guard) {
    database.run('DELETE FROM entity_leases WHERE expires_at <= ?', [new Date().toISOString()])
    if (guard.requireNoLease) {
      const lease = database.query<LeaseRow, [Collection, string]>(
        'SELECT owner, acquired_at, expires_at FROM entity_leases WHERE collection = ? AND entity_key = ?',
      ).get(collection, guard.entityKey)
      if (lease) throw new StorageLeaseError(`${collection}/${guard.entityKey} is leased by ${lease.owner} until ${lease.expires_at}.`)
    }
    const current = database.query<EntityHeadRow, [Collection, string]>(
      'SELECT entity_version, record_hash FROM entity_heads WHERE collection = ? AND entity_key = ?',
    ).get(collection, guard.entityKey)
    const actualVersion = current?.entity_version ?? null
    if (actualVersion !== guard.expectedEntityVersion) {
      throw new StorageConflictError(
        `${collection}/${guard.entityKey} expected entity version ${guard.expectedEntityVersion ?? 'none'}, current is ${actualVersion ?? 'none'}.`,
      )
    }
  }
  const previousRecordHash = head?.record_hash ?? null
  const clean = { ...record } as Record<string, unknown>
  delete clean.recordHash
  delete clean.previousRecordHash
  const base = {
    ...clean,
    id: typeof clean.id === 'string' ? clean.id : randomUUID(),
    createdAt: typeof clean.createdAt === 'string' ? clean.createdAt : new Date().toISOString(),
    previousRecordHash,
  } as unknown as Omit<StoredRecord, 'recordHash'> & T
  const recordHash = hashRecord(base)
  const stored = { ...base, recordHash } as StoredRecord & T
  const entityVersion = guard ? (guard.entityVersion ?? ((guard.expectedEntityVersion ?? 0) + 1)) : null
  if (guard && entityVersion !== (guard.expectedEntityVersion ?? 0) + 1) {
    throw new StorageConflictError(`${collection}/${guard.entityKey} entity versions must advance exactly once.`)
  }
  database.run(`
    INSERT INTO records(collection, id, created_at, previous_record_hash, record_hash, entity_key, entity_version, payload)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    collection,
    stored.id,
    stored.createdAt,
    stored.previousRecordHash ?? null,
    recordHash,
    guard?.entityKey ?? null,
    entityVersion,
    JSON.stringify(stored),
  ])
  database.run(`
    INSERT INTO collection_heads(collection, record_hash, record_count)
    VALUES (?, ?, ?)
    ON CONFLICT(collection) DO UPDATE SET
      record_hash = excluded.record_hash,
      record_count = excluded.record_count
  `, [collection, recordHash, all.length + 1])
  if (guard) {
    database.run(`
      INSERT INTO entity_heads(collection, entity_key, entity_version, record_hash)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(collection, entity_key) DO UPDATE SET
        entity_version = excluded.entity_version,
        record_hash = excluded.record_hash
    `, [collection, guard.entityKey, entityVersion, recordHash])
  }
  return stored
}

export async function appendRecordsAtomically(entries: AtomicAppend[]): Promise<StoredRecord[]> {
  if (!entries.length) return []
  const database = openDatabase()
  try {
    for (const collection of [...new Set(entries.map((entry) => entry.collection))].sort()) ensureLegacyImported(database, collection)
    let output: StoredRecord[] = []
    const append = database.transaction(() => {
      output = entries.map((entry) => appendRecordInDatabase(database, entry.collection, entry.record, entry.guard))
    })
    append.immediate()
    return output
  } finally {
    closeSafely(database)
  }
}

export async function appendRecord<T extends Record<string, unknown>>(
  collection: Collection,
  record: T,
  guard?: AppendGuard,
): Promise<StoredRecord & T> {
  const [stored] = await appendRecordsAtomically([{ collection, record, ...(guard ? { guard } : {}) }])
  return stored as StoredRecord & T
}

export async function listRecords(
  collection: Collection,
  filter?: Record<string, unknown>,
): Promise<StoredRecord[]> {
  const database = openDatabase()
  try {
    ensureLegacyImported(database, collection)
    const all = readAllFromDatabase(database, collection)
    if (!filter) return all
    const keys = Object.keys(filter)
    return all.filter((record) => keys.every((key) => record[key] === filter[key]))
  } finally {
    closeSafely(database)
  }
}

export async function getRecord(collection: Collection, id: string): Promise<StoredRecord | null> {
  const all = await listRecords(collection)
  return all.find((record) => record.id === id) ?? null
}

export async function getEntityVersion(collection: Collection, entityKey: string): Promise<number | null> {
  const database = openDatabase()
  try {
    ensureLegacyImported(database, collection)
    readAllFromDatabase(database, collection)
    return database.query<EntityHeadRow, [Collection, string]>(
      'SELECT entity_version, record_hash FROM entity_heads WHERE collection = ? AND entity_key = ?',
    ).get(collection, entityKey)?.entity_version ?? null
  } finally {
    closeSafely(database)
  }
}

export async function acquireEntityLease(
  collection: Collection,
  entityKey: string,
  owner: string,
  ttlMs = 30_000,
): Promise<EntityLease | null> {
  if (!Number.isInteger(ttlMs) || ttlMs < 1_000 || ttlMs > 300_000) throw new Error('lease ttl must be between 1 and 300 seconds')
  const database = openDatabase()
  try {
    ensureLegacyImported(database, collection)
    let lease: EntityLease | null = null
    const acquire = database.transaction(() => {
      const now = new Date()
      const acquiredAt = now.toISOString()
      const expiresAt = new Date(now.getTime() + ttlMs).toISOString()
      database.run('DELETE FROM entity_leases WHERE expires_at <= ?', [acquiredAt])
      const current = database.query<LeaseRow, [Collection, string]>(
        'SELECT owner, acquired_at, expires_at FROM entity_leases WHERE collection = ? AND entity_key = ?',
      ).get(collection, entityKey)
      if (current) return
      database.run(
        'INSERT INTO entity_leases(collection, entity_key, owner, acquired_at, expires_at) VALUES (?, ?, ?, ?, ?)',
        [collection, entityKey, owner, acquiredAt, expiresAt],
      )
      lease = { collection, entityKey, owner, acquiredAt, expiresAt }
    })
    acquire.immediate()
    return lease
  } finally {
    closeSafely(database)
  }
}

export async function getEntityLease(collection: Collection, entityKey: string): Promise<EntityLease | null> {
  const database = openDatabase()
  try {
    ensureLegacyImported(database, collection)
    const now = new Date().toISOString()
    const cleanup = database.transaction(() => {
      database.run('DELETE FROM entity_leases WHERE expires_at <= ?', [now])
    })
    cleanup.immediate()
    const row = database.query<LeaseRow, [Collection, string]>(
      'SELECT owner, acquired_at, expires_at FROM entity_leases WHERE collection = ? AND entity_key = ?',
    ).get(collection, entityKey)
    return row ? { collection, entityKey, owner: row.owner, acquiredAt: row.acquired_at, expiresAt: row.expires_at } : null
  } finally {
    closeSafely(database)
  }
}

export async function renewEntityLease(
  collection: Collection,
  entityKey: string,
  owner: string,
  ttlMs = 30_000,
): Promise<EntityLease | null> {
  if (!Number.isInteger(ttlMs) || ttlMs < 1_000 || ttlMs > 300_000) throw new Error('lease ttl must be between 1 and 300 seconds')
  const database = openDatabase()
  try {
    ensureLegacyImported(database, collection)
    let lease: EntityLease | null = null
    const renew = database.transaction(() => {
      const now = new Date()
      const nowIso = now.toISOString()
      database.run('DELETE FROM entity_leases WHERE expires_at <= ?', [nowIso])
      const current = database.query<LeaseRow, [Collection, string, string]>(
        'SELECT owner, acquired_at, expires_at FROM entity_leases WHERE collection = ? AND entity_key = ? AND owner = ?',
      ).get(collection, entityKey, owner)
      if (!current) return
      const expiresAt = new Date(now.getTime() + ttlMs).toISOString()
      database.run(
        'UPDATE entity_leases SET expires_at = ? WHERE collection = ? AND entity_key = ? AND owner = ?',
        [expiresAt, collection, entityKey, owner],
      )
      lease = { collection, entityKey, owner, acquiredAt: current.acquired_at, expiresAt }
    })
    renew.immediate()
    return lease
  } finally {
    closeSafely(database)
  }
}

export async function releaseEntityLease(collection: Collection, entityKey: string, owner: string): Promise<boolean> {
  const database = openDatabase()
  try {
    ensureLegacyImported(database, collection)
    let released = false
    const release = database.transaction(() => {
      const result = database.run(
        'DELETE FROM entity_leases WHERE collection = ? AND entity_key = ? AND owner = ?',
        [collection, entityKey, owner],
      )
      released = result.changes === 1
    })
    release.immediate()
    return released
  } finally {
    closeSafely(database)
  }
}
