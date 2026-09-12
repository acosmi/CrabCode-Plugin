import { createHash, randomUUID } from 'node:crypto'
import { toText } from 'hast-util-to-text'
import rehypeParse from 'rehype-parse'
import { unified } from 'unified'
import { z } from 'zod'
import { err, ok, type Envelope } from '../envelope.ts'
import { ResearchCaptureSchema, SafeHttpUrlSchema, stableHash, type ResearchCapture } from '../domain.ts'
import { fetchPinned, forbiddenIp, pinnedRequestOptions } from '../outbound.ts'
import { appendRecordsAtomically, getRecord, storageWarnings } from '../storage.ts'

const MAX_CAPTURE_BYTES = 2_000_000
const MAX_REDIRECTS = 5
const FETCH_TIMEOUT_MS = 12_000
const CAPTURE_ACCEPT = 'text/html, text/plain, application/json, application/xhtml+xml;q=0.9'
const CAPTURE_USER_AGENT = 'CrabCode-MediaOps/0.4 evidence-capture'
const CAPTURE_CONTENT_TYPES = /^(?:text\/(?:html|plain)|application\/(?:json|xhtml\+xml))$/
const captureSchema = z.object({ url: SafeHttpUrlSchema, capturedBy: z.string().min(1) })

export const name = 'mediaops.research.capture'
export const description =
  'Fetch one public HTTP(S) evidence page under SSRF, redirect, timeout, MIME and byte limits. Returns hash-bound capture metadata; research.complete accepts only these server-generated captures.'
export const inputSchema = captureSchema.shape

function captureHashPayload(capture: Omit<ResearchCapture, 'captureHash'>): unknown {
  return { ...capture }
}

function normalizeSnapshot(value: string): string {
  return value.normalize('NFC').replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').trim()
}

const htmlParser = unified().use(rehypeParse)

function explicitlyHiddenElement(node: any): boolean {
  if (node?.type !== 'element') return false
  const properties = node.properties ?? {}
  const style = Array.isArray(properties.style) ? properties.style.join(' ') : String(properties.style ?? '')
  return properties.hidden === true || String(properties.ariaHidden ?? '').toLowerCase() === 'true' ||
    /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden|content-visibility\s*:\s*hidden)\s*(?:;|$)/i.test(style)
}

function pruneExplicitlyHidden(node: any): void {
  if (!Array.isArray(node?.children)) return
  node.children = node.children.filter((child: any) => child?.type !== 'comment' && !explicitlyHiddenElement(child))
  for (const child of node.children) pruneExplicitlyHidden(child)
}

function visibleSnapshot(bytes: Uint8Array, contentType: string): string {
  const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  if (contentType === 'text/plain') return normalizeSnapshot(decoded)
  if (contentType === 'application/json') {
    let value: unknown
    try {
      value = JSON.parse(decoded)
    } catch (error) {
      throw new Error(`invalid JSON evidence (${error instanceof Error ? error.message : String(error)})`)
    }
    return normalizeSnapshot(JSON.stringify(value, null, 2))
  }
  if (contentType === 'text/html' || contentType === 'application/xhtml+xml') {
    const tree = htmlParser.parse(decoded)
    pruneExplicitlyHidden(tree)
    return normalizeSnapshot(toText(tree))
  }
  throw new Error(`unsupported content type ${contentType || '(missing)'}`)
}

/**
 * The SSRF/pinning/limit implementation lives in `src/outbound.ts` so evidence
 * capture and the hot-topic feeds cannot drift apart. These re-exports keep the
 * existing capture-side test surface pointed at the one implementation.
 */
export const researchCaptureInternals = {
  forbiddenIp,
  pinnedRequestOptions: (url: string, address: string, family: 4 | 6) =>
    pinnedRequestOptions({ url: new URL(url), addresses: [{ address, family }] }, { accept: CAPTURE_ACCEPT, userAgent: CAPTURE_USER_AGENT }),
  visibleSnapshot: (contentType: string, value: string) => visibleSnapshot(new TextEncoder().encode(value), contentType),
}

