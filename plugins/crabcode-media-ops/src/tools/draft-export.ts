/**
 * Unapproved draft export (RC-14).
 *
 * A single local editor needs to look at the thing they are writing — in a
 * browser, at any stage, long before research, review, QA or approval exist.
 * Until now the only way to get an openable file was `delivery.render`, which
 * requires a fully reviewed revision; so the tool that answers "let me see it"
 * did not exist, and the pressure was to loosen the tool that does mean
 * "this is ready".
 *
 * This is a separate channel, not a relaxed mode of that one:
 *
 * - products land in `<data>/draft-exports/<exportId>/`, never in
 *   `<data>/delivery-candidates/`, and records land in the `draft-exports`
 *   collection, never in `delivery-manifests`. `getLatestVerifiedDelivery` and
 *   `verifyDeliveryBytes` resolve inside the candidate directory, so a draft is
 *   structurally invisible to preview/readiness/approval/package rather than
 *   being excluded by a flag;
 * - `releaseStatus` and `qaLevel` are literals: `unapproved` and `none`;
 * - the rendered HTML/Markdown carry a visible notice, and the render contract
 *   itself (`renderArticle` / `RENDER_CONTRACT`) is untouched — it is the hash
 *   contract of real delivery and a draft must not be able to move it;
 * - governance is reported as found. `missing` and `stale` are answers, and so
 *   is a `manual-import` profile: a personal, unapproved style preference is
 *   perfectly good for a draft and is simply named as what it is.
 */

import { createHash, randomUUID } from 'node:crypto'
import { copyFile, lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { z } from 'zod'
import { err, ok, type Envelope } from '../envelope.ts'
import {
  DraftExportManifestSchema,
  stableHash,
  type ContentManifestV2,
  type DraftExportGovernance,
  type DraftExportManifest,
} from '../domain.ts'
import { getPlatform, platformIds } from '../platforms/registry.ts'
import { assertSafeHtml, renderArticle, RENDER_CONTRACT } from '../rendering/renderer.ts'
import { appendRecordsAtomically, dataDir, ensureDir, storageWarnings } from '../storage.ts'
import { getContentRevision, getLatestContent } from './content.ts'
import { artifact as buildArtifact, getLatestVerifiedDelivery } from './delivery.ts'
import { getEditorialReview } from './editorial-review.ts'
import { getOriginalityScan, originalityScanPasses } from './originality.ts'
import { loadProfile } from './profiles.ts'
import { getResearchReview } from './research.ts'
import { inspectContent, type ReadinessIssue } from './readiness.ts'

/**
 * Visible draft markers.
 *
 * Inert by construction: no script, no style attribute, no external reference,
 * and the assembled HTML is re-checked with `assertSafeHtml` afterwards.
 */
export const DRAFT_EXPORT_NOTICE_HTML =
  '<p class="draft-export-notice">草稿导出（未批准）：本文件未经审批、未经交付 QA，不是交付候选，不能用于发布或对外分发。</p>'
export const DRAFT_EXPORT_NOTICE_MARKDOWN =
  '> 草稿导出（未批准）：本文件未经审批、未经交付 QA，不是交付候选，不能用于发布或对外分发。'

const DRAFT_EXPORTS_DIRECTORY = 'draft-exports'

const draftExportSchema = z.object({
  contentId: z.string().uuid(),
  revisionId: z.string().uuid().optional(),
  platform: z.enum(['wechat', 'xhs', 'toutiao']).optional(),
  exportedBy: z.string().min(1),
})

export const exportDraftName = 'mediaops.delivery.export_draft'
export const exportDraftDescription =
  'Export an openable HTML/Markdown draft of any content revision at any stage (intake through reviewed). This is NOT a delivery candidate: the export is written to a separate draft-exports directory and collection, is marked releaseStatus=unapproved / qaLevel=none, never enters approval and cannot advance any governed state. Use it in single-person local-editorial mode to actually read your draft; the formal chain stays delivery.render/verify -> readiness.inspect -> approval -> publish.package. The response lists real governance state (bound/stale/missing) and the blockers that still stand.'
export const exportDraftInputSchema = draftExportSchema.shape

function sha256(bytes: Uint8Array | string): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function safeAssetName(index: number, path: string): string {
  const normalized = basename(path).replace(/[^A-Za-z0-9._-]+/g, '-') || 'asset'
  return `${String(index + 1).padStart(3, '0')}-${normalized}`
}

type FrozenAsset = { asset: ContentManifestV2['assets'][number]; bytes: Uint8Array; relativePath: string }

/**
 * Read and verify the asset bytes a draft renders.
 *
 * Byte identity is enforced exactly as in `delivery.render` — a draft of
 * different bytes than the ones registered is not a draft of this revision.
 * Pending rights are allowed and reported: a draft is precisely where an image
 * whose licence is still being sorted out belongs.
 */
async function draftAssetBytes(content: ContentManifestV2): Promise<{ frozen: FrozenAsset[]; rightsPending: string[] }> {
  const frozen: FrozenAsset[] = []
  const rightsPending: string[] = []
  for (const [index, asset] of content.assets.entries()) {
    if (asset.rightsStatus === 'pending') rightsPending.push(asset.assetId)
    let stat
    try {
      stat = await lstat(asset.path)
    } catch (error) {
      throw new Error(`ASSET_INVALID:${asset.assetId}: ${error instanceof Error ? error.message : String(error)}`)
    }
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`ASSET_INVALID:${asset.assetId}`)
    const bytes = await readFile(asset.path)
    if (bytes.byteLength !== asset.byteSize || sha256(bytes) !== asset.sha256) throw new Error(`ASSET_HASH_MISMATCH:${asset.assetId}`)
    frozen.push({ asset, bytes, relativePath: `assets/${safeAssetName(index, asset.path)}` })
  }
  return { frozen, rightsPending }
}

