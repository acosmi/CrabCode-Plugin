import { createHash, randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { copyFile, lstat, mkdir, open, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { z } from 'zod'
import { actionRequired, blocked, err, ok, type Envelope } from '../envelope.ts'
import { DeliveryManifestSchema, PackageManifestSchema, PrincipalAssuranceSchema, VERSION, stableHash, type PackageManifest } from '../domain.ts'
import type { TrustedPrincipal } from '../identity.ts'
import { getPlatform } from '../platforms/registry.ts'
import {
  acquireEntityLease,
  appendRecordsAtomically,
  dataDir,
  ensureDir,
  listRecords,
  releaseEntityLease,
  renewEntityLease,
  StorageConflictError,
  storageWarnings,
  type StoredRecord,
} from '../storage.ts'
import { getApproval, markApprovalPackaged, projectApprovalPackaged, type ApprovalRecord } from './approval.ts'
import { getLatestContent } from './content.ts'
import { getDeliveryManifest, verifyDeliveryBytes } from './delivery.ts'
import { inspectContent } from './readiness.ts'

export const name = 'mediaops.publish.package'
export const description =
  'Recoverably copy an approved, verified and frozen delivery into a manual publish package. A DO-NOT-PUBLISH marker remains until approval, package state, history and audit commit atomically.'
export const inputSchema = {
  contentId: z.string().uuid(),
  approvalId: z.string().uuid(),
  packagedBy: z.string().min(1),
}

const LEASE_TTL_MS = 300_000
const LEASE_RENEW_SAFETY_MS = 60_000
const MAX_PACKAGE_BYTES = 512 * 1024 * 1024
const PENDING_MARKER = 'DO-NOT-PUBLISH.commit-pending'

const packageOperationSchema = z.object({
  schemaVersion: z.literal(1),
  transitionVersion: z.number().int().positive(),
  operationId: z.string().uuid(),
  packageId: z.string().uuid(),
  approvalId: z.string().uuid(),
  expectedApprovalTransitionVersion: z.number().int().positive(),
  approvalTransitionVersion: z.number().int().positive().optional(),
  contentId: z.string().uuid(),
  revisionId: z.string().uuid(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  deliveryId: z.string().uuid(),
  renderManifestHash: z.string().regex(/^[a-f0-9]{64}$/),
  platform: z.enum(['wechat', 'xhs', 'toutiao']),
  pluginVersion: z.string().min(1),
  finalRoot: z.string().min(1),
  temporaryRoot: z.string().min(1),
  packageManifestHash: z.string().regex(/^[a-f0-9]{64}$/),
  approvalSnapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
  copyChecklistHash: z.string().regex(/^[a-f0-9]{64}$/),
  bindingHash: z.string().regex(/^[a-f0-9]{64}$/),
  state: z.enum(['preparing', 'committed', 'aborted']),
  packagedBy: z.string().min(1),
  packagedIdentity: z.object({
    principalId: z.string().min(1),
    issuer: z.string().min(1),
    assurance: PrincipalAssuranceSchema,
  }).strict(),
  preparedAt: z.string().datetime(),
  committedAt: z.string().datetime().optional(),
  committedBy: z.string().min(1).optional(),
  abortedAt: z.string().datetime().optional(),
  abortedReason: z.string().min(1).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.state === 'preparing') {
    if (value.transitionVersion !== 1 || value.approvalTransitionVersion || value.committedAt || value.committedBy || value.abortedAt || value.abortedReason) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['state'], message: 'preparing operations must be transition 1 without terminal fields' })
    }
  } else if (value.state === 'committed') {
    if (value.transitionVersion !== 2 || !value.approvalTransitionVersion || !value.committedAt || !value.committedBy || value.abortedAt || value.abortedReason) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['state'], message: 'committed operations require transition 2 and complete commit fields only' })
    }
  } else if (value.transitionVersion !== 2 || !value.abortedAt || !value.abortedReason || value.approvalTransitionVersion || value.committedAt || value.committedBy) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['state'], message: 'aborted operations require transition 2 and complete abort fields only' })
  }
})

type PackageOperationData = z.infer<typeof packageOperationSchema>
type PackageOperation = StoredRecord & PackageOperationData

