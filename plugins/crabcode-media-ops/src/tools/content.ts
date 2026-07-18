import { createHash, randomUUID } from 'node:crypto'
import { lstat, readFile, realpath } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'
import { z } from 'zod'
import { err, ok, type Envelope } from '../envelope.ts'
import {
  AssetInputSchema,
  BrandIdSchema,
  CitationSchema,
  ContentManifestSchema,
  ContentManifestV2Schema,
  SCHEMA_VERSION,
  assertStoredContentHash,
  computeContentHash,
  stableHash,
  type Asset,
  type ContentManifest,
  type ContentManifestV2,
} from '../domain.ts'
import { buildArticleDoc, editorialSubjectHash, ArticleDocError } from '../rendering/article-doc.ts'
import {
  appendRecordsAtomically,
  dataDir,
  getRecord,
  listRecords,
  StorageConflictError,
  StorageLeaseError,
  storageWarnings,
} from '../storage.ts'
import { getEditorialReview } from './editorial-review.ts'
import { getOriginalityScan, originalityScanPasses } from './originality.ts'
import { loadReferenceRecords } from './references.ts'
import { getResearchReview } from './research.ts'

const MAX_ASSET_BYTES = 20 * 1024 * 1024
const STAGES = ['intake', 'researched', 'drafted', 'reviewed'] as const

const saveSchema = z.object({
  contentId: z.string().uuid().optional(),
  expectedRevision: z.number().int().positive().optional(),
  // local-editorial only: ask the server-owned service actor to register a
  // mechanical intake import. Consumed and stripped by the identity layer;
  // it never reaches the stored manifest.
  serviceImport: z.boolean().optional(),
  kind: z.enum(['brief', 'draft', 'variant']),
  brandId: BrandIdSchema,
  profileVersion: z.string().min(1),
  stage: z.enum(STAGES),
  parentIds: z.array(z.string().uuid()).max(100).default([]),
  platform: z.enum(['wechat', 'xhs', 'toutiao']).optional(),
  contentLanguage: z.string().regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/).default('zh-CN'),
  researchSubject: z.string().min(1).max(1000),
  referenceIds: z.array(z.string().uuid()).max(100).default([]),
  researchId: z.string().uuid().optional(),
  originalityScanId: z.string().uuid().optional(),
  editorialReviewId: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  bodyMarkdown: z.string().max(2_000_000),
  summary: z.string().max(2000).optional(),
  citations: z.array(CitationSchema).max(200).default([]),
  assets: z.array(AssetInputSchema).max(100).optional(),
  savedBy: z.string().min(1),
})

export const saveName = 'mediaops.content.save'
export const saveDescription =
  'Create one immutable schema-v2 content revision. The first revision must be intake and each later revision may stay at its stage or advance by one evidence-backed stage; review conclusions cannot be self-reported here. In local-editorial mode, serviceImport:true asks the server-owned service actor to register a mechanical intake import.'
export const saveInputSchema = saveSchema.shape

type SaveArgs = z.input<typeof saveSchema>
let contentSaveQueue: Promise<void> = Promise.resolve()

async function withContentSaveLock<T>(work: () => Promise<T>): Promise<T> {
  const previous = contentSaveQueue
  let release!: () => void
  contentSaveQueue = new Promise<void>((resolve) => { release = resolve })
  await previous
  try {
    return await work()
  } finally {
    release()
  }
}

function stageRank(stage: ContentManifestV2['stage']): number {
  return STAGES.indexOf(stage)
}

function isV2(content: ContentManifest): content is ContentManifestV2 {
  return 'schemaVersion' in content && content.schemaVersion === 2
}

