import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { err, ok, type Envelope } from '../envelope.ts'
import { Sha256Schema, namedActorsEqual, stableHash } from '../domain.ts'
import { getPlatform } from '../platforms/registry.ts'
import { appendRecord, listRecords, storageWarnings, type StoredRecord } from '../storage.ts'
import { getLatestContent } from './content.ts'
import { getDeliveryManifest, getLatestVerifiedDelivery, verifyDeliveryBytes } from './delivery.ts'
import { inspectContent } from './readiness.ts'

export type ApprovalState = 'pending' | 'approved' | 'rejected' | 'revoked'

const approvalSchema = z.object({
  schemaVersion: z.literal(2),
  approvalId: z.string().uuid(),
  contentId: z.string().uuid(),
  revisionId: z.string().uuid(),
  contentHash: Sha256Schema,
  articleDocHash: Sha256Schema,
  deliveryId: z.string().uuid(),
  renderManifestHash: Sha256Schema,
  primaryArtifactHash: Sha256Schema,
  backupArtifactHash: Sha256Schema,
  channelArtifactHashes: z.array(Sha256Schema),
  rendererVersion: z.string().min(1),
  templateVersion: z.string().min(1),
  stylePolicyVersion: z.string().min(1),
  sanitizationPolicyVersion: z.string().min(1),
  platformRuleVersion: z.string().min(1),
  approvalBindingHash: Sha256Schema,
  platform: z.enum(['wechat', 'xhs', 'toutiao']),
  state: z.enum(['pending', 'approved', 'rejected', 'revoked']),
  summary: z.string().min(1),
  checklist: z.array(z.string().min(1)).min(1),
  requestedBy: z.string().min(1),
  decidedBy: z.string().min(1).optional(),
  reason: z.string().min(1).optional(),
  decidedAt: z.string().datetime().optional(),
})

export type ApprovalRecord = StoredRecord & z.infer<typeof approvalSchema>

function bindingPayload(record: Pick<z.infer<typeof approvalSchema>,
  'contentId' | 'revisionId' | 'contentHash' | 'articleDocHash' | 'deliveryId' | 'renderManifestHash' |
  'primaryArtifactHash' | 'backupArtifactHash' | 'channelArtifactHashes' | 'rendererVersion' | 'templateVersion' |
  'stylePolicyVersion' | 'sanitizationPolicyVersion' | 'platformRuleVersion' | 'platform'>): unknown {
  return {
    contentId: record.contentId,
    revisionId: record.revisionId,
    contentHash: record.contentHash,
    articleDocHash: record.articleDocHash,
    deliveryId: record.deliveryId,
    renderManifestHash: record.renderManifestHash,
    primaryArtifactHash: record.primaryArtifactHash,
    backupArtifactHash: record.backupArtifactHash,
    channelArtifactHashes: record.channelArtifactHashes,
    rendererVersion: record.rendererVersion,
    templateVersion: record.templateVersion,
    stylePolicyVersion: record.stylePolicyVersion,
    sanitizationPolicyVersion: record.sanitizationPolicyVersion,
    platformRuleVersion: record.platformRuleVersion,
    platform: record.platform,
  }
}

function parseApproval(record: unknown): ApprovalRecord {
  const parsed = approvalSchema.safeParse(record)
  if (!parsed.success) throw new Error(`INVALID_STORED_APPROVAL:${parsed.error.message}`)
  if (stableHash(bindingPayload(parsed.data)) !== parsed.data.approvalBindingHash) throw new Error(`APPROVAL_BINDING_HASH_MISMATCH:${parsed.data.approvalId}`)
  return record as ApprovalRecord
}

export async function getApproval(approvalId: string): Promise<ApprovalRecord | null> {
  const records = await listRecords('approvals', { approvalId })
  if (!records.length) return null
  return parseApproval(records[records.length - 1])
}

