/**
 * JSONL persistence layer for mediaops.
 *
 * Each collection is a newline-delimited JSON file under the data root. The data
 * root is MEDIAOPS_DATA_DIR (injected by CrabCode as CRABCODE_PLUGIN_DATA). When
 * that env is missing we fall back to a tmp dir and surface a warning so callers
 * can tell persistence is non-durable.
 */

import { mkdir, readFile, appendFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

export type Collection = 'content' | 'approvals' | 'publish-history'

export type StoredRecord = {
  id: string
  createdAt: string
  [key: string]: unknown
}

const FALLBACK_DIR = join(tmpdir(), 'crabcode-media-ops-data')

/** Resolve the data root and report whether the env-configured dir was used. */
export function resolveDataDir(): { dir: string; usedFallback: boolean } {
  const fromEnv = process.env.MEDIAOPS_DATA_DIR
  if (fromEnv && fromEnv.trim()) return { dir: fromEnv, usedFallback: false }
  return { dir: FALLBACK_DIR, usedFallback: true }
}

export function dataDir(): string {
  return resolveDataDir().dir
}

/** Warnings to attach when persistence falls back to a tmp dir. */
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

/** Append a record; auto-assigns id + createdAt if absent. Returns the stored record. */
export async function appendRecord<T extends Record<string, unknown>>(
  collection: Collection,
  record: T,
): Promise<StoredRecord & T> {
  await ensureDir(dataDir())
  const stored: StoredRecord & T = {
    id: typeof record.id === 'string' ? (record.id as string) : randomUUID(),
    createdAt: typeof record.createdAt === 'string' ? (record.createdAt as string) : new Date().toISOString(),
    ...record,
  }
  await appendFile(collectionPath(collection), JSON.stringify(stored) + '\n', 'utf8')
  return stored
}

async function readAll(collection: Collection): Promise<StoredRecord[]> {
  const path = collectionPath(collection)
  if (!existsSync(path)) return []
  const raw = await readFile(path, 'utf8')
  const out: StoredRecord[] = []
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      out.push(JSON.parse(trimmed) as StoredRecord)
    } catch {
      // Skip malformed lines rather than crashing the whole read.
    }
  }
  return out
}

/** List records, optionally filtered by an exact-match key/value object. */
export async function listRecords(
  collection: Collection,
  filter?: Record<string, unknown>,
): Promise<StoredRecord[]> {
  const all = await readAll(collection)
  if (!filter) return all
  const keys = Object.keys(filter)
  return all.filter((rec) => keys.every((k) => rec[k] === filter[k]))
}

export async function getRecord(collection: Collection, id: string): Promise<StoredRecord | null> {
  const all = await readAll(collection)
  return all.find((rec) => rec.id === id) ?? null
}
