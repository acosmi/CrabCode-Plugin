import { createHash } from 'node:crypto'
import { z } from 'zod'

export const VERSION = '0.3.0'

export const BrandIdSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,63}$/, 'brandId must be a lowercase slug (a-z, 0-9, hyphens)')

export const ClaimSchema = z.object({
  id: z.string().min(1),
  claim: z.string().min(1),
  status: z.enum(['verified', 'doubtful', 'unsourced']),
  sourceUrl: z.string().url().optional(),
})

export const ReviewSchema = z.object({
  status: z.literal('completed'),
  completedBy: z.string().min(1),
  completedAt: z.string().datetime(),
  claims: z.array(ClaimSchema),
  noVerifiableClaimsReason: z.string().min(1).optional(),
  waivers: z
    .array(
      z.object({
        claimId: z.string().min(1),
        by: z.string().min(1),
        reason: z.string().min(1),
      }),
    )
    .default([]),
})

export const OriginalityReviewSchema = z.object({
  status: z.enum(['completed', 'changes_required', 'evidence_required']),
  reviewedBy: z.string().min(1),
  reviewedAt: z.string().datetime(),
  conclusion: z.enum(['publishable', 'publish_after_changes', 'needs_evidence']),
  notes: z.array(z.string()).default([]),
})

export const LegalReviewSchema = z.object({
  status: z.enum(['not_required', 'completed', 'required']),
  reviewedBy: z.string().min(1),
  reviewedAt: z.string().datetime(),
  riskLevel: z.enum(['low', 'medium', 'high']),
  notes: z.array(z.string()).default([]),
})

export const AiDisclosureSchema = z.object({
  aiAssisted: z.boolean(),
  methods: z.array(z.enum(['platform-native', 'body-label', 'file-metadata'])).default([]),
  bodyLabelText: z.string().min(1).optional(),
  platformNativeConfirmed: z.boolean().optional(),
  fileMetadataConfirmed: z.boolean().optional(),
  confirmedBy: z.string().min(1).optional(),
  ruleVersion: z.string().min(1).optional(),
})

export const AssetSchema = z.object({
  path: z.string().min(1),
  role: z.string().min(1).default('inline'),
  rightsStatus: z.enum(['owned', 'licensed', 'public-domain', 'pending']).default('pending'),
})

export const ContentManifestSchema = z.object({
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
  assets: z.array(AssetSchema).default([]),
  review: ReviewSchema.optional(),
  originalityReview: OriginalityReviewSchema.optional(),
  legalReview: LegalReviewSchema.optional(),
  aiDisclosure: AiDisclosureSchema.optional(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  savedBy: z.string().min(1),
  createdAt: z.string().datetime(),
})

export type ContentManifest = z.infer<typeof ContentManifestSchema>
export type Claim = z.infer<typeof ClaimSchema>

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonicalize(v)]),
    )
  }
  return value
}

export function stableHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex')
}

export function computeContentHash(
  content: Omit<ContentManifest, 'contentHash' | 'revisionId' | 'revision' | 'createdAt'>,
): string {
  return stableHash(content)
}
