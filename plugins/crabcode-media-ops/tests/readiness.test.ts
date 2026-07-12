import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { saveHandler as saveContent } from '../src/tools/content.ts'
import { handler } from '../src/tools/readiness.ts'
import { createProfile, createReviewedContent, DISCLOSURE } from './helpers.ts'

describe('complete Media Gate', () => {
  let dir: string
  let version: string
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mediaops-readiness-v2-'))
    process.env.MEDIAOPS_DATA_DIR = dir
    version = await createProfile('tech-daily')
  })
  afterEach(async () => rm(dir, { recursive: true, force: true }))

  test('passes a fully reviewed revision', async () => {
    const content = await createReviewedContent({ dir, brandId: 'tech-daily', profileVersion: version })
    const env = await handler({ contentId: content.contentId })
    expect(env.status).toBe('ok')
    expect((env.data as any).ready).toBe(true)
  })

  test('omitted review is blocked instead of treated as empty claims', async () => {
    const draft = await saveContent({ kind: 'draft', brandId: 'tech-daily', profileVersion: version, stage: 'drafted', title: '草稿', bodyMarkdown: '正文', savedBy: '作者' })
    const env = await handler({ contentId: (draft.data as any).contentId, platform: 'wechat' })
    expect((env.data as any).issues.some((i: any) => i.code === 'REVIEW_REQUIRED')).toBe(true)
  })

  test('empty claim ledger requires explicit reason', async () => {
    const content = await createReviewedContent({ dir, brandId: 'tech-daily', profileVersion: version })
    const saved = await saveContent({
      contentId: content.contentId, kind: 'variant', brandId: 'tech-daily', profileVersion: version, stage: 'reviewed', platform: 'wechat', title: '无理由', bodyMarkdown: `正文\n${DISCLOSURE}`,
      assets: [{ path: content.assetPath, role: 'cover', rightsStatus: 'owned' }], review: { status: 'completed', completedBy: '核查', completedAt: new Date().toISOString(), claims: [], waivers: [] },
      originalityReview: { status: 'completed', reviewedBy: '原创', reviewedAt: new Date().toISOString(), conclusion: 'publishable', notes: [] },
      legalReview: { status: 'not_required', reviewedBy: '编辑', reviewedAt: new Date().toISOString(), riskLevel: 'low', notes: [] },
      aiDisclosure: { aiAssisted: true, methods: ['body-label'], bodyLabelText: DISCLOSURE, confirmedBy: '确认人' }, savedBy: '编辑',
    })
    const env = await handler({ contentId: (saved.data as any).contentId })
    expect((env.data as any).issues.some((i: any) => i.code === 'REVIEW_REQUIRED')).toBe(true)
  })

  test('unresolved claim requires a claim-bound waiver', async () => {
    const content = await createReviewedContent({ dir, brandId: 'tech-daily', profileVersion: version, claims: [{ id: 'c1', claim: '营收翻倍', status: 'doubtful' }], noVerifiableClaimsReason: undefined })
    const env = await handler({ contentId: content.contentId })
    expect((env.data as any).issues.some((i: any) => i.code === 'UNRESOLVED_CLAIMS')).toBe(true)
  })

  test('confirmed platform-native disclosure is valid without fixed body sentence', async () => {
    const content = await createReviewedContent({ dir, brandId: 'tech-daily', profileVersion: version, body: '纯正文', disclosure: { aiAssisted: true, methods: ['platform-native'], platformNativeConfirmed: true, confirmedBy: '运营者' } })
    expect((await handler({ contentId: content.contentId })).status).toBe('ok')
  })

  test('stale platform rules block readiness', async () => {
    const content = await createReviewedContent({ dir, brandId: 'tech-daily', profileVersion: version })
    const env = await handler({ contentId: content.contentId, now: '2030-01-01T00:00:00.000Z' })
    expect((env.data as any).issues.some((i: any) => i.code === 'PLATFORM_RULES_STALE')).toBe(true)
  })
})
