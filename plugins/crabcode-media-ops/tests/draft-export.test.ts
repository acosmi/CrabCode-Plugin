import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DraftExportManifestSchema, stableHash } from '../src/domain.ts'
import { IdentityError, authorizeToolCall } from '../src/identity.ts'
import { listRecords } from '../src/storage.ts'
import { getHandler as getContent, saveHandler as saveContent } from '../src/tools/content.ts'
import { getLatestVerifiedDelivery } from '../src/tools/delivery.ts'
import {
  DRAFT_EXPORT_NOTICE_HTML,
  DRAFT_EXPORT_NOTICE_MARKDOWN,
  exportDraftHandler,
} from '../src/tools/draft-export.ts'
import { handler as previewCreate } from '../src/tools/preview.ts'
import { handler as readinessInspect } from '../src/tools/readiness.ts'
import { registerHandler as registerReference } from '../src/tools/references.ts'
import { DISCLOSURE, createProfile, createReviewedContent } from './helpers.ts'

const PNG_BYTES = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489', 'hex')

async function writeAsset(dir: string, name: string): Promise<string> {
  const path = join(dir, name)
  await writeFile(path, PNG_BYTES)
  return path
}

describe('unapproved draft export', () => {
  let dir: string
  let brandId: string
  let profileVersion: string
  let previousDataDir: string | undefined

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mediaops-draft-export-'))
    previousDataDir = process.env.MEDIAOPS_DATA_DIR
    process.env.MEDIAOPS_DATA_DIR = dir
    brandId = 'draft-brand'
    profileVersion = await createProfile(brandId)
  })

  afterEach(async () => {
    if (previousDataDir === undefined) delete process.env.MEDIAOPS_DATA_DIR
    else process.env.MEDIAOPS_DATA_DIR = previousDataDir
    await rm(dir, { recursive: true, force: true })
  })

  /**
   * The whole point of RC-14: a single local editor gets an openable file from
   * an ordinary, un-reviewed, un-researched draft — and the file says out loud
   * what it is.
   */
  test('a solo editor exports an openable draft from an un-reviewed revision', async () => {
    const reference = await registerReference({
      role: 'user_owned_draft',
      rightsStatus: 'owned',
      allowedUses: ['rewrite'],
      title: '我自己的旧稿',
      rawText: '这是用户自己写的素材，可作为改写底稿。',
      registeredBy: '本机编辑者',
    })
    expect(reference.status).toBe('ok')
    const referenceId = (reference.data as any).reference.referenceId as string

    const intake = await saveContent({
      kind: 'draft', brandId, profileVersion, stage: 'intake', platform: 'wechat',
      researchSubject: '本机草稿导出', referenceIds: [referenceId],
      title: '一个尚未审校的草稿', bodyMarkdown: '', savedBy: '本机编辑者',
    })
    expect(intake.status).toBe('ok')
    const contentId = (intake.data as any).contentId as string

    const assetPath = await writeAsset(dir, 'cover.png')
    const written = await saveContent({
      contentId, expectedRevision: 1, kind: 'draft', brandId, profileVersion, stage: 'intake', platform: 'wechat',
      researchSubject: '本机草稿导出', referenceIds: [referenceId],
      title: '一个尚未审校的草稿',
      bodyMarkdown: `这是第一版正文，还没有做研究和审校。\n\n${DISCLOSURE}`,
      assets: [{ path: assetPath, role: 'cover', rightsStatus: 'owned', alt: '文章封面图' }],
      savedBy: '本机编辑者',
    })
    expect(written.status).toBe('ok')

    const readBack = await getContent({ contentId, revisionId: (written.data as any).revisionId })
    expect(readBack.status).toBe('ok')
    expect((readBack.data as any).revisionId).toBe((written.data as any).revisionId)
    expect((readBack.data as any).contentHash).toBe((written.data as any).contentHash)

    const edited = await saveContent({
      contentId, expectedRevision: 2, kind: 'draft', brandId, profileVersion, stage: 'intake', platform: 'wechat',
      researchSubject: '本机草稿导出', referenceIds: [referenceId],
      title: '一个尚未审校的草稿',
      bodyMarkdown: `作者改过一轮的正文，仍然没有做研究和审校。\n\n## 一个小节\n\n补充说明。\n\n${DISCLOSURE}`,
      assets: [{ path: assetPath, role: 'cover', rightsStatus: 'owned', alt: '文章封面图' }],
      savedBy: '本机编辑者',
    })
    expect(edited.status).toBe('ok')
    expect((edited.data as any).revision).toBe(3)

    const exported = await exportDraftHandler({ contentId, exportedBy: '本机编辑者' })
    expect(exported.status).toBe('ok')
    const data = exported.data as any

    expect(data.releaseStatus).toBe('unapproved')
    expect(data.qaLevel).toBe('none')
    expect(data.stage).toBe('intake')
    expect(data.governance.profile).toBe('manual-import')
    expect(data.governance.originalityScan).toBe('missing')
    expect(data.governance.editorialReview).toBe('missing')
    expect(data.governance.research).toBe('missing')
    expect(data.governance.verifiedDelivery).toBe('none')
    expect(data.assetRightsPending).toEqual([])

    const html = await readFile(data.primaryPath, 'utf8')
    const markdown = await readFile(data.backupPath, 'utf8')
    const channel = await readFile(data.channelPath, 'utf8')
    expect(html).toContain(DRAFT_EXPORT_NOTICE_HTML)
    expect((html.match(/<h1(?:\s|>)/g) ?? []).length).toBe(1)
    expect(html).toContain('作者改过一轮的正文')
    expect(markdown.split('\n')[0]).toBe(DRAFT_EXPORT_NOTICE_MARKDOWN)
    // The channel fragment has no <body> to insert after and is the artifact
    // most likely to be pasted straight into a platform editor, so it carries
    // the same marker, prepended.
    expect(channel.startsWith(DRAFT_EXPORT_NOTICE_HTML)).toBe(true)
    expect(channel).toContain('data-render-profile="wechat-richtext@1"')

    const blockerCodes = data.blockers.map((issue: any) => issue.code)
    expect(blockerCodes).toContain('EDITORIAL_REVIEW_REQUIRED')
    expect(blockerCodes).toContain('DELIVERY_VERIFICATION_REQUIRED')

    const manifestOnDisk = DraftExportManifestSchema.parse(JSON.parse(await readFile(join(data.exportRoot, 'draft-export-manifest.json'), 'utf8')))
    expect(manifestOnDisk.exportManifestHash).toBe(data.exportManifestHash)
    const { exportManifestHash, ...withoutHash } = manifestOnDisk
    expect(stableHash(withoutHash)).toBe(exportManifestHash)

    const stored = await listRecords('draft-exports', { exportId: data.exportId })
    expect(stored).toHaveLength(1)
    expect((stored[0] as any).exportManifestHash).toBe(data.exportManifestHash)
  })

  /**
   * The draft channel must be invisible to the formal chain by construction,
   * not by a flag. Products live outside `delivery-candidates` and records
   * outside `delivery-manifests`, which is exactly what
   * `getLatestVerifiedDelivery` / `verifyDeliveryBytes` resolve against.
   */
  test('exporting a draft advances nothing in the approval chain', async () => {
    const intake = await saveContent({
      kind: 'draft', brandId, profileVersion, stage: 'intake', platform: 'wechat',
      researchSubject: '不进正式链', title: '不进正式链的草稿', bodyMarkdown: '正文。', savedBy: '本机编辑者',
    })
    const contentId = (intake.data as any).contentId as string
    const exported = await exportDraftHandler({ contentId, exportedBy: '本机编辑者' })
    expect(exported.status).toBe('ok')

    expect(await getLatestVerifiedDelivery(contentId)).toBeNull()

    const preview = await previewCreate({ contentId })
    expect(preview.error?.code).toBe('DELIVERY_VERIFICATION_REQUIRED')

    const readiness = await readinessInspect({ contentId })
    const readinessData = readiness.data as any
    expect(readinessData.ready).toBe(false)
    expect(readinessData.issues.map((issue: any) => issue.code)).toContain('DELIVERY_VERIFICATION_REQUIRED')
    // Nothing about the draft may appear as a satisfied gate.
    expect(JSON.stringify(readinessData.issues)).not.toContain('draft')
    expect(JSON.stringify(readinessData.issues)).not.toContain('DRAFT')
    expect(readinessData.deliveryId).toBeUndefined()

    // Positive control: the formal chain still reaches preview when it is actually walked.
    const reviewed = await createReviewedContent({ dir, brandId, profileVersion, deliveryMode: 'verified' })
    const realPreview = await previewCreate({ contentId: reviewed.contentId })
    expect(realPreview.status).toBe('ok')
  })

  test('pending asset rights are exported and named, and changed bytes are refused', async () => {
    const pendingAsset = await writeAsset(dir, 'pending.png')
    const intake = await saveContent({
      kind: 'draft', brandId, profileVersion, stage: 'intake', platform: 'wechat',
      researchSubject: '权利待定', title: '权利待定的草稿', bodyMarkdown: '正文。',
      assets: [{ path: pendingAsset, role: 'cover', rightsStatus: 'pending', alt: '待定权利封面' }],
      savedBy: '本机编辑者',
    })
    expect(intake.status).toBe('ok')
    const pendingContentId = (intake.data as any).contentId as string
    const latest = await getContent({ contentId: pendingContentId })
    const pendingAssetId = (latest.data as any).assets[0].assetId as string

    const exported = await exportDraftHandler({ contentId: pendingContentId, exportedBy: '本机编辑者' })
    expect(exported.status).toBe('ok')
    expect((exported.data as any).assetRightsPending).toEqual([pendingAssetId])

    // Positive control: resolved rights produce an empty list, so the field is
    // reporting the asset's real status rather than always being populated.
    const ownedAsset = await writeAsset(dir, 'owned.png')
    const ownedIntake = await saveContent({
      kind: 'draft', brandId, profileVersion, stage: 'intake', platform: 'wechat',
      researchSubject: '权利已定', title: '权利已定的草稿', bodyMarkdown: '正文。',
      assets: [{ path: ownedAsset, role: 'cover', rightsStatus: 'owned', alt: '已定权利封面' }],
      savedBy: '本机编辑者',
    })
    const ownedExport = await exportDraftHandler({ contentId: (ownedIntake.data as any).contentId, exportedBy: '本机编辑者' })
    expect(ownedExport.status).toBe('ok')
    expect((ownedExport.data as any).assetRightsPending).toEqual([])

    // A draft of different bytes than the registered ones is not a draft of
    // this revision, whatever its rights status says.
    await writeFile(pendingAsset, Buffer.concat([PNG_BYTES, Buffer.from('tampered', 'utf8')]))
    const tampered = await exportDraftHandler({ contentId: pendingContentId, exportedBy: '本机编辑者' })
    expect(tampered.error?.code).toBe('ASSET_HASH_MISMATCH')
  })

  test('a fully reviewed revision exports as a draft too, with its real bound governance', async () => {
    const reviewed = await createReviewedContent({ dir, brandId, profileVersion, deliveryMode: 'none' })
    const exported = await exportDraftHandler({ contentId: reviewed.contentId, exportedBy: '本机编辑者' })
    expect(exported.status).toBe('ok')
    const data = exported.data as any
    expect(data.stage).toBe('reviewed')
    expect(data.governance.originalityScan).toBe('bound')
    expect(data.governance.editorialReview).toBe('bound')
    expect(data.governance.research).toBe('bound')
    // Reviewed is still not approved, and the export still says so.
    expect(data.releaseStatus).toBe('unapproved')
    expect(data.qaLevel).toBe('none')
    expect(data.governance.verifiedDelivery).toBe('none')
  })

  test('a specific revisionId must belong to the named contentId', async () => {
    const first = await saveContent({
      kind: 'draft', brandId, profileVersion, stage: 'intake', platform: 'wechat',
      researchSubject: '甲稿', title: '甲稿', bodyMarkdown: '正文甲。', savedBy: '本机编辑者',
    })
    const second = await saveContent({
      kind: 'draft', brandId, profileVersion, stage: 'intake', platform: 'wechat',
      researchSubject: '乙稿', title: '乙稿', bodyMarkdown: '正文乙。', savedBy: '本机编辑者',
    })
    // Name the preconditions. Without these, a storage hiccup (this machine does
    // produce EPERM/EBUSY on SQLite and on rename) surfaces further down as
    // "the mismatch rule is broken", which is a different bug than the one that
    // happened. The data dir is a process-global that every suite writes, so it
    // is checked here too rather than assumed.
    expect(first.status, JSON.stringify(first)).toBe('ok')
    expect(second.status, JSON.stringify(second)).toBe('ok')
    expect(process.env.MEDIAOPS_DATA_DIR).toBe(dir)
    const crossed = await exportDraftHandler({
      contentId: (first.data as any).contentId,
      revisionId: (second.data as any).revisionId,
      exportedBy: '本机编辑者',
    })
    expect(crossed.error?.code).toBe('PACKAGE_INPUT_MISMATCH')

    // Positive control: the matching pair exports the exact revision asked for.
    const matched = await exportDraftHandler({
      contentId: (first.data as any).contentId,
      revisionId: (first.data as any).revisionId,
      exportedBy: '本机编辑者',
    })
    expect(matched.status).toBe('ok')
    expect(await readFile((matched.data as any).primaryPath, 'utf8')).toContain('正文甲')
  })

  test('the export lands in draft-exports and never in delivery-candidates', async () => {
    const intake = await saveContent({
      kind: 'draft', brandId, profileVersion, stage: 'intake', platform: 'wechat',
      researchSubject: '目录隔离', title: '目录隔离', bodyMarkdown: '正文。', savedBy: '本机编辑者',
    })
    const exported = await exportDraftHandler({ contentId: (intake.data as any).contentId, exportedBy: '本机编辑者' })
    expect(exported.status).toBe('ok')
    const exportRoot = (exported.data as any).exportRoot as string
    expect(exportRoot.startsWith(join(dir, 'draft-exports'))).toBe(true)
    expect(exportRoot.startsWith(join(dir, 'delivery-candidates'))).toBe(false)
    // The manifest records the same root the caller was handed.
    const manifest = JSON.parse(await readFile(join(exportRoot, 'draft-export-manifest.json'), 'utf8'))
    expect(manifest.exportRoot).toBe(exportRoot)
  })

  test('no target platform is reported as an unevaluated platform gate, not as a clean draft', async () => {
    const intake = await saveContent({
      kind: 'draft', brandId, profileVersion, stage: 'intake',
      researchSubject: '未定平台', title: '未定平台', bodyMarkdown: '正文。', savedBy: '本机编辑者',
    })
    const exported = await exportDraftHandler({ contentId: (intake.data as any).contentId, exportedBy: '本机编辑者' })
    expect(exported.status).toBe('ok')
    expect((exported.data as any).blockers).toEqual([{
      code: 'PLATFORM_UNSPECIFIED',
      severity: 'error',
      message: 'No target platform is recorded or supplied, so platform limits and rule freshness were not evaluated for this draft.',
    }])

    // Positive control: naming the platform actually runs the gate.
    const withPlatform = await exportDraftHandler({ contentId: (intake.data as any).contentId, platform: 'wechat', exportedBy: '本机编辑者' })
    expect((withPlatform.data as any).blockers.map((issue: any) => issue.code)).toContain('DELIVERY_VERIFICATION_REQUIRED')
  })
})

