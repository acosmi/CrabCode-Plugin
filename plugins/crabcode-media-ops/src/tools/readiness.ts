import { z } from 'zod'
import { actionRequired, err, ok, type Envelope } from '../envelope.ts'
import type { ContentManifest, ContentManifestV2 } from '../domain.ts'
import { getPlatform, platformIds, type PlatformDescriptor } from '../platforms/registry.ts'
import { getLatestContent } from './content.ts'
import { getLatestVerifiedDelivery, verifyDeliveryBytes } from './delivery.ts'
import { getEditorialReview } from './editorial-review.ts'
import { getOriginalityScan, originalityScanPasses } from './originality.ts'
import { loadProfile } from './profiles.ts'
import { getResearchReview } from './research.ts'

export const name = 'mediaops.readiness.inspect'
export const description =
  'Run the fail-closed Media Gate against tool-generated, hash-bound research, originality, editorial and verified HTML-delivery records for the latest v2 revision.'
export const inputSchema = {
  contentId: z.string().uuid(),
  platform: z.enum(['wechat', 'xhs', 'toutiao']).optional(),
}

export type ReadinessIssue = { code: string; severity: 'error' | 'warning'; message: string }

function isV2(content: ContentManifest): content is ContentManifestV2 {
  return 'schemaVersion' in content && content.schemaVersion === 2
}

function daysBetween(now: Date, thenIso: string): number {
  return (now.getTime() - new Date(thenIso).getTime()) / 86_400_000
}

function citationUrlIdentity(value: string): string {
  const url = new URL(value)
  url.hash = ''
  url.hostname = url.hostname.toLowerCase()
  if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) url.port = ''
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '')
  url.searchParams.sort()
  return url.toString()
}

function addStructuralIssues(content: ContentManifestV2, platform: PlatformDescriptor, issues: ReadinessIssue[]): void {
  const severity = platform.rules.some((rule) => rule.ruleType !== 'editorial-guidance') ? 'error' : 'warning'
  const titleLength = [...content.title].length
  const bodyLength = [...content.bodyMarkdown].length
  if (titleLength > platform.limits.titleMax) issues.push({ code: 'TITLE_TOO_LONG', severity, message: `Title has ${titleLength} characters; ${platform.displayName} threshold is ${platform.limits.titleMax}.` })
  if (bodyLength > platform.limits.bodyMaxChars) issues.push({ code: 'BODY_TOO_LONG', severity, message: `Body has ${bodyLength} characters; ${platform.displayName} threshold is ${platform.limits.bodyMaxChars}.` })
  if (content.assets.length > platform.limits.imageMaxCount) issues.push({ code: 'TOO_MANY_IMAGES', severity, message: `${content.assets.length} assets exceeds ${platform.limits.imageMaxCount}.` })
  if (platform.limits.coverRequired && !content.assets.some((asset) => asset.role === 'cover')) issues.push({ code: 'COVER_MISSING', severity, message: `${platform.displayName} requires or operationally expects a cover asset.` })
  if (content.assets.some((asset) => asset.rightsStatus === 'pending')) issues.push({ code: 'ASSET_RIGHTS_PENDING', severity: 'error', message: 'Every delivered asset must have resolved rights.' })
}

function addDisclosureIssues(content: ContentManifestV2, issues: ReadinessIssue[]): void {
  const disclosure = content.aiDisclosure
  if (!disclosure) {
    issues.push({ code: 'AI_DISCLOSURE_REQUIRED', severity: 'error', message: 'AI-assistance status and disclosure method are missing from the independent editorial review.' })
    return
  }
  if (!disclosure.aiAssisted) return
  if (!disclosure.confirmedBy || !disclosure.methods.length) {
    issues.push({ code: 'AI_DISCLOSURE_REQUIRED', severity: 'error', message: 'AI-assisted content needs a named, confirmed disclosure method.' })
    return
  }
  const confirmed = disclosure.methods.some((method) => {
    if (method === 'body-label') return Boolean(disclosure.bodyLabelText && content.bodyMarkdown.includes(disclosure.bodyLabelText) && content.articleDoc.disclosures.includes(disclosure.bodyLabelText))
    if (method === 'platform-native') return disclosure.platformNativeConfirmed === true
    return disclosure.fileMetadataConfirmed === true
  })
  if (!confirmed) issues.push({ code: 'AI_DISCLOSURE_REQUIRED', severity: 'error', message: 'The declared disclosure is not confirmed in its bound channel/body artifact.' })
}

