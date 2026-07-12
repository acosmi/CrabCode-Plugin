import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { ok, err, type Envelope } from '../envelope.ts'
import {
  AiDisclosureSchema,
  AssetSchema,
  BrandIdSchema,
  ContentManifestSchema,
  LegalReviewSchema,
  OriginalityReviewSchema,
  ReviewSchema,
  computeContentHash,
  type ContentManifest,
} from '../domain.ts'
import { appendRecord, getRecord, listRecords, storageWarnings } from '../storage.ts'

const saveSchema = z.object({
  contentId: z.string().uuid().optional(),
  expectedRevision: z.number().int().positive().optional(),
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
  savedBy: z.string().min(1),
})

export const saveName = 'mediaops.content.save'
export const saveDescription =
  'Create or append a validated content-manifest revision. Every revision is immutable, hash-addressed and brand/profile scoped.'
export const saveInputSchema = saveSchema.shape

type SaveArgs = z.input<typeof saveSchema>

function stageRank(stage: ContentManifest['stage']): number {
  return ['intake', 'researched', 'drafted', 'reviewed'].indexOf(stage)
}

export async function getLatestContent(contentId: string): Promise<ContentManifest | null> {
  const records = await listRecords('content', { contentId })
  if (!records.length) return null
  const parsed = records
    .map((record) => ContentManifestSchema.safeParse(record))
    .filter((result): result is { success: true; data: ContentManifest } => result.success)
    .map((result) => result.data)
    .sort((a, b) => b.revision - a.revision)
  return parsed[0] ?? null
}

export async function saveHandler(args: SaveArgs): Promise<Envelope> {
  const parsed = saveSchema.safeParse(args)
  if (!parsed.success) {
    return err('INVALID_CONTENT_MANIFEST', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '))
  }
  const input = parsed.data
  const contentId = input.contentId ?? randomUUID()
  const previous = await getLatestContent(contentId)
  if (previous) {
    if (previous.brandId !== input.brandId) {
      return err('BRAND_SCOPE_MISMATCH', 'A contentId cannot move between brandId scopes.')
    }
    if (input.expectedRevision !== undefined && input.expectedRevision !== previous.revision) {
      return err('REVISION_CONFLICT', `Expected revision ${input.expectedRevision}, current revision is ${previous.revision}.`)
    }
    if (stageRank(input.stage) < stageRank(previous.stage)) {
      return err('INVALID_STAGE_TRANSITION', `Content stage cannot move backward from ${previous.stage} to ${input.stage}.`)
    }
  }
  if (input.stage === 'reviewed' && !input.review) {
    return err('REVIEW_REQUIRED', 'A reviewed content revision must include a completed fact-check review.')
  }

  const revision = (previous?.revision ?? 0) + 1
  const revisionId = randomUUID()
  const createdAt = new Date().toISOString()
  const withoutHash = {
    contentId,
    kind: input.kind,
    brandId: input.brandId,
    profileVersion: input.profileVersion,
    stage: input.stage,
    parentIds: input.parentIds,
    ...(input.platform ? { platform: input.platform } : {}),
    title: input.title,
    bodyMarkdown: input.bodyMarkdown,
    ...(input.summary ? { summary: input.summary } : {}),
    citations: input.citations,
    assets: input.assets,
    ...(input.review ? { review: input.review } : {}),
    ...(input.originalityReview ? { originalityReview: input.originalityReview } : {}),
    ...(input.legalReview ? { legalReview: input.legalReview } : {}),
    ...(input.aiDisclosure ? { aiDisclosure: input.aiDisclosure } : {}),
    savedBy: input.savedBy,
  }
  const contentHash = computeContentHash(withoutHash)
  const manifest: ContentManifest = ContentManifestSchema.parse({
    ...withoutHash,
    revisionId,
    revision,
    contentHash,
    createdAt,
  })
  await appendRecord('content', { id: revisionId, ...manifest })
  await appendRecord('audit-events', {
    event: 'content.revision.saved',
    contentId,
    revisionId,
    revision,
    contentHash,
    brandId: input.brandId,
    actor: input.savedBy,
  })
  return ok({ contentId, revisionId, revision, stage: input.stage, contentHash }, storageWarnings())
}

export const getName = 'mediaops.content.get'
export const getDescription = 'Fetch the latest content manifest by contentId, or an immutable revision by revisionId.'
export const getInputSchema = { contentId: z.string().uuid().optional(), revisionId: z.string().uuid().optional() }

export async function getHandler(args: { contentId?: string; revisionId?: string }): Promise<Envelope> {
  if (!args.contentId && !args.revisionId) return err('INVALID_ARGUMENT', 'Provide contentId or revisionId.')
  if (args.revisionId) {
    const record = await getRecord('content', args.revisionId)
    if (!record) return err('NOT_FOUND', `No content revision ${args.revisionId}.`, storageWarnings())
    const parsed = ContentManifestSchema.safeParse(record)
    if (!parsed.success) return err('INVALID_STORED_CONTENT', `Stored revision ${args.revisionId} is invalid.`)
    if (args.contentId && parsed.data.contentId !== args.contentId) return err('PACKAGE_INPUT_MISMATCH', 'contentId and revisionId do not match.')
    return ok(parsed.data, storageWarnings())
  }
  const latest = await getLatestContent(args.contentId!)
  if (!latest) return err('NOT_FOUND', `No content ${args.contentId}.`, storageWarnings())
  return ok(latest, storageWarnings())
}

export const listName = 'mediaops.content.list'
export const listDescription = 'List latest content manifests, optionally scoped by brand, kind or stage.'
export const listInputSchema = {
  brandId: BrandIdSchema.optional(),
  kind: z.enum(['brief', 'draft', 'variant']).optional(),
  stage: z.enum(['intake', 'researched', 'drafted', 'reviewed']).optional(),
}

export async function listHandler(args: { brandId?: string; kind?: string; stage?: string }): Promise<Envelope> {
  const records = await listRecords('content')
  const latest = new Map<string, ContentManifest>()
  for (const record of records) {
    const parsed = ContentManifestSchema.safeParse(record)
    if (!parsed.success) continue
    const current = latest.get(parsed.data.contentId)
    if (!current || parsed.data.revision > current.revision) latest.set(parsed.data.contentId, parsed.data)
  }
  const manifests = [...latest.values()].filter(
    (item) =>
      (!args.brandId || item.brandId === args.brandId) &&
      (!args.kind || item.kind === args.kind) &&
      (!args.stage || item.stage === args.stage),
  )
  return ok({ count: manifests.length, manifests }, storageWarnings())
}