/**
 * Identity: the export is deterministic machine work, so in local-editorial mode
 * the server-owned service actor performs it and the caller-supplied name is
 * overwritten rather than trusted.
 */
describe('draft export identity binding', () => {
  const IDENTITY_KEYS = [
    'MEDIAOPS_IDENTITY_MODE',
    'MEDIAOPS_TRUSTED_PRINCIPAL_ID',
    'MEDIAOPS_TRUSTED_PRINCIPAL_ISSUER',
    'MEDIAOPS_TRUSTED_PRINCIPAL_ROLES',
  ] as const
  let saved: Record<string, string | undefined> = {}

  beforeEach(() => {
    saved = Object.fromEntries(IDENTITY_KEYS.map((key) => [key, process.env[key]]))
    for (const key of IDENTITY_KEYS) delete process.env[key]
  })

  afterEach(() => {
    for (const key of IDENTITY_KEYS) {
      const value = saved[key]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  test('local-editorial mode routes the export to the service actor', () => {
    process.env.MEDIAOPS_IDENTITY_MODE = 'local-editorial'
    process.env.MEDIAOPS_TRUSTED_PRINCIPAL_ID = 'solo-editor'
    process.env.MEDIAOPS_TRUSTED_PRINCIPAL_ISSUER = 'crabcode-local-editorial'
    // Deliberately without the renderer role: the human never needed it, and
    // the call succeeding proves the service actor executed the work.
    process.env.MEDIAOPS_TRUSTED_PRINCIPAL_ROLES = 'author,fact_checker'

    const bound = authorizeToolCall('mediaops.delivery.export_draft', { contentId: '00000000-0000-4000-8000-00000000000a', exportedBy: 'spoofed' }, undefined)
    expect(bound.principal?.actorKey).toBe('mediaops-server:service')
    expect((bound.args as any).exportedBy).toBe('mediaops-server:service')
  })

  test('a configured mode without a configured principal still fails closed', () => {
    process.env.MEDIAOPS_IDENTITY_MODE = 'local-editorial'
    try {
      authorizeToolCall('mediaops.delivery.export_draft', { contentId: '00000000-0000-4000-8000-00000000000a', exportedBy: 'spoofed' }, undefined)
      throw new Error('expected the missing local principal to be rejected')
    } catch (error) {
      expect(error).toBeInstanceOf(IdentityError)
      expect((error as IdentityError).code).toBe('AUTHENTICATION_REQUIRED')
    }
  })

  test('no trusted identity at all is rejected', () => {
    expect(() => authorizeToolCall('mediaops.delivery.export_draft', { contentId: '00000000-0000-4000-8000-00000000000a', exportedBy: 'spoofed' }, undefined))
      .toThrow(IdentityError)
  })
})
