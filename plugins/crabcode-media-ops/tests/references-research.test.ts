import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { EvidenceSourceSchema } from '../src/domain.ts'
import { registerHandler, getHandler as getReference } from '../src/tools/references.ts'
import { saveHandler } from '../src/tools/content.ts'
import { getHandler as getResearch, handler as completeResearch } from '../src/tools/research.ts'
import { handler as captureResearch, researchCaptureInternals } from '../src/tools/research-capture.ts'
import { createProfile, createReviewedContent, createTestResearchCapture } from './helpers.ts'

function contextAssessment(basisExcerpt: string) {
  return {
    publisherType: 'unknown' as const,
    sourceFunction: 'context' as const,
    originRelationship: 'original' as const,
    basisExcerpt,
    classificationRationale: '该测试来源只提供背景上下文，不作为一手或权威事实证据使用。',
  }
}

function primaryAssessment(basisExcerpt: string) {
  return {
    publisherType: 'government' as const,
    sourceFunction: 'original_record' as const,
    originRelationship: 'original' as const,
    basisExcerpt,
    classificationRationale: '该测试来源模拟主管机关直接发布的原始记录，按一手来源归类。',
  }
}

function reportingAssessment(basisExcerpt: string) {
  return {
    publisherType: 'professional_media' as const,
    sourceFunction: 'independent_reporting' as const,
    originRelationship: 'original' as const,
    basisExcerpt,
    classificationRationale: '该测试来源模拟专业媒体自行采写的报道，按独立专业报道归类。',
  }
}