function withDraftNoticeHtml(html: string): string {
  const marker = '<body>'
  const at = html.indexOf(marker)
  if (at < 0) throw new Error('rendered draft HTML has no <body> element to mark as unapproved')
  const marked = `${html.slice(0, at + marker.length)}\n${DRAFT_EXPORT_NOTICE_HTML}${html.slice(at + marker.length)}`
  assertSafeHtml(marked)
  return marked
}

function withDraftNoticeMarkdown(markdown: string): string {
  return `${DRAFT_EXPORT_NOTICE_MARKDOWN}\n\n${markdown}`
}

/**
 * The channel fragment carries the same marker, prepended.
 *
 * It has no `<body>` to insert after, and it is the artifact most likely to be
 * pasted straight into a platform editor — an unmarked copy of it is exactly
 * the draft that gets published by accident.
 */
function withDraftNoticeFragment(fragment: string): string {
  const marked = `${DRAFT_EXPORT_NOTICE_HTML}\n${fragment}`
  assertSafeHtml(marked)
  return marked
}

async function researchState(content: ContentManifestV2): Promise<DraftExportGovernance['research']> {
  if (!content.researchId) return 'missing'
  const research = await getResearchReview(content.researchId)
  return research && research.status === 'completed' && research.contentId === content.contentId &&
    Boolean(content.researchBundleHash) && research.researchBundleHash === content.researchBundleHash
    ? 'bound'
    : 'stale'
}

async function originalityState(content: ContentManifestV2): Promise<DraftExportGovernance['originalityScan']> {
  if (!content.originalityScanId) return 'missing'
  const scan = await getOriginalityScan(content.originalityScanId)
  return scan && scan.contentId === content.contentId && scan.subjectHash === content.originalitySubjectHash && originalityScanPasses(scan)
    ? 'bound'
    : 'stale'
}

async function editorialState(content: ContentManifestV2): Promise<DraftExportGovernance['editorialReview']> {
  if (!content.editorialReviewId) return 'missing'
  const editorial = await getEditorialReview(content.editorialReviewId)
  return editorial && editorial.contentId === content.contentId && editorial.subjectHash === content.originalitySubjectHash &&
    editorial.originalityScanId === content.originalityScanId &&
    editorial.factReview.researchBundleHash === content.researchBundleHash
    ? 'bound'
    : 'stale'
}

async function describeGovernance(content: ContentManifestV2): Promise<DraftExportGovernance> {
  const profile = await loadProfile(content.brandId, content.profileVersion)
  const verified = await getLatestVerifiedDelivery(content.contentId, content.revisionId)
  return {
    research: await researchState(content),
    originalityScan: await originalityState(content),
    editorialReview: await editorialState(content),
    profile: profile ? profile.source : 'missing',
    verifiedDelivery: verified ? 'present' : 'none',
  }
}

