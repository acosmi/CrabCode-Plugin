import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { decideHandler, requestHandler } from '../src/tools/approval.ts'
import { saveHandler as saveContent } from '../src/tools/content.ts'
import { handler as packageContent } from '../src/tools/package.ts'
import { createProfile, createReviewedContent, DISCLOSURE } from './helpers.ts'

describe('hash-bound publish packaging', () => {
  let dir: string
  let version: string
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mediaops-package-v2-'))
    process.env.MEDIAOPS_DATA_DIR = dir
    version = await createProfile('pack-brand')
  })
  afterEach(async () => rm(dir, { recursive: true, force: true }))

  async function pending() {
    const content = await createReviewedContent({ dir, brandId: 'pack-brand', profileVersion: version })
    const approval = await requestHandler({ contentId: content.contentId, platform: 'wechat', summary: '发布此稿', checklist: ['事实与披露已确认'], requestedBy: '运营' })
    return { content, approvalId: (approval.data as any).approvalId }
  }

  test('missing and pending approvals cannot package', async () => {
    const { content, approvalId } = await pending()
    const missing = await packageContent({ contentId: content.contentId, approvalId: crypto.randomUUID(), packagedBy: '运营' })
    expect(missing.error?.code).toBe('APPROVAL_REQUIRED')
    const wait = await packageContent({ contentId: content.contentId, approvalId, packagedBy: '运营' })
    expect(wait.error?.code).toBe('APPROVAL_PENDING')
  })

  test('approved content packages with trace manifest and copied asset', async () => {
    const { content, approvalId } = await pending()
    await decideHandler({ approvalId, decision: 'approved', decidedBy: '主编', reason: '核对通过' })
    const env = await packageContent({ contentId: content.contentId, approvalId, packagedBy: '发布员' })
    expect(env.status).toBe('ok')
    const path = (env.data as any).packagePath
    const manifest = JSON.parse(readFileSync(join(path, 'manifest.json'), 'utf8'))
    expect(manifest.contentHash).toBe(content.contentHash)
    expect(manifest.approval.state).toBe('approved')
    expect(manifest.profileVersion).toBe(version)
    expect(existsSync(join(path, manifest.assets[0].packagePath))).toBe(true)
  })

  test('rejected approval cannot package', async () => {
    const { content, approvalId } = await pending()
    await decideHandler({ approvalId, decision: 'rejected', decidedBy: '主编', reason: '需改稿' })
    expect((await packageContent({ contentId: content.contentId, approvalId, packagedBy: '发布员' })).error?.code).toBe('APPROVAL_REJECTED')
  })

  test('editing after approval makes it stale', async () => {
    const { content, approvalId } = await pending()
    await decideHandler({ approvalId, decision: 'approved', decidedBy: '主编', reason: '通过' })
    await saveContent({
      contentId: content.contentId, kind: 'variant', brandId: 'pack-brand', profileVersion: version, stage: 'reviewed', platform: 'wechat', title: '批准后修改的标题', bodyMarkdown: `正文\n${DISCLOSURE}`,
      assets: [{ path: content.assetPath, role: 'cover', rightsStatus: 'owned' }], review: { status: 'completed', completedBy: '核查', completedAt: new Date().toISOString(), claims: [], noVerifiableClaimsReason: '无事实主张', waivers: [] },
      originalityReview: { status: 'completed', reviewedBy: '原创', reviewedAt: new Date().toISOString(), conclusion: 'publishable', notes: [] }, legalReview: { status: 'not_required', reviewedBy: '编辑', reviewedAt: new Date().toISOString(), riskLevel: 'low', notes: [] },
      aiDisclosure: { aiAssisted: true, methods: ['body-label'], bodyLabelText: DISCLOSURE, confirmedBy: '确认人' }, savedBy: '编辑',
    })
    expect((await packageContent({ contentId: content.contentId, approvalId, packagedBy: '发布员' })).error?.code).toBe('APPROVAL_STALE')
  })
})
