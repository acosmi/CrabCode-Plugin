import { createHash, randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ResearchCaptureSchema, stableHash } from '../src/domain.ts'
import { appendRecord } from '../src/storage.ts'
import { saveHandler as saveProfile } from '../src/tools/profiles.ts'
import { saveHandler as saveContent } from '../src/tools/content.ts'
import { handler as completeResearch, getResearchReview } from '../src/tools/research.ts'
import { scanHandler } from '../src/tools/originality.ts'
import { handler as completeEditorialReview } from '../src/tools/editorial-review.ts'
import { renderHandler, verifyHandler } from '../src/tools/delivery.ts'

export const DISCLOSURE = '本文包含 AI 辅助创作内容'

export async function createTestResearchCapture(args: { url: string; snapshotText: string; capturedBy?: string }): Promise<string> {
  const captureId = randomUUID()
  const capturedAt = new Date().toISOString()
  const snapshotText = args.snapshotText.normalize('NFC').replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').trim()
  const bytes = new TextEncoder().encode(snapshotText)
  const withoutHash = {
    captureId,
    requestedUrl: args.url,
    finalUrl: args.url,
    httpStatus: 200,
    contentType: 'text/html',
    snapshotText,
    snapshotHash: stableHash(snapshotText),
    contentHash: createHash('sha256').update(bytes).digest('hex'),
    byteSize: bytes.byteLength,
    capturedAt,
    capturedBy: args.capturedBy ?? '测试抓取器',
  }
  const capture = ResearchCaptureSchema.parse({ ...withoutHash, captureHash: stableHash(withoutHash) })
  await appendRecord('research-captures', { id: captureId, ...capture })
  return captureId
}

export async function createProfile(brandId: string, bannedWords: string[] = []): Promise<string> {
  const saved = await saveProfile({
    brand_id: brandId,
    name: `${brandId} display`,
    persona: { identity: '可信观点媒体' },
    voice: { tone: '清晰克制' },
    audience: { segments: ['普通读者'] },
    columns: [{ name: '观点' }],
    platforms: [{ platform: 'wechat' }, { platform: 'xhs' }, { platform: 'toutiao' }],
    banned_words: bannedWords,
    compliance: { ai_label_text: DISCLOSURE },
    confirmedBy: '测试确认人',
  })
  return (saved.data as { profileVersion: string }).profileVersion
}

type TestClaim = { id: string; claim: string; status?: 'verified' | 'doubtful' | 'unsourced'; core?: boolean }

