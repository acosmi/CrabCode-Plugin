import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { registerHandler } from '../src/tools/references.ts'
import { getLatestContent, saveHandler } from '../src/tools/content.ts'
import { handler as completeResearch } from '../src/tools/research.ts'
import { getOriginalityScan, reviewHandler, scanHandler } from '../src/tools/originality.ts'
import { createProfile, createTestResearchCapture } from './helpers.ts'

describe('version-bound originality evidence', () => {
  let dir: string
  let profileVersion: string
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mediaops-originality-'))
    process.env.MEDIAOPS_DATA_DIR = dir
    profileVersion = await createProfile('originality-brand')
  })
  afterEach(async () => rm(dir, { recursive: true, force: true }))

  async function drafted(referenceText: string | string[], draftText: string, allowQuotation = false): Promise<string> {
    const referenceIds: string[] = []
    for (const [index, rawText] of (Array.isArray(referenceText) ? referenceText : [referenceText]).entries()) {
      const registered = await registerHandler({
        role: 'third_party_reference', rightsStatus: 'unknown',
        allowedUses: ['fact_leads', 'abstract_style_features', 'originality_comparison', ...(allowQuotation ? ['attributed_quotation' as const] : [])],
        title: `外部作者文章 ${index + 1}`, url: `https://author${index + 1}.example.com/post`, rawText,
        doNotCopyFeatures: ['论证顺序', '段落映射', '标志性表达'], registeredBy: '运营',
      })
      referenceIds.push((registered.data as any).reference.referenceId)
    }
    const base = { kind: 'draft' as const, brandId: 'originality-brand', profileVersion, platform: 'wechat' as const, researchSubject: '原创风险测试', referenceIds, title: '独立标题' }
    const intake = await saveHandler({ ...base, stage: 'intake', bodyMarkdown: '', savedBy: '选题员' })
    const contentId = (intake.data as any).contentId
    const now = new Date().toISOString()
    const officialCaptureId = await createTestResearchCapture({ url: 'https://official.example.org/a', snapshotText: '独立资料一' })
    const newsCaptureId = await createTestResearchCapture({ url: 'https://news.example.net/b', snapshotText: '独立资料二' })
    const research = await completeResearch({
      contentId, claims: [], evidenceLinks: [],
      sources: [
        { sourceKey: 'official', captureId: officialCaptureId, title: '官方资料', publisher: '官方机构', sourceTier: 'authoritative', isPrimary: true },
        { sourceKey: 'news', captureId: newsCaptureId, title: '独立报道', publisher: '新闻机构', sourceTier: 'professional', isPrimary: false },
      ],
      searches: [{ query: '原创风险测试', executedAt: now, resultCount: 2, tool: 'web-search' }], counterEvidenceSourceKeys: [], unresolvedGaps: [],
      noVerifiableClaimsReason: '本测试仅比较表达独立性', conclusionStrength: 'normal', completedBy: '研究员',
    })
    const researchId = (research.data as any).researchId
    await saveHandler({ ...base, contentId, expectedRevision: 1, stage: 'researched', researchId, bodyMarkdown: '', savedBy: '研究编排员' })
    const draft = await saveHandler({ ...base, contentId, expectedRevision: 2, stage: 'drafted', researchId, bodyMarkdown: draftText, savedBy: '写作者' })
    if (draft.status !== 'ok') throw new Error(JSON.stringify(draft))
    return contentId
  }

  test('blocks substantial literal reuse and cannot be human-overridden', async () => {
    const copied = '这是一段足够长的参考表达，用于验证几乎原封不动复制时必须被系统阻断，不能依靠调用方自称原创来绕过。'
    const contentId = await drafted(copied, copied)
    const scan = await scanHandler({ contentId, createdBy: '扫描员' })
    expect((scan.data as any).decision).toBe('blocked')
    const reviewed = await reviewHandler({ scanId: (scan.data as any).scanId, decision: 'pass', reviewedBy: '独立主编', rationale: '该测试试图用人工结论覆盖高字面重合自动阻断，系统必须拒绝这一操作。', structureIndependent: true, argumentIndependent: true, attributedQuotations: [] })
    expect(reviewed.error?.code).toBe('ORIGINALITY_DECISION_NOT_REVIEWABLE')
  })

  test('low-literal synonym/structure risk still requires a separate human judgment', async () => {
    const reference = '先描述普通人的困境。\n\n再解释工具如何改变门槛。\n\n最后得出技术应服务人的结论。'
    const draft = '开头呈现大众遇到的阻碍。\n\n中段分析新方法怎样降低难度。\n\n结尾主张创新最终应当增益个体。'
    const contentId = await drafted(reference, draft)
    const scan = await scanHandler({ contentId, createdBy: '扫描员' })
    expect((scan.data as any).decision).toBe('human_review_required')
    const review = await reviewHandler({
      scanId: (scan.data as any).scanId, decision: 'pass', reviewedBy: '独立主编',
      rationale: '人工逐段核对后确认案例组合、观点来源和论证推进均由当前作者独立建立。',
      structureIndependent: true, argumentIndependent: true, attributedQuotations: [],
    })
    expect(review.status).toBe('ok')
  })

  test('aggregates copied coverage across multiple references instead of evaluating each source in isolation', async () => {
    const first = '红色齿轮推动透明船舶向前航行，参考文章随后讨论港口效率。'
    const second = '蓝色电路连接微型城市夜间照明，参考文章随后讨论能源调度。'
    const draft = '先提出完全独立的问题。红色齿轮推动透明船舶向前航行。再补充新的分析。蓝色电路连接微型城市夜间照明。最后给出自己的结论。'
    const contentId = await drafted([first, second], draft)
    const scan = await scanHandler({ contentId, createdBy: '扫描员' })
    expect((scan.data as any).draftCoverage).toBeGreaterThan(0.2)
    expect((scan.data as any).decision).toBe('blocked')
  })

  test('only excludes a short, exact, attributed quotation and binds the declaration into scan evidence', async () => {
    const quote = '工具应当服务人的真实需要'
    const contentId = await drafted(`评论者写道：${quote}。其余内容与测试无关。`, `王编辑指出：“${quote}”。\n\n本文随后建立一套完全独立的判断框架。`, true)
    const latest = await getLatestContent(contentId)
    const referenceId = (latest as any).referenceIds[0]
    const withoutAttribution = await scanHandler({
      contentId,
      createdBy: '扫描员',
      quotations: [{ referenceId, text: quote, attribution: '不存在的署名', locator: '第一段' }],
    })
    expect(withoutAttribution.error?.code).toBe('INVALID_ATTRIBUTED_QUOTATION')

    const scan = await scanHandler({ contentId, createdBy: '扫描员', quotations: [{ referenceId, text: quote, attribution: '王编辑', locator: '第一段' }] })
    const stored = await getOriginalityScan((scan.data as any).scanId)
    expect(stored?.quotations).toEqual([{ referenceId, text: quote, attribution: '王编辑', locator: '第一段' }])
    expect(stored?.longestNormalizedMatch).toBeLessThan(quote.length)
  })
})