export async function inspectContent(content: ContentManifest, platform: PlatformDescriptor, now = new Date()): Promise<ReadinessIssue[]> {
  const issues: ReadinessIssue[] = []
  if (!isV2(content)) return [{ code: 'SCHEMA_UPGRADE_REQUIRED', severity: 'error', message: 'Legacy schema-v1 content cannot enter the v2 approval/delivery gate.' }]
  if (content.stage !== 'reviewed') issues.push({ code: 'EDITORIAL_REVIEW_REQUIRED', severity: 'error', message: `Content stage is ${content.stage}; reviewed is required.` })
  if (content.platform && content.platform !== platform.id) issues.push({ code: 'PACKAGE_INPUT_MISMATCH', severity: 'error', message: `Content targets ${content.platform}, not ${platform.id}.` })
  for (const rule of platform.rules) {
    if (daysBetween(now, rule.verifiedAt) > rule.maxAgeDays) issues.push({ code: 'PLATFORM_RULES_STALE', severity: 'error', message: `Rule ${rule.id} is stale; re-verify ${rule.sourceUrl} before approval.` })
  }
  addStructuralIssues(content, platform, issues)

  let research = null
  if (!content.researchId || !content.researchBundleHash) {
    issues.push({ code: 'RESEARCH_EVIDENCE_REQUIRED', severity: 'error', message: 'No completed research bundle is bound to this revision.' })
  } else {
    research = await getResearchReview(content.researchId)
    if (!research || research.status !== 'completed' || research.contentId !== content.contentId || research.researchBundleHash !== content.researchBundleHash) {
      issues.push({ code: 'RESEARCH_STALE', severity: 'error', message: 'Research is missing, incomplete, belongs elsewhere or failed hash binding.' })
    }
  }

  let scan = null
  if (!content.originalityScanId) {
    issues.push({ code: 'ORIGINALITY_REVIEW_REQUIRED', severity: 'error', message: 'No tool-generated originality scan is bound to this revision.' })
  } else {
    scan = await getOriginalityScan(content.originalityScanId)
    if (!scan || scan.contentId !== content.contentId || scan.subjectHash !== content.originalitySubjectHash || !originalityScanPasses(scan)) {
      issues.push({ code: 'ORIGINALITY_REVIEW_REQUIRED', severity: 'error', message: 'Originality evidence is stale, mismatched, blocked or missing its required independent human decision.' })
    }
  }

  let editorial = null
  if (!content.editorialReviewId) {
    issues.push({ code: 'EDITORIAL_REVIEW_REQUIRED', severity: 'error', message: 'No independent editorial review record is bound to this revision.' })
  } else {
    editorial = await getEditorialReview(content.editorialReviewId)
    if (!editorial || editorial.contentId !== content.contentId || editorial.subjectHash !== content.originalitySubjectHash || editorial.originalityScanId !== content.originalityScanId || editorial.factReview.researchBundleHash !== content.researchBundleHash) {
      issues.push({ code: 'EDITORIAL_REVIEW_STALE', severity: 'error', message: 'Editorial review no longer binds to this article, originality scan and research bundle.' })
    }
  }

  if (editorial) {
    if (editorial.legalReview.status === 'required' || (editorial.legalReview.riskLevel === 'high' && editorial.legalReview.status !== 'completed')) {
      issues.push({ code: 'LEGAL_REVIEW_REQUIRED', severity: 'error', message: 'Specialist legal-risk routing is incomplete.' })
    }
    const waivers = new Map(editorial.factReview.waivers.map((waiver) => [waiver.claimId, waiver]))
    for (const claim of editorial.factReview.claims) {
      if (claim.status !== 'verified') {
        const waiver = waivers.get(claim.id)
        if (!waiver) issues.push({ code: 'UNRESOLVED_CLAIMS', severity: 'error', message: `Claim ${claim.id} remains ${claim.status} without a named waiver.` })
        else issues.push({ code: 'UNRESOLVED_CLAIMS_WAIVED', severity: 'warning', message: `Claim ${claim.id} was waived by ${waiver.by}: ${waiver.reason}` })
      }
    }
  }
  if (research && editorial) {
    const sourceById = new Map(research.sources.map((source) => [source.sourceId, source]))
    const sourceByUrl = new Map(research.sources.flatMap((source) => [
      [citationUrlIdentity(source.canonicalUrl), source],
      [citationUrlIdentity(source.finalUrl), source],
    ] as const))
    const validCitationSourceIds = new Set<string>()
    for (const citation of content.citations) {
      const byId = citation.sourceId ? sourceById.get(citation.sourceId) : undefined
      const byUrl = sourceByUrl.get(citationUrlIdentity(citation.url))
      if (citation.sourceId && !byId) {
        issues.push({ code: 'SOURCE_CITATION_INVALID', severity: 'error', message: `Citation ${citation.title} names an unknown research sourceId.` })
      } else if (byId && byId.sourceId !== byUrl?.sourceId) {
        issues.push({ code: 'SOURCE_CITATION_INVALID', severity: 'error', message: `Citation ${citation.title} URL does not match its bound research sourceId.` })
      } else if (!byUrl) {
        issues.push({ code: 'SOURCE_CITATION_INVALID', severity: 'error', message: `Citation ${citation.title} was not opened and recorded in the bound research bundle.` })
      } else {
        validCitationSourceIds.add(byUrl.sourceId)
      }
    }
    for (const claim of editorial.factReview.claims.filter((item) => item.status === 'verified')) {
      for (const linkId of claim.evidenceLinkIds) {
        const sourceId = linkId.split(':', 1)[0]
        const source = sourceById.get(sourceId)
        if (!source || !validCitationSourceIds.has(source.sourceId)) {
          issues.push({ code: 'SOURCE_CITATION_MISSING', severity: 'error', message: `Verified claim ${claim.id} uses evidence ${linkId} that is absent from reader-visible citations.` })
        }
      }
    }
  }
  addDisclosureIssues(content, issues)

  const profile = await loadProfile(content.brandId, content.profileVersion)
  if (!profile) issues.push({ code: 'PROFILE_REQUIRED', severity: 'error', message: `Profile ${content.brandId}@${content.profileVersion} does not exist.` })
  else {
    const scanned = `${content.title}\n${content.summary ?? ''}\n${content.bodyMarkdown}`
    const found = profile.banned_words.filter((word) => word.trim() && scanned.includes(word))
    if (found.length) issues.push({ code: 'BANNED_WORD_PRESENT', severity: 'error', message: `Banned words present: ${found.join('、')}.` })
  }

  const delivery = await getLatestVerifiedDelivery(content.contentId, content.revisionId)
  if (!delivery || delivery.contentHash !== content.contentHash || delivery.articleDocHash !== content.articleDocHash) {
    issues.push({ code: 'DELIVERY_VERIFICATION_REQUIRED', severity: 'error', message: 'No verified white-background HTML-primary/Markdown-backup delivery manifest binds to this exact revision.' })
  } else {
    try {
      await verifyDeliveryBytes(delivery)
    } catch (error) {
      issues.push({ code: 'DELIVERY_INTEGRITY_FAILED', severity: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }
  return issues
}

export async function handler(args: { contentId: string; platform?: 'wechat' | 'xhs' | 'toutiao' }): Promise<Envelope> {
  const content = await getLatestContent(args.contentId)
  if (!content) return err('NOT_FOUND', `No content ${args.contentId}.`)
  const platformId = args.platform ?? content.platform
  if (!platformId) return err('PACKAGE_INPUT_MISMATCH', 'No target platform is recorded or supplied.')
  const platform = getPlatform(platformId)
  if (!platform) return err('UNKNOWN_PLATFORM', `Unknown platform '${platformId}'. Known: ${platformIds().join(', ')}`)
  const issues = await inspectContent(content, platform)
  const delivery = 'schemaVersion' in content && content.schemaVersion === 2 ? await getLatestVerifiedDelivery(content.contentId, content.revisionId) : null
  const data = {
    contentId: content.contentId,
    revisionId: content.revisionId,
    contentHash: content.contentHash,
    platform: platform.id,
    ruleVersion: platform.ruleVersion,
    ready: issues.every((issue) => issue.severity !== 'error'),
    issues,
    ...(delivery ? {
      deliveryId: delivery.deliveryId,
      renderManifestHash: delivery.renderManifestHash,
      primaryArtifact: delivery.primaryArtifact,
      backupArtifact: delivery.backupArtifact,
    } : {}),
  }
  return data.ready ? ok(data) : actionRequired(data)
}
