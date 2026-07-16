import { createHash } from 'node:crypto'
import { z } from 'zod'

export const VERSION = '0.4.0'
export const SCHEMA_VERSION = 2 as const

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/)
export { Sha256Schema }

export function isSafeHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && Boolean(parsed.hostname)
  } catch {
    return false
  }
}

export function isSafeLinkUrl(value: string): boolean {
  if (value.startsWith('#')) return /^#[A-Za-z0-9_:.~-]+$/.test(value)
  try {
    const parsed = new URL(value)
    return ['https:', 'http:', 'mailto:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

export const SafeHttpUrlSchema = z.string().refine(isSafeHttpUrl, 'URL must use http:// or https://')

export const BrandIdSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,63}$/, 'brandId must be a lowercase slug (a-z, 0-9, hyphens)')

export function namedActorKey(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase()
}

export function namedActorsEqual(left: string, right: string): boolean {
  return namedActorKey(left) === namedActorKey(right)
}

export const ReferenceRoleSchema = z.enum([
  'user_owned_draft',
  'authorized_sample',
  'third_party_reference',
  'factual_source',
])

export const ReferenceAllowedUseSchema = z.enum([
  'rewrite',
  'fact_leads',
  'abstract_style_features',
  'attributed_quotation',
  'originality_comparison',
])

export const ReferenceMaterialSchema = z
  .object({
    referenceId: z.string().uuid(),
    role: ReferenceRoleSchema,
    rightsStatus: z.enum(['owned', 'licensed', 'public_domain', 'unknown']),
    allowedUses: z.array(ReferenceAllowedUseSchema).min(1),
    title: z.string().min(1).max(300),
    url: SafeHttpUrlSchema.optional(),
    contentHash: Sha256Schema,
    eligibleAsEvidence: z.boolean(),
    doNotCopyFeatures: z.array(z.string().min(1).max(240)).max(24).default([]),
    registeredAt: z.string().datetime(),
    registeredBy: z.string().min(1),
  })
  .superRefine((value, ctx) => {
    if (value.role === 'third_party_reference') {
      if (value.allowedUses.includes('rewrite')) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['allowedUses'], message: 'third-party material cannot be used as a rewrite base' })
      }
      if (value.eligibleAsEvidence) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['eligibleAsEvidence'], message: 'a user reference cannot count as independently verified evidence' })
      }
      if (value.doNotCopyFeatures.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['doNotCopyFeatures'], message: 'third-party material requires a do-not-copy feature list' })
      }
    }
    if (value.role === 'authorized_sample' && !['owned', 'licensed', 'public_domain'].includes(value.rightsStatus)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['rightsStatus'], message: 'authorized samples require owned, licensed or public-domain rights' })
    }
    if (value.role === 'user_owned_draft' && value.rightsStatus !== 'owned') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['rightsStatus'], message: 'user-owned drafts must be recorded as owned' })
    }
  })

export type ReferenceMaterial = z.infer<typeof ReferenceMaterialSchema>

export const ResearchCaptureSchema = z.object({
  captureId: z.string().uuid(),
  requestedUrl: SafeHttpUrlSchema,
  finalUrl: SafeHttpUrlSchema,
  httpStatus: z.number().int().min(200).max(299),
  contentType: z.string().min(1).max(200),
  snapshotText: z.string().min(1).max(2_000_000),
  snapshotHash: Sha256Schema,
  contentHash: Sha256Schema,
  byteSize: z.number().int().positive().max(2_000_000),
  connectedAddress: z.string().ip(),
  resolvedAddresses: z.array(z.string().ip()).min(1).max(32),
  capturedAt: z.string().datetime(),
  capturedBy: z.string().trim().min(1).max(300),
  captureHash: Sha256Schema,
})

export type ResearchCapture = z.infer<typeof ResearchCaptureSchema>

export const SourceAssessmentSchema = z.object({
  publisherType: z.enum([
    'government',
    'court',
    'standards_body',
    'academic',
    'company',
    'professional_media',
    'industry_organization',
    'individual',
    'unknown',
  ]),
  sourceFunction: z.enum([
    'original_record',
    'first_party_statement',
    'official_interpretation',
    'independent_reporting',
    'professional_analysis',
    'context',
  ]),
  originRelationship: z.enum(['original', 'syndicated', 'unknown']),
  basisExcerpt: z.string().min(1).max(1500),
  classificationRationale: z.string().min(20).max(2000),
  assessedBy: z.string().trim().min(1).max(300),
  assessedAt: z.string().datetime(),
}).strict()

