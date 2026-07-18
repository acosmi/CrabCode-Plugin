import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { err, ok, type Envelope } from '../envelope.ts'
import { PrincipalAssuranceSchema, Sha256Schema, namedActorsEqual, stableHash } from '../domain.ts'
import type { TrustedPrincipal } from '../identity.ts'
import { getPlatform } from '../platforms/registry.ts'
import {
  appendRecordsAtomically,
  listRecords,
  StorageConflictError,
  StorageLeaseError,
  storageWarnings,
  type AtomicAppend,
  type StoredRecord,
} from '../storage.ts'
import { getLatestContent } from './content.ts'
import { getDeliveryManifest, getLatestVerifiedDelivery, verifyDeliveryBytes } from './delivery.ts'
import { inspectContent } from './readiness.ts'

export type ApprovalState = 'pending' | 'approved' | 'rejected' | 'revoked'

const approvalSchema = z.object({
  schemaVersion: z.literal(3),
  transitionVersion: z.number().int().positive(),
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
  requestedIdentity: z.object({
    principalId: z.string().min(1),
    issuer: z.string().min(1),
    assurance: PrincipalAssuranceSchema,
  }).strict(),
  decidedBy: z.string().min(1).optional(),
  decidedIdentity: z.object({
    principalId: z.string().min(1),
    issuer: z.string().min(1),
    assurance: PrincipalAssuranceSchema,
  }).strict().optional(),
  reason: z.string().min(1).optional(),
  decidedAt: z.string().datetime().optional(),
  packageId: z.string().uuid().optional(),
  packagedBy: z.string().min(1).optional(),
  packagedIdentity: z.object({
    principalId: z.string().min(1),
    issuer: z.string().min(1),
    assurance: PrincipalAssuranceSchema,
  }).strict().optional(),
  packagedAt: z.string().datetime().optional(),
}).strict().superRefine((value, ctx) => {
  const decisionFields = [value.decidedBy, value.decidedIdentity, value.reason, value.decidedAt]
  const packageFields = [value.packageId, value.packagedBy, value.packagedIdentity, value.packagedAt]
  const hasAllDecisionFields = decisionFields.every((field) => field !== undefined)
  const hasAnyDecisionField = decisionFields.some((field) => field !== undefined)
  const hasAllPackageFields = packageFields.every((field) => field !== undefined)
  const hasAnyPackageField = packageFields.some((field) => field !== undefined)
  if (value.state === 'pending' ? hasAnyDecisionField : !hasAllDecisionFields) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['state'], message: 'pending approvals must omit decision fields; terminal decisions require all decision fields' })
  }
  if (hasAnyPackageField && (!hasAllPackageFields || value.state !== 'approved')) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['packageId'], message: 'package fields must appear as a complete group on an approved record' })
  }
  if ((value.state === 'pending' || value.state === 'rejected' || value.state === 'revoked') && hasAnyPackageField) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['packageId'], message: `${value.state} approvals cannot carry package fields` })
  }
})

export type ApprovalRecord = StoredRecord & z.infer<typeof approvalSchema>

function approvalData(record: unknown): z.infer<typeof approvalSchema> {
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('INVALID_STORED_APPROVAL:not an object')
  const {
    id: _storedId,
    createdAt: _storedCreatedAt,
    previousRecordHash: _storedPreviousRecordHash,
    recordHash: _storedRecordHash,
    ...data
  } = record as StoredRecord
  return approvalSchema.parse(data)
}

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
  let parsed: z.infer<typeof approvalSchema>
  try {
    parsed = approvalData(record)
  } catch (error) {
    throw new Error(`INVALID_STORED_APPROVAL:${error instanceof Error ? error.message : String(error)}`)
  }
  if (stableHash(bindingPayload(parsed)) !== parsed.approvalBindingHash) throw new Error(`APPROVAL_BINDING_HASH_MISMATCH:${parsed.approvalId}`)
  return { ...(record as StoredRecord), ...parsed } as ApprovalRecord
}

export async function getApproval(approvalId: string): Promise<ApprovalRecord | null> {
  const records = await listRecords('approvals', { approvalId })
  if (!records.length) return null
  return parseApproval(records[records.length - 1])
}

