import { z } from 'zod'
import { actionRequired, err, ok, type Envelope } from '../envelope.ts'
import type { ContentManifest } from '../domain.ts'
import { getPlatform, platformIds, type PlatformDescriptor } from '../platforms/registry.ts'
import { getLatestContent } from './content.ts'
import { loadProfile } from './profiles.ts'

export const name = 'mediaops.readiness.inspect'
export const description =
  'Run the complete Media Gate against the latest stored content revision. Omitted reviews are never treated as clean.'
export const inputSchema = {
  contentId: z.string().uuid(),
  platform: z.enum(['wechat', 'xhs', 'toutiao']).optional(),
  now: z.string().datetime().optional().describe('Deterministic audit clock; normally omitted.'),
}

type Issue = { code: string; severity: 'error' | 'warning'; message: string }

function daysBetween(now: Date, thenIso: string): number {
  return (now.getTime() - new Date(thenIso).getTime()) / 86_400_000
}

function addStructuralIssues(content: ContentManifest, platform: PlatformDescriptor, issues: Issue[]): void {
  const severity = platform.rules.some((r) => r.ruleType !== 'editorial-guidance') ? 'error' : 'warning'
  const titleLen = [...content.title].length
  const bodyLen = [...content.bodyMarkdown].length
  if (titleLen > platform.limits.titleMax) {
    issues.push({ code: 'TITLE_TOO_LONG', severity, message: `Title has ${titleLen} characters; current ${platform.displayName} threshold is ${platform.limits.titleMax}.` })
  }
  if (bodyLen > platform.limits.bodyMaxChars) {
    issues.push({ code: 'BODY_TOO_LONG', severity, message: `Body has ${bodyLen} characters; current ${platform.displayName} threshold is ${platform.limits.bodyMaxChars}.` })
  }
  if (content.assets.length > platform.limits.imageMaxCount) {
    issues.push({ code: 'TOO_MANY_IMAGES', severity, message: `${content.assets.length} assets exceeds the current threshold of ${platform.limits.imageMaxCount}.` })
  }
  if (platform.limits.coverRequired && !content.assets.some((asset) => asset.role === 'cover')) {
    issues.push({ code: 'COVER_MISSING', severity, message: `${platform.displayName} requires or operationally expects a cover asset.` })
  }
}

function addReviewIssues(content: ContentManifest, issues: Issue[]): void {
  const review = content.review
  if (!review || review.status !== 'completed') {
    issues.push({ code: 'REVIEW_REQUIRED', severity: 'error', message: 'A completed fact-check review record is required.' })
    return
  }
  if (review.claims.length === 0 && !review.noVerifiableClaimsReason?.trim()) {
    issues.push({ code: 'REVIEW_REQUIRED', severity: 'error', message: 'An empty claim ledger must explicitly explain why no verifiable claims were found.' })
  }
  const waiverByClaim = new Map(review.waivers.map((waiver) => [waiver.claimId, waiver]))
  for (const claim of review.claims) {
    if (claim.status === 'verified' && !claim.sourceUrl) {
      issues.push({ code: 'UNRESOLVED_CLAIMS', severity: 'error', message: `Verified claim ${claim.id} is missing sourceUrl.` })
    }
    if (claim.status !== 'verified') {
      const waiver = waiverByClaim.get(claim.id)
      if (!waiver) {
        issues.push({ code: 'UNRESOLVED_CLAIMS', severity: 'error', message: `Claim ${claim.id} remains ${claim.status} without a named, reasoned waiver bound to this revision.` })
      } else {
        issues.push({ code: 'UNRESOLVED_CLAIMS_WAIVED', severity: 'warning', message: `Claim ${claim.id} was waived by ${waiver.by}: ${waiver.reason}` })
      }
    }
  }
  if (!content.originalityReview || content.originalityReview.status !== 'completed' || content.originalityReview.conclusion !== 'publishable') {
    issues.push({ code: 'ORIGINALITY_REVIEW_REQUIRED', severity: 'error', message: 'A completed originality review with a publishable conclusion is required.' })
  }
  const legal = content.legalReview
  if (!legal || legal.status === 'required' || (legal.riskLevel === 'high' && legal.status !== 'completed')) {
    issues.push({ code: 'LEGAL_REVIEW_REQUIRED', severity: 'error', message: 'Legal-risk routing is incomplete or still requires specialist review.' })
  }
}