export const EvidenceSourceSchema = z.object({
  sourceId: z.string().uuid(),
  canonicalUrl: SafeHttpUrlSchema,
  finalUrl: SafeHttpUrlSchema,
  httpStatus: z.number().int().min(200).max(299),
  contentType: z.string().min(1).max(200),
  title: z.string().min(1).max(500),
  creator: z.string().max(300).optional(),
  publisher: z.string().min(1).max(300),
  publishedAt: z.string().datetime().optional(),
  accessedAt: z.string().datetime(),
  sourceTier: z.enum(['primary', 'authoritative', 'professional', 'context']),
  isPrimary: z.boolean(),
  publisherIdentityMethod: z.enum(['recognized-institutional-domain', 'configured-trusted-host', 'unverified']),
  publisherIdentityRule: z.string().min(1).max(253).optional(),
  trustedHostConfigurationHash: Sha256Schema.optional(),
  assessment: SourceAssessmentSchema,
  independenceGroup: z.string().min(1).max(200),
  retrievalStatus: z.literal('retrieved'),
  snapshotRef: z.string().max(1000).optional(),
  snapshotHash: Sha256Schema,
  contentHash: Sha256Schema,
  rightsOrTerms: z.string().max(1000).optional(),
}).strict().superRefine((value, ctx) => {
  const strongIdentity = value.publisherIdentityMethod !== 'unverified'
  if (value.isPrimary !== (value.sourceTier === 'primary')) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['isPrimary'], message: 'isPrimary must be true exactly when sourceTier is primary' })
  }
  if ((value.sourceTier === 'primary' || value.sourceTier === 'authoritative') && !strongIdentity) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['publisherIdentityMethod'], message: `${value.sourceTier} sources require verified publisher-host identity` })
  }
  const functionByTier: Record<typeof value.sourceTier, ReadonlySet<typeof value.assessment.sourceFunction>> = {
    primary: new Set(['original_record', 'first_party_statement']),
    authoritative: new Set(['official_interpretation']),
    professional: new Set(['independent_reporting', 'professional_analysis']),
    context: new Set(['original_record', 'first_party_statement', 'official_interpretation', 'independent_reporting', 'professional_analysis', 'context']),
  }
  if (!functionByTier[value.sourceTier].has(value.assessment.sourceFunction)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sourceTier'], message: `sourceTier ${value.sourceTier} is incompatible with sourceFunction ${value.assessment.sourceFunction}` })
  }
  if (value.sourceTier !== 'context' && value.assessment.originRelationship !== 'original') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['assessment', 'originRelationship'], message: 'non-context source tiers require an original source relationship' })
  }
  let finalHost = ''
  try {
    finalHost = new URL(value.finalUrl).hostname.toLowerCase().replace(/\.$/, '')
  } catch {
    // SafeHttpUrlSchema reports the URL issue separately.
  }
  const ruleMatches = (rule: string): boolean => value.publisherIdentityMethod === 'configured-trusted-host'
    ? (rule.startsWith('*.') ? finalHost.endsWith(rule.slice(1)) && finalHost !== rule.slice(2) : finalHost === rule)
    : finalHost === rule || finalHost.endsWith(`.${rule}`)
  if (value.publisherIdentityMethod === 'unverified') {
    if (value.publisherIdentityRule || value.trustedHostConfigurationHash) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['publisherIdentityRule'], message: 'unverified publisher identity must not carry a trust rule or configuration hash' })
    }
  } else if (!value.publisherIdentityRule || !ruleMatches(value.publisherIdentityRule)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['publisherIdentityRule'], message: 'verified publisher identity requires the exact matching host rule' })
  }
  if (value.publisherIdentityMethod === 'configured-trusted-host' && !value.trustedHostConfigurationHash) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['trustedHostConfigurationHash'], message: 'configured host trust requires a configuration hash' })
  }
  if (value.publisherIdentityMethod !== 'configured-trusted-host' && value.trustedHostConfigurationHash) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['trustedHostConfigurationHash'], message: 'configuration hash is only valid for configured host trust' })
  }
})