describe('reference firewall and research evidence', () => {
  let dir: string
  let profileVersion: string
  let previousTrustedHosts: string | undefined
  beforeEach(async () => {
    previousTrustedHosts = process.env.MEDIAOPS_TRUSTED_SOURCE_HOSTS
    delete process.env.MEDIAOPS_TRUSTED_SOURCE_HOSTS
    dir = await mkdtemp(join(tmpdir(), 'mediaops-reference-'))
    process.env.MEDIAOPS_DATA_DIR = dir
    profileVersion = await createProfile('reference-brand')
  })
  afterEach(async () => {
    if (previousTrustedHosts === undefined) delete process.env.MEDIAOPS_TRUSTED_SOURCE_HOSTS
    else process.env.MEDIAOPS_TRUSTED_SOURCE_HOSTS = previousTrustedHosts
    await rm(dir, { recursive: true, force: true })
  })

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

  test('validated DNS cannot be rebound between lookup and connection', () => {
    const options = researchCaptureInternals.pinnedRequestOptions('https://evidence.example/report?q=1', '93.184.216.34', 4) as any
    expect(options.hostname).toBe('93.184.216.34')
    expect(options.path).toBe('/report?q=1')
    expect(options.servername).toBe('evidence.example')
    expect(options.headers.host).toBe('evidence.example')
    expect('lookup' in options).toBe(false)
    expect(researchCaptureInternals.forbiddenIp('127.0.0.1')).toBe(true)
    expect(researchCaptureInternals.forbiddenIp('93.184.216.34')).toBe(false)
    expect(researchCaptureInternals.forbiddenIp('::ffff:192.168.1.1')).toBe(true)
    expect(researchCaptureInternals.forbiddenIp('::ffff:c0a8:1')).toBe(true)
    expect(researchCaptureInternals.forbiddenIp('64:ff9b::7f00:1')).toBe(true)
    expect(researchCaptureInternals.forbiddenIp('2002:7f00:1::')).toBe(true)
    expect(researchCaptureInternals.forbiddenIp('2001:db8::1')).toBe(true)
    expect(researchCaptureInternals.forbiddenIp('2606:4700:4700::1111')).toBe(false)
    const ipv6Options = researchCaptureInternals.pinnedRequestOptions('https://[2606:4700:4700::1111]/dns', '2606:4700:4700::1111', 6) as any
    expect(ipv6Options.hostname).toBe('2606:4700:4700::1111')
    expect(ipv6Options.servername).toBeUndefined()
    expect(ipv6Options.headers.host).toBe('[2606:4700:4700::1111]')
  })

  test('HTML evidence exposes only reader-visible text, never scripts, comments or explicitly hidden nodes', () => {
    const visible = researchCaptureInternals.visibleSnapshot('text/html', `<!doctype html><html><head><title>伪造标题增长10%</title></head><body>
      <script type="application/json">{"claim":"Acme公司增长10%"}</script>
      <!-- Acme公司增长10% -->
      <div hidden>Acme公司增长10%</div><div style="display:none">Acme公司增长10%</div>
      <p>Acme公司收入下降10%</p></body></html>`)
    expect(visible).toContain('Acme公司收入下降10%')
    expect(visible).not.toContain('Acme公司增长10%')
    expect(visible).not.toContain('伪造标题')
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
      sources: [{ sourceKey: 'one', captureId, title: '页面', publisher: '示例', assessment: contextAssessment('页面内容') }],
      evidenceLinks: [],
      searches: [{ query: '零结果测试', executedAt: now, resultCount: 0, tool: 'web-search' }],
      counterEvidenceSourceKeys: [], unresolvedGaps: [], noVerifiableClaimsReason: '无外部事实主张', conclusionStrength: 'normal', completedBy: '研究员',
    })
    expect(research.status).toBe('action_required')
    expect((research.data as any).problems).toContain('all recorded web searches returned zero results')
  })

  test('the public research get contract recovers server-derived IDs for fresh-context handoff', async () => {
    const intake = await saveHandler({
      kind: 'brief', brandId: 'reference-brand', profileVersion, stage: 'intake', platform: 'wechat',
      researchSubject: '公开交接测试', title: '公开交接', bodyMarkdown: '', savedBy: '选题员',
    })
    const now = new Date().toISOString()
    const captureId = await createTestResearchCapture({ url: 'https://example.org/handoff', snapshotText: '公开交接背景材料。' })
    const completed = await completeResearch({
      contentId: (intake.data as any).contentId,
      claims: [],
      sources: [{ sourceKey: 'context', captureId, title: '交接材料', publisher: '示例资料库', assessment: contextAssessment('公开交接背景材料') }],
      evidenceLinks: [],
      searches: [{ query: '公开交接测试', executedAt: now, resultCount: 1, tool: 'web-search' }],
      counterEvidenceSourceKeys: [], unresolvedGaps: [], noVerifiableClaimsReason: '该流程样本没有外部事实主张', conclusionStrength: 'normal', completedBy: '研究员',
    })
    expect(completed.status).toBe('ok')
    const immediate = (completed.data as any).research
    const recovered = await getResearch({ researchId: immediate.researchId })
    expect(recovered.status).toBe('ok')
    const bundle = (recovered.data as any).research
    expect(bundle.researchBundleHash).toBe(immediate.researchBundleHash)
    expect(bundle.sources[0].sourceId).toMatch(/^[0-9a-f-]{36}$/)
    expect(bundle.sources[0].publisherIdentityMethod).toBe('unverified')
    expect(bundle.sources[0].independenceGroup).toHaveLength(24)
    expect(bundle.sources[0].snapshotText).toBeUndefined()
  })

  test('configured publisher trust records its exact rule/config hash and stored invariants reject spoofed tiers', async () => {
    process.env.MEDIAOPS_TRUSTED_SOURCE_HOSTS = 'news.example.com'
    const intake = await saveHandler({
      kind: 'brief', brandId: 'reference-brand', profileVersion, stage: 'intake', platform: 'wechat',
      researchSubject: '信任配置审计', title: '信任配置', bodyMarkdown: '', savedBy: '选题员',
    })
    const now = new Date().toISOString()
    const captureId = await createTestResearchCapture({ url: 'https://news.example.com/report', snapshotText: '媒体自行采写背景材料。' })
    const completed = await completeResearch({
      contentId: (intake.data as any).contentId, claims: [],
      sources: [{ sourceKey: 'media', captureId, title: '背景报道', publisher: '示例媒体', assessment: reportingAssessment('媒体自行采写背景材料') }],
      evidenceLinks: [], searches: [{ query: '信任配置审计', executedAt: now, resultCount: 1, tool: 'web-search' }],
      counterEvidenceSourceKeys: [], unresolvedGaps: [], noVerifiableClaimsReason: '该样本没有外部事实主张', conclusionStrength: 'normal', completedBy: '研究员',
    })
    expect(completed.status).toBe('ok')
    const source = (completed.data as any).research.sources[0]
    expect(source.publisherIdentityMethod).toBe('configured-trusted-host')
    expect(source.publisherIdentityRule).toBe('news.example.com')
    expect(source.trustedHostConfigurationHash).toMatch(/^[a-f0-9]{64}$/)
    expect(EvidenceSourceSchema.safeParse({ ...source, sourceTier: 'primary', isPrimary: false, publisherIdentityMethod: 'unverified' }).success).toBe(false)
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
      sources: [{ sourceKey: 'one', captureId, title: '页面', publisher: '同一机构', assessment: primaryAssessment('页面没有这句话') }],
      evidenceLinks: [{ claimId: 'c1', sourceKey: 'one', relation: 'supports', supportType: 'direct', locator: 'p1', supportingExcerpt: '某项指标增长', sourceInterpretation: '直接支持', limitations: '单一来源', checkedAt: now }],
      searches: [{ query: '证据测试', executedAt: now, resultCount: 1, tool: 'web-search' }],
      counterEvidenceSourceKeys: [], unresolvedGaps: [], conclusionStrength: 'normal', completedBy: '研究员',
    })
    expect(research.status).toBe('action_required')
    const problems = (research.data as any).problems.join('|')
    expect(problems).toContain('does not contain')
    expect(problems).toContain('two independent')
  })

  test('a supports label cannot reverse the quantitative direction in captured evidence', async () => {
    const intake = await saveHandler({
      kind: 'brief', brandId: 'reference-brand', profileVersion, stage: 'intake', platform: 'wechat',
      researchSubject: '方向校验', title: '方向校验', bodyMarkdown: '', savedBy: '选题员',
    })
    const now = new Date().toISOString()
    const captureId = await createTestResearchCapture({ url: 'https://example.gov.cn/direction', snapshotText: '公开材料显示某指标增长10%。' })
    const research = await completeResearch({
      contentId: (intake.data as any).contentId,
      claims: [{ id: 'c1', claim: '某指标下降10%', core: false, temporallySensitive: true, controversial: false }],
      sources: [{ sourceKey: 'official', captureId, title: '公开材料', publisher: '主管机关', assessment: primaryAssessment('某指标增长10%') }],
      evidenceLinks: [{ claimId: 'c1', sourceKey: 'official', relation: 'supports', supportType: 'direct', locator: '正文', supportingExcerpt: '某指标增长10%', sourceInterpretation: '调用方错误解释为某指标下降10%', limitations: '方向必须以原始片段为准', checkedAt: now }],
      searches: [{ query: '方向校验', executedAt: now, resultCount: 1, tool: 'web-search' }],
      counterEvidenceSourceKeys: [], unresolvedGaps: [], conclusionStrength: 'normal', completedBy: '研究员',
    })
    expect(research.status).toBe('action_required')
    expect((research.data as any).problems.join('|')).toContain('opposite direction decrease/increase')
  })

  test('caller interpretation cannot supply facts absent from the captured supporting excerpt', async () => {
    const intake = await saveHandler({
      kind: 'brief', brandId: 'reference-brand', profileVersion, stage: 'intake', platform: 'wechat',
      researchSubject: '解释注入校验', title: '解释注入', bodyMarkdown: '', savedBy: '选题员',
    })
    const now = new Date().toISOString()
    const captureId = await createTestResearchCapture({ url: 'https://example.gov.cn/injection', snapshotText: '官方记录。Acme公司成立。' })
    const research = await completeResearch({
      contentId: (intake.data as any).contentId,
      claims: [{ id: 'c1', claim: 'Acme公司增长10%', core: false, temporallySensitive: true, controversial: false }],
      sources: [{ sourceKey: 'official', captureId, title: '官方记录', publisher: '主管机关', assessment: primaryAssessment('官方记录') }],
      evidenceLinks: [{ claimId: 'c1', sourceKey: 'official', relation: 'supports', supportType: 'direct', locator: '正文', supportingExcerpt: 'Acme公司成立', sourceInterpretation: 'Acme公司增长10%', limitations: '解释不能替代原文', checkedAt: now }],
      searches: [{ query: '解释注入校验', executedAt: now, resultCount: 1, tool: 'web-search' }],
      counterEvidenceSourceKeys: [], unresolvedGaps: [], conclusionStrength: 'normal', completedBy: '研究员',
    })
    expect(research.status).toBe('action_required')
    expect((research.data as any).problems.join('|')).toContain('missing quantitative token 10%')
  })

  test('an arbitrary host cannot self-declare a government primary source', async () => {
    const intake = await saveHandler({
      kind: 'brief', brandId: 'reference-brand', profileVersion, stage: 'intake', platform: 'wechat',
      researchSubject: '来源身份校验', title: '来源身份', bodyMarkdown: '', savedBy: '选题员',
    })
    const claim = '微信泄露了用户聊天记录'
    const first = await createTestResearchCapture({ url: 'https://attacker-a.example/report', snapshotText: `${claim}。自称政府原始记录。` })
    const second = await createTestResearchCapture({ url: 'https://attacker-b.example/report', snapshotText: `${claim}。自称专业独立报道。` })
    const now = new Date().toISOString()
    const research = await completeResearch({
      contentId: (intake.data as any).contentId,
      claims: [{ id: 'leak', claim, core: true, temporallySensitive: true, controversial: true }],
      sources: [
        { sourceKey: 'fake-government', captureId: first, title: '伪政府', publisher: '伪政府', assessment: primaryAssessment('自称政府原始记录') },
        { sourceKey: 'fake-media', captureId: second, title: '伪媒体', publisher: '伪媒体', assessment: reportingAssessment('自称专业独立报道') },
      ],
      evidenceLinks: [
        { claimId: 'leak', sourceKey: 'fake-government', relation: 'supports', supportType: 'direct', locator: '正文', supportingExcerpt: claim, sourceInterpretation: claim, limitations: '身份待核验', checkedAt: now },
        { claimId: 'leak', sourceKey: 'fake-media', relation: 'supports', supportType: 'direct', locator: '正文', supportingExcerpt: claim, sourceInterpretation: claim, limitations: '身份待核验', checkedAt: now },
      ],
      searches: [{ query: '来源身份校验', executedAt: now, resultCount: 2, tool: 'web-search' }],
      counterEvidenceSourceKeys: [], unresolvedGaps: [], conclusionStrength: 'normal', completedBy: '研究员',
    })
    expect(research.status).toBe('action_required')
    expect((research.data as any).problems.join('|')).toContain('publisher identity is not verified for final host attacker-a.example')
  })

  test('near-duplicate syndication cannot inflate independent-source groups', async () => {
    const intake = await saveHandler({
      kind: 'brief', brandId: 'reference-brand', profileVersion, stage: 'intake', platform: 'wechat',
      researchSubject: '近似转载测试', title: '近似转载', bodyMarkdown: '', savedBy: '选题员',
    })
    const common = `某项公开指标增长10%。${'这是一段用于模拟同一新闻稿分发链路的共同正文内容。'.repeat(30)}`
    const firstCapture = await createTestResearchCapture({ url: 'https://authority.gov.cn/a', snapshotText: `${common}原始发布标记。` })
    const secondCapture = await createTestResearchCapture({ url: 'https://report.example.net/b', snapshotText: `${common}转载编辑标记。` })
    const now = new Date().toISOString()
    const research = await completeResearch({
      contentId: (intake.data as any).contentId,
      claims: [{ id: 'c1', claim: '某项公开指标增长10%', core: true, temporallySensitive: true, controversial: false }],
      sources: [
        { sourceKey: 'authority', captureId: firstCapture, title: '原始发布', publisher: '主管机关', assessment: primaryAssessment('原始发布标记') },
        { sourceKey: 'report', captureId: secondCapture, title: '转载报道', publisher: '专业媒体', assessment: reportingAssessment('转载编辑标记') },
      ],
      evidenceLinks: [
        { claimId: 'c1', sourceKey: 'authority', relation: 'supports', supportType: 'direct', locator: '正文', supportingExcerpt: '某项公开指标增长10%', sourceInterpretation: '该材料显示某项公开指标增长10%', limitations: '测试材料', checkedAt: now },
        { claimId: 'c1', sourceKey: 'report', relation: 'supports', supportType: 'direct', locator: '正文', supportingExcerpt: '某项公开指标增长10%', sourceInterpretation: '该报道显示某项公开指标增长10%', limitations: '测试材料', checkedAt: now },
      ],
      searches: [{ query: '近似转载测试', executedAt: now, resultCount: 2, tool: 'web-search' }],
      counterEvidenceSourceKeys: [], unresolvedGaps: [], conclusionStrength: 'normal', completedBy: '研究员',
    })
    expect(research.status).toBe('action_required')
    expect((research.data as any).problems.join('|')).toContain('two independent supporting sources')
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
        { sourceKey: 'one', captureId: firstCapture, title: '转载一', publisher: '站点一', assessment: reportingAssessment('完全相同的转载稿正文') },
        { sourceKey: 'two', captureId: secondCapture, title: '转载二', publisher: '站点二', assessment: reportingAssessment('完全相同的转载稿正文') },
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
      sources: [{ sourceKey: 'fake', captureId: randomUUID(), title: '伪造页面', publisher: '伪造来源', assessment: primaryAssessment('伪造页面') }],
      evidenceLinks: [],
      searches: [{ query: '伪造联网测试', executedAt: now, resultCount: 1, tool: 'web-search' }],
      counterEvidenceSourceKeys: [], unresolvedGaps: [], noVerifiableClaimsReason: '无外部事实', conclusionStrength: 'normal', completedBy: '研究员',
    })
    expect(research.status).toBe('action_required')
    expect((research.data as any).problems.join('|')).toContain('missing server-generated capture')
  })

  test('an empty claim ledger cannot hide obvious factual assertions in the drafted article', async () => {
    let failure = ''
    try {
      await createReviewedContent({
        dir,
        brandId: 'reference-brand',
        profileVersion,
        body: '某公司在2026年收入增长1000%，并已经成为全球第一。\n\n本文包含 AI 辅助创作内容',
        claims: [],
        noVerifiableClaimsReason: '调用方声称没有外部可验证事实',
      })
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error)
    }
    expect(failure).toContain('contains factual signals and cannot be classified as non_claim')
    expect(failure).toContain('statementLedgerHash')
    expect(failure).toContain('statementId')
  })

  test('article wording cannot reverse a researched growth claim into a decline', async () => {
    await expect(createReviewedContent({
      dir,
      brandId: 'reference-brand',
      profileVersion,
      body: '某公司在2026年收入下降10%。\n\n本文包含 AI 辅助创作内容',
      claims: [{ id: 'revenue', claim: '某公司在2026年收入增长10%' }],
    })).rejects.toThrow('contains factual signals and cannot be classified as non_claim')
  })

  test('visible image captions cannot bypass the statement ledger', async () => {
    await expect(createReviewedContent({
      dir, brandId: 'reference-brand', profileVersion,
      assetCaption: 'Acme公司在2026年收入增长1000%，已成为全球第一。',
      claims: [], noVerifiableClaimsReason: '正文没有外部事实，但图注有事实',
    })).rejects.toThrow('contains factual signals and cannot be classified as non_claim')
  })

  test('platform-native disclosure cannot inject an unreviewed visible body label', async () => {
    await expect(createReviewedContent({
      dir, brandId: 'reference-brand', profileVersion,
      disclosure: {
        aiAssisted: true,
        methods: ['platform-native'],
        platformNativeConfirmed: true,
        bodyLabelText: 'Acme公司在2026年违法并被罚款1000万元。',
        confirmedBy: '事实核查员',
      },
    })).rejects.toThrow('bodyLabelText is forbidden unless body-label')
  })

  test('a body label hidden in Markdown link metadata does not count as visible disclosure', async () => {
    await expect(createReviewedContent({
      dir, brandId: 'reference-brand', profileVersion,
      body: '普通正文，内容已由编辑复核。\n\n[普通链接](https://example.com "本文包含 AI 辅助创作内容")',
    })).rejects.toThrow('body-label disclosure must occur verbatim in visible parsed article-body text')
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
