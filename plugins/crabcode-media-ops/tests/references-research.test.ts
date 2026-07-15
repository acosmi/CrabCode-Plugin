import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { registerHandler, getHandler as getReference } from '../src/tools/references.ts'
import { saveHandler } from '../src/tools/content.ts'
import { handler as completeResearch } from '../src/tools/research.ts'
import { handler as captureResearch } from '../src/tools/research-capture.ts'
import { createProfile, createReviewedContent, createTestResearchCapture } from './helpers.ts'

describe('reference firewall and research evidence', () => {
  let dir: string
  let profileVersion: string
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mediaops-reference-'))
    process.env.MEDIAOPS_DATA_DIR = dir
    profileVersion = await createProfile('reference-brand')
  })
  afterEach(async () => rm(dir, { recursive: true, force: true }))

  test('forbids third-party rewrite rights and never returns raw text to writer-facing metadata', async () => {
    const forbidden = await registerHandler({
      role: 'third_party_reference', rightsStatus: 'unknown', allowedUses: ['rewrite'], title: '他人文章', rawText: '原文',
      doNotCopyFeatures: ['标题结构'], registeredBy: '运营',
    })
    expect(forbidden.error?.code).toBe('REFERENCE_USAGE_NOT_ALLOWED')
    const stored = await registerHandler({
      role: 'third_party_reference', rightsStatus: 'unknown', allowedUses: ['fact_leads', 'abstract_style_features', 'originality_comparison'],
      title: '他人文章', rawText: '仅保存在受保护集合的完整原文', doNotCopyFeatures: ['标题结构', '论证顺序'], registeredBy: '运营',
    })
    expect(stored.status).toBe('ok')
    const metadata = await getReference({ referenceId: (stored.data as any).reference.referenceId })
    expect(JSON.stringify(metadata.data)).not.toContain('完整原文')
    expect((stored.data as any).writerPayloadContainsRawText).toBe(false)
  })

  test('server evidence capture blocks loopback and custom-port SSRF targets', async () => {
    const loopback = await captureResearch({ url: 'http://127.0.0.1/', capturedBy: '研究员' })
    const customPort = await captureResearch({ url: 'https://example.com:8443/a', capturedBy: '研究员' })
    expect(loopback.error?.code).toBe('SOURCE_RETRIEVAL_FAILED')
    expect(customPort.error?.code).toBe('SOURCE_RETRIEVAL_FAILED')
  })

  test('zero-result research stays action_required even when a caller supplies a source object', async () => {
    const intake = await saveHandler({
      kind: 'brief', brandId: 'reference-brand', profileVersion, stage: 'intake', platform: 'wechat',
      researchSubject: '零结果测试', title: '零结果', bodyMarkdown: '', savedBy: '选题员',
    })
    const now = new Date().toISOString()
    const captureId = await createTestResearchCapture({ url: 'https://example.org/a', snapshotText: '页面内容' })
    const research = await completeResearch({
      contentId: (intake.data as any).contentId,
      claims: [],
      sources: [{ sourceKey: 'one', captureId, title: '页面', publisher: '示例', sourceTier: 'context', isPrimary: false }],
      evidenceLinks: [],
      searches: [{ query: '零结果测试', executedAt: now, resultCount: 0, tool: 'web-search' }],
      counterEvidenceSourceKeys: [], unresolvedGaps: [], noVerifiableClaimsReason: '无外部事实主张', conclusionStrength: 'normal', completedBy: '研究员',
    })
    expect(research.status).toBe('action_required')
    expect((research.data as any).problems).toContain('all recorded web searches returned zero results')
  })

  test('a core claim needs two independent groups and the excerpt must occur in the snapshot', async () => {
    const intake = await saveHandler({
      kind: 'brief', brandId: 'reference-brand', profileVersion, stage: 'intake', platform: 'wechat',
      researchSubject: '证据测试', title: '证据', bodyMarkdown: '', savedBy: '选题员',
    })
    const now = new Date().toISOString()
    const captureId = await createTestResearchCapture({ url: 'https://example.org/a', snapshotText: '页面没有这句话' })
    const research = await completeResearch({
      contentId: (intake.data as any).contentId,
      claims: [{ id: 'c1', claim: '某项指标增长', core: true, temporallySensitive: true, controversial: false }],
      sources: [{ sourceKey: 'one', captureId, title: '页面', publisher: '同一机构', sourceTier: 'authoritative', isPrimary: true }],
      evidenceLinks: [{ claimId: 'c1', sourceKey: 'one', relation: 'supports', supportType: 'direct', locator: 'p1', supportingExcerpt: '某项指标增长', sourceInterpretation: '直接支持', limitations: '单一来源', checkedAt: now }],
      searches: [{ query: '证据测试', executedAt: now, resultCount: 1, tool: 'web-search' }],
      counterEvidenceSourceKeys: [], unresolvedGaps: [], conclusionStrength: 'normal', completedBy: '研究员',
    })
    expect(research.status).toBe('action_required')
    const problems = (research.data as any).problems.join('|')
    expect(problems).toContain('does not contain')
    expect(problems).toContain('two independent')
  })

  test('exact mirror captures cannot be counted as two independent sources', async () => {
    const registered = await registerHandler({
      role: 'third_party_reference', rightsStatus: 'unknown', allowedUses: ['fact_leads', 'abstract_style_features', 'originality_comparison'],
      title: '第三方参考', rawText: '参考原文', doNotCopyFeatures: ['论证顺序'], registeredBy: '运营',
    })
    const intake = await saveHandler({
      kind: 'brief', brandId: 'reference-brand', profileVersion, stage: 'intake', platform: 'wechat', researchSubject: '镜像测试',
      referenceIds: [(registered.data as any).reference.referenceId], title: '镜像', bodyMarkdown: '', savedBy: '选题员',
    })
    const snapshotText = '完全相同的转载稿正文。'
    const firstCapture = await createTestResearchCapture({ url: 'https://one.example/a', snapshotText })
    const secondCapture = await createTestResearchCapture({ url: 'https://two.example/b', snapshotText })
    const now = new Date().toISOString()
    const research = await completeResearch({
      contentId: (intake.data as any).contentId, claims: [], evidenceLinks: [],
      sources: [
        { sourceKey: 'one', captureId: firstCapture, title: '转载一', publisher: '站点一', originPublisher: '来源一', sourceTier: 'professional', isPrimary: false },
        { sourceKey: 'two', captureId: secondCapture, title: '转载二', publisher: '站点二', originPublisher: '来源二', sourceTier: 'professional', isPrimary: false },
      ],
      searches: [{ query: '镜像测试', executedAt: now, resultCount: 2, tool: 'web-search' }],
      counterEvidenceSourceKeys: [], unresolvedGaps: [], noVerifiableClaimsReason: '无事实主张', conclusionStrength: 'normal', completedBy: '研究员',
    })
    expect(research.status).toBe('action_required')
    expect((research.data as any).problems.join('|')).toContain('duplicates the exact captured content')
  })

  test('cannot fabricate network retrieval with caller-supplied status or snapshot text', async () => {
    const intake = await saveHandler({
      kind: 'brief', brandId: 'reference-brand', profileVersion, stage: 'intake', platform: 'wechat',
      researchSubject: '伪造联网测试', title: '伪造联网', bodyMarkdown: '', savedBy: '选题员',
    })
    const now = new Date().toISOString()
    const research = await completeResearch({
      contentId: (intake.data as any).contentId,
      claims: [],
      sources: [{ sourceKey: 'fake', captureId: randomUUID(), title: '伪造页面', publisher: '伪造来源', sourceTier: 'authoritative', isPrimary: true }],
      evidenceLinks: [],
      searches: [{ query: '伪造联网测试', executedAt: now, resultCount: 1, tool: 'web-search' }],
      counterEvidenceSourceKeys: [], unresolvedGaps: [], noVerifiableClaimsReason: '无外部事实', conclusionStrength: 'normal', completedBy: '研究员',
    })
    expect(research.status).toBe('action_required')
    expect((research.data as any).problems.join('|')).toContain('missing server-generated capture')
  })

  test('an empty claim ledger cannot hide obvious factual assertions in the drafted article', async () => {
    await expect(createReviewedContent({
      dir,
      brandId: 'reference-brand',
      profileVersion,
      body: '某公司在2026年收入增长1000%，并已经成为全球第一。\n\n本文包含 AI 辅助创作内容',
      claims: [],
      noVerifiableClaimsReason: '调用方声称没有外部可验证事实',
    })).rejects.toThrow('article contains verifiable claim signals absent from the research ledger')
  })

  test('summary or citation changes after scan/editorial review invalidate promotion', async () => {
    await expect(createReviewedContent({
      dir, brandId: 'reference-brand', profileVersion, lateReviewedSummary: '审校后才注入的摘要事实',
    })).rejects.toThrow('article semantics')
    await expect(createReviewedContent({
      dir, brandId: 'reference-brand', profileVersion, lateReviewedCitationUrl: 'https://unreviewed.example/elsewhere',
    })).rejects.toThrow('article semantics')
  })
})