export const ResearchClaimSchema = z.object({
  id: z.string().min(1).max(120),
  claim: z.string().min(1).max(2000),
  core: z.boolean().default(true),
  temporallySensitive: z.boolean().default(false),
  controversial: z.boolean().default(false),
})

export const ClaimEvidenceLinkSchema = z.object({
  claimId: z.string().min(1).max(120),
  sourceId: z.string().uuid(),
  relation: z.enum(['supports', 'contradicts', 'contextualizes']),
  supportType: z.enum(['direct', 'partial', 'contextual']),
  locator: z.string().min(1).max(500),
  supportingExcerpt: z.string().min(1).max(1500),
  sourceInterpretation: z.string().min(1).max(1500),
  limitations: z.string().min(1).max(1000),
  checkedAt: z.string().datetime(),
})

export const ResearchSearchLogSchema = z.object({
  query: z.string().min(1).max(500),
  executedAt: z.string().datetime(),
  resultCount: z.number().int().nonnegative(),
  tool: z.enum(['web-search', 'web-fetch', 'official-api']),
})

export const ResearchReviewSchema = z.object({
  researchId: z.string().uuid(),
  contentId: z.string().uuid(),
  sourceRevisionId: z.string().uuid(),
  subjectHash: Sha256Schema,
  claimSetHash: Sha256Schema,
  claims: z.array(ResearchClaimSchema).max(200),
  sources: z.array(EvidenceSourceSchema).max(100),
  evidenceLinks: z.array(ClaimEvidenceLinkSchema).max(1000),
  searches: z.array(ResearchSearchLogSchema).min(1).max(100),
  counterEvidenceSourceIds: z.array(z.string().uuid()).max(100).default([]),
  unresolvedGaps: z.array(z.string().min(1).max(1000)).max(100).default([]),
  noVerifiableClaimsReason: z.string().min(1).max(1000).optional(),
  conclusionStrength: z.enum(['normal', 'qualified']),
  status: z.enum(['completed', 'incomplete']),
  policyVersion: z.string().min(1),
  researchBundleHash: Sha256Schema,
  completedBy: z.string().trim().min(1).max(300),
  completedAt: z.string().datetime(),
})

export type ResearchReview = z.infer<typeof ResearchReviewSchema>

export const ClaimSchema = z.object({
  id: z.string().min(1),
  claim: z.string().min(1),
  status: z.enum(['verified', 'doubtful', 'unsourced']),
  evidenceLinkIds: z.array(z.string().min(1)).default([]),
})

export const VerifiableStatementSchema = z.object({
  statementId: Sha256Schema,
  location: z.enum(['title', 'summary', 'body']),
  ordinal: z.number().int().nonnegative(),
  text: z.string().min(1).max(5000),
  signals: z.array(z.string().min(1).max(200)).min(1).max(50),
})

export const StatementCoverageSchema = z.object({
  statementId: Sha256Schema,
  classification: z.enum(['verified_fact', 'author_inference', 'opinion', 'non_claim']),
  claimIds: z.array(z.string().min(1).max(120)).max(20),
  directionConfirmed: z.literal(true).optional(),
  rationale: z.string().min(20).max(2000),
  inferenceMarker: z.string().min(1).max(120).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.classification === 'verified_fact' || value.classification === 'author_inference') {
    if (value.claimIds.length === 0) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['claimIds'], message: `${value.classification} requires at least one verified research claim` })
    if (value.directionConfirmed !== true) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['directionConfirmed'], message: `${value.classification} requires directionConfirmed=true` })
  } else if (value.claimIds.length > 0 || value.directionConfirmed !== undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['claimIds'], message: `${value.classification} must not claim factual evidence coverage` })
  }
  if (value.classification === 'author_inference' && !value.inferenceMarker) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['inferenceMarker'], message: 'author_inference requires the exact visible inference marker' })
  }
  if (value.classification !== 'author_inference' && value.inferenceMarker !== undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['inferenceMarker'], message: 'inferenceMarker is only valid for author_inference' })
  }
})

