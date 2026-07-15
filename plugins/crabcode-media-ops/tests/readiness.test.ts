import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { saveHandler as saveContent, getLatestContent } from '../src/tools/content.ts'
import { getPlatform } from '../src/platforms/registry.ts'
import { handler, inspectContent } from '../src/tools/readiness.ts'
import { createProfile, createReviewedContent } from './helpers.ts'

describe('complete Media Gate', () => {
  let dir: string
  let version: string
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mediaops-readiness-v2-'))
    process.env.MEDIAOPS_DATA_DIR = dir
    version = await createProfile('tech-daily')
  })
  afterEach(async () => rm(dir, { recursive: true, force: true }))

  test('passes only a fully evidenced and delivery-verified revision', async () => {
    const content = await createReviewedContent({ dir, brandId: 'tech-daily', profileVersion: version })
    const env = await handler({ contentId: content.contentId })
    expect(env.status).toBe('ok')
    expect((env.data as any).ready).toBe(true)
    expect((env.data as any).primaryArtifact.format).toBe('html')
    expect((env.data as any).backupArtifact.format).toBe('markdown')
  })

  test('intake cannot self-report or bypass research/review/delivery gates', async () => {
    const intake = await saveContent({ kind: 'draft', brandId: 'tech-daily', profileVersion: version, researchSubject: '选题', stage: 'intake', platform: 'wechat', title: '草稿', bodyMarkdown: '', savedBy: '作者' })
    const env = await handler({ contentId: (intake.data as any).contentId })
    const codes = (env.data as any).issues.map((issue: any) => issue.code)
    expect(codes).toContain('EDITORIAL_REVIEW_REQUIRED')
    expect(codes).toContain('RESEARCH_EVIDENCE_REQUIRED')
    expect(codes).toContain('DELIVERY_VERIFICATION_REQUIRED')
  })

  test('confirmed platform-native disclosure is valid without fixed body sentence', async () => {
    const content = await createReviewedContent({ dir, brandId: 'tech-daily', profileVersion: version, body: '纯正文', disclosure: { aiAssisted: true, methods: ['platform-native'], platformNativeConfirmed: true, confirmedBy: '运营者' } })
    expect((await handler({ contentId: content.contentId })).status).toBe('ok')
  })

  test('stale platform rules are detected with an internal deterministic audit clock', async () => {
    const fixture = await createReviewedContent({ dir, brandId: 'tech-daily', profileVersion: version })
    const content = await getLatestContent(fixture.contentId)
    const issues = await inspectContent(content!, getPlatform('wechat')!, new Date('2030-01-01T00:00:00.000Z'))
    expect(issues.some((issue) => issue.code === 'PLATFORM_RULES_STALE')).toBe(true)
  })
})
