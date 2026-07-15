import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { actionRequired, err, ok, type Envelope } from '../envelope.ts'
import {
  ClaimEvidenceLinkSchema,
  EvidenceSourceSchema,
  ResearchClaimSchema,
  ResearchReviewSchema,
  ResearchSearchLogSchema,
  namedActorsEqual,
  stableHash,
  type ResearchReview,
} from '../domain.ts'
import { appendRecord, getRecord, storageWarnings } from '../storage.ts'
import { getLatestContent } from './content.ts'
import { loadReferenceRecords } from './references.ts'
import { getResearchCapture } from './research-capture.ts'

export const RESEARCH_POLICY_VERSION = 'research-evidence@1'

const sourceInputSchema = z.object({
  sourceKey: z.string().min(1).max(120),
  captureId: z.string().uuid(),
  title: z.string().min(1).max(500),
  creator: z.string().max(300).optional(),
  publisher: z.string().min(1).max(300),
  originPublisher: z.string().min(1).max(300).optional(),
  publishedAt: z.string().datetime().optional(),
  sourceTier: z.enum(['primary', 'authoritative', 'professional', 'context']),
  isPrimary: z.boolean(),
  rightsOrTerms: z.string().max(1000).optional(),
}).strict()

const linkInputSchema = z.object({
  claimId: z.string().min(1).max(120),
  sourceKey: z.string().min(1).max(120),
  relation: z.enum(['supports', 'contradicts', 'contextualizes']),
  supportType: z.enum(['direct', 'partial', 'contextual']),
  locator: z.string().min(1).max(500),
  supportingExcerpt: z.string().min(1).max(1500),
  sourceInterpretation: z.string().min(1).max(1500),
  limitations: z.string().min(1).max(1000),
  checkedAt: z.string().datetime(),
})

const completeSchema = z.object({
  contentId: z.string().uuid(),
  claims: z.array(ResearchClaimSchema).max(200),
  sources: z.array(sourceInputSchema).max(100),
  evidenceLinks: z.array(linkInputSchema).max(1000),
  searches: z.array(ResearchSearchLogSchema).min(1).max(100),
  counterEvidenceSourceKeys: z.array(z.string().min(1).max(120)).max(100).default([]),
  unresolvedGaps: z.array(z.string().min(1).max(1000)).max(100).default([]),
  noVerifiableClaimsReason: z.string().min(1).max(1000).optional(),
  conclusionStrength: z.enum(['normal', 'qualified']).default('normal'),
  completedBy: z.string().min(1),
})

export const name = 'mediaops.research.complete'
export const description =
  'Create a hash-bound research bundle from caller-recorded search logs and server-generated page captures. Requires claim-level excerpts, structural independence checks and counter-evidence recording; zero-result research stays incomplete.'
export const inputSchema = completeSchema.shape

function normalizeEvidenceText(value: string): string {
  return value.normalize('NFC').replace(/\s+/g, ' ').trim()
}

function normalizedPublisher(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[^a-z0-9\u3400-\u9fff]+/g, '')
}

function urlIdentity(value: string): string {
  const url = new URL(value)
  url.hash = ''
  url.hostname = url.hostname.toLowerCase()
  if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) url.port = ''
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '')
  url.searchParams.sort()
  return url.toString()
}

function researchBundlePayload(review: Omit<ResearchReview, 'researchBundleHash'>): unknown {
  return {
    contentId: review.contentId,
    sourceRevisionId: review.sourceRevisionId,
    subjectHash: review.subjectHash,
    claimSetHash: review.claimSetHash,
    claims: review.claims,
    sources: review.sources,
    evidenceLinks: review.evidenceLinks,
    searches: review.searches,
    counterEvidenceSourceIds: review.counterEvidenceSourceIds,
    unresolvedGaps: review.unresolvedGaps,
    noVerifiableClaimsReason: review.noVerifiableClaimsReason,
    conclusionStrength: review.conclusionStrength,
    status: review.status,
    policyVersion: review.policyVersion,
  }
}