export function projectApprovalPackaged(
  current: ApprovalRecord,
  packageId: string,
  principal: TrustedPrincipal,
  packagedAt: string,
): z.infer<typeof approvalSchema> {
  return approvalSchema.parse({
    ...approvalData(current),
    transitionVersion: current.transitionVersion + 1,
    packageId,
    packagedBy: principal.actorKey,
    packagedIdentity: identityRecord(principal),
    packagedAt,
  })
}

export async function markApprovalPackaged(
  approvalId: string,
  expectedTransitionVersion: number,
  packageId: string,
  principal: TrustedPrincipal,
  options: { packagedAt: string; additionalEntries?: AtomicAppend[] },
): Promise<{ transitionVersion: number; approval: z.infer<typeof approvalSchema> }> {
  const current = await getApproval(approvalId)
  if (!current || current.state !== 'approved' || current.transitionVersion !== expectedTransitionVersion || current.packageId) {
    throw new StorageConflictError(`approval ${approvalId} changed before its package transition could be committed`)
  }
  const transitionVersion = current.transitionVersion + 1
  const record = projectApprovalPackaged(current, packageId, principal, options.packagedAt)
  await appendRecordsAtomically([
    { collection: 'approvals', record: { id: randomUUID(), ...record }, guard: {
      entityKey: approvalId,
      expectedEntityVersion: expectedTransitionVersion,
      entityVersion: transitionVersion,
    } },
    ...(options.additionalEntries ?? []),
  ])
  return { transitionVersion, approval: record }
}

export const requestName = 'mediaops.approval.request'
export const requestDescription = 'Request authenticated-principal approval for one exact verified HTML/Markdown delivery manifest and all content/render/artifact hashes.'
export const requestInputSchema = {
  contentId: z.string().uuid(),
  deliveryId: z.string().uuid(),
  platform: z.enum(['wechat', 'xhs', 'toutiao']),
  summary: z.string().min(1),
  checklist: z.array(z.string().min(1)).min(1),
  requestedBy: z.string().min(1),
}

function identityRecord(principal: TrustedPrincipal): { principalId: string; issuer: string; assurance: TrustedPrincipal['assurance'] } {
  return { principalId: principal.principalId, issuer: principal.issuer, assurance: principal.assurance }
}

export async function requestHandler(
  args: { contentId: string; deliveryId: string; platform: 'wechat' | 'xhs' | 'toutiao'; summary: string; checklist: string[]; requestedBy: string },
  principal?: TrustedPrincipal,
): Promise<Envelope> {
  if (!principal) return err('AUTHENTICATION_REQUIRED', 'Approval requests require a trusted principal; requestedBy is not identity.')
  const requestedBy = principal.actorKey
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
    schemaVersion: 3,
    transitionVersion: 1,
    approvalId,
    ...binding,
    approvalBindingHash: stableHash(bindingPayload(binding)),
    state: 'pending',
    summary: args.summary,
    checklist: args.checklist,
    requestedBy,
    requestedIdentity: identityRecord(principal),
  })
  try {
    await appendRecordsAtomically([
      { collection: 'approvals', record: { id: approvalId, ...record }, guard: {
        entityKey: approvalId,
        expectedEntityVersion: null,
        entityVersion: 1,
      } },
      { collection: 'audit-events', record: {
        event: 'approval.requested', approvalId, ...binding, approvalBindingHash: record.approvalBindingHash,
        actor: requestedBy, actorAssurance: principal.assurance,
      } },
    ])
  } catch (error) {
    if (error instanceof StorageConflictError) return err('APPROVAL_CONFLICT', 'The approval was concurrently created; retry the request.')
    throw error
  }
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
export const decideDescription = 'Approve or reject an exact pending delivery binding, or revoke an approved binding before packaging. Approval rechecks content, platform rules, delivery manifest and every frozen byte.'
export const decideInputSchema = {
  approvalId: z.string().uuid(),
  decision: z.enum(['approved', 'rejected', 'revoked']),
  decidedBy: z.string().min(1),
  reason: z.string().min(1),
}

