/**
 * Fail-closed JSONL persistence for mediaops.
 *
 * Historical 0.3.x files remain readable. New records carry a per-collection
 * hash chain so accidental truncation or mutation is detected instead of
 * silently falling back to an older approval or content revision.
 */

import { createHash, randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { appendFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export type Collection =
  | 'content'
  | 'approvals'
  | 'publish-history'
  | 'audit-events'
  | 'style-forms'
  | 'profile-proposals'
  | 'references'
  | 'research-captures'
  | 'research-reviews'
  | 'originality-scans'
  | 'editorial-reviews'
  | 'delivery-manifests'

export type StoredRecord = {
  id: string
  createdAt: string
  previousRecordHash?: string | null
  recordHash?: string
  [key: string]: unknown
}

export class StorageCorruptionError extends Error {
  readonly code = 'STORAGE_CORRUPT'

  constructor(message: string) {
    super(message)
    this.name = 'StorageCorruptionError'
  }
}

const FALLBACK_DIR = join(tmpdir(), 'crabcode-media-ops-data')
let writeQueue: Promise<void> = Promise.resolve()

export function resolveDataDir(): { dir: string; usedFallback: boolean } {
  const fromEnv = process.env.MEDIAOPS_DATA_DIR
  if (fromEnv && fromEnv.trim()) return { dir: fromEnv, usedFallback: false }
  return { dir: FALLBACK_DIR, usedFallback: true }
}

export function dataDir(): string {
  return resolveDataDir().dir
}

export function storageWarnings(): string[] {
  return resolveDataDir().usedFallback
    ? ['MEDIAOPS_DATA_DIR is not set; using a temporary directory. Stored data is not durable across restarts.']
    : []
}

export async function ensureDir(dir: string): Promise<void> {
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
}

function collectionPath(collection: Collection): string {
  return join(dataDir(), `${collection}.jsonl`)
}

function collectionHeadPath(collection: Collection): string {
  return join(dataDir(), `${collection}.head.json`)
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

async function readAll(collection: Collection): Promise<StoredRecord[]> {
  const path = collectionPath(collection)
  const headPath = collectionHeadPath(collection)
  if (!existsSync(path)) {
    if (existsSync(headPath)) throw new StorageCorruptionError(`${collection} head exists but its JSONL file is missing.`)
    return []
  }
  const raw = await readFile(path, 'utf8')
  const out: StoredRecord[] = []
  let previousNewHash: string | null = null
  for (const [index, line] of raw.split('\n').entries()) {
    if (!line.trim()) continue
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
    if (record.recordHash !== undefined) {
      if (!/^[a-f0-9]{64}$/.test(record.recordHash)) {
        throw new StorageCorruptionError(`${collection}.jsonl line ${index + 1} has an invalid recordHash.`)
      }
      const { recordHash, ...payload } = record
      const actual = hashRecord(payload)
      if (actual !== recordHash) {
        throw new StorageCorruptionError(`${collection}.jsonl line ${index + 1} failed recordHash verification.`)
      }
      if ((record.previousRecordHash ?? null) !== previousNewHash) {
        throw new StorageCorruptionError(`${collection}.jsonl line ${index + 1} breaks the record hash chain.`)
      }
      previousNewHash = recordHash
    } else if (previousNewHash !== null) {
      throw new StorageCorruptionError(`${collection}.jsonl line ${index + 1} is an unhashed record after hashed records began.`)
    }
    out.push(record)
  }
  if (previousNewHash !== null) {
    if (!existsSync(headPath)) throw new StorageCorruptionError(`${collection} is missing its atomic head record.`)
    let head: unknown
    try {
      head = JSON.parse(await readFile(headPath, 'utf8'))
    } catch (error) {
      throw new StorageCorruptionError(`${collection} head is malformed (${error instanceof Error ? error.message : String(error)}).`)
    }
    if (!head || typeof head !== 'object' || (head as any).collection !== collection || (head as any).recordHash !== previousNewHash || (head as any).recordCount !== out.length) {
      throw new StorageCorruptionError(`${collection} head does not match the JSONL tail/count.`)
    }
  } else if (existsSync(headPath)) {
    throw new StorageCorruptionError(`${collection} has a head record but no hashed JSONL records.`)
  }
  return out
}

export async function withStorageLock<T>(work: () => Promise<T>): Promise<T> {
  const previous = writeQueue
  let release!: () => void
  writeQueue = new Promise<void>((resolve) => {
    release = resolve
  })
  await previous
  try {
    return await work()
  } finally {
    release()
  }
}

export async function appendRecord<T extends Record<string, unknown>>(
  collection: Collection,
  record: T,
): Promise<StoredRecord & T> {
  return withStorageLock(async () => {
    await ensureDir(dataDir())
    const all = await readAll(collection)
    const previousRecordHash = [...all].reverse().find((item) => typeof item.recordHash === 'string')?.recordHash ?? null
    const clean = { ...record } as Record<string, unknown>
    delete clean.recordHash
    delete clean.previousRecordHash
    const base = {
      ...clean,
      id: typeof clean.id === 'string' ? clean.id : randomUUID(),
      createdAt: typeof clean.createdAt === 'string' ? clean.createdAt : new Date().toISOString(),
      previousRecordHash,
    } as unknown as Omit<StoredRecord, 'recordHash'> & T
    const stored = { ...base, recordHash: hashRecord(base) } as StoredRecord & T
    await appendFile(collectionPath(collection), JSON.stringify(stored) + '\n', 'utf8')
    const headPath = collectionHeadPath(collection)
    const temporaryHeadPath = `${headPath}.${randomUUID()}.tmp`
    try {
      await writeFile(temporaryHeadPath, JSON.stringify({ collection, recordHash: stored.recordHash, recordCount: all.length + 1 }) + '\n', 'utf8')
      await rename(temporaryHeadPath, headPath)
    } catch (error) {
      await rm(temporaryHeadPath, { force: true })
      throw error
    }
    return stored
  })
}

export async function listRecords(
  collection: Collection,
  filter?: Record<string, unknown>,
): Promise<StoredRecord[]> {
  const all = await readAll(collection)
  if (!filter) return all
  const keys = Object.keys(filter)
  return all.filter((record) => keys.every((key) => record[key] === filter[key]))
}

export async function getRecord(collection: Collection, id: string): Promise<StoredRecord | null> {
  const all = await readAll(collection)
  return all.find((record) => record.id === id) ?? null
}