export async function handler(args: z.input<typeof completeSchema>): Promise<Envelope> {
  const parsed = completeSchema.safeParse(args)
  if (!parsed.success) return err('INVALID_RESEARCH_RECORD', parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '))
  const input = parsed.data
  const content = await getLatestContent(input.contentId)
  if (!content) return err('NOT_FOUND', `No content ${input.contentId}.`)
  if (!('schemaVersion' in content) || content.schemaVersion !== 2) return err('SCHEMA_UPGRADE_REQUIRED', 'Research completion requires a schema v2 intake revision.')
  if (content.stage !== 'intake') return err('INVALID_STAGE_TRANSITION', `Research must bind to an intake revision; current stage is ${content.stage}.`)
  if (namedActorsEqual(input.completedBy, content.savedBy)) return err('ROLE_SEPARATION_REQUIRED', 'The intake author cannot self-complete the independent research review.')

  let references
  try {
    references = await loadReferenceRecords(content.referenceIds)
  } catch (error) {
    return err('REFERENCE_EVIDENCE_REQUIRED', error instanceof Error ? error.message : String(error))
  }
  const subjectHash = stableHash({
    researchSubject: content.researchSubject,
    references: references.map(({ metadata }) => ({ referenceId: metadata.referenceId, contentHash: metadata.contentHash, role: metadata.role })),
  })

  const problems: string[] = []
  const claimIds = new Set<string>()
  for (const claim of input.claims) {
    if (claimIds.has(claim.id)) problems.push(`duplicate claimId ${claim.id}`)
    claimIds.add(claim.id)
  }
  if (input.claims.length === 0 && !input.noVerifiableClaimsReason) problems.push('noVerifiableClaimsReason is required when the claim ledger is empty')
  if (!input.searches.some((search) => search.resultCount > 0)) problems.push('all recorded web searches returned zero results')
  if (input.sources.length === 0) problems.push('at least one opened, retrievable source is required')

  const sourceKeys = new Set<string>()
  const captureIds = new Set<string>()
  const sourceByKey = new Map<string, z.infer<typeof EvidenceSourceSchema>>()
  const snapshotByKey = new Map<string, string>()
  const sourceHostById = new Map<string, string>()
  const seenPageIdentities = new Map<string, string>()
  const seenSnapshotHashes = new Map<string, string>()
  for (const source of input.sources) {
    if (sourceKeys.has(source.sourceKey)) {
      problems.push(`duplicate sourceKey ${source.sourceKey}`)
      continue
    }
    sourceKeys.add(source.sourceKey)
    if (captureIds.has(source.captureId)) {
      problems.push(`${source.sourceKey} reuses an evidence capture already submitted by another source`)
      continue
    }
    captureIds.add(source.captureId)
    const capture = await getResearchCapture(source.captureId)
    if (!capture) {
      problems.push(`${source.sourceKey} references a missing server-generated capture`)
      continue
    }
    for (const identity of new Set([urlIdentity(capture.requestedUrl), urlIdentity(capture.finalUrl)])) {
      const previous = seenPageIdentities.get(identity)
      if (previous && previous !== source.sourceKey) problems.push(`${source.sourceKey} duplicates the same source page as ${previous}`)
      else seenPageIdentities.set(identity, source.sourceKey)
    }
    const previousSnapshot = seenSnapshotHashes.get(capture.snapshotHash)
    if (previousSnapshot && previousSnapshot !== source.sourceKey) problems.push(`${source.sourceKey} duplicates the exact captured content of ${previousSnapshot} and cannot count as an independent source`)
    else seenSnapshotHashes.set(capture.snapshotHash, source.sourceKey)
    const snapshot = normalizeEvidenceText(capture.snapshotText)
    const sourceId = randomUUID()
    const finalHost = new URL(capture.finalUrl).hostname.toLowerCase()
    const origin = normalizedPublisher(source.originPublisher ?? source.publisher) || finalHost
    const evidence = EvidenceSourceSchema.safeParse({
      sourceId,
      canonicalUrl: capture.requestedUrl,
      finalUrl: capture.finalUrl,
      httpStatus: capture.httpStatus,
      contentType: capture.contentType,
      title: source.title,
      ...(source.creator ? { creator: source.creator } : {}),
      publisher: source.publisher,
      ...(source.publishedAt ? { publishedAt: source.publishedAt } : {}),
      accessedAt: capture.capturedAt,
      sourceTier: source.sourceTier,
      isPrimary: source.isPrimary,
      independenceGroup: stableHash(origin).slice(0, 24),
      retrievalStatus: 'retrieved',
      snapshotRef: `capture:${capture.captureId}`,
      snapshotHash: capture.snapshotHash,
      contentHash: capture.contentHash,
      ...(source.rightsOrTerms ? { rightsOrTerms: source.rightsOrTerms } : {}),
    })
    if (!evidence.success) {
      problems.push(`${source.sourceKey}: ${evidence.error.issues.map((issue) => issue.message).join(', ')}`)
      continue
    }
    sourceByKey.set(source.sourceKey, evidence.data)
    snapshotByKey.set(source.sourceKey, snapshot)
    sourceHostById.set(evidence.data.sourceId, finalHost)
  }

  const evidenceLinks: z.infer<typeof ClaimEvidenceLinkSchema>[] = []
  const sourceById = new Map<string, z.infer<typeof EvidenceSourceSchema>>()
  for (const source of sourceByKey.values()) sourceById.set(source.sourceId, source)
  const referenceUrls = new Set(references.map(({ metadata }) => metadata.url).filter((url): url is string => Boolean(url)).map(urlIdentity))
  for (const link of input.evidenceLinks) {
    const source = sourceByKey.get(link.sourceKey)
    if (!claimIds.has(link.claimId)) {
      problems.push(`evidence link references unknown claim ${link.claimId}`)
      continue
    }
    if (!source) {
      problems.push(`evidence link references unknown source ${link.sourceKey}`)
      continue
    }
    const snapshot = snapshotByKey.get(link.sourceKey) ?? ''
    if (!snapshot.includes(normalizeEvidenceText(link.supportingExcerpt))) {
      problems.push(`${link.sourceKey} snapshot does not contain the claimed supporting excerpt for ${link.claimId}`)
    }
    if (referenceUrls.has(urlIdentity(source.canonicalUrl)) || referenceUrls.has(urlIdentity(source.finalUrl))) {
      if (link.relation === 'supports') problems.push(`user reference ${link.sourceKey} cannot count as independent supporting evidence`)
    }
    evidenceLinks.push(ClaimEvidenceLinkSchema.parse({ ...link, sourceId: source.sourceId }))
  }

  for (const claim of input.claims) {
    const supporting = evidenceLinks
      .filter((link) => link.claimId === claim.id && link.relation === 'supports' && link.supportType !== 'contextual')
      .map((link) => sourceById.get(link.sourceId))
      .filter((source): source is z.infer<typeof EvidenceSourceSchema> => Boolean(source))
    const independentGroups = new Set(supporting.map((source) => source.independenceGroup))
    const independentHosts = new Set(supporting.map((source) => sourceHostById.get(source.sourceId)).filter((host): host is string => Boolean(host)))
    const strong = supporting.some((source) => ['primary', 'authoritative'].includes(source.sourceTier))
    if (claim.core) {
      if (independentGroups.size < 2 || independentHosts.size < 2) problems.push(`core claim ${claim.id} needs two independent supporting sources from distinct origin groups and hosts`)
      if (!strong && !(input.conclusionStrength === 'qualified' && supporting.filter((source) => source.sourceTier === 'professional').length >= 2)) {
        problems.push(`core claim ${claim.id} needs a primary/authoritative source or a qualified two-professional-source basis`)
      }
    } else if (supporting.length === 0) {
      problems.push(`claim ${claim.id} has no supporting evidence`)
    }
    if (evidenceLinks.some((link) => link.claimId === claim.id && link.relation === 'contradicts')) problems.push(`claim ${claim.id} has unresolved counter-evidence`)
  }

  const independentEvidence = new Set([...sourceByKey.values()].map((source) => source.independenceGroup))
  const independentEvidenceHosts = new Set([...sourceByKey.values()].map((source) => sourceHostById.get(source.sourceId)).filter((host): host is string => Boolean(host)))
  if (references.some(({ metadata }) => metadata.role === 'third_party_reference') && (independentEvidence.size < 2 || independentEvidenceHosts.size < 2)) {
    problems.push('third-party reference workflows require at least two independent researched source groups on distinct hosts')
  }
  problems.push(...input.unresolvedGaps)

  const researchId = randomUUID()
  const completedAt = new Date().toISOString()
  const status = problems.length ? 'incomplete' : 'completed'
  const counterEvidenceSourceIds = input.counterEvidenceSourceKeys
    .map((key) => sourceByKey.get(key)?.sourceId)
    .filter((id): id is string => Boolean(id))
  const withoutHash: Omit<ResearchReview, 'researchBundleHash'> = {
    researchId,
    contentId: content.contentId,
    sourceRevisionId: content.revisionId,
    subjectHash,
    claimSetHash: stableHash(input.claims),
    claims: input.claims,
    sources: [...sourceByKey.values()],
    evidenceLinks,
    searches: input.searches,
    counterEvidenceSourceIds,
    unresolvedGaps: problems,
    ...(input.noVerifiableClaimsReason ? { noVerifiableClaimsReason: input.noVerifiableClaimsReason } : {}),
    conclusionStrength: input.conclusionStrength,
    status,
    policyVersion: RESEARCH_POLICY_VERSION,
    completedBy: input.completedBy,
    completedAt,
  }
  const researchBundleHash = stableHash(researchBundlePayload(withoutHash))
  const review = ResearchReviewSchema.parse({ ...withoutHash, researchBundleHash })
  await appendRecord('research-reviews', { id: researchId, ...review })
  await appendRecord('audit-events', {
    event: `research.${status}`,
    researchId,
    contentId: content.contentId,
    revisionId: content.revisionId,
    researchBundleHash,
    actor: input.completedBy,
    problems,
  })
  const data = { researchId, status, subjectHash, researchBundleHash, sourceCount: review.sources.length, independentSourceGroups: independentEvidence.size, problems }
  return status === 'completed' ? ok(data, storageWarnings()) : actionRequired(data, storageWarnings())
}

export async function getResearchReview(researchId: string): Promise<ResearchReview | null> {
  const record = await getRecord('research-reviews', researchId)
  if (!record) return null
  const parsed = ResearchReviewSchema.safeParse(record)
  if (!parsed.success) throw new Error(`INVALID_STORED_RESEARCH:${researchId}`)
  const { researchBundleHash, ...withoutHash } = parsed.data
  if (stableHash(researchBundlePayload(withoutHash)) !== researchBundleHash) throw new Error(`RESEARCH_HASH_MISMATCH:${researchId}`)
  return parsed.data
}