export const ReviewSchema = z.object({
  status: z.literal('completed'),
  subjectHash: Sha256Schema,
  researchId: z.string().uuid(),
  researchBundleHash: Sha256Schema,
  completedBy: z.string().trim().min(1).max(300),
  completedAt: z.string().datetime(),
  claims: z.array(ClaimSchema).max(200),
  statementLedgerHash: Sha256Schema,
  statements: z.array(VerifiableStatementSchema).max(1000),
  statementCoverage: z.array(StatementCoverageSchema).max(1000),
  noVerifiableClaimsReason: z.string().min(1).optional(),
  waivers: z
    .array(
      z.object({
        claimId: z.string().min(1),
        by: z.string().trim().min(1).max(300),
        reason: z.string().min(1),
      }),
    )
    .max(200)
    .default([]),
})

export const LegalReviewSchema = z.object({
  status: z.enum(['not_required', 'completed', 'required']),
  reviewedBy: z.string().trim().min(1).max(300),
  reviewedAt: z.string().datetime(),
  riskLevel: z.enum(['low', 'medium', 'high']),
  notes: z.array(z.string().max(1000)).default([]),
})

export const AiDisclosureSchema = z.object({
  aiAssisted: z.boolean(),
  methods: z.array(z.enum(['platform-native', 'body-label', 'file-metadata'])).max(3).default([]),
  bodyLabelText: z.string().min(1).max(500).optional(),
  platformNativeConfirmed: z.boolean().optional(),
  fileMetadataConfirmed: z.boolean().optional(),
  confirmedBy: z.string().trim().min(1).max(300).optional(),
  ruleVersion: z.string().min(1).optional(),
}).strict().superRefine((value, ctx) => {
  if (new Set(value.methods).size !== value.methods.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['methods'], message: 'AI disclosure methods must be unique' })
  }
  if (value.aiAssisted) {
    if (!value.methods.length || !value.confirmedBy) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['methods'], message: 'AI-assisted content requires at least one confirmed disclosure method' })
  } else if (value.methods.length || value.bodyLabelText || value.platformNativeConfirmed !== undefined || value.fileMetadataConfirmed !== undefined || value.confirmedBy || value.ruleVersion) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['aiAssisted'], message: 'non-AI-assisted content must not carry disclosure fields' })
  }
  if (value.methods.includes('body-label') && !value.bodyLabelText) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['bodyLabelText'], message: 'bodyLabelText is required when body-label is declared' })
  } else if (!value.methods.includes('body-label') && value.bodyLabelText) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['bodyLabelText'], message: 'bodyLabelText is forbidden unless body-label is declared' })
  }
  if (value.methods.includes('platform-native') ? value.platformNativeConfirmed !== true : value.platformNativeConfirmed !== undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['platformNativeConfirmed'], message: 'platformNativeConfirmed=true is required exactly when platform-native is declared' })
  }
  if (value.methods.includes('file-metadata') ? value.fileMetadataConfirmed !== true : value.fileMetadataConfirmed !== undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fileMetadataConfirmed'], message: 'fileMetadataConfirmed=true is required exactly when file-metadata is declared' })
  }
})

export const AssetInputSchema = z.object({
  path: z.string().min(1),
  role: z.string().min(1).max(80).default('inline'),
  rightsStatus: z.enum(['owned', 'licensed', 'public-domain', 'pending']).default('pending'),
  alt: z.string().min(1).max(500).optional(),
  caption: z.string().min(1).max(1000).optional(),
  sourceUrl: SafeHttpUrlSchema.optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
})

export const AssetSchema = AssetInputSchema.extend({
  assetId: z.string().uuid(),
  sha256: Sha256Schema,
  byteSize: z.number().int().positive(),
  mediaType: z.enum(['image/png', 'image/jpeg', 'image/gif', 'image/webp']),
  registeredAt: z.string().datetime(),
})

export type Asset = z.infer<typeof AssetSchema>

const ArticleNodeTypeSchema = z.enum([
  'root',
  'paragraph',
  'heading',
  'text',
  'emphasis',
  'strong',
  'delete',
  'inlineCode',
  'code',
  'blockquote',
  'list',
  'listItem',
  'link',
  'image',
  'thematicBreak',
  'break',
  'table',
  'tableRow',
  'tableCell',
  'footnoteDefinition',
  'footnoteReference',
])

export type ArticleNode = {
  type: z.infer<typeof ArticleNodeTypeSchema>
  value?: string
  depth?: 2 | 3 | 4
  url?: string
  title?: string | null
  alt?: string
  lang?: string | null
  meta?: string | null
  ordered?: boolean
  start?: number | null
  spread?: boolean
  checked?: boolean | null
  align?: Array<'left' | 'right' | 'center' | null>
  identifier?: string
  label?: string
  children?: ArticleNode[]
}

