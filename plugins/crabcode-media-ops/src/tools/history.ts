import { z } from 'zod'
import { ok, type Envelope } from '../envelope.ts'
import { listRecords, storageWarnings } from '../storage.ts'

export const name = 'mediaops.publish.history'
export const description = 'List publish-package history records, optionally filtered by platform.'

export const inputSchema = {
  platform: z.string().optional(),
}

type Args = { platform?: string }

export async function handler(args: Args): Promise<Envelope> {
  const records = await listRecords('publish-history', args.platform ? { platform: args.platform } : undefined)
  return ok({ count: records.length, history: records }, storageWarnings())
}
