import { z } from 'zod'
import { ok, err, type Envelope } from '../envelope.ts'
import { appendRecord, getRecord, listRecords, storageWarnings } from '../storage.ts'

// The agent (via SKILL.md) writes the actual prose. This server only persists it.

// ---- mediaops.content.save --------------------------------------------------

export const saveName = 'mediaops.content.save'
export const saveDescription =
  'Persist a piece of content (brief, draft, or variant) that the agent already authored. This server does not generate prose.'

export const saveInputSchema = {
  kind: z.enum(['brief', 'draft', 'variant']),
  payload: z.record(z.unknown()).describe('The content body the agent produced (title, bodyMarkdown, notes, etc.).'),
}

type SaveArgs = { kind: 'brief' | 'draft' | 'variant'; payload: Record<string, unknown> }

export async function saveHandler(args: SaveArgs): Promise<Envelope> {
  const record = await appendRecord('content', { kind: args.kind, payload: args.payload })
  return ok({ id: record.id, kind: args.kind, createdAt: record.createdAt }, storageWarnings())
}

// ---- mediaops.content.get ---------------------------------------------------

export const getName = 'mediaops.content.get'
export const getDescription = 'Fetch a stored content record by id.'

export const getInputSchema = {
  id: z.string(),
}

type GetArgs = { id: string }

export async function getHandler(args: GetArgs): Promise<Envelope> {
  const record = await getRecord('content', args.id)
  if (!record) return err('not_found', `no content record with id ${args.id}`, storageWarnings())
  return ok(record, storageWarnings())
}

// ---- mediaops.content.list --------------------------------------------------

export const listName = 'mediaops.content.list'
export const listDescription = 'List stored content records, optionally filtered by kind.'

export const listInputSchema = {
  kind: z.enum(['brief', 'draft', 'variant']).optional(),
}

type ListArgs = { kind?: 'brief' | 'draft' | 'variant' }

export async function listHandler(args: ListArgs): Promise<Envelope> {
  const records = await listRecords('content', args.kind ? { kind: args.kind } : undefined)
  return ok({ count: records.length, records }, storageWarnings())
}