export const ArticleNodeSchema: z.ZodType<ArticleNode> = z.lazy(() =>
  z
    .object({
      type: ArticleNodeTypeSchema,
      value: z.string().optional(),
      depth: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
      url: z.string().optional(),
      title: z.string().nullable().optional(),
      alt: z.string().optional(),
      lang: z.string().nullable().optional(),
      meta: z.string().nullable().optional(),
      ordered: z.boolean().optional(),
      start: z.number().int().nullable().optional(),
      spread: z.boolean().optional(),
      checked: z.boolean().nullable().optional(),
      align: z.array(z.enum(['left', 'right', 'center']).nullable()).optional(),
      identifier: z.string().optional(),
      label: z.string().optional(),
      children: z.array(ArticleNodeSchema).optional(),
    })
    .strict(),
)

export const CitationSchema = z.object({
  sourceId: z.string().uuid().optional(),
  url: SafeHttpUrlSchema,
  title: z.string().min(1).max(500),
  publisher: z.string().max(300).optional(),
  publishedAt: z.string().datetime().optional(),
  accessedAt: z.string().datetime().optional(),
})

export const ArticleDocSchema = z.object({
  schemaVersion: z.literal('article-doc@1'),
  language: z.string().regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/),
  title: z.string().min(1).max(500),
  summary: z.string().max(2000).optional(),
  body: ArticleNodeSchema,
  citations: z.array(CitationSchema).max(200),
  assets: z.array(
    AssetSchema.omit({ path: true, registeredAt: true }).extend({ packagePath: z.string().optional() }),
  ).max(100),
  disclosures: z.array(z.string().min(1).max(1000)).max(20),
})

export type ArticleDoc = z.infer<typeof ArticleDocSchema>

export const OriginalityHumanReviewSchema = z.object({
  decision: z.enum(['pass', 'changes_required']),
  reviewedBy: z.string().trim().min(1).max(300),
  reviewedAt: z.string().datetime(),
  rationale: z.string().min(20).max(3000),
  structureIndependent: z.boolean(),
  argumentIndependent: z.boolean(),
  attributedQuotations: z.array(z.string().min(1).max(500)).max(20).default([]),
})

export const OriginalityScanSchema = z.object({
  scanId: z.string().uuid(),
  contentId: z.string().uuid(),
  sourceRevisionId: z.string().uuid(),
  subjectHash: Sha256Schema,
  referenceHashes: z.array(z.object({ referenceId: z.string().uuid(), contentHash: Sha256Schema, role: ReferenceRoleSchema })).max(100),
  quotations: z.array(z.object({ referenceId: z.string().uuid(), text: z.string().min(1).max(200), attribution: z.string().min(1).max(300), locator: z.string().min(1).max(300) })).max(20).default([]),
  algorithmVersion: z.string().min(1),
  policyVersion: z.string().min(1),
  parameters: z.object({ ngramSizes: z.array(z.number().int().positive()).min(1).max(10), paragraphThreshold: z.number().min(0).max(1), paragraphCandidateLimit: z.number().int().positive().optional() }).strict(),
  exactMatches: z.array(z.object({ referenceId: z.string().uuid(), text: z.string().max(200), length: z.number().int().nonnegative() })).max(20),
  longestNormalizedMatch: z.number().int().nonnegative(),
  draftCoverage: z.number().min(0).max(1),
  referenceCoverage: z.number().min(0).max(1),
  ngramMatches: z.record(z.string(), z.number().int().nonnegative()),
  paragraphAlignments: z.array(z.object({ referenceId: z.string().uuid(), draftIndex: z.number().int().nonnegative(), referenceIndex: z.number().int().nonnegative(), similarity: z.number().min(0).max(1) })).max(100),
  outlineSimilarity: z.number().min(0).max(1),
  semanticFlags: z.array(z.string().max(500)).max(20),
  decision: z.enum(['blocked', 'changes_required', 'human_review_required', 'low_risk']),
  reviewRequired: z.boolean(),
  createdAt: z.string().datetime(),
  createdBy: z.string().trim().min(1).max(300),
  humanReview: OriginalityHumanReviewSchema.optional(),
  scanHash: Sha256Schema,
})