async function fetchCapture(requestedUrl: string): Promise<{
  finalUrl: string
  status: number
  contentType: string
  bytes: Uint8Array
  connectedAddress: string
  resolvedAddresses: string[]
}> {
  return fetchPinned({
    url: requestedUrl,
    timeoutMs: FETCH_TIMEOUT_MS,
    maxBytes: MAX_CAPTURE_BYTES,
    maxRedirects: MAX_REDIRECTS,
    accept: CAPTURE_ACCEPT,
    acceptContentTypes: CAPTURE_CONTENT_TYPES,
    userAgent: CAPTURE_USER_AGENT,
  })
}

export async function handler(args: z.input<typeof captureSchema>): Promise<Envelope> {
  const parsed = captureSchema.safeParse(args)
  if (!parsed.success) return err('INVALID_RESEARCH_CAPTURE', parsed.error.message)
  let fetched
  try {
    fetched = await fetchCapture(parsed.data.url)
  } catch (error) {
    return err('SOURCE_RETRIEVAL_FAILED', error instanceof Error ? error.message : String(error))
  }
  let snapshotText: string
  try {
    snapshotText = visibleSnapshot(fetched.bytes, fetched.contentType)
  } catch (error) {
    return err('SOURCE_RETRIEVAL_FAILED', error instanceof Error ? error.message : String(error))
  }
  if (!snapshotText) return err('SOURCE_RETRIEVAL_FAILED', 'The captured page contains no usable text.')
  const captureId = randomUUID()
  const capturedAt = new Date().toISOString()
  const withoutHash: Omit<ResearchCapture, 'captureHash'> = {
    captureId,
    requestedUrl: new URL(parsed.data.url).toString(),
    finalUrl: fetched.finalUrl,
    httpStatus: fetched.status,
    contentType: fetched.contentType,
    snapshotText,
    snapshotHash: stableHash(snapshotText),
    contentHash: createHash('sha256').update(fetched.bytes).digest('hex'),
    byteSize: fetched.bytes.byteLength,
    connectedAddress: fetched.connectedAddress,
    resolvedAddresses: fetched.resolvedAddresses,
    capturedAt,
    capturedBy: parsed.data.capturedBy,
  }
  const captureHash = stableHash(captureHashPayload(withoutHash))
  const capture = ResearchCaptureSchema.parse({ ...withoutHash, captureHash })
  await appendRecordsAtomically([
    { collection: 'research-captures', record: { id: captureId, ...capture } },
    { collection: 'audit-events', record: {
      event: 'research.source.captured', captureId, requestedUrl: capture.requestedUrl, finalUrl: capture.finalUrl,
      snapshotHash: capture.snapshotHash, contentHash: capture.contentHash, actor: capture.capturedBy,
    } },
  ])
  return ok({
    captureId,
    requestedUrl: capture.requestedUrl,
    finalUrl: capture.finalUrl,
    httpStatus: capture.httpStatus,
    contentType: capture.contentType,
    snapshotHash: capture.snapshotHash,
    contentHash: capture.contentHash,
    byteSize: capture.byteSize,
    connectedAddress: capture.connectedAddress,
    resolvedAddresses: capture.resolvedAddresses,
    capturedAt,
  }, storageWarnings())
}

export async function getResearchCapture(captureId: string): Promise<ResearchCapture | null> {
  const record = await getRecord('research-captures', captureId)
  if (!record) return null
  const parsed = ResearchCaptureSchema.safeParse(record)
  if (!parsed.success) throw new Error(`INVALID_STORED_RESEARCH_CAPTURE:${captureId}`)
  const { captureHash, ...withoutHash } = parsed.data
  if (stableHash(captureHashPayload(withoutHash)) !== captureHash) throw new Error(`RESEARCH_CAPTURE_HASH_MISMATCH:${captureId}`)
  return parsed.data
}