class PackageLeaseLostError extends Error {
  constructor() {
    super('The package lease expired or changed before the operation could commit. The recoverable final directory retains its DO-NOT-PUBLISH marker.')
    this.name = 'PackageLeaseLostError'
  }
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function operationBindingPayload(operation: Pick<PackageOperationData,
  'operationId' | 'packageId' | 'approvalId' | 'expectedApprovalTransitionVersion' | 'contentId' | 'revisionId' |
  'contentHash' | 'deliveryId' | 'renderManifestHash' | 'platform' | 'pluginVersion' | 'finalRoot' | 'temporaryRoot' |
  'packageManifestHash' | 'approvalSnapshotHash' | 'copyChecklistHash' | 'packagedBy' | 'packagedIdentity' | 'preparedAt'>): unknown {
  return {
    operationId: operation.operationId,
    packageId: operation.packageId,
    approvalId: operation.approvalId,
    expectedApprovalTransitionVersion: operation.expectedApprovalTransitionVersion,
    contentId: operation.contentId,
    revisionId: operation.revisionId,
    contentHash: operation.contentHash,
    deliveryId: operation.deliveryId,
    renderManifestHash: operation.renderManifestHash,
    platform: operation.platform,
    pluginVersion: operation.pluginVersion,
    finalRoot: operation.finalRoot,
    temporaryRoot: operation.temporaryRoot,
    packageManifestHash: operation.packageManifestHash,
    approvalSnapshotHash: operation.approvalSnapshotHash,
    copyChecklistHash: operation.copyChecklistHash,
    packagedBy: operation.packagedBy,
    packagedIdentity: operation.packagedIdentity,
    preparedAt: operation.preparedAt,
  }
}

function parsePackageOperation(record: StoredRecord): PackageOperation {
  const {
    id: _storedId,
    createdAt: _storedCreatedAt,
    previousRecordHash: _storedPreviousRecordHash,
    recordHash: _storedRecordHash,
    ...operationData
  } = record
  const parsed = packageOperationSchema.safeParse(operationData)
  if (!parsed.success) throw new Error(`INVALID_PACKAGE_OPERATION:${parsed.error.message}`)
  if (stableHash(operationBindingPayload(parsed.data)) !== parsed.data.bindingHash) {
    throw new Error(`PACKAGE_OPERATION_BINDING_MISMATCH:${parsed.data.operationId}`)
  }
  return { ...record, ...parsed.data } as PackageOperation
}

async function getPackageOperation(approvalId: string): Promise<PackageOperation | null> {
  const records = await listRecords('package-operations', { approvalId })
  if (!records.length) return null
  return parsePackageOperation(records[records.length - 1])
}

function safeRelativePath(value: string): boolean {
  return Boolean(value) && /^[A-Za-z0-9._/-]+$/.test(value) && !value.startsWith('/') && !value.includes(':') && value.split('/').every((part) => part && part !== '.' && part !== '..')
}

async function walkTree(root: string, relativeRoot = ''): Promise<{ files: string[]; directories: string[] }> {
  const absolute = relativeRoot ? join(root, relativeRoot) : root
  const rootStat = await lstat(absolute)
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) throw new Error(`package path ${absolute} is not a regular directory`)
  const files: string[] = []
  const directories = [absolute]
  for (const entry of await readdir(absolute, { withFileTypes: true })) {
    const relative = relativeRoot ? `${relativeRoot}/${entry.name}` : entry.name
    const path = join(root, relative)
    const stat = await lstat(path)
    if (stat.isSymbolicLink()) throw new Error(`package contains symbolic link ${relative}`)
    if (stat.isDirectory()) {
      const nested = await walkTree(root, relative)
      files.push(...nested.files)
      directories.push(...nested.directories)
    } else if (stat.isFile()) files.push(relative)
    else throw new Error(`package contains unsupported filesystem entry ${relative}`)
  }
  return { files: files.sort(), directories }
}

async function syncPath(path: string): Promise<void> {
  const handle = await open(path, 'r')
  try {
    await handle.sync()
  } finally {
    await handle.close()
  }
}

async function syncTree(root: string): Promise<void> {
  const tree = await walkTree(root)
  for (const relativePath of tree.files) await syncPath(join(root, relativePath))
  for (const directory of tree.directories.sort((left, right) => right.length - left.length)) await syncPath(directory)
}

function packageFiles(delivery: z.infer<typeof DeliveryManifestSchema>): string[] {
  const files = [
    delivery.primaryArtifact.relativePath,
    delivery.backupArtifact.relativePath,
    ...delivery.channelArtifacts.map((item) => item.relativePath),
    ...delivery.assets.map((item) => item.relativePath),
    ...(delivery.qaEvidence?.artifacts ?? []).map((item) => item.relativePath),
    'delivery-manifest.json',
    'approval.json',
    'package-manifest.json',
    'copy-checklist.md',
  ]
  if (files.some((file) => !safeRelativePath(file))) throw new Error('package contains an unsafe relative path')
  if (new Set(files).size !== files.length) throw new Error('package contains duplicate relative paths')
  return files
}

