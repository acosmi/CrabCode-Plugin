import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { actionRequired, err, ok, type Envelope } from '../envelope.ts'
import {
  ClaimEvidenceLinkSchema,
  EvidenceSourceSchema,
  ResearchClaimSchema,
  ResearchReviewSchema,
  ResearchSearchLogSchema,
  SourceAssessmentSchema,
  namedActorsEqual,
  stableHash,
  type ResearchReview,
} from '../domain.ts'
import { factualCompatibility } from '../factual-integrity.ts'
import { appendRecordsAtomically, getRecord, storageWarnings } from '../storage.ts'
import { getLatestContent } from './content.ts'
import { loadReferenceRecords } from './references.ts'
import { getResearchCapture } from './research-capture.ts'

export const RESEARCH_POLICY_VERSION = 'research-evidence@2'

const sourceInputSchema = z.object({
  sourceKey: z.string().min(1).max(120),
  captureId: z.string().uuid(),
  title: z.string().min(1).max(500),
  creator: z.string().max(300).optional(),
  publisher: z.string().min(1).max(300),
  publishedAt: z.string().datetime().optional(),
  assessment: SourceAssessmentSchema.omit({ assessedBy: true, assessedAt: true }),
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

function organizationHost(hostname: string): string {
  const parts = hostname.toLowerCase().split('.').filter(Boolean)
  if (parts.length <= 2) return parts.join('.')
  const compoundSuffix = `${parts.at(-2)}.${parts.at(-1)}`
  return ['com.cn', 'net.cn', 'org.cn', 'gov.cn', 'edu.cn', 'co.uk', 'org.uk', 'ac.uk'].includes(compoundSuffix)
    ? parts.slice(-3).join('.')
    : parts.slice(-2).join('.')
}

function snapshotFingerprint(value: string): Set<string> {
  const normalized = value.normalize('NFKC').toLowerCase().replace(/\s+/g, '')
  const width = 12
  if (normalized.length <= width) return new Set(normalized ? [normalized] : [])
  const step = Math.max(1, Math.floor((normalized.length - width) / 2048))
  const output = new Set<string>()
  for (let index = 0; index <= normalized.length - width; index += step) output.add(normalized.slice(index, index + width))
  return output
}

function nearDuplicate(left: Set<string>, right: Set<string>): boolean {
  if (!left.size || !right.size) return false
  const [small, large] = left.size <= right.size ? [left, right] : [right, left]
  if (small.size < 20) return false
  let intersection = 0
  for (const token of small) if (large.has(token)) intersection++
  const containment = intersection / small.size
  const jaccard = intersection / (left.size + right.size - intersection)
  return containment >= 0.72 || jaccard >= 0.6
}

type PublisherIdentityMethod = 'recognized-institutional-domain' | 'configured-trusted-host' | 'unverified'

function trustedHostConfiguration(): { patterns: string[]; problems: string[]; configurationHash: string } {
  const patterns: string[] = []
  const problems: string[] = []
  for (const raw of (process.env.MEDIAOPS_TRUSTED_SOURCE_HOSTS ?? '').split(',')) {
    const pattern = raw.normalize('NFKC').trim().toLowerCase().replace(/\.$/, '')
    if (!pattern) continue
    const wildcard = pattern.startsWith('*.')
    const hostname = wildcard ? pattern.slice(2) : pattern
    if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(hostname) || (wildcard && hostname.split('.').length < 3)) {
      problems.push(`MEDIAOPS_TRUSTED_SOURCE_HOSTS contains invalid or over-broad entry '${raw.trim()}'`)
      continue
    }
    patterns.push(wildcard ? `*.${hostname}` : hostname)
  }
  const normalizedPatterns = [...new Set(patterns)].sort()
  return { patterns: normalizedPatterns, problems, configurationHash: stableHash(normalizedPatterns) }
}

function configuredHostRule(hostname: string, patterns: string[]): string | undefined {
  return patterns.find((pattern) => pattern.startsWith('*.')
    ? hostname.endsWith(pattern.slice(1)) && hostname !== pattern.slice(2)
    : hostname === pattern)
}

function recognizedInstitutionalRule(publisherType: z.input<typeof sourceInputSchema>['assessment']['publisherType'], hostname: string): string | undefined {
  const matchingRule = (rules: string[]): string | undefined => rules.find((rule) => hostname === rule || hostname.endsWith(`.${rule}`))
  if (publisherType === 'government' || publisherType === 'court') {
    return matchingRule(['gov.cn', 'gov.uk', 'gov'])
  }
  if (publisherType === 'academic') {
    return matchingRule(['edu.cn', 'ac.cn', 'ac.uk', 'edu'])
  }
  return undefined
}

function deriveSourceClass(assessment: z.input<typeof sourceInputSchema>['assessment'], finalHost: string, trustedHosts: ReturnType<typeof trustedHostConfiguration>): {
  sourceTier: 'primary' | 'authoritative' | 'professional' | 'context'
  isPrimary: boolean
  publisherIdentityMethod: PublisherIdentityMethod
  publisherIdentityRule?: string
  trustedHostConfigurationHash?: string
  problem?: string
} {
  const allowedPublisherTypes: Record<typeof assessment.sourceFunction, ReadonlySet<typeof assessment.publisherType>> = {
    original_record: new Set(['government', 'court', 'standards_body', 'academic', 'company', 'industry_organization']),
    first_party_statement: new Set(['government', 'court', 'standards_body', 'academic', 'company', 'industry_organization', 'individual']),
    official_interpretation: new Set(['government', 'court', 'standards_body']),
    independent_reporting: new Set(['professional_media']),
    professional_analysis: new Set(['academic', 'professional_media', 'industry_organization']),
    context: new Set(['government', 'court', 'standards_body', 'academic', 'company', 'professional_media', 'industry_organization', 'individual', 'unknown']),
  }
  if (!allowedPublisherTypes[assessment.sourceFunction].has(assessment.publisherType)) {
    return { sourceTier: 'context', isPrimary: false, publisherIdentityMethod: 'unverified', problem: `${assessment.sourceFunction} is incompatible with publisher type ${assessment.publisherType}` }
  }
  if (assessment.originRelationship !== 'original' && assessment.sourceFunction !== 'context') {
    return { sourceTier: 'context', isPrimary: false, publisherIdentityMethod: 'unverified', problem: `${assessment.sourceFunction} requires an original source rather than ${assessment.originRelationship}` }
  }
  const recognizedRule = recognizedInstitutionalRule(assessment.publisherType, finalHost)
  const configuredRule = configuredHostRule(finalHost, trustedHosts.patterns)
  const publisherIdentityMethod: PublisherIdentityMethod = recognizedRule
    ? 'recognized-institutional-domain'
    : configuredRule ? 'configured-trusted-host' : 'unverified'
  const identityEvidence = recognizedRule
    ? { publisherIdentityRule: recognizedRule }
    : configuredRule ? { publisherIdentityRule: configuredRule, trustedHostConfigurationHash: trustedHosts.configurationHash } : {}
  if (['original_record', 'first_party_statement', 'official_interpretation'].includes(assessment.sourceFunction) && publisherIdentityMethod === 'unverified') {
    return {
      sourceTier: 'context',
      isPrimary: false,
      publisherIdentityMethod,
      ...identityEvidence,
      problem: `${assessment.sourceFunction} publisher identity is not verified for final host ${finalHost}; use a recognized institutional domain or configure the exact trusted host`,
    }
  }
  if (['original_record', 'first_party_statement'].includes(assessment.sourceFunction)) return { sourceTier: 'primary', isPrimary: true, publisherIdentityMethod, ...identityEvidence }
  if (assessment.sourceFunction === 'official_interpretation') return { sourceTier: 'authoritative', isPrimary: false, publisherIdentityMethod, ...identityEvidence }
  if (['independent_reporting', 'professional_analysis'].includes(assessment.sourceFunction)) return { sourceTier: 'professional', isPrimary: false, publisherIdentityMethod, ...identityEvidence }
  return { sourceTier: 'context', isPrimary: false, publisherIdentityMethod, ...identityEvidence }
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
  const assessedAt = new Date().toISOString()
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
  const trustedHosts = trustedHostConfiguration()
  problems.push(...trustedHosts.problems)
  const claimIds = new Set<string>()
  const claimById = new Map<string, z.infer<typeof ResearchClaimSchema>>()
  for (const claim of input.claims) {
    if (claimIds.has(claim.id)) problems.push(`duplicate claimId ${claim.id}`)
    claimIds.add(claim.id)
    claimById.set(claim.id, claim)
  }
  if (input.claims.length === 0 && !input.noVerifiableClaimsReason) problems.push('noVerifiableClaimsReason is required when the claim ledger is empty')
  if (!input.searches.some((search) => search.resultCount > 0)) problems.push('all recorded web searches returned zero results')
  if (input.sources.length === 0) problems.push('at least one opened, retrievable source is required')

  const sourceKeys = new Set<string>()
  const captureIds = new Set<string>()
  const sourceByKey = new Map<string, z.infer<typeof EvidenceSourceSchema>>()
  const snapshotByKey = new Map<string, string>()
  const organizationByKey = new Map<string, string>()
  const publisherByKey = new Map<string, string>()
  const fingerprintByKey = new Map<string, Set<string>>()
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
    const sourceClass = deriveSourceClass(source.assessment, finalHost, trustedHosts)
    if (sourceClass.problem) problems.push(`${source.sourceKey} source assessment is invalid: ${sourceClass.problem}`)
    if (!snapshot.includes(normalizeEvidenceText(source.assessment.basisExcerpt))) {
      problems.push(`${source.sourceKey} source-assessment basisExcerpt is absent from the captured snapshot`)
    }
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
      sourceTier: sourceClass.sourceTier,
      isPrimary: sourceClass.isPrimary,
      publisherIdentityMethod: sourceClass.publisherIdentityMethod,
      ...(sourceClass.publisherIdentityRule ? { publisherIdentityRule: sourceClass.publisherIdentityRule } : {}),
      ...(sourceClass.trustedHostConfigurationHash ? { trustedHostConfigurationHash: sourceClass.trustedHostConfigurationHash } : {}),
      assessment: { ...source.assessment, assessedBy: input.completedBy, assessedAt },
      independenceGroup: stableHash(organizationHost(finalHost)).slice(0, 24),
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
    organizationByKey.set(source.sourceKey, organizationHost(finalHost))
    publisherByKey.set(source.sourceKey, normalizedPublisher(source.publisher))
    fingerprintByKey.set(source.sourceKey, snapshotFingerprint(snapshot))
    sourceHostById.set(evidence.data.sourceId, finalHost)
  }

  // Same organization, same accountable publisher, and near-duplicate page
  // content are unioned before independence is counted. Caller-provided source
  // labels can therefore only reduce, never inflate, independent-source groups.
  const keys = [...sourceByKey.keys()].sort()
  const parent = new Map(keys.map((key) => [key, key]))
  const find = (key: string): string => {
    const current = parent.get(key) ?? key
    if (current === key) return key
    const root = find(current)
    parent.set(key, root)
    return root
  }
  const union = (left: string, right: string): void => {
    const leftRoot = find(left)
    const rightRoot = find(right)
    if (leftRoot === rightRoot) return
    parent.set(leftRoot < rightRoot ? rightRoot : leftRoot, leftRoot < rightRoot ? leftRoot : rightRoot)
  }
  for (let leftIndex = 0; leftIndex < keys.length; leftIndex++) {
    for (let rightIndex = leftIndex + 1; rightIndex < keys.length; rightIndex++) {
      const left = keys[leftIndex]
      const right = keys[rightIndex]
      const sameOrganization = organizationByKey.get(left) === organizationByKey.get(right)
      const leftPublisher = publisherByKey.get(left)
      const samePublisher = Boolean(leftPublisher && leftPublisher === publisherByKey.get(right))
      const similarContent = nearDuplicate(fingerprintByKey.get(left) ?? new Set(), fingerprintByKey.get(right) ?? new Set())
      if (sameOrganization || samePublisher || similarContent) union(left, right)
    }
  }
  const membersByRoot = new Map<string, string[]>()
  for (const key of keys) {
    const root = find(key)
    membersByRoot.set(root, [...(membersByRoot.get(root) ?? []), key])
  }
  for (const key of keys) {
    const source = sourceByKey.get(key)!
    const members = membersByRoot.get(find(key))!.sort()
    sourceByKey.set(key, EvidenceSourceSchema.parse({ ...source, independenceGroup: stableHash({ sourceCluster: members }).slice(0, 24) }))
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
    if (link.relation === 'supports') {
      const claim = claimById.get(link.claimId)
      if (claim) {
        const mismatch = factualCompatibility(claim.claim, link.supportingExcerpt)
        if (mismatch.length) problems.push(`${link.sourceKey} support direction does not match claim ${link.claimId}: ${mismatch.join(', ')}`)
      }
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
      if (!strong && !(input.conclusionStrength === 'qualified' && supporting.filter((source) => source.sourceTier === 'professional' && source.publisherIdentityMethod !== 'unverified').length >= 2)) {
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
  const completedAt = assessedAt
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
  await appendRecordsAtomically([
    { collection: 'research-reviews', record: { id: researchId, ...review } },
    { collection: 'audit-events', record: {
      event: `research.${status}`,
      researchId,
      contentId: content.contentId,
      revisionId: content.revisionId,
      researchBundleHash,
      actor: input.completedBy,
      problems,
    } },
  ])
  const data = {
    researchId,
    status,
    subjectHash,
    researchBundleHash,
    sourceCount: review.sources.length,
    independentSourceGroups: independentEvidence.size,
    problems,
    research: review,
  }
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

export const getName = 'mediaops.research.get'
export const getDescription =
  'Retrieve one complete hash-verified research bundle, including server-derived source identity/tier/independence fields and exact evidence-link IDs required by downstream editorial review.'
export const getInputSchema = { researchId: z.string().uuid() }

export async function getHandler(args: { researchId: string }): Promise<Envelope> {
  const parsed = z.object({ researchId: z.string().uuid() }).safeParse(args)
  if (!parsed.success) return err('INVALID_RESEARCH_ID', parsed.error.message)
  const research = await getResearchReview(parsed.data.researchId)
  return research ? ok({ research }, storageWarnings()) : err('NOT_FOUND', `No research bundle ${parsed.data.researchId}.`)
}