function addDisclosureIssues(content: ContentManifest, issues: Issue[]): void {
  const disclosure = content.aiDisclosure
  if (!disclosure) {
    issues.push({ code: 'AI_DISCLOSURE_REQUIRED', severity: 'error', message: 'AI-assistance status and disclosure method must be recorded.' })
    return
  }
  if (!disclosure.aiAssisted) return
  if (!disclosure.confirmedBy || disclosure.methods.length === 0) {
    issues.push({ code: 'AI_DISCLOSURE_REQUIRED', severity: 'error', message: 'AI-assisted content requires at least one declared method and named confirmation.' })
    return
  }
  const valid = disclosure.methods.some((method) => {
    if (method === 'body-label') return Boolean(disclosure.bodyLabelText && content.bodyMarkdown.includes(disclosure.bodyLabelText))
    if (method === 'platform-native') return disclosure.platformNativeConfirmed === true
    return disclosure.fileMetadataConfirmed === true
  })
  if (!valid) {
    issues.push({ code: 'AI_DISCLOSURE_REQUIRED', severity: 'error', message: 'The recorded AI disclosure method has not been confirmed or is absent from the content.' })
  }
}

export async function inspectContent(content: ContentManifest, platform: PlatformDescriptor, now = new Date()): Promise<Issue[]> {
  const issues: Issue[] = []
  if (content.platform && content.platform !== platform.id) {
    issues.push({ code: 'PACKAGE_INPUT_MISMATCH', severity: 'error', message: `Content targets ${content.platform}, not ${platform.id}.` })
  }
  for (const rule of platform.rules) {
    if (daysBetween(now, rule.verifiedAt) > rule.maxAgeDays) {
      issues.push({ code: 'PLATFORM_RULES_STALE', severity: 'error', message: `Rule ${rule.id} is stale; re-verify ${rule.sourceUrl} before packaging.` })
    }
  }
  addStructuralIssues(content, platform, issues)
  addReviewIssues(content, issues)
  addDisclosureIssues(content, issues)
  const profile = await loadProfile(content.brandId, content.profileVersion)
  if (!profile) {
    issues.push({ code: 'PROFILE_REQUIRED', severity: 'error', message: `Profile ${content.brandId}@${content.profileVersion} does not exist.` })
  } else {
    const scanned = `${content.title}\n${content.summary ?? ''}\n${content.bodyMarkdown}`
    const found = profile.banned_words.filter((word) => word.trim() && scanned.includes(word))
    if (found.length) issues.push({ code: 'BANNED_WORD_PRESENT', severity: 'error', message: `Banned words present: ${found.join('、')}.` })
  }
  if (content.assets.some((asset) => asset.rightsStatus === 'pending')) {
    issues.push({ code: 'ASSET_RIGHTS_PENDING', severity: 'error', message: 'Every packaged asset must have a resolved rights status.' })
  }
  return issues
}

export async function handler(args: { contentId: string; platform?: 'wechat' | 'xhs' | 'toutiao'; now?: string }): Promise<Envelope> {
  const content = await getLatestContent(args.contentId)
  if (!content) return err('NOT_FOUND', `No content ${args.contentId}.`)
  const platformId = args.platform ?? content.platform
  if (!platformId) return err('PACKAGE_INPUT_MISMATCH', 'No target platform is recorded or supplied.')
  const platform = getPlatform(platformId)
  if (!platform) return err('UNKNOWN_PLATFORM', `Unknown platform '${platformId}'. Known: ${platformIds().join(', ')}`)
  const issues = await inspectContent(content, platform, args.now ? new Date(args.now) : new Date())
  const data = { contentId: content.contentId, revisionId: content.revisionId, contentHash: content.contentHash, platform: platform.id, ruleVersion: platform.ruleVersion, ready: issues.every((issue) => issue.severity !== 'error'), issues }
  return data.ready ? ok(data) : actionRequired(data)
}