function copyChecklist(platformDisplayName: string): string {
  return [
    `# Copy checklist — ${platformDisplayName}`,
    '',
    `- [ ] STOP if ${PENDING_MARKER} exists; the database commit has not been finalized`,
    '- [ ] Call mediaops.approval.get immediately before manual publication and confirm packageId/transitionVersion match approval.json',
    '- [ ] Open article.html and confirm it is the exact approved primary artifact',
    '- [ ] Use article.md only as a backup, not as the default user presentation',
    '- [ ] Recheck current platform console rules and native AI-label setting',
    '- [ ] Confirm cover and inline images match the frozen assets',
    '- [ ] Confirm approvalBindingHash and renderManifestHash match package-manifest.json',
    '- [ ] Perform final manual publication; Gate B publish APIs remain disabled',
    '',
  ].join('\n')
}

function identitySnapshot(principal: TrustedPrincipal): PackageOperationData['packagedIdentity'] {
  return { principalId: principal.principalId, issuer: principal.issuer, assurance: principal.assurance }
}

function sameIdentity(operation: PackageOperation, principal: TrustedPrincipal): boolean {
  return operation.packagedBy === principal.actorKey && operation.packagedIdentity.principalId === principal.principalId &&
    operation.packagedIdentity.issuer === principal.issuer && operation.packagedIdentity.assurance === principal.assurance
}

function buildPackageDocuments(args: {
  packageId: string
  pluginVersion: string
  preparedAt: string
  packagedBy: string
  packagedIdentity: PackageOperationData['packagedIdentity']
  content: any
  approval: ApprovalRecord
  delivery: z.infer<typeof DeliveryManifestSchema>
  platform: NonNullable<ReturnType<typeof getPlatform>>
  principal: TrustedPrincipal
}): { files: string[]; packageManifest: PackageManifest; approvalSnapshot: Record<string, unknown>; checklist: string } {
  const files = packageFiles(args.delivery)
  const approvalSnapshot = projectApprovalPackaged(args.approval, args.packageId, args.principal, args.preparedAt)
  const packageManifest = PackageManifestSchema.parse({
    schemaVersion: 4,
    packageId: args.packageId,
    pluginVersion: args.pluginVersion,
    platform: args.platform.id,
    platformDisplayName: args.platform.displayName,
    platformRuleVersion: args.platform.ruleVersion,
    contentId: args.content.contentId,
    revisionId: args.content.revisionId,
    contentRevision: args.content.revision,
    contentHash: args.content.contentHash,
    articleDocHash: args.content.articleDocHash,
    deliveryId: args.delivery.deliveryId,
    renderManifestHash: args.delivery.renderManifestHash,
    approvalId: args.approval.approvalId,
    approvedTransitionVersion: args.approval.transitionVersion,
    packageCommitTransitionVersion: args.approval.transitionVersion + 1,
    approvalBindingHash: args.approval.approvalBindingHash,
    primaryArtifact: args.delivery.primaryArtifact,
    backupArtifact: args.delivery.backupArtifact,
    channelArtifacts: args.delivery.channelArtifacts,
    assets: args.delivery.assets,
    qaEvidence: args.delivery.qaEvidence,
    defaultUserPresentation: 'article.html (HTML primary)',
    backup: 'article.md (Markdown backup)',
    publishMode: 'package-only; manual platform submission; no rerender during packaging',
    packagedBy: args.packagedBy,
    packagedIdentity: args.packagedIdentity,
    createdAt: args.preparedAt,
    files,
  })
  return { files, packageManifest, approvalSnapshot, checklist: copyChecklist(args.platform.displayName) }
}

async function verifyPackageRoot(
  root: string,
  delivery: z.infer<typeof DeliveryManifestSchema>,
  operation: PackageOperation,
  allowPendingMarker: boolean,
): Promise<{ files: string[]; packageManifest: PackageManifest }> {
  const packageManifest = PackageManifestSchema.parse(JSON.parse(await readFile(join(root, 'package-manifest.json'), 'utf8')))
  if (stableHash(packageManifest) !== operation.packageManifestHash) throw new Error('package manifest does not match the prepared operation binding')
  if (!Array.isArray(packageManifest.files) || packageManifest.files.some((file: unknown) => typeof file !== 'string' || !safeRelativePath(file))) {
    throw new Error('package manifest file inventory is invalid')
  }
  const expectedFiles = [...packageManifest.files, ...(allowPendingMarker ? [PENDING_MARKER] : [])].sort()
  const tree = await walkTree(root)
  if (stableHash(tree.files) !== stableHash(expectedFiles)) throw new Error('package filesystem inventory differs from the bound manifest')
  const approvalSnapshot = JSON.parse(await readFile(join(root, 'approval.json'), 'utf8'))
  if (stableHash(approvalSnapshot) !== operation.approvalSnapshotHash) throw new Error('package approval snapshot differs from the prepared operation binding')
  const checklist = await readFile(join(root, 'copy-checklist.md'), 'utf8')
  if (stableHash(checklist) !== operation.copyChecklistHash) throw new Error('package copy checklist differs from the prepared operation binding')
  const copiedDeliveryManifest = DeliveryManifestSchema.parse(JSON.parse(await readFile(join(root, 'delivery-manifest.json'), 'utf8')))
  if (stableHash(copiedDeliveryManifest) !== stableHash(delivery)) throw new Error('copied delivery manifest failed canonical hash verification')
  for (const item of [delivery.primaryArtifact, delivery.backupArtifact, ...delivery.channelArtifacts]) {
    const bytes = await readFile(join(root, item.relativePath))
    if (bytes.byteLength !== item.byteSize || sha256(bytes) !== item.artifactHash) throw new Error(`copied artifact ${item.artifactId} failed hash verification`)
  }
  for (const asset of delivery.assets) {
    const bytes = await readFile(join(root, asset.relativePath))
    if (bytes.byteLength !== asset.byteSize || sha256(bytes) !== asset.sha256) throw new Error(`copied asset ${asset.assetId} failed hash verification`)
  }
  for (const qaArtifact of delivery.qaEvidence?.artifacts ?? []) {
    const bytes = await readFile(join(root, qaArtifact.relativePath))
    if (bytes.byteLength !== qaArtifact.byteSize || sha256(bytes) !== qaArtifact.sha256) throw new Error(`copied QA artifact ${qaArtifact.relativePath} failed hash verification`)
  }
  return { files: packageManifest.files, packageManifest }
}