export type OriginalityScan = z.infer<typeof OriginalityScanSchema>

export const EditorialReviewRecordSchema = z.object({
  reviewId: z.string().uuid(),
  contentId: z.string().uuid(),
  sourceRevisionId: z.string().uuid(),
  subjectHash: Sha256Schema,
  originalityScanId: z.string().uuid(),
  factReview: ReviewSchema,
  legalReview: LegalReviewSchema,
  aiDisclosure: AiDisclosureSchema,
  completedBy: z.string().trim().min(1).max(300),
  completedAt: z.string().datetime(),
  reviewHash: Sha256Schema,
})

export type EditorialReviewRecord = z.infer<typeof EditorialReviewRecordSchema>

const BaseContentSchema = z.object({
  contentId: z.string().uuid(),
  revisionId: z.string().uuid(),
  revision: z.number().int().positive(),
  kind: z.enum(['brief', 'draft', 'variant']),
  brandId: BrandIdSchema,
  profileVersion: z.string().min(1),
  stage: z.enum(['intake', 'researched', 'drafted', 'reviewed']),
  parentIds: z.array(z.string().uuid()).default([]),
  platform: z.enum(['wechat', 'xhs', 'toutiao']).optional(),
  title: z.string().min(1),
  bodyMarkdown: z.string(),
  summary: z.string().optional(),
  assets: z.array(AssetSchema).default([]),
  contentHash: Sha256Schema,
  savedBy: z.string().trim().min(1).max(300),
  createdAt: z.string().datetime(),
})

export const ContentManifestV2Schema = BaseContentSchema.extend({
  schemaVersion: z.literal(2),
  contentLanguage: z.string().default('zh-CN'),
  researchSubject: z.string().min(1).max(1000),
  referenceIds: z.array(z.string().uuid()).max(100).default([]),
  researchId: z.string().uuid().optional(),
  originalityScanId: z.string().uuid().optional(),
  editorialReviewId: z.string().uuid().optional(),
  citations: z.array(CitationSchema).max(200).default([]),
  articleDoc: ArticleDocSchema,
  articleDocHash: Sha256Schema,
  originalitySubjectHash: Sha256Schema,
  researchBundleHash: Sha256Schema.optional(),
  review: ReviewSchema.optional(),
  legalReview: LegalReviewSchema.optional(),
  aiDisclosure: AiDisclosureSchema.optional(),
})

const LegacyClaimSchema = z.object({
  id: z.string().min(1),
  claim: z.string().min(1),
  status: z.enum(['verified', 'doubtful', 'unsourced']),
  sourceUrl: z.string().url().optional(),
})

const LegacyReviewSchema = z.object({
  status: z.literal('completed'),
  completedBy: z.string().min(1),
  completedAt: z.string().datetime(),
  claims: z.array(LegacyClaimSchema),
  noVerifiableClaimsReason: z.string().min(1).optional(),
  waivers: z.array(z.object({ claimId: z.string(), by: z.string(), reason: z.string() })).default([]),
})

const LegacyOriginalityReviewSchema = z.object({
  status: z.enum(['completed', 'changes_required', 'evidence_required']),
  reviewedBy: z.string().min(1),
  reviewedAt: z.string().datetime(),
  conclusion: z.enum(['publishable', 'publish_after_changes', 'needs_evidence']),
  notes: z.array(z.string()).default([]),
})

export const ContentManifestV1Schema = z.object({
  contentId: z.string().uuid(),
  revisionId: z.string().uuid(),
  revision: z.number().int().positive(),
  kind: z.enum(['brief', 'draft', 'variant']),
  brandId: BrandIdSchema,
  profileVersion: z.string().min(1),
  stage: z.enum(['intake', 'researched', 'drafted', 'reviewed']),
  parentIds: z.array(z.string().uuid()).default([]),
  platform: z.enum(['wechat', 'xhs', 'toutiao']).optional(),
  title: z.string().min(1),
  bodyMarkdown: z.string(),
  summary: z.string().optional(),
  citations: z.array(z.object({ url: z.string().url(), title: z.string().optional() })).default([]),
  assets: z.array(z.object({ path: z.string(), role: z.string().default('inline'), rightsStatus: z.enum(['owned', 'licensed', 'public-domain', 'pending']).default('pending') })).default([]),
  review: LegacyReviewSchema.optional(),
  originalityReview: LegacyOriginalityReviewSchema.optional(),
  legalReview: LegalReviewSchema.optional(),
  aiDisclosure: AiDisclosureSchema.optional(),
  contentHash: Sha256Schema,
  savedBy: z.string().min(1),
  createdAt: z.string().datetime(),
})

