import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { err, ok, type Envelope } from '../envelope.ts'
import { getPlatform } from '../platforms/registry.ts'
import { appendRecord, listRecords, storageWarnings, type StoredRecord } from '../storage.ts'
import { getLatestContent } from './content.ts'
import { inspectContent } from './readiness.ts'

export type ApprovalState = 'pending' | 'approved' | 'rejected' | 'revoked'
export type ApprovalRecord = StoredRecord & {
  approvalId: string
  contentId: string
  revisionId: string
  contentHash: string
  platform: 'wechat' | 'xhs' | 'toutiao'
  state: ApprovalState
  summary: string
  checklist: string[]
  requestedBy: string
  decidedBy?: string
  reason?: string
  decidedAt?: string
}

export async function getApproval(approvalId: string): Promise<ApprovalRecord | null> {
  const records = await listRecords('approvals', { approvalId })
  return records.length ? (records[records.length - 1] as ApprovalRecord) : null
}

export const requestName = 'mediaops.approval.request'
export const requestDescription = 'Request human approval for one ready content revision, target platform and immutable content hash.'
export const requestInputSchema = {
  contentId: z.string().uuid(),
  platform: z.enum(['wechat', 'xhs', 'toutiao']),
  summary: z.string().min(1),
  checklist: z.array(z.string().min(1)).min(1),
  requestedBy: z.string().min(1),
}

export async function requestHandler(args: { contentId: string; platform: 'wechat' | 'xhs' | 'toutiao'; summary: string; checklist: string[]; requestedBy: string }): Promise<Envelope> {
  const content = await getLatestContent(args.contentId)
  if (!content) return err('NOT_FOUND', `No content ${args.contentId}.`)
  if (content.platform !== args.platform) return err('PACKAGE_INPUT_MISMATCH', `Content targets ${content.platform ?? 'no platform'}, not ${args.platform}.`)
  const platform = getPlatform(args.platform)!
  const issues = await inspectContent(content, platform)
  const blockers = issues.filter((issue) => issue.severity === 'error')
  if (blockers.length) return err(blockers[0].code, `Approval cannot be requested: ${blockers.map((item) => item.message).join(' ')}`)
  const approvalId = randomUUID()
  const record: Omit<ApprovalRecord, 'createdAt'> = {
    id: approvalId,
    approvalId,
    contentId: content.contentId,
    revisionId: content.revisionId,
    contentHash: content.contentHash,
    platform: args.platform,
    state: 'pending',
    summary: args.summary,
    checklist: args.checklist,
    requestedBy: args.requestedBy,
  }
  await appendRecord('approvals', record)
  await appendRecord('audit-events', { event: 'approval.requested', approvalId, contentId: content.contentId, revisionId: content.revisionId, contentHash: content.contentHash, platform: args.platform, actor: args.requestedBy })
  return ok({ approvalId, state: 'pending', contentId: content.contentId, revisionId: content.revisionId, contentHash: content.contentHash, platform: args.platform, pendingChecklist: args.checklist }, storageWarnings())
}

export const decideName = 'mediaops.approval.decide'
export const decideDescription = 'Approve, reject or revoke a pending approval. Approval is denied if the current content hash changed.'
export const decideInputSchema = {
  approvalId: z.string().uuid(),
  decision: z.enum(['approved', 'rejected', 'revoked']),
  decidedBy: z.string().min(1),
  reason: z.string().min(1),
}

export async function decideHandler(args: { approvalId: string; decision: 'approved' | 'rejected' | 'revoked'; decidedBy: string; reason: string }): Promise<Envelope> {
  const current = await getApproval(args.approvalId)
  if (!current) return err('NOT_FOUND', `No approval ${args.approvalId}.`)
  if (args.decision === 'revoked') {
    if (current.state !== 'approved') return err('INVALID_APPROVAL_TRANSITION', `Only approved records can be revoked; current state is ${current.state}.`)
  } else if (current.state !== 'pending') {
    return err('INVALID_APPROVAL_TRANSITION', `Only pending records can be approved or rejected; current state is ${current.state}.`)
  }
  const content = await getLatestContent(current.contentId)
  if (!content || content.contentHash !== current.contentHash || content.revisionId !== current.revisionId) {
    return err('APPROVAL_STALE', 'Content changed after approval was requested; request approval for the latest revision.')
  }
  const decidedAt = new Date().toISOString()
  await appendRecord('approvals', { ...current, id: randomUUID(), createdAt: decidedAt, state: args.decision, decidedBy: args.decidedBy, reason: args.reason, decidedAt })
  await appendRecord('audit-events', { event: `approval.${args.decision}`, approvalId: args.approvalId, contentId: current.contentId, revisionId: current.revisionId, contentHash: current.contentHash, platform: current.platform, actor: args.decidedBy, reason: args.reason })
  return ok({ approvalId: args.approvalId, state: args.decision, decidedBy: args.decidedBy, decidedAt }, storageWarnings())
}

export const getName = 'mediaops.approval.get'
export const getDescription = 'Get the current state of one approval.'
export const getInputSchema = { approvalId: z.string().uuid() }
export async function getHandler(args: { approvalId: string }): Promise<Envelope> {
  const record = await getApproval(args.approvalId)
  return record ? ok(record, storageWarnings()) : err('NOT_FOUND', `No approval ${args.approvalId}.`)
}

export const listName = 'mediaops.approval.list'
export const listDescription = 'List current approval states, optionally scoped by contentId or state.'
export const listInputSchema = { contentId: z.string().uuid().optional(), state: z.enum(['pending', 'approved', 'rejected', 'revoked']).optional() }
export async function listHandler(args: { contentId?: string; state?: ApprovalState } = {}): Promise<Envelope> {
  const events = await listRecords('approvals')
  const current = new Map<string, ApprovalRecord>()
  for (const event of events) current.set(String(event.approvalId), event as ApprovalRecord)
  const approvals = [...current.values()].filter((item) => (!args.contentId || item.contentId === args.contentId) && (!args.state || item.state === args.state))
  return ok({ count: approvals.length, approvals }, storageWarnings())
}