export async function createReviewedContent(args: {
  dir: string
  brandId: string
  profileVersion: string
  platform?: 'wechat' | 'xhs' | 'toutiao'
  title?: string
  body?: string
  claims?: TestClaim[]
  waivers?: Array<{ claimId: string; by: string; reason: string }>
  noVerifiableClaimsReason?: string
  disclosure?: any
  lateReviewedSummary?: string
  lateReviewedCitationUrl?: string
}): Promise<{ contentId: string; revisionId: string; contentHash: string; articleDocHash: string; assetPath: string; deliveryId: string; renderManifestHash: string }> {
  const platform = args.platform ?? 'wechat'
  const title = args.title ?? '一个经过审校的标题'
  const body = args.body ?? `这是经过审校的正文。\n\n${DISCLOSURE}`
  const researchSubject = `核验：${title}`
  const assetPath = join(args.dir, `cover-${Math.random().toString(16).slice(2)}.png`)
  // Valid PNG signature plus an IHDR-sized test payload; production code also records its exact bytes.
  await writeFile(assetPath, Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489', 'hex'))

  const intake = await saveContent({
    kind: 'variant', brandId: args.brandId, profileVersion: args.profileVersion, stage: 'intake', platform,
    researchSubject, title, bodyMarkdown: '', savedBy: '选题编辑',
  })
  if (intake.status !== 'ok') throw new Error(`intake failed: ${JSON.stringify(intake)}`)
  const contentId = (intake.data as any).contentId as string
  const now = new Date().toISOString()
  const claims = args.claims ?? []
  const snapshotText = claims.length ? `公开材料。${claims.map((claim) => claim.claim).join('。')}。` : '该测试稿为编辑流程样本，不包含外部可验证事实主张。'
  const sourceDrafts = claims.length ? [
    { sourceKey: 'official', url: 'https://example.gov.cn/official', title: '官方材料', publisher: '示例主管部门', originPublisher: '示例主管部门', sourceTier: 'authoritative' as const, isPrimary: true },
    { sourceKey: 'professional', url: 'https://news.example.com/report', title: '独立报道', publisher: '示例新闻机构', originPublisher: '示例新闻机构', sourceTier: 'professional' as const, isPrimary: false },
  ] : [
    { sourceKey: 'context', url: 'https://example.org/context', title: '流程背景材料', publisher: '示例资料库', originPublisher: '示例资料库', sourceTier: 'context' as const, isPrimary: false },
  ]
  const sources = await Promise.all(sourceDrafts.map(async ({ url, ...source }) => ({
    ...source,
    captureId: await createTestResearchCapture({ url, snapshotText: `${snapshotText}\n${source.sourceKey} 独立来源记录。` }),
  })))
  const evidenceLinks = claims.flatMap((claim) => sources.map((source) => ({
    claimId: claim.id,
    sourceKey: source.sourceKey,
    relation: 'supports' as const,
    supportType: 'direct' as const,
    locator: `${source.sourceKey}-${claim.id}`,
    supportingExcerpt: claim.claim,
    sourceInterpretation: `该来源直接陈述：${claim.claim}`,
    limitations: '仅用于测试确定性证据绑定，不代表真实事件。',
    checkedAt: now,
  })))
  const researchEnv = await completeResearch({
    contentId,
    claims: claims.map((claim) => ({ id: claim.id, claim: claim.claim, core: claim.core ?? true, temporallySensitive: false, controversial: false })),
    sources,
    evidenceLinks,
    searches: [{ query: researchSubject, executedAt: now, resultCount: sources.length, tool: 'web-search' }],
    counterEvidenceSourceKeys: [],
    unresolvedGaps: [],
    ...(claims.length ? {} : { noVerifiableClaimsReason: args.noVerifiableClaimsReason ?? '该测试稿没有外部可验证事实主张' }),
    conclusionStrength: 'normal',
    completedBy: '研究员',
  })
  if (researchEnv.status !== 'ok') throw new Error(`research failed: ${JSON.stringify(researchEnv)}`)
  const researchId = (researchEnv.data as any).researchId as string
  const research = await getResearchReview(researchId)
  if (!research) throw new Error('research record missing')
  const citations = research.sources.map((source) => ({
    sourceId: source.sourceId,
    url: source.finalUrl,
    title: source.title,
    publisher: source.publisher,
    ...(source.publishedAt ? { publishedAt: source.publishedAt } : {}),
    accessedAt: source.accessedAt,
  }))
  const researched = await saveContent({
    contentId, expectedRevision: 1, kind: 'variant', brandId: args.brandId, profileVersion: args.profileVersion,
    stage: 'researched', platform, researchSubject, researchId, title, bodyMarkdown: '', citations, savedBy: '研究编排员',
  })
  if (researched.status !== 'ok') throw new Error(`researched save failed: ${JSON.stringify(researched)}`)
  const drafted = await saveContent({
    contentId, expectedRevision: 2, kind: 'variant', brandId: args.brandId, profileVersion: args.profileVersion,
    stage: 'drafted', platform, researchSubject, researchId, title, bodyMarkdown: body, citations,
    assets: [{ path: assetPath, role: 'cover', rightsStatus: 'owned', alt: '文章封面图' }], savedBy: '测试编辑',
  })
  if (drafted.status !== 'ok') throw new Error(`draft save failed: ${JSON.stringify(drafted)}`)
  const scan = await scanHandler({ contentId, createdBy: '原创扫描员' })
  if (scan.status !== 'ok') throw new Error(`scan failed: ${JSON.stringify(scan)}`)
  const scanId = (scan.data as any).scanId as string
  const factClaims = claims.map((claim) => ({
    id: claim.id,
    claim: claim.claim,
    status: claim.status ?? 'verified',
    evidenceLinkIds: claim.status && claim.status !== 'verified' ? [] : research.evidenceLinks
      .filter((link) => link.claimId === claim.id && link.relation === 'supports')
      .map((link) => `${link.sourceId}:${link.locator}`),
  }))
  const disclosure = args.disclosure ?? { aiAssisted: true, methods: ['body-label'], bodyLabelText: DISCLOSURE, confirmedBy: '事实核查员', ruleVersion: 'cac-2025' }
  const editorial = await completeEditorialReview({
    contentId,
    originalityScanId: scanId,
    claims: factClaims,
    ...(claims.length ? {} : { noVerifiableClaimsReason: args.noVerifiableClaimsReason ?? '该测试稿没有外部可验证事实主张' }),
    waivers: args.waivers ?? [],
    legalReview: { status: 'not_required', reviewedBy: '事实核查员', reviewedAt: now, riskLevel: 'low', notes: [] },
    aiDisclosure: disclosure,
    completedBy: '事实核查员',
  })
  if (editorial.status !== 'ok') throw new Error(`editorial review failed: ${JSON.stringify(editorial)}`)
  const editorialReviewId = (editorial.data as any).reviewId as string
  const reviewed = await saveContent({
    contentId, expectedRevision: 3, kind: 'variant', brandId: args.brandId, profileVersion: args.profileVersion,
    stage: 'reviewed', platform, researchSubject, researchId, originalityScanId: scanId, editorialReviewId,
    title, bodyMarkdown: body,
    ...(args.lateReviewedSummary ? { summary: args.lateReviewedSummary } : {}),
    citations: args.lateReviewedCitationUrl ? citations.map((citation, index) => index === 0 ? { ...citation, url: args.lateReviewedCitationUrl! } : citation) : citations,
    savedBy: '发布编排员',
  })
  if (reviewed.status !== 'ok') throw new Error(`reviewed save failed: ${JSON.stringify(reviewed)}`)
  const delivery = await renderHandler({ contentId, generatedBy: '排版员' })
  if (delivery.status !== 'ok') throw new Error(`delivery render failed: ${JSON.stringify(delivery)}`)
  const deliveryId = (delivery.data as any).deliveryId as string
  const verified = await verifyHandler({
    deliveryId,
    verifiedBy: '视觉复核员',
    visualReviewStatus: 'passed',
    viewports: [
      { width: 320, height: 720, noHorizontalOverflow: true, whiteBackground: true, readable: true },
      { width: 768, height: 1024, noHorizontalOverflow: true, whiteBackground: true, readable: true },
      { width: 1440, height: 900, noHorizontalOverflow: true, whiteBackground: true, readable: true },
    ],
    printChecked: true,
    notes: ['测试夹具：静态与多视口视觉门禁通过'],
  })
  if (verified.status !== 'ok') throw new Error(`delivery verify failed: ${JSON.stringify(verified)}`)
  return {
    contentId,
    revisionId: (reviewed.data as any).revisionId,
    contentHash: (reviewed.data as any).contentHash,
    articleDocHash: (reviewed.data as any).articleDocHash,
    assetPath,
    deliveryId,
    renderManifestHash: (verified.data as any).renderManifestHash,
  }
}