export const ContentManifestSchema = z.union([ContentManifestV2Schema, ContentManifestV1Schema])
export type ContentManifestV2 = z.infer<typeof ContentManifestV2Schema>
export type ContentManifest = z.infer<typeof ContentManifestSchema>
export type Claim = z.infer<typeof ClaimSchema>

export const DeliveryArtifactSchema = z.object({
  artifactId: z.string().uuid(),
  role: z.enum(['primary', 'backup', 'channel_variant']),
  format: z.enum(['html', 'markdown']),
  mediaType: z.string().min(1),
  relativePath: z.string().min(1),
  artifactHash: Sha256Schema,
  byteSize: z.number().int().positive(),
  sourceContentHash: Sha256Schema,
  renderProfile: z.string().min(1),
})

export type DeliveryArtifact = z.infer<typeof DeliveryArtifactSchema>

const DeliveryQaArtifactSchema = z.object({
  relativePath: z.string().min(1),
  mediaType: z.string().min(1),
  byteSize: z.number().int().positive(),
  sha256: Sha256Schema,
})

const DeliveryQaEvidenceSchema = z.object({
  schemaVersion: z.literal('mediaops-delivery-qa-evidence@1'),
  status: z.literal('passed'),
  htmlSha256: Sha256Schema,
  tools: z.object({
    java: z.string().nullable(),
    vnuPackage: z.string().min(1),
    vnuRuntime: z.string().nullable(),
    playwright: z.string().min(1),
    chromium: z.string().nullable(),
    axe: z.string().min(1),
  }).strict(),
  checks: z.array(z.object({ id: z.string().min(1), status: z.literal('passed'), detail: z.string().min(1) })).min(1),
  artifacts: z.array(DeliveryQaArtifactSchema).min(3),
  completedAt: z.string().datetime(),
})

export const DeliveryManifestSchema = z.object({
  deliveryId: z.string().uuid(),
  contentId: z.string().uuid(),
  revisionId: z.string().uuid(),
  contentHash: Sha256Schema,
  articleDocHash: Sha256Schema,
  primaryArtifact: DeliveryArtifactSchema,
  backupArtifact: DeliveryArtifactSchema,
  channelArtifacts: z.array(DeliveryArtifactSchema).default([]),
  assets: z.array(z.object({ assetId: z.string().uuid(), relativePath: z.string(), sha256: Sha256Schema, byteSize: z.number().int().positive(), mediaType: z.string() })),
  rendererVersion: z.string().min(1),
  templateId: z.string().min(1),
  templateVersion: z.string().min(1),
  stylePolicyVersion: z.string().min(1),
  sanitizationPolicyVersion: z.string().min(1),
  dependencyLockHash: Sha256Schema,
  renderInputsHash: Sha256Schema,
  parityStatus: z.enum(['passed', 'failed']),
  securityStatus: z.enum(['passed', 'failed']),
  semanticStatus: z.enum(['passed', 'failed']),
  accessibilityStatus: z.enum(['passed', 'failed', 'manual_required']),
  visualReviewStatus: z.enum(['pending', 'passed', 'failed']),
  checks: z.array(z.object({ id: z.string().min(1), status: z.enum(['passed', 'failed']), detail: z.string().min(1) })),
  qaEvidence: DeliveryQaEvidenceSchema.optional(),
  visualReview: z.object({
    reviewedBy: z.string().trim().min(1).max(300),
    reviewedAt: z.string().datetime(),
    viewports: z.array(z.object({ width: z.number().int().positive(), height: z.number().int().positive(), noHorizontalOverflow: z.boolean(), whiteBackground: z.boolean(), readable: z.boolean() })).min(3),
    printChecked: z.boolean(),
    notes: z.array(z.string().min(1).max(1000)).default([]),
  }).optional(),
  verifiedBy: z.string().trim().min(1).max(300).optional(),
  verifiedAt: z.string().datetime().optional(),
  renderManifestHash: Sha256Schema,
  generatedAt: z.string().datetime(),
  generatedBy: z.string().trim().min(1).max(300),
  artifactRoot: z.string().min(1),
})

