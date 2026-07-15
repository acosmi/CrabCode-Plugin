import { createHash, randomUUID } from 'node:crypto'
import { copyFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import { err, ok, type Envelope } from '../envelope.ts'
import { DeliveryManifestSchema, VERSION, stableHash } from '../domain.ts'
import { getPlatform } from '../platforms/registry.ts'
import { appendRecord, dataDir, ensureDir, storageWarnings } from '../storage.ts'
import { getApproval } from './approval.ts'
import { getLatestContent } from './content.ts'
import { getDeliveryManifest, verifyDeliveryBytes } from './delivery.ts'
import { inspectContent } from './readiness.ts'

export const name = 'mediaops.publish.package'
export const description =
  'Atomically copy an approved, verified and frozen delivery candidate into a manual publish package. It never rereads original assets or rerenders content.'
export const inputSchema = {
  contentId: z.string().uuid(),
  approvalId: z.string().uuid(),
  packagedBy: z.string().min(1),
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

export async function handler(args: { contentId: string; approvalId: string; packagedBy: string }): Promise<Envelope> {
  const content = await getLatestContent(args.contentId)
  if (!content) return err('NOT_FOUND', `No content ${args.contentId}.`)
  if (!('schemaVersion' in content) || content.schemaVersion !== 2) return err('SCHEMA_UPGRADE_REQUIRED', 'Legacy content cannot be packaged by the integrity workflow.')
  const approval = await getApproval(args.approvalId)
  if (!approval) return err('APPROVAL_REQUIRED', `No v2 approval ${args.approvalId}.`)
  if (approval.contentId !== content.contentId || approval.platform !== content.platform) return err('PACKAGE_INPUT_MISMATCH', 'Approval does not target this content/platform pair.')
  if (approval.state === 'pending') return err('APPROVAL_PENDING', 'Approval is still pending.')
  if (approval.state === 'rejected') return err('APPROVAL_REJECTED', 'Approval was rejected.')
  if (approval.state !== 'approved') return err('APPROVAL_REQUIRED', `Approval state ${approval.state} cannot package content.`)
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

  const packageId = randomUUID()
  const packagesRoot = join(dataDir(), 'publish-packages')
  const finalRoot = join(packagesRoot, `${platform.id}-${new Date().toISOString().slice(0, 10)}-${packageId}`)
  const temporaryRoot = join(packagesRoot, `.tmp-${packageId}-${randomUUID()}`)
  await ensureDir(packagesRoot)
  const artifactEntries = [delivery.primaryArtifact, delivery.backupArtifact, ...delivery.channelArtifacts]
  const files = [
    ...artifactEntries.map((item) => item.relativePath),
    ...delivery.assets.map((item) => item.relativePath),
    'delivery-manifest.json',
    'approval.json',
    'package-manifest.json',
    'copy-checklist.md',
  ]
  const packageManifest = {
    schemaVersion: 2,
    packageId,
    pluginVersion: VERSION,
    platform: platform.id,
    platformDisplayName: platform.displayName,
    platformRuleVersion: platform.ruleVersion,
    contentId: content.contentId,
    revisionId: content.revisionId,
    contentRevision: content.revision,
    contentHash: content.contentHash,
    articleDocHash: content.articleDocHash,
    deliveryId: delivery.deliveryId,
    renderManifestHash: delivery.renderManifestHash,
    approvalId: approval.approvalId,
    approvalBindingHash: approval.approvalBindingHash,
    primaryArtifact: delivery.primaryArtifact,
    backupArtifact: delivery.backupArtifact,
    channelArtifacts: delivery.channelArtifacts,
    assets: delivery.assets,
    defaultUserPresentation: 'article.html (HTML primary)',
    backup: 'article.md (Markdown backup)',
    publishMode: 'package-only; manual platform submission; no rerender during packaging',
    packagedBy: args.packagedBy,
    createdAt: new Date().toISOString(),
    files,
  }
  const checklist = [
    `# Copy checklist — ${platform.displayName}`,
    '',
    '- [ ] Open article.html and confirm it is the exact approved primary artifact',
    '- [ ] Use article.md only as a backup, not as the default user presentation',
    '- [ ] Recheck current platform console rules and native AI-label setting',
    '- [ ] Confirm cover and inline images match the frozen assets',
    '- [ ] Confirm approvalBindingHash and renderManifestHash match package-manifest.json',
    '- [ ] Perform final manual publication; Gate B publish APIs remain disabled',
    '',
  ].join('\n')
  try {
    await mkdir(join(temporaryRoot, 'assets'), { recursive: true })
    for (const item of artifactEntries) await copyFile(join(sourceRoot, item.relativePath), join(temporaryRoot, item.relativePath))
    for (const asset of delivery.assets) await copyFile(join(sourceRoot, asset.relativePath), join(temporaryRoot, asset.relativePath))
    await copyFile(join(sourceRoot, 'delivery-manifest.json'), join(temporaryRoot, 'delivery-manifest.json'))
    await writeFile(join(temporaryRoot, 'approval.json'), JSON.stringify(approval, null, 2) + '\n', 'utf8')
    await writeFile(join(temporaryRoot, 'package-manifest.json'), JSON.stringify(packageManifest, null, 2) + '\n', 'utf8')
    await writeFile(join(temporaryRoot, 'copy-checklist.md'), checklist, 'utf8')
    for (const item of artifactEntries) {
      const bytes = await readFile(join(temporaryRoot, item.relativePath))
      if (bytes.byteLength !== item.byteSize || sha256(bytes) !== item.artifactHash) throw new Error(`copied artifact ${item.artifactId} failed hash verification`)
    }
    for (const asset of delivery.assets) {
      const bytes = await readFile(join(temporaryRoot, asset.relativePath))
      if (bytes.byteLength !== asset.byteSize || sha256(bytes) !== asset.sha256) throw new Error(`copied asset ${asset.assetId} failed hash verification`)
    }
    const copiedDeliveryManifest = DeliveryManifestSchema.parse(JSON.parse(await readFile(join(temporaryRoot, 'delivery-manifest.json'), 'utf8')))
    if (stableHash(copiedDeliveryManifest) !== stableHash(delivery)) throw new Error('copied delivery manifest failed canonical hash verification')
    await rename(temporaryRoot, finalRoot)
  } catch (error) {
    await rm(temporaryRoot, { recursive: true, force: true })
    return err('PACKAGE_WRITE_FAILED', error instanceof Error ? error.message : String(error))
  }
  await appendRecord('publish-history', {
    id: packageId, packageId, packagePath: finalRoot, platform: platform.id, contentId: content.contentId,
    revisionId: content.revisionId, contentHash: content.contentHash, articleDocHash: content.articleDocHash,
    deliveryId: delivery.deliveryId, renderManifestHash: delivery.renderManifestHash, approvalId: approval.approvalId,
    approvalBindingHash: approval.approvalBindingHash, brandId: content.brandId, profileVersion: content.profileVersion,
    packagedBy: args.packagedBy, mode: 'frozen-copy-only', primaryFormat: 'html', backupFormat: 'markdown',
  })
  await appendRecord('audit-events', {
    event: 'publish.package.created', packageId, contentId: content.contentId, revisionId: content.revisionId,
    contentHash: content.contentHash, deliveryId: delivery.deliveryId, renderManifestHash: delivery.renderManifestHash,
    approvalId: approval.approvalId, platform: platform.id, actor: args.packagedBy,
  })
  return ok({
    packageId,
    packagePath: finalRoot,
    contentId: content.contentId,
    revisionId: content.revisionId,
    contentHash: content.contentHash,
    deliveryId: delivery.deliveryId,
    renderManifestHash: delivery.renderManifestHash,
    approvalId: approval.approvalId,
    platform: platform.id,
    primary: { path: join(finalRoot, delivery.primaryArtifact.relativePath), format: 'html', hash: delivery.primaryArtifact.artifactHash },
    backup: { path: join(finalRoot, delivery.backupArtifact.relativePath), format: 'markdown', hash: delivery.backupArtifact.artifactHash },
    files,
  }, storageWarnings())
}