function parseStoredContent(record: unknown): ContentManifest {
  const parsed = ContentManifestSchema.safeParse(record)
  if (!parsed.success) {
    throw new Error(`INVALID_STORED_CONTENT:${parsed.error.issues.map((issue) => `${issue.path.join('.')}:${issue.message}`).join('|')}`)
  }
  assertStoredContentHash(parsed.data)
  if (isV2(parsed.data)) {
    if (stableHash(parsed.data.articleDoc) !== parsed.data.articleDocHash) {
      throw new Error(`ARTICLE_DOC_HASH_MISMATCH:${parsed.data.contentId}:${parsed.data.revisionId}`)
    }
    const subjectHash = editorialSubjectHash(parsed.data.articleDoc)
    if (subjectHash !== parsed.data.originalitySubjectHash) {
      throw new Error(`ORIGINALITY_SUBJECT_HASH_MISMATCH:${parsed.data.contentId}:${parsed.data.revisionId}`)
    }
  }
  return parsed.data
}

export async function getLatestContent(contentId: string): Promise<ContentManifest | null> {
  const records = await listRecords('content', { contentId })
  let latest: ContentManifest | null = null
  for (const record of records) {
    const content = parseStoredContent(record)
    if (!latest || content.revision > latest.revision) latest = content
  }
  return latest
}

export async function getContentRevision(revisionId: string): Promise<ContentManifest | null> {
  const record = await getRecord('content', revisionId)
  return record ? parseStoredContent(record) : null
}