export type DeliveryManifest = z.infer<typeof DeliveryManifestSchema>

const PackageRelativePathSchema = z.string().min(1).refine((value) =>
  /^[A-Za-z0-9._/-]+$/.test(value) && !value.startsWith('/') && !value.includes(':') && value.split('/').every((part) => part && part !== '.' && part !== '..'),
  'package path must be a safe relative POSIX path',
)

const PackageIdentitySchema = z.object({
  principalId: z.string().min(1),
  issuer: z.string().min(1),
  assurance: z.enum(['mcp_oauth', 'host_principal']),
}).strict()

export const PackageManifestSchema = z.object({
  schemaVersion: z.literal(4),
  packageId: z.string().uuid(),
  pluginVersion: z.string().min(1),
  platform: z.enum(['wechat', 'xhs', 'toutiao']),
  platformDisplayName: z.string().min(1),
  platformRuleVersion: z.string().min(1),
  contentId: z.string().uuid(),
  revisionId: z.string().uuid(),
  contentRevision: z.number().int().positive(),
  contentHash: Sha256Schema,
  articleDocHash: Sha256Schema,
  deliveryId: z.string().uuid(),
  renderManifestHash: Sha256Schema,
  approvalId: z.string().uuid(),
  approvedTransitionVersion: z.number().int().positive(),
  packageCommitTransitionVersion: z.number().int().positive(),
  approvalBindingHash: Sha256Schema,
  primaryArtifact: DeliveryArtifactSchema,
  backupArtifact: DeliveryArtifactSchema,
  channelArtifacts: z.array(DeliveryArtifactSchema),
  assets: z.array(z.object({
    assetId: z.string().uuid(),
    relativePath: PackageRelativePathSchema,
    sha256: Sha256Schema,
    byteSize: z.number().int().positive(),
    mediaType: z.string().min(1),
  }).strict()).max(100),
  qaEvidence: DeliveryQaEvidenceSchema.optional(),
  defaultUserPresentation: z.literal('article.html (HTML primary)'),
  backup: z.literal('article.md (Markdown backup)'),
  publishMode: z.literal('package-only; manual platform submission; no rerender during packaging'),
  packagedBy: z.string().min(1),
  packagedIdentity: PackageIdentitySchema,
  createdAt: z.string().datetime(),
  files: z.array(PackageRelativePathSchema).min(4).max(1000),
}).strict().superRefine((value, ctx) => {
  if (value.primaryArtifact.role !== 'primary' || value.primaryArtifact.format !== 'html') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['primaryArtifact'], message: 'primary artifact must be HTML with role=primary' })
  }
  if (value.backupArtifact.role !== 'backup' || value.backupArtifact.format !== 'markdown') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['backupArtifact'], message: 'backup artifact must be Markdown with role=backup' })
  }
  if (value.channelArtifacts.some((artifact) => artifact.role !== 'channel_variant')) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['channelArtifacts'], message: 'channel artifacts must use role=channel_variant' })
  }
  if (value.packageCommitTransitionVersion !== value.approvedTransitionVersion + 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['packageCommitTransitionVersion'], message: 'package commit transition must immediately follow the approved transition' })
  }
  if (new Set(value.files).size !== value.files.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['files'], message: 'package file inventory must not contain duplicates' })
  }
})

export type PackageManifest = z.infer<typeof PackageManifestSchema>

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
        .map(([k, v]) => [k, canonicalize(v)]),
    )
  }
  return value
}

export function stableHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex')
}

export function computeContentHash(content: Record<string, unknown>): string {
  return stableHash(content)
}

export function contentHashPayload(content: ContentManifest): Record<string, unknown> {
  const { contentHash: _contentHash, revisionId: _revisionId, revision: _revision, createdAt: _createdAt, ...payload } = content
  return payload
}

export function assertStoredContentHash(content: ContentManifest): void {
  const actual = computeContentHash(contentHashPayload(content))
  if (actual !== content.contentHash) {
    throw new Error(`CONTENT_HASH_MISMATCH:${content.contentId}:${content.revisionId}`)
  }
}
