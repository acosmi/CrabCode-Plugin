import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { copyFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { z } from 'zod'
import { err, ok, type Envelope } from '../envelope.ts'
import { renderDocument, toPlainText } from '../markdown.ts'
import { getPlatform } from '../platforms/registry.ts'
import { appendRecord, dataDir, ensureDir, storageWarnings } from '../storage.ts'
import { getApproval } from './approval.ts'
import { getLatestContent } from './content.ts'
import { inspectContent } from './readiness.ts'

export const name = 'mediaops.publish.package'
export const description =
  'Build a movable manual publish package only from the latest reviewed content revision and a matching approved hash.'
export const inputSchema = {
  contentId: z.string().uuid(),
  approvalId: z.string().uuid(),
  packagedBy: z.string().min(1),
}

function safeAssetName(index: number, path: string): string {
  return `${String(index + 1).padStart(2, '0')}-${basename(path).replace(/[^a-zA-Z0-9._-]+/g, '-')}`
}

export async function handler(args: { contentId: string; approvalId: string; packagedBy: string }): Promise<Envelope> {
  const content = await getLatestContent(args.contentId)
  if (!content) return err('NOT_FOUND', `No content ${args.contentId}.`)
  const approval = await getApproval(args.approvalId)
  if (!approval) return err('APPROVAL_REQUIRED', `No approval ${args.approvalId}.`)
  if (approval.contentId !== content.contentId || approval.platform !== content.platform) {
    return err('PACKAGE_INPUT_MISMATCH', 'Approval does not target this content/platform pair.')
  }
  if (approval.state === 'pending') return err('APPROVAL_PENDING', 'Approval is still pending.')
  if (approval.state === 'rejected') return err('APPROVAL_REJECTED', 'Approval was rejected.')
  if (approval.state !== 'approved') return err('APPROVAL_REQUIRED', `Approval state ${approval.state} cannot package content.`)
  if (approval.revisionId !== content.revisionId || approval.contentHash !== content.contentHash) {
    return err('APPROVAL_STALE', 'The content changed after approval; request and obtain a new approval.')
  }
  const platform = getPlatform(approval.platform)!
  const issues = await inspectContent(content, platform)
  const blockers = issues.filter((issue) => issue.severity === 'error')
  if (blockers.length) return err(blockers[0].code, `Packaging blocked: ${blockers.map((item) => item.message).join(' ')}`)
  const missingAssets = content.assets.filter((asset) => !existsSync(asset.path))
  if (missingAssets.length) return err('ASSET_MISSING', `Missing assets: ${missingAssets.map((asset) => asset.path).join(', ')}.`)

  const packageId = randomUUID()
  const pkgDir = join(dataDir(), 'publish-packages', `${platform.id}-${new Date().toISOString().slice(0, 10)}-${packageId}`)
  const assetsDir = join(pkgDir, 'assets')
  await ensureDir(assetsDir)
  const copiedAssets: { sourcePath: string; packagePath: string; role: string; rightsStatus: string }[] = []
  for (const [index, asset] of content.assets.entries()) {
    const fileName = safeAssetName(index, asset.path)
    await copyFile(asset.path, join(assetsDir, fileName))
    copiedAssets.push({ sourcePath: asset.path, packagePath: `assets/${fileName}`, role: asset.role, rightsStatus: asset.rightsStatus })
  }

  const html = renderDocument(content.title, content.bodyMarkdown)
  const summary = content.summary ?? toPlainText(content.bodyMarkdown).slice(0, 280)
  const files = ['manifest.json', 'article.md', 'article.html', 'title.txt', 'summary.txt', 'copy-checklist.md', ...copiedAssets.map((asset) => asset.packagePath)]
  const manifest = {
    packageId,
    pluginVersion: '0.3.0',
    platform: platform.id,
    platformDisplayName: platform.displayName,
    platformRuleVersion: platform.ruleVersion,
    contentId: content.contentId,
    revisionId: content.revisionId,
    contentRevision: content.revision,
    contentHash: content.contentHash,
    brandId: content.brandId,
    profileVersion: content.profileVersion,
    review: content.review,
    originalityReview: content.originalityReview,
    legalReview: content.legalReview,
    aiDisclosure: content.aiDisclosure,
    citations: content.citations,
    approval: {
      approvalId: approval.approvalId,
      state: approval.state,
      requestedBy: approval.requestedBy,
      decidedBy: approval.decidedBy,
      decidedAt: approval.decidedAt,
      contentHash: approval.contentHash,
    },
    title: content.title,
    summary,
    assets: copiedAssets,
    publishMode: 'package-only (manual copy; real publish API requires Gate B credentials)',
    packagedBy: args.packagedBy,
    createdAt: new Date().toISOString(),
    files,
  }
  const checklist = [
    `# Copy checklist — ${platform.displayName}`,
    '',
    `- [ ] Recheck current platform console rules (${platform.ruleVersion})`,
    '- [ ] Confirm title, body, cover and packaged assets',
    '- [ ] Confirm AI disclosure using the recorded method',
    '- [ ] Confirm approval hash matches manifest contentHash',
    '- [ ] Perform final manual publication; Gate B APIs are not enabled',
    '',
  ].join('\n')
  await writeFile(join(pkgDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')
  await writeFile(join(pkgDir, 'article.md'), content.bodyMarkdown, 'utf8')
  await writeFile(join(pkgDir, 'article.html'), html, 'utf8')
  await writeFile(join(pkgDir, 'title.txt'), content.title, 'utf8')
  await writeFile(join(pkgDir, 'summary.txt'), summary, 'utf8')
  await writeFile(join(pkgDir, 'copy-checklist.md'), checklist, 'utf8')
  await appendRecord('publish-history', { id: packageId, packageId, platform: platform.id, packagePath: pkgDir, contentId: content.contentId, revisionId: content.revisionId, contentHash: content.contentHash, brandId: content.brandId, profileVersion: content.profileVersion, approvalId: approval.approvalId, packagedBy: args.packagedBy, mode: 'package-only' })
  await appendRecord('audit-events', { event: 'publish.package.created', packageId, contentId: content.contentId, revisionId: content.revisionId, contentHash: content.contentHash, approvalId: approval.approvalId, platform: platform.id, actor: args.packagedBy })
  return ok({ packageId, packagePath: pkgDir, contentId: content.contentId, revisionId: content.revisionId, contentHash: content.contentHash, approvalId: approval.approvalId, platform: platform.id, files }, storageWarnings())
}
