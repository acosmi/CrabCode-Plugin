import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { actionRequired, err, ok, type Envelope } from '../envelope.ts'
import {
  AiDisclosureSchema,
  ClaimSchema,
  EditorialReviewRecordSchema,
  LegalReviewSchema,
  ReviewSchema,
  StatementCoverageSchema,
  namedActorKey,
  namedActorsEqual,
  stableHash,
  type EditorialReviewRecord,
} from '../domain.ts'
import { extractVerifiableStatements, factualCompatibility } from '../factual-integrity.ts'
import { appendRecordsAtomically, getRecord, storageWarnings } from '../storage.ts'
import { bodyPlainText, visibleArticleBodyText } from '../rendering/article-doc.ts'
import { getLatestContent } from './content.ts'
import { getOriginalityScan, originalityScanPasses } from './originality.ts'
import { getResearchReview } from './research.ts'

const completeSchema = z.object({
  contentId: z.string().uuid(),
  originalityScanId: z.string().uuid(),
  claims: z.array(ClaimSchema).max(200),
  statementCoverage: z.array(StatementCoverageSchema).max(1000),
  noVerifiableClaimsReason: z.string().min(1).max(1000).optional(),
  waivers: z.array(z.object({ claimId: z.string().min(1).max(120), by: z.string().min(1).max(300), reason: z.string().min(1).max(1000) })).max(200).default([]),
  legalReview: LegalReviewSchema,
  aiDisclosure: AiDisclosureSchema,
  completedBy: z.string().min(1),
})

export const name = 'mediaops.editorial.review'
export const description =
  'Record independent fact, legal-risk and AI-disclosure review for one drafted revision after originality evidence passes. Verified claims must cite supporting links from its bound research bundle; action_required returns the server-generated statement IDs needed for a retry.'
export const inputSchema = completeSchema.shape

const INFERENCE_MARKER_PATTERN = /(?:我认为|我们认为|在我看来|本文判断|作者判断|这意味着|由此可见|可以推断|可能|或许|may|might|suggests?|in my view|we believe)/i

function reviewHashPayload(review: Omit<EditorialReviewRecord, 'reviewHash'>): unknown {
  return {
    reviewId: review.reviewId,
    contentId: review.contentId,
    sourceRevisionId: review.sourceRevisionId,
    subjectHash: review.subjectHash,
    originalityScanId: review.originalityScanId,
    factReview: review.factReview,
    legalReview: review.legalReview,
    aiDisclosure: review.aiDisclosure,
    completedBy: review.completedBy,
    completedAt: review.completedAt,
  }
}

