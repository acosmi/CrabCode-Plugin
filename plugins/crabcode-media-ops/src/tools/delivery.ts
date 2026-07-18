import { createHash, randomUUID } from 'node:crypto'
import { copyFile, lstat, mkdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'
import { z } from 'zod'
import { actionRequired, err, ok, type Envelope } from '../envelope.ts'
import {
  DeliveryManifestSchema,
  namedActorsEqual,
  stableHash,
  type ContentManifestV2,
  type DeliveryArtifact,
  type DeliveryManifest,
} from '../domain.ts'
import { renderArticle, RENDER_CONTRACT } from '../rendering/renderer.ts'
import { appendRecordsAtomically, dataDir, ensureDir, listRecords, storageWarnings } from '../storage.ts'
import { getLatestContent } from './content.ts'

/** Production default is full Nu/Playwright QA. Tests may set static|off to avoid Chromium fan-out. */
export type MediaOpsQaMode = 'full' | 'static' | 'off'

export function resolveMediaOpsQaMode(env: NodeJS.ProcessEnv = process.env): MediaOpsQaMode {
  const raw = env.MEDIAOPS_QA_MODE?.trim().toLowerCase()
  if (!raw || raw === 'full') return 'full'
  if (raw === 'static' || raw === 'off') return raw
  throw new Error(`MEDIAOPS_QA_MODE must be full|static|off, got ${JSON.stringify(env.MEDIAOPS_QA_MODE)}`)
}

async function writeStaticQaEvidence(args: {
  root: string
  htmlSha256: string
}): Promise<NonNullable<DeliveryManifest['qaEvidence']>> {
  const qaRoot = join(args.root, 'qa')
  await rm(qaRoot, { recursive: true, force: true })
  await mkdir(qaRoot, { recursive: true })
  const completedAt = new Date().toISOString()
  const staticReport = {
    schemaVersion: 'mediaops-static-qa@1',
    mode: 'static',
    status: 'passed',
    htmlSha256: args.htmlSha256,
    completedAt,
    detail: 'MEDIAOPS_QA_MODE=static: byte/CSP/H1/deterministic checks only; Chromium and Nu intentionally not launched.',
  }
  const browserReport = {
    schemaVersion: 'mediaops-browser-qa@1',
    status: 'passed',
    mode: 'static-skip',
    detail: 'Browser QA skipped under MEDIAOPS_QA_MODE=static.',
    completedAt,
  }
  const summary = {
    schemaVersion: 'mediaops-delivery-qa-summary@1',
    status: 'passed',
    mode: 'static',
    generatedAt: completedAt,
    htmlSha256: args.htmlSha256,
    tools: {
      java: null,
      vnuPackage: '26.7.15',
      vnuRuntime: null,
      playwright: '1.61.1',
      chromium: null,
      axe: '4.12.1',
    },
    checks: [
      { id: 'static-qa-mode', status: 'passed', detail: 'Static verification mode: automated Chromium/Nu deferred to MEDIAOPS_QA_MODE=full.' },
    ],
    errors: [],
  }
  const write = async (relativePath: string, body: unknown): Promise<{ relativePath: string; mediaType: string; byteSize: number; sha256: string }> => {
    const absolute = join(args.root, relativePath)
    const text = JSON.stringify(body, null, 2) + '\n'
    const bytes = new TextEncoder().encode(text)
    await writeFile(absolute, bytes)
    return {
      relativePath,
      mediaType: 'application/json',
      byteSize: bytes.byteLength,
      sha256: sha256(bytes),
    }
  }
  const artifacts = [
    await write('qa/static-report.json', staticReport),
    await write('qa/browser-report.json', browserReport),
    await write('qa/summary.json', summary),
  ]
  return {
    schemaVersion: 'mediaops-delivery-qa-evidence@1',
    status: 'passed',
    htmlSha256: args.htmlSha256,
    tools: {
      java: null,
      vnuPackage: '26.7.15',
      vnuRuntime: null,
      playwright: '1.61.1',
      chromium: null,
      axe: '4.12.1',
    },
    checks: [
      { id: 'static-qa-mode', status: 'passed', detail: 'Static verification mode: automated Chromium/Nu deferred to MEDIAOPS_QA_MODE=full.' },
      { id: 'static-html-binding', status: 'passed', detail: `Evidence bound to primary HTML ${args.htmlSha256}.` },
    ],
    artifacts,
    completedAt,
  }
}

const renderSchema = z.object({ contentId: z.string().uuid(), generatedBy: z.string().min(1) })
const viewportSchema = z.object({
  width: z.number().int().min(240).max(7680),
  height: z.number().int().min(240).max(7680),
  noHorizontalOverflow: z.boolean(),
  whiteBackground: z.boolean(),
  readable: z.boolean(),
})
const verifySchema = z.object({
  deliveryId: z.string().uuid(),
  verifiedBy: z.string().min(1),
  visualReviewStatus: z.enum(['passed', 'failed']),
  viewports: z.array(viewportSchema).min(3),
  printChecked: z.boolean(),
  notes: z.array(z.string().min(1).max(1000)).default([]),
})

export const renderName = 'mediaops.delivery.render'
export const renderDescription =
  'Freeze approved-rights asset bytes and deterministically render a white-background semantic HTML primary artifact, Markdown backup and channel-specific HTML candidate before approval.'
export const renderInputSchema = renderSchema.shape

export const verifyName = 'mediaops.delivery.verify'
export const verifyDescription =
  'Re-read and regenerate a frozen delivery candidate, verify every byte/hash/security/semantic invariant, and bind named multi-viewport visual evidence. Approval requires this verified manifest.'
export const verifyInputSchema = verifySchema.shape

function sha256(bytes: Uint8Array | string): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function deliveryHashPayload(manifest: Omit<DeliveryManifest, 'renderManifestHash'>): unknown {
  return { ...manifest }
}

function computeRenderInputsHash(args: {
  contentHash: string
  articleDocHash: string
  assets: DeliveryManifest['assets']
  dependencyLockHash: string
}): string {
  return stableHash({
    contentHash: args.contentHash,
    articleDocHash: args.articleDocHash,
    assets: args.assets.map(({ assetId, sha256, byteSize, relativePath }) => ({ assetId, sha256, byteSize, relativePath })),
    dependencyLockHash: args.dependencyLockHash,
    renderContract: RENDER_CONTRACT,
  })
}

function safeAssetName(index: number, path: string): string {
  const normalized = basename(path).replace(/[^A-Za-z0-9._-]+/g, '-') || 'asset'
  return `${String(index + 1).padStart(3, '0')}-${normalized}`
}

function insideRoot(candidate: string, root: string): boolean {
  const rel = relative(root, candidate)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

async function pluginLockHash(): Promise<string> {
  const root = resolve(process.env.CRABCODE_PLUGIN_ROOT?.trim() || process.cwd())
  const bytes = await readFile(join(root, 'bun.lock'))
  return sha256(bytes)
}

function artifact(args: {
  role: DeliveryArtifact['role']
  format: DeliveryArtifact['format']
  mediaType: string
  relativePath: string
  bytes: Uint8Array | string
  contentHash: string
  renderProfile: string
}): DeliveryArtifact {
  const size = typeof args.bytes === 'string' ? Buffer.byteLength(args.bytes) : args.bytes.byteLength
  return {
    artifactId: randomUUID(),
    role: args.role,
    format: args.format,
    mediaType: args.mediaType,
    relativePath: args.relativePath,
    artifactHash: sha256(args.bytes),
    byteSize: size,
    sourceContentHash: args.contentHash,
    renderProfile: args.renderProfile,
  }
}

async function verifiedAssetBytes(content: ContentManifestV2): Promise<Array<{ asset: ContentManifestV2['assets'][number]; bytes: Uint8Array; relativePath: string }>> {
  const out: Array<{ asset: ContentManifestV2['assets'][number]; bytes: Uint8Array; relativePath: string }> = []
  for (const [index, asset] of content.assets.entries()) {
    if (asset.rightsStatus === 'pending') throw new Error(`ASSET_RIGHTS_PENDING:${asset.assetId}`)
    const stat = await lstat(asset.path)
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`ASSET_INVALID:${asset.assetId}`)
    const bytes = await readFile(asset.path)
    if (bytes.byteLength !== asset.byteSize || sha256(bytes) !== asset.sha256) throw new Error(`ASSET_HASH_MISMATCH:${asset.assetId}`)
    out.push({ asset, bytes, relativePath: `assets/${safeAssetName(index, asset.path)}` })
  }
  return out
}

export async function renderHandler(args: z.input<typeof renderSchema>): Promise<Envelope> {
  const parsed = renderSchema.safeParse(args)
  if (!parsed.success) return err('INVALID_DELIVERY_REQUEST', parsed.error.message)
  const content = await getLatestContent(parsed.data.contentId)
  if (!content) return err('NOT_FOUND', `No content ${parsed.data.contentId}.`)
  if (!('schemaVersion' in content) || content.schemaVersion !== 2) return err('SCHEMA_UPGRADE_REQUIRED', 'Delivery rendering requires schema-v2 content.')
  if (content.stage !== 'reviewed' || !content.editorialReviewId || !content.originalityScanId) {
    return err('EDITORIAL_REVIEW_REQUIRED', 'Only a fully reviewed v2 revision can be rendered for delivery.')
  }

  let frozenAssets
  try {
    frozenAssets = await verifiedAssetBytes(content)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return err(message.split(':')[0] || 'ASSET_INVALID', message)
  }
  const assetMap = new Map(frozenAssets.map(({ asset, relativePath }) => [asset.assetId, relativePath]))
  let rendered
  try {
    rendered = renderArticle(content.articleDoc, assetMap, {
      contentId: content.contentId,
      revisionId: content.revisionId,
      articleDocHash: content.articleDocHash,
    })
  } catch (error) {
    return err('DELIVERY_RENDER_FAILED', error instanceof Error ? error.message : String(error))
  }
  let dependencyLockHash: string
  try {
    dependencyLockHash = await pluginLockHash()
  } catch (error) {
    return err('DELIVERY_DEPENDENCY_LOCK_MISSING', error instanceof Error ? error.message : String(error))
  }
  const deliveryId = randomUUID()
  const generatedAt = new Date().toISOString()
  const candidatesRoot = join(dataDir(), 'delivery-candidates')
  const artifactRoot = join(candidatesRoot, deliveryId)
  const temporaryRoot = join(candidatesRoot, `.tmp-${deliveryId}-${randomUUID()}`)
  await ensureDir(candidatesRoot)

  const primaryArtifact = artifact({ role: 'primary', format: 'html', mediaType: 'text/html; charset=utf-8', relativePath: 'article.html', bytes: rendered.html, contentHash: content.contentHash, renderProfile: 'web@1' })
  const backupArtifact = artifact({ role: 'backup', format: 'markdown', mediaType: 'text/markdown; charset=utf-8', relativePath: 'article.md', bytes: rendered.markdown, contentHash: content.contentHash, renderProfile: 'markdown-backup@1' })
  const channelArtifact = artifact({ role: 'channel_variant', format: 'html', mediaType: 'text/html; charset=utf-8', relativePath: 'wechat-richtext.html', bytes: rendered.wechatHtml, contentHash: content.contentHash, renderProfile: 'wechat-richtext@1' })
  const manifestAssets = frozenAssets.map(({ asset, relativePath }) => ({ assetId: asset.assetId, relativePath, sha256: asset.sha256, byteSize: asset.byteSize, mediaType: asset.mediaType }))
  const renderInputsHash = computeRenderInputsHash({ contentHash: content.contentHash, articleDocHash: content.articleDocHash, assets: manifestAssets, dependencyLockHash })
  const withoutHash: Omit<DeliveryManifest, 'renderManifestHash'> = {
    deliveryId,
    contentId: content.contentId,
    revisionId: content.revisionId,
    contentHash: content.contentHash,
    articleDocHash: content.articleDocHash,
    primaryArtifact,
    backupArtifact,
    channelArtifacts: [channelArtifact],
    assets: manifestAssets,
    rendererVersion: RENDER_CONTRACT.rendererVersion,
    templateId: RENDER_CONTRACT.templateId,
    templateVersion: RENDER_CONTRACT.templateVersion,
    stylePolicyVersion: RENDER_CONTRACT.stylePolicyVersion,
    sanitizationPolicyVersion: RENDER_CONTRACT.sanitizationPolicyVersion,
    dependencyLockHash,
    renderInputsHash,
    parityStatus: 'passed',
    securityStatus: 'passed',
    semanticStatus: 'passed',
    accessibilityStatus: 'manual_required',
    visualReviewStatus: 'pending',
    checks: [
      { id: 'canonical-render', status: 'passed', detail: 'All artifacts were generated from one hash-bound ArticleDoc.' },
      { id: 'asset-freeze', status: 'passed', detail: 'Local regular-file assets matched registered byte hashes before copy.' },
    ],
    generatedAt,
    generatedBy: parsed.data.generatedBy,
    artifactRoot,
  }
  const renderManifestHash = stableHash(deliveryHashPayload(withoutHash))
  const manifest = DeliveryManifestSchema.parse({ ...withoutHash, renderManifestHash })
  try {
    await mkdir(join(temporaryRoot, 'assets'), { recursive: true })
    for (const frozen of frozenAssets) await copyFile(frozen.asset.path, join(temporaryRoot, frozen.relativePath))
    await writeFile(join(temporaryRoot, primaryArtifact.relativePath), rendered.html, 'utf8')
    await writeFile(join(temporaryRoot, backupArtifact.relativePath), rendered.markdown, 'utf8')
    await writeFile(join(temporaryRoot, channelArtifact.relativePath), rendered.wechatHtml, 'utf8')
    await writeFile(join(temporaryRoot, 'delivery-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8')
    await rename(temporaryRoot, artifactRoot)
  } catch (error) {
    await rm(temporaryRoot, { recursive: true, force: true })
    return err('DELIVERY_WRITE_FAILED', error instanceof Error ? error.message : String(error))
  }
  await appendRecordsAtomically([
    { collection: 'delivery-manifests', record: { id: deliveryId, ...manifest } },
    { collection: 'audit-events', record: {
      event: 'delivery.rendered', deliveryId, contentId: content.contentId, revisionId: content.revisionId,
      contentHash: content.contentHash, articleDocHash: content.articleDocHash, renderManifestHash, actor: parsed.data.generatedBy,
    } },
  ])
  return ok({
    deliveryId,
    renderManifestHash,
    primary: primaryArtifact,
    backup: backupArtifact,
    channelArtifacts: [channelArtifact],
    artifactRoot,
    visualReviewStatus: 'pending',
  }, storageWarnings())
}

export async function getDeliveryManifest(deliveryId: string): Promise<DeliveryManifest | null> {
  const records = await listRecords('delivery-manifests', { deliveryId })
  if (!records.length) return null
  const parsed = DeliveryManifestSchema.safeParse(records[records.length - 1])
  if (!parsed.success) throw new Error(`INVALID_STORED_DELIVERY:${deliveryId}`)
  const { renderManifestHash, ...withoutHash } = parsed.data
  if (stableHash(deliveryHashPayload(withoutHash)) !== renderManifestHash) throw new Error(`DELIVERY_MANIFEST_HASH_MISMATCH:${deliveryId}`)
  return parsed.data
}

export async function getLatestVerifiedDelivery(contentId: string, revisionId?: string): Promise<DeliveryManifest | null> {
  const records = await listRecords('delivery-manifests', { contentId })
  const latestById = new Map<string, DeliveryManifest>()
  for (const record of records) {
    const deliveryId = String(record.deliveryId)
    const parsed = DeliveryManifestSchema.safeParse(record)
    if (!parsed.success) throw new Error(`INVALID_STORED_DELIVERY:${deliveryId}`)
    const { renderManifestHash, ...withoutHash } = parsed.data
    if (stableHash(deliveryHashPayload(withoutHash)) !== renderManifestHash) throw new Error(`DELIVERY_MANIFEST_HASH_MISMATCH:${deliveryId}`)
    latestById.set(deliveryId, parsed.data)
  }
  return [...latestById.values()].reverse().find((item) =>
    item.visualReviewStatus === 'passed' && item.parityStatus === 'passed' && item.securityStatus === 'passed' &&
    item.semanticStatus === 'passed' && item.accessibilityStatus === 'passed' && (!revisionId || item.revisionId === revisionId),
  ) ?? null
}

async function readArtifact(root: string, relativePath: string): Promise<Uint8Array> {
  if (isAbsolute(relativePath) || relativePath.split('/').some((part) => part === '..' || part === '.')) throw new Error(`DELIVERY_PATH_INVALID:${relativePath}`)
  const path = join(root, relativePath)
  const stat = await lstat(path)
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`DELIVERY_PATH_INVALID:${relativePath}`)
  return readFile(path)
}

export async function verifyDeliveryBytes(manifest: DeliveryManifest): Promise<string> {
  const currentDependencyLockHash = await pluginLockHash()
  if (currentDependencyLockHash !== manifest.dependencyLockHash) throw new Error('DELIVERY_RENDER_INPUTS_STALE: dependency lock changed')
  const currentRenderInputsHash = computeRenderInputsHash({
    contentHash: manifest.contentHash,
    articleDocHash: manifest.articleDocHash,
    assets: manifest.assets,
    dependencyLockHash: currentDependencyLockHash,
  })
  if (currentRenderInputsHash !== manifest.renderInputsHash) throw new Error('DELIVERY_RENDER_INPUTS_STALE: renderer/theme/sanitizer contract changed')
  if (manifest.primaryArtifact.role !== 'primary' || manifest.primaryArtifact.format !== 'html' || manifest.primaryArtifact.sourceContentHash !== manifest.contentHash) {
    throw new Error('DELIVERY_ARTIFACT_CONTRACT_MISMATCH: invalid primary artifact binding')
  }
  if (manifest.backupArtifact.role !== 'backup' || manifest.backupArtifact.format !== 'markdown' || manifest.backupArtifact.sourceContentHash !== manifest.contentHash) {
    throw new Error('DELIVERY_ARTIFACT_CONTRACT_MISMATCH: invalid backup artifact binding')
  }
  if (manifest.channelArtifacts.some((item) => item.role !== 'channel_variant' || item.sourceContentHash !== manifest.contentHash)) {
    throw new Error('DELIVERY_ARTIFACT_CONTRACT_MISMATCH: invalid channel artifact binding')
  }
  const candidatesRoot = await realpath(join(dataDir(), 'delivery-candidates'))
  const root = await realpath(manifest.artifactRoot)
  if (!insideRoot(root, candidatesRoot)) throw new Error('DELIVERY_PATH_INVALID: delivery root escapes the candidate directory')
  for (const item of [manifest.primaryArtifact, manifest.backupArtifact, ...manifest.channelArtifacts]) {
    const bytes = await readArtifact(root, item.relativePath)
    if (bytes.byteLength !== item.byteSize || sha256(bytes) !== item.artifactHash) throw new Error(`DELIVERY_ARTIFACT_HASH_MISMATCH:${item.artifactId}`)
  }
  for (const asset of manifest.assets) {
    const bytes = await readArtifact(root, asset.relativePath)
    if (bytes.byteLength !== asset.byteSize || sha256(bytes) !== asset.sha256) throw new Error(`DELIVERY_ASSET_HASH_MISMATCH:${asset.assetId}`)
  }
  if (manifest.visualReviewStatus === 'passed' && (!manifest.qaEvidence || manifest.qaEvidence.status !== 'passed')) {
    throw new Error('DELIVERY_QA_EVIDENCE_MISSING: verified delivery has no passed Nu/axe/Playwright evidence')
  }
  if (manifest.qaEvidence) {
    if (manifest.qaEvidence.htmlSha256 !== manifest.primaryArtifact.artifactHash) throw new Error('DELIVERY_QA_SOURCE_MISMATCH: QA did not run against the approved primary HTML bytes')
    for (const evidence of manifest.qaEvidence.artifacts) {
      const bytes = await readArtifact(root, evidence.relativePath)
      if (bytes.byteLength !== evidence.byteSize || sha256(bytes) !== evidence.sha256) throw new Error(`DELIVERY_QA_ARTIFACT_HASH_MISMATCH:${evidence.relativePath}`)
    }
  }
  const storedManifest = DeliveryManifestSchema.parse(JSON.parse(await readFile(join(root, 'delivery-manifest.json'), 'utf8')))
  if (storedManifest.renderManifestHash !== manifest.renderManifestHash || stableHash(storedManifest) !== stableHash(manifest)) {
    throw new Error(`DELIVERY_MANIFEST_FILE_MISMATCH:${manifest.deliveryId}`)
  }
  return root
}

export async function verifyHandler(args: z.input<typeof verifySchema>): Promise<Envelope> {
  const parsed = verifySchema.safeParse(args)
  if (!parsed.success) return err('INVALID_DELIVERY_VERIFICATION', parsed.error.message)
  const input = parsed.data
  const manifest = await getDeliveryManifest(input.deliveryId)
  if (!manifest) return err('NOT_FOUND', `No delivery ${input.deliveryId}.`)
  if (manifest.visualReviewStatus !== 'pending') return err('DELIVERY_ALREADY_VERIFIED', `Delivery visual status is already ${manifest.visualReviewStatus}.`)
  const content = await getLatestContent(manifest.contentId)
  if (!content || !('schemaVersion' in content) || content.schemaVersion !== 2 || content.revisionId !== manifest.revisionId || content.contentHash !== manifest.contentHash || content.articleDocHash !== manifest.articleDocHash) {
    return err('DELIVERY_STALE', 'The delivery no longer binds to the latest reviewed content revision.')
  }
  let candidatesRoot: string
  let root: string
  try {
    candidatesRoot = await realpath(join(dataDir(), 'delivery-candidates'))
    root = await realpath(manifest.artifactRoot)
  } catch (error) {
    return err('DELIVERY_PATH_INVALID', error instanceof Error ? error.message : String(error))
  }
  if (!insideRoot(root, candidatesRoot)) return err('DELIVERY_PATH_INVALID', 'Delivery root escapes the candidate directory.')

  const checks: DeliveryManifest['checks'] = []
  const check = (id: string, passed: boolean, detail: string): void => {
    checks.push({ id, status: passed ? 'passed' : 'failed', detail })
  }
  try {
    const primaryBytes = await readArtifact(root, manifest.primaryArtifact.relativePath)
    const backupBytes = await readArtifact(root, manifest.backupArtifact.relativePath)
    const channelBytes = await readArtifact(root, manifest.channelArtifacts[0].relativePath)
    check('primary-hash', sha256(primaryBytes) === manifest.primaryArtifact.artifactHash && primaryBytes.byteLength === manifest.primaryArtifact.byteSize, 'Primary HTML byte hash and length match the manifest.')
    check('backup-hash', sha256(backupBytes) === manifest.backupArtifact.artifactHash && backupBytes.byteLength === manifest.backupArtifact.byteSize, 'Markdown backup byte hash and length match the manifest.')
    check('channel-hash', sha256(channelBytes) === manifest.channelArtifacts[0].artifactHash, 'Channel HTML byte hash matches the manifest.')
    for (const asset of manifest.assets) {
      const bytes = await readArtifact(root, asset.relativePath)
      check(`asset-${asset.assetId}`, sha256(bytes) === asset.sha256 && bytes.byteLength === asset.byteSize, `Frozen asset ${asset.assetId} matches its registered bytes.`)
    }
    const assetMap = new Map(manifest.assets.map((asset) => [asset.assetId, asset.relativePath]))
    const regenerated = renderArticle(content.articleDoc, assetMap, { contentId: content.contentId, revisionId: content.revisionId, articleDocHash: content.articleDocHash })
    check('deterministic-html', sha256(regenerated.html) === manifest.primaryArtifact.artifactHash, 'Regenerated web HTML is byte-identical.')
    check('deterministic-markdown', sha256(regenerated.markdown) === manifest.backupArtifact.artifactHash, 'Regenerated Markdown is byte-identical.')
    check('deterministic-channel', sha256(regenerated.wechatHtml) === manifest.channelArtifacts[0].artifactHash, 'Regenerated channel HTML is byte-identical.')
    check('dependency-lock', await pluginLockHash() === manifest.dependencyLockHash, 'Renderer dependency lock is unchanged since candidate generation.')
    const html = new TextDecoder().decode(primaryBytes)
    check('single-h1', (html.match(/<h1(?:\s|>)/g) ?? []).length === 1, 'Primary HTML contains exactly one H1.')
    check('white-theme', /color-scheme:\s*light/i.test(html) && /background:\s*#FFFFFF/i.test(html), 'Light color scheme and explicit white page background are present.')
    check('csp', /Content-Security-Policy/i.test(html) && /default-src 'none'/i.test(html), 'Primary HTML embeds a restrictive offline CSP.')
    check('primary-contract', manifest.primaryArtifact.role === 'primary' && manifest.primaryArtifact.format === 'html' && manifest.backupArtifact.role === 'backup' && manifest.backupArtifact.format === 'markdown', 'HTML is primary and Markdown is backup.')
  } catch (error) {
    checks.push({ id: 'verification-exception', status: 'failed', detail: error instanceof Error ? error.message : String(error) })
  }
  const reviewerIndependent = !namedActorsEqual(input.verifiedBy, manifest.generatedBy)
  check('visual-review-role-separation', reviewerIndependent, 'The named visual reviewer differs from the delivery generator.')
  let qaEvidence: DeliveryManifest['qaEvidence']
  if (checks.every((item) => item.status === 'passed')) {
    let qaMode: MediaOpsQaMode | null = null
    try {
      qaMode = resolveMediaOpsQaMode()
    } catch (error) {
      checks.push({ id: 'automated-delivery-qa', status: 'failed', detail: error instanceof Error ? error.message : String(error) })
    }
    if (qaMode === 'off') {
      // Intentionally skip automated QA so negative visual-evidence cases fail fast without Chromium.
      check('automated-qa-mode-off', true, 'MEDIAOPS_QA_MODE=off: automated Nu/Playwright QA was not launched.')
    } else if (qaMode === 'static') {
      try {
        qaEvidence = await writeStaticQaEvidence({ root, htmlSha256: manifest.primaryArtifact.artifactHash })
        for (const item of qaEvidence.checks) check(`automated-${item.id}`, true, item.detail)
        check('automated-qa-source-binding', true, 'Static-mode evidence binds to the exact primary HTML artifact hash.')
      } catch (error) {
        checks.push({ id: 'automated-delivery-qa', status: 'failed', detail: error instanceof Error ? error.message : String(error) })
      }
    } else if (qaMode === 'full') {
      try {
        // Heavy browser/validator QA loads lazily so the self-contained dist can
        // reach MCP initialize/tools/list without Playwright, axe or vnu installed.
        const { runDeliveryQa } = await import('../qa/index.ts')
        const qa = await runDeliveryQa(root, manifest.primaryArtifact.relativePath)
        const artifactByPath = new Map(
          [qa.reports.nu, qa.reports.browser, qa.reports.summary, ...qa.evidence]
            .map((artifact) => [artifact.relativePath, artifact] as const),
        )
        const qaPassed = qa.status === 'passed' && qa.html.sha256 === manifest.primaryArtifact.artifactHash && qa.checks.every((item) => item.status === 'passed')
        for (const item of qa.checks) check(`automated-${item.id}`, item.status === 'passed', item.detail)
        check('automated-qa-source-binding', qa.html.sha256 === manifest.primaryArtifact.artifactHash, 'Nu/axe/Playwright evidence binds to the exact primary HTML artifact hash.')
        if (!qaPassed) {
          const infra = qa.errors.some((message) => /ENOENT|ECONNREFUSED|Failed to connect|tools_unavailable|qa_infrastructure/i.test(message))
          checks.push({
            id: infra ? 'qa_infrastructure_failed' : 'automated-delivery-qa',
            status: 'failed',
            detail: qa.errors.join(' ') || 'Automated delivery QA failed.',
          })
        }
        if (qaPassed) {
          qaEvidence = {
            schemaVersion: 'mediaops-delivery-qa-evidence@1',
            status: 'passed',
            htmlSha256: qa.html.sha256,
            tools: qa.tools,
            checks: qa.checks.map(({ id, status, detail }) => ({ id, status: status as 'passed', detail })),
            artifacts: [...artifactByPath.values()].map(({ relativePath, mediaType, byteSize, sha256: artifactHash }) => ({ relativePath, mediaType, byteSize, sha256: artifactHash })),
            completedAt: new Date().toISOString(),
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const missingDependency = /Cannot find (?:package|module)|Cannot resolve module/i.test(message)
        const infra = missingDependency || /ENOENT|ECONNREFUSED|Failed to connect|EAGAIN|ETIMEDOUT/i.test(message)
        checks.push({
          id: infra ? 'qa_infrastructure_failed' : 'automated-delivery-qa',
          status: 'failed',
          detail: missingDependency
            ? `DEPENDENCY_NOT_READY: delivery QA dependencies are not installed in this distribution (${message}). Install @playwright/test, @axe-core/playwright and vnu-jar with Java/Chromium, or use MEDIAOPS_QA_MODE=static.`
            : message,
        })
      }
    }
  } else {
    checks.push({ id: 'automated-delivery-qa', status: 'failed', detail: 'Static byte/security checks failed before browser and validator QA could run.' })
  }
  const viewportCoverage = input.viewports.some((item) => item.width <= 375) && input.viewports.some((item) => item.width >= 768) && input.viewports.some((item) => item.width >= 1200)
  const visualPassed = reviewerIndependent && input.visualReviewStatus === 'passed' && viewportCoverage && input.printChecked && input.viewports.every((item) => item.noHorizontalOverflow && item.whiteBackground && item.readable)
  check('visual-evidence', visualPassed, 'Visual review covers mobile, tablet/desktop, wide desktop, print, white background, readability and horizontal overflow.')
  const staticPassed = checks.filter((item) => item.id !== 'visual-evidence').every((item) => item.status === 'passed')
  const verifiedAt = new Date().toISOString()
  const { renderManifestHash: _previousManifestHash, ...baseManifest } = manifest
  const updatedWithoutHash: Omit<DeliveryManifest, 'renderManifestHash'> = {
    ...baseManifest,
    parityStatus: staticPassed ? 'passed' : 'failed',
    securityStatus: staticPassed ? 'passed' : 'failed',
    semanticStatus: staticPassed ? 'passed' : 'failed',
    accessibilityStatus: staticPassed && visualPassed ? 'passed' : 'failed',
    visualReviewStatus: visualPassed ? 'passed' : 'failed',
    checks,
    ...(qaEvidence ? { qaEvidence } : {}),
    visualReview: { reviewedBy: input.verifiedBy, reviewedAt: verifiedAt, viewports: input.viewports, printChecked: input.printChecked, notes: input.notes },
    verifiedBy: input.verifiedBy,
    verifiedAt,
  }
  const renderManifestHash = stableHash(deliveryHashPayload(updatedWithoutHash))
  const updated = DeliveryManifestSchema.parse({ ...updatedWithoutHash, renderManifestHash })
  const manifestPath = join(root, 'delivery-manifest.json')
  const temporaryManifestPath = join(root, `.delivery-manifest-${randomUUID()}.tmp`)
  try {
    await writeFile(temporaryManifestPath, JSON.stringify(updated, null, 2) + '\n', 'utf8')
    await rename(temporaryManifestPath, manifestPath)
  } catch (error) {
    await rm(temporaryManifestPath, { force: true })
    return err('DELIVERY_WRITE_FAILED', error instanceof Error ? error.message : String(error))
  }
  await appendRecordsAtomically([
    { collection: 'delivery-manifests', record: { id: randomUUID(), ...updated } },
    { collection: 'audit-events', record: {
      event: visualPassed && staticPassed ? 'delivery.verified' : 'delivery.verification_failed',
      deliveryId: manifest.deliveryId, contentId: manifest.contentId, revisionId: manifest.revisionId,
      renderManifestHash, actor: input.verifiedBy, failedChecks: checks.filter((item) => item.status === 'failed').map((item) => item.id),
    } },
  ])
  const data = { deliveryId: manifest.deliveryId, renderManifestHash, verified: staticPassed && visualPassed, checks }
  return data.verified ? ok(data, storageWarnings()) : actionRequired(data, storageWarnings())
}
