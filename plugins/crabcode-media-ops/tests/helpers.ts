import { createHash, randomUUID } from 'node:crypto'
import { setDefaultTimeout } from 'bun:test'
import { realpath, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DeliveryManifestSchema, ResearchCaptureSchema, ResearchReviewSchema, stableHash } from '../src/domain.ts'
import { extractVerifiableStatements, factualCompatibility } from '../src/factual-integrity.ts'
import { bodyPlainText } from '../src/rendering/article-doc.ts'
import { appendRecord } from '../src/storage.ts'
import { saveHandler as saveProfile } from '../src/tools/profiles.ts'
import { getLatestContent, saveHandler as saveContent } from '../src/tools/content.ts'
import { getHandler as getResearch, handler as completeResearch } from '../src/tools/research.ts'
import { scanHandler } from '../src/tools/originality.ts'
import { handler as completeEditorialReview } from '../src/tools/editorial-review.ts'
import {
  deliveryHashPayload,
  getDeliveryManifest,
  renderHandler,
  resolveMediaOpsQaMode,
  verifyHandler,
} from '../src/tools/delivery.ts'
import type { TrustedPrincipal } from '../src/identity.ts'

export const DISCLOSURE = '本文包含 AI 辅助创作内容'
// Business fixtures no longer launch Chromium; full-QA suites raise timeout via package scripts.
setDefaultTimeout(60_000)

export function testPrincipal(principalId: string, roles: string[] = ['*']): TrustedPrincipal {
  const normalized = principalId.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()
  return {
    principalId: normalized,
    actorKey: `test-issuer:${normalized}`,
    displayName: principalId,
    issuer: 'test-issuer',
    roles,
    assurance: 'host_principal',
  }
}

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
    connectedAddress: '93.184.216.34',
    resolvedAddresses: ['93.184.216.34'],
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

/**
 * Replace a candidate's QA evidence with full-grade fixture evidence.
 *
 * The Media Gate requires `qaEvidence.mode === 'full'` before approval, and full
 * mode means a real Nu + Playwright/axe run — which this machine cannot do in the
 * default suite (that is what `MEDIAOPS_QA_MODE=static` exists for). Suites about
 * the *approval state machine* (approval/package/readiness/preview) still need a
 * delivery that a real full run would have produced, so the fixture mints one
 * here rather than letting static evidence quietly count as full — the exact
 * confusion 0.4.4 removed from production.
 *
 * The written reports say plainly that they are fixtures; nothing in src/ can
 * produce them. Under `MEDIAOPS_QA_MODE=full` this is a no-op and the real
 * evidence stands (tests/delivery.qa.test.ts).
 */
