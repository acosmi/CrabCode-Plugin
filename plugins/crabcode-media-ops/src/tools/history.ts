import { z } from 'zod'
import { ok, type Envelope } from '../envelope.ts'
import { listRecords, storageWarnings } from '../storage.ts'

export const name = 'mediaops.publish.history'
export const description = 'List publish-package history records, optionally filtered by platform.'

export const inputSchema = {
  platform: z.string().optional(),
  contentId: z.string().uuid().optional(),
  brandId: z.string().optional(),
}

type Args = { platform?: string; contentId?: string; brandId?: string }

export async function handler(args: Args): Promise<Envelope> {
  const filter = Object.fromEntries(Object.entries(args).filter(([, value]) => value !== undefined))
  const records = await listRecords('publish-history', Object.keys(filter).length ? filter : undefined)
  return ok({ count: records.length, history: records }, storageWarnings())
}