export async function exportDraftHandler(args: z.input<typeof draftExportSchema>): Promise<Envelope> {
  const parsed = draftExportSchema.safeParse(args)
  if (!parsed.success) return err('INVALID_DRAFT_EXPORT_REQUEST', parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '))
  const input = parsed.data

  let content
  try {
    content = input.revisionId ? await getContentRevision(input.revisionId) : await getLatestContent(input.contentId)
  } catch (error) {
    return err('INVALID_STORED_CONTENT', error instanceof Error ? error.message : String(error))
  }
  if (!content) return err('NOT_FOUND', input.revisionId ? `No content revision ${input.revisionId}.` : `No content ${input.contentId}.`)
  if (content.contentId !== input.contentId) return err('PACKAGE_INPUT_MISMATCH', 'contentId and revisionId do not match.')
  if (!('schemaVersion' in content) || content.schemaVersion !== 2) return err('SCHEMA_UPGRADE_REQUIRED', 'Draft export requires schema-v2 content.')

  let frozen: FrozenAsset[]
  let assetRightsPending: string[]
  try {
    const resolved = await draftAssetBytes(content)
    frozen = resolved.frozen
    assetRightsPending = resolved.rightsPending
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return err(message.split(':')[0] || 'ASSET_INVALID', message)
  }

  const assetMap = new Map(frozen.map(({ asset, relativePath }) => [asset.assetId, relativePath]))
  let html: string
  let markdown: string
  let wechatHtml: string
  try {
    const rendered = renderArticle(content.articleDoc, assetMap, {
      contentId: content.contentId,
      revisionId: content.revisionId,
      articleDocHash: content.articleDocHash,
    })
    html = withDraftNoticeHtml(rendered.html)
    markdown = withDraftNoticeMarkdown(rendered.markdown)
    wechatHtml = withDraftNoticeFragment(rendered.wechatHtml)
  } catch (error) {
    return err('DRAFT_EXPORT_RENDER_FAILED', error instanceof Error ? error.message : String(error))
  }

  const platformId = input.platform ?? content.platform
  let blockers: ReadinessIssue[]
  if (!platformId) {
    blockers = [{
      code: 'PLATFORM_UNSPECIFIED',
      severity: 'error',
      message: 'No target platform is recorded or supplied, so platform limits and rule freshness were not evaluated for this draft.',
    }]
  } else {
    const platform = getPlatform(platformId)
    if (!platform) return err('UNKNOWN_PLATFORM', `Unknown platform '${platformId}'. Known: ${platformIds().join(', ')}`)
    blockers = await inspectContent(content, platform)
  }
  const governance = await describeGovernance(content)

  const exportId = randomUUID()
  const exportsRoot = join(dataDir(), DRAFT_EXPORTS_DIRECTORY)
  const exportRoot = join(exportsRoot, exportId)
  const temporaryRoot = join(exportsRoot, `.tmp-${exportId}-${randomUUID()}`)
  await ensureDir(exportsRoot)

  const primaryArtifact = buildArtifact({ role: 'primary', format: 'html', mediaType: 'text/html; charset=utf-8', relativePath: 'article.html', bytes: html, contentHash: content.contentHash, renderProfile: 'draft-web@1' })
  const backupArtifact = buildArtifact({ role: 'backup', format: 'markdown', mediaType: 'text/markdown; charset=utf-8', relativePath: 'article.md', bytes: markdown, contentHash: content.contentHash, renderProfile: 'draft-markdown@1' })
  const channelArtifact = buildArtifact({ role: 'channel_variant', format: 'html', mediaType: 'text/html; charset=utf-8', relativePath: 'wechat-richtext.html', bytes: wechatHtml, contentHash: content.contentHash, renderProfile: 'draft-wechat-richtext@1' })
  const manifestAssets = frozen.map(({ asset, relativePath }) => ({ assetId: asset.assetId, relativePath, sha256: asset.sha256, byteSize: asset.byteSize, mediaType: asset.mediaType }))

  const withoutHash: Omit<DraftExportManifest, 'exportManifestHash'> = {
    schemaVersion: 'mediaops-draft-export@1',
    exportId,
    contentId: content.contentId,
    revisionId: content.revisionId,
    revision: content.revision,
    stage: content.stage,
    contentHash: content.contentHash,
    articleDocHash: content.articleDocHash,
    releaseStatus: 'unapproved',
    qaLevel: 'none',
    governance,
    blockers,
    assetRightsPending,
    primaryArtifact,
    backupArtifact,
    channelArtifacts: [channelArtifact],
    assets: manifestAssets,
    rendererVersion: RENDER_CONTRACT.rendererVersion,
    templateId: RENDER_CONTRACT.templateId,
    exportedAt: new Date().toISOString(),
    exportedBy: input.exportedBy,
    exportRoot,
  }
  const exportManifestHash = stableHash(withoutHash)
  const manifest = DraftExportManifestSchema.parse({ ...withoutHash, exportManifestHash })

  try {
    await mkdir(join(temporaryRoot, 'assets'), { recursive: true })
    for (const item of frozen) await copyFile(item.asset.path, join(temporaryRoot, item.relativePath))
    await writeFile(join(temporaryRoot, primaryArtifact.relativePath), html, 'utf8')
    await writeFile(join(temporaryRoot, backupArtifact.relativePath), markdown, 'utf8')
    await writeFile(join(temporaryRoot, channelArtifact.relativePath), wechatHtml, 'utf8')
    await writeFile(join(temporaryRoot, 'draft-export-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8')
    await rename(temporaryRoot, exportRoot)
  } catch (error) {
    await rm(temporaryRoot, { recursive: true, force: true })
    return err('DELIVERY_WRITE_FAILED', error instanceof Error ? error.message : String(error))
  }

  await appendRecordsAtomically([
    { collection: 'draft-exports', record: { id: exportId, ...manifest } },
    { collection: 'audit-events', record: {
      event: 'delivery.draft_exported',
      exportId,
      contentId: content.contentId,
      revisionId: content.revisionId,
      stage: content.stage,
      releaseStatus: 'unapproved',
      actor: input.exportedBy,
    } },
  ])

  return ok({
    exportId,
    releaseStatus: 'unapproved',
    qaLevel: 'none',
    stage: content.stage,
    primaryPath: join(exportRoot, primaryArtifact.relativePath),
    backupPath: join(exportRoot, backupArtifact.relativePath),
    channelPath: join(exportRoot, channelArtifact.relativePath),
    exportRoot,
    governance,
    blockers,
    assetRightsPending,
    exportManifestHash,
  }, storageWarnings())
}
