import { z } from 'zod'
import { ok, type Envelope } from '../envelope.ts'
import { appendRecord, listRecords, storageWarnings } from '../storage.ts'

// ---- mediaops.approval.request ----------------------------------------------

export const requestName = 'mediaops.approval.request'
export const requestDescription =
  'Record a human-review request: a summary, the intended targets, and a checklist to confirm before publishing.'

export const requestInputSchema = {
  summary: z.string(),
  targets: z.array(z.string()).describe('Intended publish targets, e.g. platform ids or content ids.'),
  checklist: z.array(z.string()).describe('Items a human must confirm before approval.'),
}

type RequestArgs = { summary: string; targets: string[]; checklist: string[] }

export async function requestHandler(args: RequestArgs): Promise<Envelope> {
  const record = await appendRecord('approvals', {
    summary: args.summary,
    targets: args.targets,
    checklist: args.checklist,
    state: 'pending',
  })
  return ok(
    {
      approvalId: record.id,
      state: 'pending',
      pendingChecklist: args.checklist,
      targets: args.targets,
    },
    storageWarnings(),
  )
}

// ---- mediaops.approval.list -------------------------------------------------

export const listName = 'mediaops.approval.list'
export const listDescription = 'List recorded approval requests.'

export const listInputSchema = {}

export async function listHandler(): Promise<Envelope> {
  const records = await listRecords('approvals')
  return ok({ count: records.length, approvals: records }, storageWarnings())
}