export const requestName = 'mediaops.approval.request'
export const requestDescription = 'Request named human approval for one exact verified HTML/Markdown delivery manifest and all content/render/artifact hashes.'
export const requestInputSchema = {
  contentId: z.string().uuid(),
  deliveryId: z.string().uuid(),
  platform: z.enum(['wechat', 'xhs', 'toutiao']),
  summary: z.string().min(1),
  checklist: z.array(z.string().min(1)).min(1),
  requestedBy: z.string().min(1),
}

export async function requestHandler(args: { contentId: string; deliveryId: string; platform: 'wechat' | 'xhs' | 'toutiao'; summary: string; checklist: string[]; requestedBy: string }): Promise<Envelope> {
  const content = await getLatestContent(args.contentId)
  if (!content) return err('NOT_FOUND', `No content ${args.contentId}.`)
  if (content.platform !== args.platform) return err('PACKAGE_INPUT_MISMATCH', `Content targets ${content.platform ?? 'no platform'}, not ${args.platform}.`)
  if (!('schemaVersion' in content) || content.schemaVersion !== 2) return err('SCHEMA_UPGRADE_REQUIRED', 'Legacy content cannot be approved.')
  const platform = getPlatform(args.platform)!
  const issues = await inspectContent(content, platform)
  const blockers = issues.filter((issue) => issue.severity === 'error')
  if (blockers.length) return err(blockers[0].code, `Approval cannot be requested: ${blockers.map((item) => item.message).join(' ')}`)
  const delivery = await getDeliveryManifest(args.deliveryId)
  const currentDelivery = await getLatestVerifiedDelivery(content.contentId, content.revisionId)
  if (!delivery || !currentDelivery || delivery.deliveryId !== currentDelivery.deliveryId || delivery.visualReviewStatus !== 'passed' || delivery.contentHash !== content.contentHash || delivery.articleDocHash !== content.articleDocHash) {
    return err('DELIVERY_VERIFICATION_REQUIRED', 'deliveryId is not the current verified delivery for this exact revision.')
  }
  try {
    await verifyDeliveryBytes(delivery)
  } catch (error) {
    return err('DELIVERY_INTEGRITY_FAILED', error instanceof Error ? error.message : String(error))
  }
  const approvalId = randomUUID()
  const binding = {
    contentId: content.contentId,
    revisionId: content.revisionId,
    contentHash: content.contentHash,
    articleDocHash: content.articleDocHash,
    deliveryId: delivery.deliveryId,
    renderManifestHash: delivery.renderManifestHash,
    primaryArtifactHash: delivery.primaryArtifact.artifactHash,
    backupArtifactHash: delivery.backupArtifact.artifactHash,
    channelArtifactHashes: delivery.channelArtifacts.map((item) => item.artifactHash),
    rendererVersion: delivery.rendererVersion,
    templateVersion: delivery.templateVersion,
    stylePolicyVersion: delivery.stylePolicyVersion,
    sanitizationPolicyVersion: delivery.sanitizationPolicyVersion,
    platformRuleVersion: platform.ruleVersion,
    platform: args.platform,
  }
  const record = approvalSchema.parse({
    schemaVersion: 2,
    approvalId,
    ...binding,
    approvalBindingHash: stableHash(bindingPayload(binding)),
    state: 'pending',
    summary: args.summary,
    checklist: args.checklist,
    requestedBy: args.requestedBy,
  })
  await appendRecord('approvals', { id: approvalId, ...record })
  await appendRecord('audit-events', { event: 'approval.requested', approvalId, ...binding, approvalBindingHash: record.approvalBindingHash, actor: args.requestedBy })
  return ok({
    approvalId,
    state: 'pending',
    ...binding,
    approvalBindingHash: record.approvalBindingHash,
    primaryArtifactPath: `${delivery.artifactRoot}/${delivery.primaryArtifact.relativePath}`,
    backupArtifactPath: `${delivery.artifactRoot}/${delivery.backupArtifact.relativePath}`,
    pendingChecklist: args.checklist,
  }, storageWarnings())
}