export async function handler(args: z.input<typeof completeSchema>): Promise<Envelope> {
  const parsed = completeSchema.safeParse(args)
  if (!parsed.success) return err('INVALID_EDITORIAL_REVIEW', parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '))
  const input = parsed.data
  const content = await getLatestContent(input.contentId)
  if (!content) return err('NOT_FOUND', `No content ${input.contentId}.`)
  if (!('schemaVersion' in content) || content.schemaVersion !== 2) return err('SCHEMA_UPGRADE_REQUIRED', 'Editorial review requires schema-v2 content.')
  if (content.stage !== 'drafted') return err('INVALID_STAGE_TRANSITION', `Editorial review requires drafted content; current stage is ${content.stage}.`)
  const scan = await getOriginalityScan(input.originalityScanId)
  if (!scan || scan.contentId !== content.contentId || scan.sourceRevisionId !== content.revisionId || scan.subjectHash !== content.originalitySubjectHash) {
    return err('ORIGINALITY_SCAN_STALE', 'The originality scan is missing or does not bind to this exact draft.')
  }
  if (!originalityScanPasses(scan)) return err('ORIGINALITY_REVIEW_REQUIRED', `Originality decision ${scan.decision} has not passed.`)
  const forbiddenActors = new Set([content.savedBy, scan.createdBy, scan.humanReview?.reviewedBy].filter((actor): actor is string => Boolean(actor)).map(namedActorKey))
  if (forbiddenActors.has(namedActorKey(input.completedBy))) return err('ROLE_SEPARATION_REQUIRED', 'The editorial reviewer must differ from the draft author and originality reviewers.')
  if (!content.researchId || !content.researchBundleHash) return err('RESEARCH_EVIDENCE_REQUIRED', 'Draft is not bound to completed research evidence.')
  const research = await getResearchReview(content.researchId)
  if (!research || research.status !== 'completed' || research.researchBundleHash !== content.researchBundleHash) {
    return err('RESEARCH_STALE', 'The bound research record is missing, incomplete or changed.')
  }

  const problems: string[] = []
  const researchClaims = new Map(research.claims.map((claim) => [claim.id, claim]))
  const reviewedClaims = new Map<string, z.infer<typeof ClaimSchema>>()
  for (const claim of input.claims) {
    if (reviewedClaims.has(claim.id)) problems.push(`duplicate reviewed claim ${claim.id}`)
    reviewedClaims.set(claim.id, claim)
    const sourceClaim = researchClaims.get(claim.id)
    if (!sourceClaim || sourceClaim.claim !== claim.claim) {
      problems.push(`claim ${claim.id} does not exactly match the research ledger`)
      continue
    }
    const validSupportingIds = new Set(
      research.evidenceLinks
        .filter((link) => link.claimId === claim.id && link.relation === 'supports' && link.supportType !== 'contextual')
        .map((link) => `${link.sourceId}:${link.locator}`),
    )
    if (claim.status === 'verified') {
      if (!claim.evidenceLinkIds.length) problems.push(`verified claim ${claim.id} has no evidenceLinkIds`)
      for (const linkId of claim.evidenceLinkIds) if (!validSupportingIds.has(linkId)) problems.push(`claim ${claim.id} cites unknown/non-supporting evidence link ${linkId}`)
    } else if (sourceClaim.core) {
      problems.push(`core claim ${claim.id} remains ${claim.status}`)
    } else if (!input.waivers.some((waiver) => waiver.claimId === claim.id)) {
      problems.push(`non-core claim ${claim.id} remains ${claim.status} without a named waiver`)
    }
  }
  for (const claim of research.claims) if (!reviewedClaims.has(claim.id)) problems.push(`research claim ${claim.id} is missing from fact review`)
  if (research.claims.length === 0 && !input.noVerifiableClaimsReason?.trim()) problems.push('noVerifiableClaimsReason is required for an empty claim ledger')
  if (research.claims.length > 0 && input.noVerifiableClaimsReason) problems.push('noVerifiableClaimsReason cannot replace a non-empty claim ledger')

  const statements = extractVerifiableStatements({
    title: content.title,
    ...(content.summary ? { summary: content.summary } : {}),
    bodyText: bodyPlainText(content.articleDoc),
  })
  const statementLedgerHash = stableHash(statements)
  const statementById = new Map(statements.map((statement) => [statement.statementId, statement]))
  const coverageById = new Map<string, z.infer<typeof StatementCoverageSchema>>()
  for (const coverage of input.statementCoverage) {
    if (coverageById.has(coverage.statementId)) problems.push(`duplicate statement coverage ${coverage.statementId}`)
    coverageById.set(coverage.statementId, coverage)
    const statement = statementById.get(coverage.statementId)
    if (!statement) {
      problems.push(`statement coverage ${coverage.statementId} does not bind to a current article statement`)
      continue
    }
    const mappedClaims = coverage.claimIds.map((claimId) => reviewedClaims.get(claimId))
    const missingClaimIds = coverage.claimIds.filter((_, index) => !mappedClaims[index])
    if (missingClaimIds.length) problems.push(`statement ${coverage.statementId} maps unknown fact-review claims: ${missingClaimIds.join(', ')}`)
    const nonVerified = mappedClaims.filter((claim) => claim && claim.status !== 'verified')
    if (nonVerified.length) problems.push(`statement ${coverage.statementId} maps claims that are not verified`)
    const verifiedMappedClaims = mappedClaims.filter((claim): claim is z.infer<typeof ClaimSchema> => claim !== undefined && claim.status === 'verified')
    const strongSignals = statement.signals.some((signal) => signal.startsWith('number:') || signal.startsWith('predicate:'))
    if ((coverage.classification === 'opinion' || coverage.classification === 'non_claim') && strongSignals) {
      problems.push(`statement ${coverage.statementId} contains factual signals and cannot be classified as ${coverage.classification}`)
    }
    if (coverage.classification === 'verified_fact') {
      const candidates = verifiedMappedClaims.map((claim) => ({ claim, mismatches: factualCompatibility(statement.text, claim.claim) }))
      if (!candidates.some(({ mismatches }) => mismatches.length === 0)) {
        const detail = candidates.map(({ claim, mismatches }) => `${claim.id}[${mismatches.join(', ')}]`).join('; ') || 'no verified mapped claim'
        problems.push(`statement ${coverage.statementId} is not independently compatible with any one mapped research claim: ${detail}`)
      }
    }
    if (coverage.classification === 'author_inference') {
      if (!coverage.inferenceMarker || !statement.text.includes(coverage.inferenceMarker) || !INFERENCE_MARKER_PATTERN.test(coverage.inferenceMarker)) {
        problems.push(`statement ${coverage.statementId} needs an exact visible inference marker such as “本文判断” or “可能”`)
      }
    }
  }
  for (const statement of statements) {
    if (!coverageById.has(statement.statementId)) problems.push(`verifiable article statement is absent from the fact ledger: ${statement.text}`)
  }

  const legal = input.legalReview
  if (!namedActorsEqual(legal.reviewedBy, input.completedBy)) problems.push('legalReview.reviewedBy must match the accountable editorial reviewer')
  if (legal.status === 'required' || (legal.riskLevel === 'high' && legal.status !== 'completed')) problems.push('specialist legal review remains required')
  const disclosure = input.aiDisclosure
  if (disclosure.aiAssisted) {
    if (!disclosure.confirmedBy || disclosure.methods.length === 0) problems.push('AI-assisted content needs a named, confirmed disclosure method')
    if (disclosure.confirmedBy && !namedActorsEqual(disclosure.confirmedBy, input.completedBy)) problems.push('aiDisclosure.confirmedBy must match the accountable editorial reviewer')
    for (const method of disclosure.methods) {
      if (method === 'body-label' && (!disclosure.bodyLabelText || !visibleArticleBodyText(content.articleDoc).includes(disclosure.bodyLabelText))) {
        problems.push('body-label disclosure must occur verbatim in visible parsed article-body text')
      }
      if (method === 'platform-native' && disclosure.platformNativeConfirmed !== true) problems.push('platform-native disclosure is not confirmed')
      if (method === 'file-metadata' && disclosure.fileMetadataConfirmed !== true) problems.push('file-metadata disclosure is not confirmed')
    }
    if (disclosure.bodyLabelText && !disclosure.methods.includes('body-label')) {
      problems.push('bodyLabelText is forbidden unless body-label is a declared and reviewed disclosure method')
    }
  } else if (disclosure.methods.length || disclosure.bodyLabelText || disclosure.platformNativeConfirmed || disclosure.fileMetadataConfirmed) {
    problems.push('non-AI-assisted content must not carry AI disclosure methods or injected label text')
  }
  if (problems.length) {
    return actionRequired({
      contentId: content.contentId,
      revisionId: content.revisionId,
      statementLedgerHash,
      statements,
      problems,
    }, storageWarnings())
  }

  const completedAt = new Date().toISOString()
  const factReview = ReviewSchema.parse({
    status: 'completed',
    subjectHash: content.originalitySubjectHash,
    researchId: research.researchId,
    researchBundleHash: research.researchBundleHash,
    completedBy: input.completedBy,
    completedAt,
    claims: input.claims,
    statementLedgerHash,
    statements,
    statementCoverage: input.statementCoverage,
    ...(input.noVerifiableClaimsReason ? { noVerifiableClaimsReason: input.noVerifiableClaimsReason } : {}),
    waivers: input.waivers,
  })
  const reviewId = randomUUID()
  const withoutHash: Omit<EditorialReviewRecord, 'reviewHash'> = {
    reviewId,
    contentId: content.contentId,
    sourceRevisionId: content.revisionId,
    subjectHash: content.originalitySubjectHash,
    originalityScanId: scan.scanId,
    factReview,
    legalReview: legal,
    aiDisclosure: disclosure,
    completedBy: input.completedBy,
    completedAt,
  }
  const reviewHash = stableHash(reviewHashPayload(withoutHash))
  const review = EditorialReviewRecordSchema.parse({ ...withoutHash, reviewHash })
  await appendRecordsAtomically([
    { collection: 'editorial-reviews', record: { id: reviewId, ...review } },
    { collection: 'audit-events', record: {
      event: 'editorial-review.completed',
      reviewId,
      contentId: content.contentId,
      revisionId: content.revisionId,
      subjectHash: content.originalitySubjectHash,
      originalityScanId: scan.scanId,
      actor: input.completedBy,
    } },
  ])
  return ok({ reviewId, contentId: content.contentId, revisionId: content.revisionId, subjectHash: content.originalitySubjectHash, statementLedgerHash, reviewHash }, storageWarnings())
}

export async function getEditorialReview(reviewId: string): Promise<EditorialReviewRecord | null> {
  const record = await getRecord('editorial-reviews', reviewId)
  if (!record) return null
  const parsed = EditorialReviewRecordSchema.safeParse(record)
  if (!parsed.success) throw new Error(`INVALID_STORED_EDITORIAL_REVIEW:${reviewId}`)
  const { reviewHash, ...withoutHash } = parsed.data
  if (stableHash(reviewHashPayload(withoutHash)) !== reviewHash) throw new Error(`EDITORIAL_REVIEW_HASH_MISMATCH:${reviewId}`)
  return parsed.data
}