async function finalizeCommittedPackage(root: string, delivery: z.infer<typeof DeliveryManifestSchema>, operation: PackageOperation): Promise<void> {
  const markerPath = join(root, PENDING_MARKER)
  if (existsSync(markerPath)) {
    await verifyPackageRoot(root, delivery, operation, true)
    await rm(markerPath)
    await syncPath(root)
    await syncPath(dirname(root))
  }
  await verifyPackageRoot(root, delivery, operation, false)
}

function packageResponse(
  operation: PackageOperation,
  delivery: z.infer<typeof DeliveryManifestSchema>,
  approvalTransitionVersion: number,
  files: string[],
  recoveryMode: 'new' | 'resumed' | 'idempotent',
): Envelope {
  return ok({
    packageId: operation.packageId,
    packagePath: operation.finalRoot,
    contentId: operation.contentId,
    revisionId: operation.revisionId,
    contentHash: operation.contentHash,
    deliveryId: operation.deliveryId,
    renderManifestHash: operation.renderManifestHash,
    approvalId: operation.approvalId,
    approvalTransitionVersion,
    platform: operation.platform,
    primary: { path: join(operation.finalRoot, delivery.primaryArtifact.relativePath), format: 'html', hash: delivery.primaryArtifact.artifactHash },
    backup: { path: join(operation.finalRoot, delivery.backupArtifact.relativePath), format: 'markdown', hash: delivery.backupArtifact.artifactHash },
    files,
    recoveryMode,
    recovered: recoveryMode !== 'new',
  }, storageWarnings())
}

function packageRecoveryRequired(
  operation: PackageOperation,
  code: string,
  message: string,
  samePrincipalRequired = operation.state === 'preparing',
): Envelope {
  return actionRequired({
    code,
    message,
    operationId: operation.operationId,
    packageId: operation.packageId,
    state: operation.state,
    contentId: operation.contentId,
    approvalId: operation.approvalId,
    finalRoot: operation.finalRoot,
    markerPath: join(operation.finalRoot, PENDING_MARKER),
    safeToPublish: false,
    retryRequired: true,
    samePrincipalRequired,
    retry: {
      tool: name,
      args: { contentId: operation.contentId, approvalId: operation.approvalId, packagedBy: operation.packagedBy },
    },
  }, storageWarnings())
}

function packageAborted(operation: PackageOperation): Envelope {
  return blocked({
    code: 'PACKAGE_ABORTED',
    message: operation.abortedReason ?? 'The prepared package operation was aborted.',
    operationId: operation.operationId,
    packageId: operation.packageId,
    state: operation.state,
    finalRoot: operation.finalRoot,
    markerPath: join(operation.finalRoot, PENDING_MARKER),
    safeToPublish: false,
    retryRequired: false,
    requiredAction: 'Keep or quarantine the marked directory for audit, then create a new revision and approval.',
  }, storageWarnings())
}