function insideRoot(candidate: string, root: string): boolean {
  const rel = relative(root, candidate)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

function sniffMediaType(bytes: Uint8Array): Asset['mediaType'] | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  const head = new TextDecoder().decode(bytes.slice(0, 12))
  if (head.startsWith('GIF87a') || head.startsWith('GIF89a')) return 'image/gif'
  if (head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP') return 'image/webp'
  return null
}

async function freezeAssetMetadata(input: z.infer<typeof AssetInputSchema>): Promise<Asset> {
  const configuredRoot = resolve(process.env.MEDIAOPS_ASSET_ROOT?.trim() || dataDir())
  let root: string
  let candidate: string
  try {
    root = await realpath(configuredRoot)
    const requested = isAbsolute(input.path) ? input.path : resolve(root, input.path)
    const stat = await lstat(requested)
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('asset must be a regular non-symbolic-link file')
    candidate = await realpath(requested)
  } catch (error) {
    throw new ArticleDocError('ASSET_INVALID', `${input.path}: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (!insideRoot(candidate, root)) {
    throw new ArticleDocError('ASSET_OUTSIDE_ALLOWED_ROOT', `${input.path} resolves outside MEDIAOPS_ASSET_ROOT (${root}).`)
  }
  const bytes = await readFile(candidate)
  if (bytes.length === 0 || bytes.length > MAX_ASSET_BYTES) {
    throw new ArticleDocError('ASSET_INVALID', `${input.path} must contain 1 to ${MAX_ASSET_BYTES} bytes.`)
  }
  const mediaType = sniffMediaType(bytes)
  if (!mediaType) throw new ArticleDocError('ASSET_TYPE_UNSUPPORTED', `${input.path} is not a supported PNG, JPEG, GIF or WebP file.`)
  return {
    ...input,
    path: candidate,
    assetId: randomUUID(),
    sha256: createHash('sha256').update(bytes).digest('hex'),
    byteSize: bytes.length,
    mediaType,
    registeredAt: new Date().toISOString(),
  }
}

async function resolveAssets(input: z.infer<typeof AssetInputSchema>[] | undefined, previous: ContentManifestV2 | null): Promise<Asset[]> {
  if (input === undefined) return previous?.assets ?? []
  const assets: Asset[] = []
  for (const item of input) assets.push(await freezeAssetMetadata(item))
  return assets
}

async function expectedResearchSubjectHash(researchSubject: string, referenceIds: string[]): Promise<string> {
  const references = await loadReferenceRecords(referenceIds)
  return stableHash({
    researchSubject,
    references: references.map(({ metadata }) => ({
      referenceId: metadata.referenceId,
      contentHash: metadata.contentHash,
      role: metadata.role,
    })),
  })
}

async function saveHandlerUnlocked(args: SaveArgs): Promise<Envelope> {
  const parsed = saveSchema.safeParse(args)
  if (!parsed.success) {
    return err('INVALID_CONTENT_MANIFEST', parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '))
  }
  const input = parsed.data
  const contentId = input.contentId ?? randomUUID()
  let previous: ContentManifest | null
  try {
    previous = await getLatestContent(contentId)
  } catch (error) {
    return err('INVALID_STORED_CONTENT', error instanceof Error ? error.message : String(error))
  }

  if (!previous && input.stage !== 'intake') {
    return err('INVALID_STAGE_TRANSITION', 'The first content revision must be intake; research, drafting and review require separately generated evidence records.')
  }
  if (previous && !isV2(previous)) return err('SCHEMA_UPGRADE_REQUIRED', 'Legacy schema-v1 content is read-only and cannot enter the v2 evidence workflow.')
  const prior = previous && isV2(previous) ? previous : null
  if (prior) {
    if (prior.brandId !== input.brandId) return err('BRAND_SCOPE_MISMATCH', 'A contentId cannot move between brandId scopes.')
    if (input.expectedRevision !== undefined && input.expectedRevision !== prior.revision) {
      return err('REVISION_CONFLICT', `Expected revision ${input.expectedRevision}, current revision is ${prior.revision}.`)
    }
    if (prior.stage === 'reviewed') return err('REVIEWED_REVISION_IMMUTABLE', 'Reviewed content is terminal; create a new intake/variant to change it.')
    const delta = stageRank(input.stage) - stageRank(prior.stage)
    if (delta < 0 || delta > 1) {
      return err('INVALID_STAGE_TRANSITION', `Content may stay at ${prior.stage} or advance by one stage; requested ${input.stage}.`)
    }
  }

  let references
  try {
    references = await loadReferenceRecords(input.referenceIds)
  } catch (error) {
    return err('REFERENCE_EVIDENCE_REQUIRED', error instanceof Error ? error.message : String(error))
  }
  const researchId = input.researchId ?? prior?.researchId
  let researchBundleHash: string | undefined
  if (stageRank(input.stage) >= stageRank('researched')) {
    if (!researchId) return err('RESEARCH_EVIDENCE_REQUIRED', 'A completed researchId is required before the researched stage.')
    const research = await getResearchReview(researchId)
    if (!research || research.status !== 'completed') return err('RESEARCH_EVIDENCE_REQUIRED', 'The bound research record is missing or incomplete.')
    if (research.contentId !== contentId) return err('RESEARCH_BINDING_MISMATCH', 'Research belongs to another contentId.')
    if (prior?.stage === 'intake' && research.sourceRevisionId !== prior.revisionId) {
      return err('RESEARCH_BINDING_MISMATCH', 'Research must bind to the immediately preceding intake revision.')
    }
    const expectedSubjectHash = await expectedResearchSubjectHash(input.researchSubject, input.referenceIds)
    if (research.subjectHash !== expectedSubjectHash) return err('RESEARCH_STALE', 'Research subject or registered reference bytes changed after research.')
    researchBundleHash = research.researchBundleHash
  }

  let assets: Asset[]
  try {
    assets = await resolveAssets(input.assets, prior)
  } catch (error) {
    if (error instanceof ArticleDocError) return err(error.code, error.message)
    return err('ASSET_INVALID', error instanceof Error ? error.message : String(error))
  }

  let originalityScanId = input.originalityScanId
  let editorialReviewId = input.editorialReviewId
  let embeddedReview: ContentManifestV2['review']
  let embeddedLegal: ContentManifestV2['legalReview']
  let embeddedDisclosure: ContentManifestV2['aiDisclosure']
  if (input.stage === 'reviewed') {
    if (!prior || prior.stage !== 'drafted') return err('INVALID_STAGE_TRANSITION', 'Reviewed content must promote the immediately preceding drafted revision.')
    if (!originalityScanId || !editorialReviewId) return err('EDITORIAL_EVIDENCE_REQUIRED', 'Reviewed content requires originalityScanId and editorialReviewId.')
    const scan = await getOriginalityScan(originalityScanId)
    if (!scan || scan.contentId !== contentId || scan.sourceRevisionId !== prior.revisionId || scan.subjectHash !== prior.originalitySubjectHash) {
      return err('ORIGINALITY_SCAN_STALE', 'Originality evidence is missing or does not bind to the preceding draft.')
    }
    if (!originalityScanPasses(scan)) return err('ORIGINALITY_REVIEW_REQUIRED', `Originality decision ${scan.decision} has not passed.`)
    const editorial = await getEditorialReview(editorialReviewId)
    if (!editorial || editorial.contentId !== contentId || editorial.sourceRevisionId !== prior.revisionId || editorial.subjectHash !== prior.originalitySubjectHash || editorial.originalityScanId !== scan.scanId) {
      return err('EDITORIAL_REVIEW_STALE', 'Editorial review is missing or does not bind to the preceding draft and originality scan.')
    }
    embeddedReview = editorial.factReview
    embeddedLegal = editorial.legalReview
    embeddedDisclosure = editorial.aiDisclosure
  } else {
    originalityScanId = undefined
    editorialReviewId = undefined
  }

  let article
  try {
    article = buildArticleDoc({
      title: input.title,
      bodyMarkdown: input.bodyMarkdown,
      language: input.contentLanguage,
      ...(input.summary ? { summary: input.summary } : {}),
      citations: input.citations,
      assets,
      ...(embeddedDisclosure ? { aiDisclosure: embeddedDisclosure } : {}),
    })
  } catch (error) {
    if (error instanceof ArticleDocError) return err(error.code, error.message)
    return err('ARTICLE_STRUCTURE_INVALID', error instanceof Error ? error.message : String(error))
  }
  if (input.stage === 'reviewed' && prior && article.originalitySubjectHash !== prior.originalitySubjectHash) {
    return err('EDITORIAL_REVIEW_STALE', 'Editor-controlled article semantics (title, summary, body, citations or asset metadata) changed while promoting the reviewed revision; edit, rescan and review a new draft instead.')
  }

  const revisionId = randomUUID()
  const revision = (prior?.revision ?? 0) + 1
  const createdAt = new Date().toISOString()
  const withoutHash: Record<string, unknown> = {
    schemaVersion: SCHEMA_VERSION,
    contentId,
    kind: input.kind,
    brandId: input.brandId,
    profileVersion: input.profileVersion,
    stage: input.stage,
    parentIds: input.parentIds,
    ...(input.platform ? { platform: input.platform } : {}),
    contentLanguage: input.contentLanguage,
    researchSubject: input.researchSubject,
    referenceIds: references.map(({ metadata }) => metadata.referenceId),
    ...(researchId ? { researchId } : {}),
    ...(originalityScanId ? { originalityScanId } : {}),
    ...(editorialReviewId ? { editorialReviewId } : {}),
    title: article.articleDoc.title,
    bodyMarkdown: input.bodyMarkdown,
    ...(article.articleDoc.summary ? { summary: article.articleDoc.summary } : {}),
    citations: input.citations,
    assets,
    articleDoc: article.articleDoc,
    articleDocHash: article.articleDocHash,
    originalitySubjectHash: article.originalitySubjectHash,
    ...(researchBundleHash ? { researchBundleHash } : {}),
    ...(embeddedReview ? { review: embeddedReview } : {}),
    ...(embeddedLegal ? { legalReview: embeddedLegal } : {}),
    ...(embeddedDisclosure ? { aiDisclosure: embeddedDisclosure } : {}),
    savedBy: input.savedBy,
  }
  const contentHash = computeContentHash(withoutHash)
  const manifest = ContentManifestV2Schema.parse({ ...withoutHash, revisionId, revision, contentHash, createdAt })
  try {
    await appendRecordsAtomically([
      { collection: 'content', record: { id: revisionId, ...manifest }, guard: {
        entityKey: contentId,
        expectedEntityVersion: prior?.revision ?? null,
        entityVersion: revision,
        requireNoLease: true,
      } },
      { collection: 'audit-events', record: {
        event: 'content.revision.saved',
        schemaVersion: SCHEMA_VERSION,
        contentId,
        revisionId,
        revision,
        stage: input.stage,
        contentHash,
        articleDocHash: article.articleDocHash,
        brandId: input.brandId,
        actor: input.savedBy,
      } },
    ])
  } catch (error) {
    if (error instanceof StorageLeaseError) {
      return err('CONTENT_BUSY', 'Packaging holds this content lease; retry after packaging finishes or the lease expires.')
    }
    if (error instanceof StorageConflictError) {
      return err('REVISION_CONFLICT', 'Another process saved this content while the revision was being prepared; reload the latest revision and retry.')
    }
    throw error
  }
  return ok({ contentId, revisionId, revision, stage: input.stage, contentHash, articleDocHash: article.articleDocHash }, storageWarnings())
}

export async function saveHandler(args: SaveArgs): Promise<Envelope> {
  return withContentSaveLock(() => saveHandlerUnlocked(args))
}

export const getName = 'mediaops.content.get'
export const getDescription = 'Fetch the latest validated content manifest by contentId, or one immutable hash-verified revision by revisionId.'
export const getInputSchema = { contentId: z.string().uuid().optional(), revisionId: z.string().uuid().optional() }

export async function getHandler(args: { contentId?: string; revisionId?: string }): Promise<Envelope> {
  if (!args.contentId && !args.revisionId) return err('INVALID_ARGUMENT', 'Provide contentId or revisionId.')
  try {
    if (args.revisionId) {
      const content = await getContentRevision(args.revisionId)
      if (!content) return err('NOT_FOUND', `No content revision ${args.revisionId}.`, storageWarnings())
      if (args.contentId && content.contentId !== args.contentId) return err('PACKAGE_INPUT_MISMATCH', 'contentId and revisionId do not match.')
      return ok(content, storageWarnings())
    }
    const latest = await getLatestContent(args.contentId!)
    return latest ? ok(latest, storageWarnings()) : err('NOT_FOUND', `No content ${args.contentId}.`, storageWarnings())
  } catch (error) {
    return err('INVALID_STORED_CONTENT', error instanceof Error ? error.message : String(error))
  }
}

export const listName = 'mediaops.content.list'
export const listDescription = 'List latest validated content manifests, optionally scoped by brand, kind or stage.'
export const listInputSchema = {
  brandId: BrandIdSchema.optional(),
  kind: z.enum(['brief', 'draft', 'variant']).optional(),
  stage: z.enum(STAGES).optional(),
}

export async function listHandler(args: { brandId?: string; kind?: string; stage?: string }): Promise<Envelope> {
  try {
    const records = await listRecords('content')
    const latest = new Map<string, ContentManifest>()
    for (const record of records) {
      const content = parseStoredContent(record)
      const current = latest.get(content.contentId)
      if (!current || content.revision > current.revision) latest.set(content.contentId, content)
    }
    const manifests = [...latest.values()].filter((item) =>
      (!args.brandId || item.brandId === args.brandId) &&
      (!args.kind || item.kind === args.kind) &&
      (!args.stage || item.stage === args.stage),
    )
    return ok({ count: manifests.length, manifests }, storageWarnings())
  } catch (error) {
    return err('INVALID_STORED_CONTENT', error instanceof Error ? error.message : String(error))
  }
}