export async function mintFullQaEvidenceFixture(deliveryId: string): Promise<string> {
  const manifest = await getDeliveryManifest(deliveryId)
  if (!manifest) throw new Error(`qa fixture: no delivery ${deliveryId}`)
  if (manifest.qaEvidence?.mode === 'full') return manifest.renderManifestHash
  const root = await realpath(manifest.artifactRoot)
  const htmlSha256 = manifest.primaryArtifact.artifactHash
  const completedAt = new Date().toISOString()
  const fixtureNote = 'TEST FIXTURE: stands in for a real Nu/Playwright/axe run; produced by tests/helpers.ts, never by src/.'
  const checks = [
    { id: 'nu-html-validity', status: 'passed' as const, detail: `${fixtureNote} Nu reported no errors for ${htmlSha256}.` },
    { id: 'axe-accessibility', status: 'passed' as const, detail: `${fixtureNote} axe-core reported no violations.` },
    { id: 'viewport-matrix', status: 'passed' as const, detail: `${fixtureNote} light/dark, 320/768/1440 and print all clean.` },
  ]
  const bodies: Array<[string, unknown]> = [
    ['qa/nu-report.json', { schemaVersion: 'mediaops-nu-qa@1', fixture: true, status: 'passed', htmlSha256, completedAt, detail: fixtureNote }],
    ['qa/browser-report.json', { schemaVersion: 'mediaops-browser-qa@1', fixture: true, status: 'passed', mode: 'full', htmlSha256, completedAt, detail: fixtureNote }],
    ['qa/summary.json', { schemaVersion: 'mediaops-delivery-qa-summary@1', fixture: true, status: 'passed', mode: 'full', htmlSha256, generatedAt: completedAt, checks, errors: [] }],
  ]
  await rm(join(root, 'qa', 'static-report.json'), { force: true })
  const artifacts = []
  for (const [relativePath, body] of bodies) {
    const bytes = new TextEncoder().encode(JSON.stringify(body, null, 2) + '\n')
    await writeFile(join(root, relativePath), bytes)
    artifacts.push({
      relativePath,
      mediaType: 'application/json',
      byteSize: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    })
  }
  const { renderManifestHash: _previous, ...withoutHash } = manifest
  const promotedWithoutHash = {
    ...withoutHash,
    checks: [
      ...manifest.checks.filter((item) => !item.id.startsWith('automated-')),
      ...checks.map((item) => ({ id: `automated-${item.id}`, status: item.status, detail: item.detail })),
      { id: 'automated-qa-source-binding', status: 'passed' as const, detail: `${fixtureNote} Evidence binds to primary HTML ${htmlSha256}.` },
    ],
    qaEvidence: {
      schemaVersion: 'mediaops-delivery-qa-evidence@1' as const,
      status: 'passed' as const,
      mode: 'full' as const,
      htmlSha256,
      tools: manifest.qaEvidence?.tools ?? { java: null, vnuPackage: '26.7.15', vnuRuntime: null, playwright: '1.61.1', chromium: null, axe: '4.12.1' },
      checks,
      artifacts,
      completedAt,
    },
  }
  const renderManifestHash = stableHash(deliveryHashPayload(promotedWithoutHash))
  const promoted = DeliveryManifestSchema.parse({ ...promotedWithoutHash, renderManifestHash })
  await writeFile(join(root, 'delivery-manifest.json'), JSON.stringify(promoted, null, 2) + '\n', 'utf8')
  await appendRecord('delivery-manifests', { id: randomUUID(), ...promoted })
  return renderManifestHash
}