export const decideName = 'mediaops.approval.decide'
export const decideDescription = 'Approve, reject or revoke an exact pending delivery binding. Approval rechecks content, platform rules, delivery manifest and every frozen byte.'
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
  if (args.decision === 'approved' && namedActorsEqual(args.decidedBy, current.requestedBy)) return err('ROLE_SEPARATION_REQUIRED', 'The approval decider must differ from the requester.')
  if (args.decision === 'approved') {
    const content = await getLatestContent(current.contentId)
    if (!content || !('schemaVersion' in content) || content.schemaVersion !== 2 || content.contentHash !== current.contentHash || content.revisionId !== current.revisionId || content.articleDocHash !== current.articleDocHash) {
      return err('APPROVAL_STALE', 'Content changed after approval was requested.')
    }
    const platform = getPlatform(current.platform)!
    if (platform.ruleVersion !== current.platformRuleVersion) return err('APPROVAL_STALE', 'Platform rule version changed after approval was requested.')
    const blockers = (await inspectContent(content, platform)).filter((issue) => issue.severity === 'error')
    if (blockers.length) return err(blockers[0].code, `Approval blocked: ${blockers.map((item) => item.message).join(' ')}`)
    const delivery = await getDeliveryManifest(current.deliveryId)
    if (!delivery || delivery.renderManifestHash !== current.renderManifestHash || delivery.primaryArtifact.artifactHash !== current.primaryArtifactHash || delivery.backupArtifact.artifactHash !== current.backupArtifactHash || stableHash(delivery.channelArtifacts.map((item) => item.artifactHash)) !== stableHash(current.channelArtifactHashes)) {
      return err('APPROVAL_STALE', 'Delivery manifest or artifact binding changed after approval was requested.')
    }
    try {
      await verifyDeliveryBytes(delivery)
    } catch (error) {
      return err('DELIVERY_INTEGRITY_FAILED', error instanceof Error ? error.message : String(error))
    }
  }
  const decidedAt = new Date().toISOString()
  await appendRecord('approvals', { ...current, id: randomUUID(), createdAt: decidedAt, state: args.decision, decidedBy: args.decidedBy, reason: args.reason, decidedAt })
  await appendRecord('audit-events', { event: `approval.${args.decision}`, approvalId: args.approvalId, contentId: current.contentId, revisionId: current.revisionId, contentHash: current.contentHash, deliveryId: current.deliveryId, renderManifestHash: current.renderManifestHash, actor: args.decidedBy, reason: args.reason })
  return ok({ approvalId: args.approvalId, state: args.decision, decidedBy: args.decidedBy, decidedAt }, storageWarnings())
}

export const getName = 'mediaops.approval.get'
export const getDescription = 'Get the current validated state of one v2 approval.'
export const getInputSchema = { approvalId: z.string().uuid() }
export async function getHandler(args: { approvalId: string }): Promise<Envelope> {
  const record = await getApproval(args.approvalId)
  return record ? ok(record, storageWarnings()) : err('NOT_FOUND', `No approval ${args.approvalId}.`)
}

export const listName = 'mediaops.approval.list'
export const listDescription = 'List current validated v2 approval states, optionally scoped by contentId or state.'
export const listInputSchema = { contentId: z.string().uuid().optional(), state: z.enum(['pending', 'approved', 'rejected', 'revoked']).optional() }
export async function listHandler(args: { contentId?: string; state?: ApprovalState } = {}): Promise<Envelope> {
  const events = await listRecords('approvals')
  const current = new Map<string, ApprovalRecord>()
  for (const event of events) {
    const parsed = parseApproval(event)
    current.set(parsed.approvalId, parsed)
  }
  const approvals = [...current.values()].filter((item) => (!args.contentId || item.contentId === args.contentId) && (!args.state || item.state === args.state))
  return ok({ count: approvals.length, approvals }, storageWarnings())
}