export async function decideHandler(
  args: { approvalId: string; decision: 'approved' | 'rejected' | 'revoked'; decidedBy: string; reason: string },
  principal?: TrustedPrincipal,
): Promise<Envelope> {
  if (!principal) return err('AUTHENTICATION_REQUIRED', 'Approval decisions require a trusted principal; decidedBy is not identity.')
  const decidedBy = principal.actorKey
  const current = await getApproval(args.approvalId)
  if (!current) return err('NOT_FOUND', `No approval ${args.approvalId}.`)
  if (current.packageId || current.packagedAt) return err('INVALID_APPROVAL_TRANSITION', 'A committed package is terminal because exported bytes cannot be recalled; create a new revision and approval for any withdrawal or correction.')
  if (args.decision === 'revoked') {
    if (current.state !== 'approved') return err('INVALID_APPROVAL_TRANSITION', `Only approved records can be revoked; current state is ${current.state}.`)
  } else if (current.state !== 'pending') {
    return err('INVALID_APPROVAL_TRANSITION', `Only pending records can be approved or rejected; current state is ${current.state}.`)
  }
  if (args.decision === 'approved' && namedActorsEqual(decidedBy, current.requestedBy)) return err('ROLE_SEPARATION_REQUIRED', 'The approval decider must differ from the requester.')
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
  const transitionVersion = current.transitionVersion + 1
  try {
    await appendRecordsAtomically([
      { collection: 'approvals', record: {
        ...approvalData(current),
        id: randomUUID(),
        createdAt: decidedAt,
        transitionVersion,
        state: args.decision,
        decidedBy,
        decidedIdentity: identityRecord(principal),
        reason: args.reason,
        decidedAt,
      }, guard: {
        entityKey: args.approvalId,
        expectedEntityVersion: current.transitionVersion,
        entityVersion: transitionVersion,
        requireNoLease: true,
      } },
      { collection: 'audit-events', record: {
        event: `approval.${args.decision}`, approvalId: args.approvalId, contentId: current.contentId,
        revisionId: current.revisionId, contentHash: current.contentHash, deliveryId: current.deliveryId,
        renderManifestHash: current.renderManifestHash, actor: decidedBy, actorAssurance: principal.assurance, reason: args.reason,
      } },
    ])
  } catch (error) {
    if (error instanceof StorageLeaseError) return err('APPROVAL_BUSY', 'Packaging holds this approval lease; retry after packaging finishes or the lease expires.')
    if (error instanceof StorageConflictError) return err('APPROVAL_CONFLICT', 'Another process changed this approval; reload it before deciding.')
    throw error
  }
  return ok({ approvalId: args.approvalId, state: args.decision, decidedBy, decidedAt, transitionVersion }, storageWarnings())
}

export const getName = 'mediaops.approval.get'
export const getDescription = 'Get the current validated state of one authenticated v3 approval.'
export const getInputSchema = { approvalId: z.string().uuid() }
export async function getHandler(args: { approvalId: string }): Promise<Envelope> {
  const record = await getApproval(args.approvalId)
  return record ? ok(approvalData(record), storageWarnings()) : err('NOT_FOUND', `No approval ${args.approvalId}.`)
}

export const listName = 'mediaops.approval.list'
export const listDescription = 'List current validated authenticated v3 approval states, optionally scoped by contentId or state.'
export const listInputSchema = { contentId: z.string().uuid().optional(), state: z.enum(['pending', 'approved', 'rejected', 'revoked']).optional() }
export async function listHandler(args: { contentId?: string; state?: ApprovalState } = {}): Promise<Envelope> {
  const events = await listRecords('approvals')
  const current = new Map<string, ApprovalRecord>()
  for (const event of events) {
    const parsed = parseApproval(event)
    current.set(parsed.approvalId, parsed)
  }
  const approvals = [...current.values()]
    .filter((item) => (!args.contentId || item.contentId === args.contentId) && (!args.state || item.state === args.state))
    .map(approvalData)
  return ok({ count: approvals.length, approvals }, storageWarnings())
}