/**
 * deliveryMode:
 * - none: stop after reviewed (no deliveryId)
 * - render-only (default): freeze/render delivery candidate without verify/QA
 * - verified: call delivery.verify, then mint full-grade QA evidence when the
 *   run was not MEDIAOPS_QA_MODE=full, so the Media Gate sees what a real full
 *   run would have produced (see mintFullQaEvidenceFixture)
 * - verified-static: call delivery.verify and keep whatever grade it produced —
 *   for tests about the evidence grade itself
 */
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
  assetCaption?: string
  deliveryMode?: 'none' | 'render-only' | 'verified' | 'verified-static'
}): Promise<{ contentId: string; revisionId: string; contentHash: string; articleDocHash: string; assetPath: string; deliveryId: string; renderManifestHash: string }> {
  const deliveryMode = args.deliveryMode ?? 'render-only'
  const platform = args.platform ?? 'wechat'
  const title = args.title ?? '一个经过审校的标题'
  const body = args.body ?? `这是经过审校的正文。\n\n${DISCLOSURE}`
  const researchSubject = `核验：${title}`
  const assetPath = join(args.dir, `cover-${Math.random().toString(16).slice(2)}.png`)
  // Valid PNG signature plus an IHDR-sized test payload; production code also records its exact bytes.
  await writeFile(assetPath, Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489', 'hex'))
  const canonicalAssetPath = await realpath(assetPath)
  const publishBody = args.assetCaption ? `${body}\n\n![文中配图](${canonicalAssetPath})` : body

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
    {
      sourceKey: 'official', url: 'https://example.gov.cn/official', title: '官方材料', publisher: '示例主管部门',
      assessment: { publisherType: 'government' as const, sourceFunction: 'original_record' as const, originRelationship: 'original' as const, basisExcerpt: 'official 独立来源记录', classificationRationale: '该页面由测试主管部门发布并承载原始公开记录，按一手记录归类。' },
    },
    {
      sourceKey: 'professional', url: 'https://news.example.com/report', title: '独立报道', publisher: '示例新闻机构',
      assessment: { publisherType: 'professional_media' as const, sourceFunction: 'independent_reporting' as const, originRelationship: 'original' as const, basisExcerpt: 'professional 独立来源记录', classificationRationale: '该页面由独立测试新闻机构采写，按专业媒体独立报道归类。' },
    },
  ] : [{
    sourceKey: 'context', url: 'https://example.org/context', title: '流程背景材料', publisher: '示例资料库',
    assessment: { publisherType: 'unknown' as const, sourceFunction: 'context' as const, originRelationship: 'original' as const, basisExcerpt: 'context 独立来源记录', classificationRationale: '该页面仅作为测试流程背景材料，不被计为强证据或一手来源。' },
  }]
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
  const retrievedResearch = await getResearch({ researchId })
  if (retrievedResearch.status !== 'ok') throw new Error(`research record missing: ${JSON.stringify(retrievedResearch)}`)
  const research = ResearchReviewSchema.parse((retrievedResearch.data as any).research)
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
    stage: 'drafted', platform, researchSubject, researchId, title, bodyMarkdown: publishBody, citations,
    assets: [{ path: assetPath, role: args.assetCaption ? 'inline' : 'cover', rightsStatus: 'owned', alt: '文章封面图', ...(args.assetCaption ? { caption: args.assetCaption } : {}) }], savedBy: '测试编辑',
  })
  if (drafted.status !== 'ok') throw new Error(`draft save failed: ${JSON.stringify(drafted)}`)
  const scan = await scanHandler({ contentId, createdBy: '原创扫描员' })
  if (scan.status !== 'ok') throw new Error(`scan failed: ${JSON.stringify(scan)}`)
  const scanId = (scan.data as any).scanId as string
  const draftedContent = await getLatestContent(contentId)
  if (!draftedContent || !('schemaVersion' in draftedContent) || draftedContent.schemaVersion !== 2) throw new Error('drafted content missing')
  const statements = extractVerifiableStatements({ title: draftedContent.title, ...(draftedContent.summary ? { summary: draftedContent.summary } : {}), bodyText: bodyPlainText(draftedContent.articleDoc) })
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
    statementCoverage: statements.map((statement) => {
      const claimIds = factClaims.filter((claim) => factualCompatibility(statement.text, claim.claim).length === 0).map((claim) => claim.id)
      return claimIds.length ? {
        statementId: statement.statementId,
        classification: 'verified_fact' as const,
        claimIds,
        directionConfirmed: true as const,
        rationale: '测试事实核查员逐项确认文章陈述与某一条完整研究主张在主体、数值、动作和极性上一致。',
      } : {
        statementId: statement.statementId,
        classification: 'non_claim' as const,
        claimIds: [],
        rationale: '测试事实核查员确认该可见文本只是标题、栏目、图像替代文本、来源标签或披露标签，不表达外部事实主张。',
      }
    }),
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
    title, bodyMarkdown: publishBody,
    ...(args.lateReviewedSummary ? { summary: args.lateReviewedSummary } : {}),
    citations: args.lateReviewedCitationUrl ? citations.map((citation, index) => index === 0 ? { ...citation, url: args.lateReviewedCitationUrl! } : citation) : citations,
    savedBy: '发布编排员',
  })
  if (reviewed.status !== 'ok') throw new Error(`reviewed save failed: ${JSON.stringify(reviewed)}`)
  const base = {
    contentId,
    revisionId: (reviewed.data as any).revisionId as string,
    contentHash: (reviewed.data as any).contentHash as string,
    articleDocHash: (reviewed.data as any).articleDocHash as string,
    assetPath,
  }
  if (deliveryMode === 'none') {
    return { ...base, deliveryId: '', renderManifestHash: '' }
  }
  const delivery = await renderHandler({ contentId, generatedBy: '排版员' })
  if (delivery.status !== 'ok') throw new Error(`delivery render failed: ${JSON.stringify(delivery)}`)
  const deliveryId = (delivery.data as any).deliveryId as string
  const renderedManifestHash = (delivery.data as any).renderManifestHash as string
  if (deliveryMode === 'render-only') {
    return { ...base, deliveryId, renderManifestHash: renderedManifestHash }
  }
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
  const verifiedManifestHash = (verified.data as any).renderManifestHash as string
  if (deliveryMode === 'verified-static' || resolveMediaOpsQaMode() === 'full') {
    return { ...base, deliveryId, renderManifestHash: verifiedManifestHash }
  }
  return { ...base, deliveryId, renderManifestHash: await mintFullQaEvidenceFixture(deliveryId) }
}