async function abortPreparedOperation(operation: PackageOperation, reason: string, actor: string): Promise<PackageOperation> {
  const {
    id: _storedId,
    createdAt: _storedCreatedAt,
    previousRecordHash: _storedPreviousRecordHash,
    recordHash: _storedRecordHash,
    ...operationData
  } = operation
  const abortedAt = new Date().toISOString()
  const aborted = packageOperationSchema.parse({
    ...operationData,
    transitionVersion: 2,
    state: 'aborted',
    abortedAt,
    abortedReason: reason,
  })
  await appendRecordsAtomically([
    { collection: 'package-operations', record: { id: randomUUID(), createdAt: abortedAt, ...aborted }, guard: {
      entityKey: operation.approvalId, expectedEntityVersion: 1, entityVersion: 2,
    } },
    { collection: 'audit-events', record: {
      event: 'publish.package.aborted', operationId: operation.operationId, packageId: operation.packageId,
      approvalId: operation.approvalId, contentId: operation.contentId, actor, reason,
    } },
  ])
  return { ...operation, ...aborted, createdAt: abortedAt } as PackageOperation
}

export async function handler(
  args: { contentId: string; approvalId: string; packagedBy: string },
  principal?: TrustedPrincipal,
): Promise<Envelope> {
  if (!principal) return err('AUTHENTICATION_REQUIRED', 'Publish packaging requires a trusted principal; packagedBy is not identity.')
  const packagedBy = principal.actorKey
  const initialContent = await getLatestContent(args.contentId)
  if (!initialContent) return err('NOT_FOUND', `No content ${args.contentId}.`)
  if (!('schemaVersion' in initialContent) || initialContent.schemaVersion !== 2) return err('SCHEMA_UPGRADE_REQUIRED', 'Legacy content cannot be packaged by the integrity workflow.')
  let content = initialContent
  let approval = await getApproval(args.approvalId)
  if (!approval) return err('APPROVAL_REQUIRED', `No v3 approval ${args.approvalId}.`)
  if (approval.contentId !== content.contentId || approval.platform !== content.platform) return err('PACKAGE_INPUT_MISMATCH', 'Approval does not target this content/platform pair.')
  const existingOperation = await getPackageOperation(approval.approvalId)
  if (approval.packageId) {
    if (!existingOperation || existingOperation.state !== 'committed' || existingOperation.packageId !== approval.packageId || existingOperation.approvalTransitionVersion !== approval.transitionVersion) {
      return err('PACKAGE_STATE_CORRUPT', 'Approval records a package that has no matching committed package operation.')
    }
    const delivery = await getDeliveryManifest(existingOperation.deliveryId)
    if (!delivery) return err('PACKAGE_STATE_CORRUPT', 'Committed package delivery metadata is missing.')
    try {
      await finalizeCommittedPackage(existingOperation.finalRoot, delivery, existingOperation)
      const manifest = PackageManifestSchema.parse(JSON.parse(await readFile(join(existingOperation.finalRoot, 'package-manifest.json'), 'utf8')))
      return packageResponse(existingOperation, delivery, approval.transitionVersion, manifest.files, 'idempotent')
    } catch (error) {
      return err('PACKAGE_INTEGRITY_FAILED', error instanceof Error ? error.message : String(error))
    }
  }
  if (approval.state === 'pending') return err('APPROVAL_PENDING', 'Approval is still pending.')
  if (approval.state === 'rejected') return err('APPROVAL_REJECTED', 'Approval was rejected.')
  if (approval.state !== 'approved') return err('APPROVAL_REQUIRED', `Approval state ${approval.state} cannot package content.`)
  if (existingOperation?.state === 'committed') return err('PACKAGE_STATE_CORRUPT', 'Package operation committed without the matching approval transition.')
  if (existingOperation?.state === 'aborted') return packageAborted(existingOperation)
  if (existingOperation && !sameIdentity(existingOperation, principal)) {
    return err('PACKAGE_RESUME_IDENTITY_MISMATCH', 'A preparing package must be resumed by the same authenticated principal that created it.')
  }

  const leaseOwner = `${packagedBy}:${randomUUID()}`
  const approvalLease = await acquireEntityLease('approvals', approval.approvalId, leaseOwner, LEASE_TTL_MS)
  if (!approvalLease) return err('APPROVAL_BUSY', 'Another package operation holds this approval lease.')
  let contentLeaseAcquired = false
  try {
    const contentLease = await acquireEntityLease('content', content.contentId, leaseOwner, LEASE_TTL_MS)
    if (!contentLease) return err('CONTENT_BUSY', 'Another package operation holds this content lease.')
    contentLeaseAcquired = true
    let renewAt = Math.min(Date.parse(approvalLease.expiresAt), Date.parse(contentLease.expiresAt)) - LEASE_RENEW_SAFETY_MS
    const ensureLeases = async (force = false): Promise<void> => {
      if (!force && Date.now() < renewAt) return
      const [renewedApproval, renewedContent] = await Promise.all([
        renewEntityLease('approvals', args.approvalId, leaseOwner, LEASE_TTL_MS),
        renewEntityLease('content', content.contentId, leaseOwner, LEASE_TTL_MS),
      ])
      if (!renewedApproval || !renewedContent) throw new PackageLeaseLostError()
      renewAt = Math.min(Date.parse(renewedApproval.expiresAt), Date.parse(renewedContent.expiresAt)) - LEASE_RENEW_SAFETY_MS
    }

    const leasedApproval = await getApproval(args.approvalId)
    const leasedContent = await getLatestContent(args.contentId)
    if (!leasedApproval || leasedApproval.transitionVersion !== approval.transitionVersion || leasedApproval.state !== 'approved' || leasedApproval.packageId) {
      return err('APPROVAL_STALE', 'Approval changed before the package lease was acquired.')
    }
    if (!leasedContent || !('schemaVersion' in leasedContent) || leasedContent.schemaVersion !== 2 || leasedContent.revisionId !== content.revisionId || leasedContent.contentHash !== content.contentHash) {
      return err('APPROVAL_STALE', 'Content changed before the package lease was acquired.')
    }
    approval = leasedApproval
    content = leasedContent
    if (approval.revisionId !== content.revisionId || approval.contentHash !== content.contentHash || approval.articleDocHash !== content.articleDocHash) {
      return err('APPROVAL_STALE', 'Content or ArticleDoc changed after approval.')
    }
    const platform = getPlatform(approval.platform)!
    if (platform.ruleVersion !== approval.platformRuleVersion) return err('APPROVAL_STALE', 'Platform rule version changed after approval.')
    const blockers = (await inspectContent(content, platform)).filter((issue) => issue.severity === 'error')
    if (blockers.length) return err(blockers[0].code, `Packaging blocked: ${blockers.map((item) => item.message).join(' ')}`)
    const delivery = await getDeliveryManifest(approval.deliveryId)
    if (!delivery || delivery.renderManifestHash !== approval.renderManifestHash || delivery.primaryArtifact.artifactHash !== approval.primaryArtifactHash || delivery.backupArtifact.artifactHash !== approval.backupArtifactHash) {
      return err('APPROVAL_STALE', 'Approved delivery manifest or primary/backup artifact hashes changed.')
    }
    let sourceRoot: string
    try {
      sourceRoot = await verifyDeliveryBytes(delivery)
    } catch (error) {
      return err('DELIVERY_INTEGRITY_FAILED', error instanceof Error ? error.message : String(error))
    }
    const declaredBytes = [delivery.primaryArtifact, delivery.backupArtifact, ...delivery.channelArtifacts].reduce((sum, item) => sum + item.byteSize, 0) +
      delivery.assets.reduce((sum, item) => sum + item.byteSize, 0) +
      (delivery.qaEvidence?.artifacts ?? []).reduce((sum, item) => sum + item.byteSize, 0)
    if (declaredBytes > MAX_PACKAGE_BYTES) return err('PACKAGE_TOO_LARGE', `Frozen package bytes ${declaredBytes} exceed the ${MAX_PACKAGE_BYTES} byte recoverable-package limit.`)

    let operation = existingOperation
    let documents: ReturnType<typeof buildPackageDocuments>
    if (!operation) {
      const packageId = randomUUID()
      const operationId = randomUUID()
      const preparedAt = new Date().toISOString()
      const packagesRoot = join(dataDir(), 'publish-packages')
      const finalRoot = join(packagesRoot, `${platform.id}-${preparedAt.slice(0, 10)}-${packageId}`)
      const temporaryRoot = join(packagesRoot, `.tmp-${packageId}`)
      documents = buildPackageDocuments({
        packageId, pluginVersion: VERSION, preparedAt, packagedBy, packagedIdentity: identitySnapshot(principal),
        content, approval, delivery, platform, principal,
      })
      const base = {
        schemaVersion: 1 as const,
        transitionVersion: 1,
        operationId,
        packageId,
        approvalId: approval.approvalId,
        expectedApprovalTransitionVersion: approval.transitionVersion,
        contentId: content.contentId,
        revisionId: content.revisionId,
        contentHash: content.contentHash,
        deliveryId: delivery.deliveryId,
        renderManifestHash: delivery.renderManifestHash,
        platform: platform.id,
        pluginVersion: VERSION,
        finalRoot,
        temporaryRoot,
        packageManifestHash: stableHash(documents.packageManifest),
        approvalSnapshotHash: stableHash(documents.approvalSnapshot),
        copyChecklistHash: stableHash(documents.checklist),
        state: 'preparing' as const,
        packagedBy,
        packagedIdentity: identitySnapshot(principal),
        preparedAt,
      }
      const operationData = packageOperationSchema.parse({ ...base, bindingHash: stableHash(operationBindingPayload(base)) })
      try {
        await appendRecordsAtomically([
          { collection: 'package-operations', record: { id: operationId, ...operationData }, guard: {
            entityKey: approval.approvalId, expectedEntityVersion: null, entityVersion: 1,
          } },
          { collection: 'audit-events', record: {
            event: 'publish.package.preparing', packageId, operationId, approvalId: approval.approvalId,
            contentId: content.contentId, revisionId: content.revisionId, actor: packagedBy, actorAssurance: principal.assurance,
          } },
        ])
      } catch (error) {
        if (error instanceof StorageConflictError) return err('APPROVAL_BUSY', 'Another recoverable package operation was created for this approval.')
        throw error
      }
      operation = { ...operationData, id: operationId, createdAt: preparedAt } as PackageOperation
    } else {
      if (operation.expectedApprovalTransitionVersion !== approval.transitionVersion || operation.contentId !== content.contentId || operation.revisionId !== content.revisionId ||
        operation.contentHash !== content.contentHash || operation.deliveryId !== delivery.deliveryId || operation.renderManifestHash !== delivery.renderManifestHash || operation.platform !== platform.id) {
        const reason = 'The preparing package operation no longer matches the approved content/delivery binding.'
        try {
          operation = await abortPreparedOperation(operation, reason, packagedBy)
          return packageAborted(operation)
        } catch (error) {
          return packageRecoveryRequired(operation, 'PACKAGE_ABORT_PENDING', `${reason} Failed to persist the aborted transition: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
      documents = buildPackageDocuments({
        packageId: operation.packageId, pluginVersion: operation.pluginVersion, preparedAt: operation.preparedAt,
        packagedBy: operation.packagedBy, packagedIdentity: operation.packagedIdentity,
        content, approval, delivery, platform, principal,
      })
      if (stableHash(documents.packageManifest) !== operation.packageManifestHash || stableHash(documents.approvalSnapshot) !== operation.approvalSnapshotHash || stableHash(documents.checklist) !== operation.copyChecklistHash) {
        return err('PACKAGE_OPERATION_STALE', 'Current package documents differ from the persisted preparing operation binding.')
      }
    }

    await ensureDir(dirname(operation.finalRoot))
    let finalVerified = false
    if (existsSync(operation.finalRoot)) {
      try {
        await verifyPackageRoot(operation.finalRoot, delivery, operation, true)
        finalVerified = true
      } catch {
        const quarantine = `${operation.finalRoot}.quarantine-${new Date().toISOString().replace(/[:.]/g, '-')}`
        await rename(operation.finalRoot, quarantine)
        await syncPath(dirname(operation.finalRoot))
      }
    }
    if (!finalVerified) {
      await rm(operation.temporaryRoot, { recursive: true, force: true })
      try {
        for (const relativePath of documents.files) await mkdir(dirname(join(operation.temporaryRoot, relativePath)), { recursive: true })
        const frozenEntries = [delivery.primaryArtifact, delivery.backupArtifact, ...delivery.channelArtifacts]
        for (const item of frozenEntries) {
          await ensureLeases()
          await copyFile(join(sourceRoot, item.relativePath), join(operation.temporaryRoot, item.relativePath))
        }
        for (const asset of delivery.assets) {
          await ensureLeases()
          await copyFile(join(sourceRoot, asset.relativePath), join(operation.temporaryRoot, asset.relativePath))
        }
        for (const qaArtifact of delivery.qaEvidence?.artifacts ?? []) {
          await ensureLeases()
          await copyFile(join(sourceRoot, qaArtifact.relativePath), join(operation.temporaryRoot, qaArtifact.relativePath))
        }
        await copyFile(join(sourceRoot, 'delivery-manifest.json'), join(operation.temporaryRoot, 'delivery-manifest.json'))
        await writeFile(join(operation.temporaryRoot, 'approval.json'), JSON.stringify(documents.approvalSnapshot, null, 2) + '\n', 'utf8')
        await writeFile(join(operation.temporaryRoot, 'package-manifest.json'), JSON.stringify(documents.packageManifest, null, 2) + '\n', 'utf8')
        await writeFile(join(operation.temporaryRoot, 'copy-checklist.md'), documents.checklist, 'utf8')
        await writeFile(join(operation.temporaryRoot, PENDING_MARKER), 'This package is not committed. Do not publish it. Resume mediaops.publish.package with the same approval and authenticated principal.\n', 'utf8')
        await verifyPackageRoot(operation.temporaryRoot, delivery, operation, true)
        await ensureLeases(true)
        await syncTree(operation.temporaryRoot)
        await rename(operation.temporaryRoot, operation.finalRoot)
        await syncPath(dirname(operation.finalRoot))
      } catch (error) {
        await rm(operation.temporaryRoot, { recursive: true, force: true })
        if (error instanceof PackageLeaseLostError) return packageRecoveryRequired(operation, 'PACKAGE_LEASE_LOST', error.message)
        return packageRecoveryRequired(operation, 'PACKAGE_WRITE_FAILED', error instanceof Error ? error.message : String(error))
      }
    }

    try {
      await ensureLeases(true)
    } catch (error) {
      return packageRecoveryRequired(operation, 'PACKAGE_LEASE_LOST', error instanceof Error ? error.message : String(error))
    }
    const commitApproval = await getApproval(approval.approvalId)
    const commitContent = await getLatestContent(content.contentId)
    if (!commitApproval || commitApproval.state !== 'approved' || commitApproval.packageId || commitApproval.transitionVersion !== approval.transitionVersion ||
      !commitContent || !('schemaVersion' in commitContent) || commitContent.schemaVersion !== 2 || commitContent.revisionId !== content.revisionId || commitContent.contentHash !== content.contentHash) {
      const reason = `Approval/content changed before commit; package bytes remain marked by ${PENDING_MARKER}.`
      try {
        operation = await abortPreparedOperation(operation, reason, packagedBy)
        return packageAborted(operation)
      } catch (error) {
        return packageRecoveryRequired(operation, 'PACKAGE_ABORT_PENDING', `${reason} Failed to persist the aborted transition: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    const committedAt = new Date().toISOString()
    const packageCommitTransitionVersion = approval.transitionVersion + 1
    const {
      id: _storedId,
      createdAt: _storedCreatedAt,
      previousRecordHash: _storedPreviousRecordHash,
      recordHash: _storedRecordHash,
      ...operationData
    } = operation
    const committedOperation = packageOperationSchema.parse({
      ...operationData,
      transitionVersion: 2,
      approvalTransitionVersion: packageCommitTransitionVersion,
      state: 'committed',
      committedAt,
      committedBy: packagedBy,
    })
    try {
      const transition = await markApprovalPackaged(approval.approvalId, approval.transitionVersion, operation.packageId, principal, {
        packagedAt: operation.preparedAt,
        additionalEntries: [
          { collection: 'package-operations', record: { id: randomUUID(), createdAt: committedAt, ...committedOperation }, guard: {
            entityKey: approval.approvalId, expectedEntityVersion: 1, entityVersion: 2,
          } },
          { collection: 'publish-history', record: {
            id: operation.packageId, packageId: operation.packageId, packagePath: operation.finalRoot, platform: platform.id, contentId: content.contentId,
            revisionId: content.revisionId, contentHash: content.contentHash, articleDocHash: content.articleDocHash,
            deliveryId: delivery.deliveryId, renderManifestHash: delivery.renderManifestHash, approvalId: approval.approvalId,
            approvalBindingHash: approval.approvalBindingHash, approvalTransitionVersion: packageCommitTransitionVersion,
            brandId: content.brandId, profileVersion: content.profileVersion,
            packagedBy, packagedIdentity: identitySnapshot(principal), mode: 'frozen-copy-only', primaryFormat: 'html', backupFormat: 'markdown',
          } },
          { collection: 'audit-events', record: {
            event: 'publish.package.created', packageId: operation.packageId, contentId: content.contentId, revisionId: content.revisionId,
            contentHash: content.contentHash, deliveryId: delivery.deliveryId, renderManifestHash: delivery.renderManifestHash,
            approvalId: approval.approvalId, approvalTransitionVersion: packageCommitTransitionVersion,
            platform: platform.id, actor: packagedBy, actorAssurance: principal.assurance,
          } },
        ],
      })
      operation = { ...operation, ...committedOperation, approvalTransitionVersion: transition.transitionVersion } as PackageOperation
    } catch (error) {
      if (error instanceof StorageConflictError) {
        const reason = `Approval changed before package commit; ${PENDING_MARKER} remains and no package was recorded.`
        try {
          operation = await abortPreparedOperation(operation, reason, packagedBy)
          return packageAborted(operation)
        } catch (abortError) {
          return packageRecoveryRequired(operation, 'PACKAGE_ABORT_PENDING', `${reason} Failed to persist the aborted transition: ${abortError instanceof Error ? abortError.message : String(abortError)}`)
        }
      }
      return packageRecoveryRequired(operation, 'PACKAGE_COMMIT_PENDING', `${error instanceof Error ? error.message : String(error)} ${PENDING_MARKER} remains; retry after storage repair.`)
    }
    try {
      await finalizeCommittedPackage(operation.finalRoot, delivery, operation)
    } catch (error) {
      return packageRecoveryRequired(operation, 'PACKAGE_FINALIZATION_PENDING', `Database commit succeeded, but the fail-safe marker could not be finalized: ${error instanceof Error ? error.message : String(error)}. Retry the same request.`, false)
    }
    return packageResponse(operation, delivery, packageCommitTransitionVersion, documents.files, existingOperation ? 'resumed' : 'new')
  } finally {
    if (contentLeaseAcquired) await releaseEntityLease('content', content.contentId, leaseOwner)
    await releaseEntityLease('approvals', approval.approvalId, leaseOwner)
  }
}
