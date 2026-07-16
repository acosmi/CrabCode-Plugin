import { createHash, randomUUID } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { request as httpRequest, type IncomingHttpHeaders, type IncomingMessage } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { BlockList, isIP } from 'node:net'
import { toText } from 'hast-util-to-text'
import rehypeParse from 'rehype-parse'
import { unified } from 'unified'
import { z } from 'zod'
import { err, ok, type Envelope } from '../envelope.ts'
import { ResearchCaptureSchema, SafeHttpUrlSchema, stableHash, type ResearchCapture } from '../domain.ts'
import { appendRecordsAtomically, getRecord, storageWarnings } from '../storage.ts'

const MAX_CAPTURE_BYTES = 2_000_000
const MAX_REDIRECTS = 5
const FETCH_TIMEOUT_MS = 12_000
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

const forbiddenV4 = new BlockList()
for (const [base, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) forbiddenV4.addSubnet(base, prefix, 'ipv4')

// Only ordinary IPv6 global-unicast addresses are eligible. Special-use
// ranges capable of tunnelling or embedding another destination are excluded
// even when the embedded destination is written in hexadecimal form.
const globalV6 = new BlockList()
globalV6.addSubnet('2000::', 3, 'ipv6')
const forbiddenV6 = new BlockList()
for (const [base, prefix] of [
  ['2001::', 23], // IETF protocol assignments (Teredo, benchmarking, ORCHID, etc.)
  ['2001:db8::', 32], // documentation
  ['2002::', 16], // 6to4 embeds an IPv4 destination
  ['3fff::', 20], // documentation
] as const) forbiddenV6.addSubnet(base, prefix, 'ipv6')

function forbiddenIp(value: string): boolean {
  if (isIP(value) === 4) return forbiddenV4.check(value, 'ipv4')
  if (isIP(value) === 6) return !globalV6.check(value, 'ipv6') || forbiddenV6.check(value, 'ipv6')
  return true
}

function remainingTime(deadline: number): number {
  const remaining = deadline - Date.now()
  if (remaining <= 0) throw new Error(`capture deadline ${FETCH_TIMEOUT_MS}ms exceeded`)
  return remaining
}

async function deadlineBound<T>(promise: Promise<T>, deadline: number): Promise<T> {
  const remaining = remainingTime(deadline)
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`capture deadline ${FETCH_TIMEOUT_MS}ms exceeded`)), remaining) }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

type ResolvedTarget = { url: URL; addresses: Array<{ address: string; family: 4 | 6 }> }

function normalizedHostname(url: URL): string {
  return url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
}

async function assertPublicUrl(value: string, deadline: number): Promise<ResolvedTarget> {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('only HTTP(S) evidence URLs are allowed')
  if (url.username || url.password) throw new Error('URL credentials are not allowed')
  if ((url.protocol === 'http:' && url.port && url.port !== '80') || (url.protocol === 'https:' && url.port && url.port !== '443')) {
    throw new Error('custom network ports are not allowed')
  }
  const hostname = normalizedHostname(url)
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname.endsWith('.lan') || hostname.endsWith('.home')) {
    throw new Error('local/internal hostnames are not allowed')
  }
  if (isIP(hostname)) {
    if (forbiddenIp(hostname)) throw new Error(`non-public address ${hostname} is not allowed`)
    url.hash = ''
    return { url, addresses: [{ address: hostname, family: isIP(hostname) as 4 | 6 }] }
  } else {
    const resolved = await deadlineBound(lookup(hostname, { all: true, verbatim: true }), deadline)
    if (!resolved.length || resolved.some(({ address }) => forbiddenIp(address))) throw new Error(`hostname ${hostname} did not resolve exclusively to public addresses`)
    const addresses = resolved
      .filter((item): item is { address: string; family: 4 | 6 } => item.family === 4 || item.family === 6)
      .sort((left, right) => left.family - right.family || (left.address < right.address ? -1 : left.address > right.address ? 1 : 0))
    if (!addresses.length) throw new Error(`hostname ${hostname} has no usable IPv4/IPv6 address`)
    url.hash = ''
    return { url, addresses }
  }
}

function normalizeRemoteAddress(value: string): string {
  return value.toLowerCase().replace(/^::ffff:/, '')
}

function readLimitedBody(response: IncomingMessage, deadline: number): Promise<Uint8Array> {
  const declared = Number(response.headers['content-length'] ?? 0)
  if (Number.isFinite(declared) && declared > MAX_CAPTURE_BYTES) throw new Error(`response exceeds ${MAX_CAPTURE_BYTES} bytes`)
  return deadlineBound(new Promise<Uint8Array>((resolve, reject) => {
    const chunks: Buffer[] = []
    let total = 0
    response.on('data', (chunk: Buffer | Uint8Array | string) => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      total += bytes.byteLength
      if (total > MAX_CAPTURE_BYTES) {
        response.destroy(new Error(`response exceeds ${MAX_CAPTURE_BYTES} bytes`))
        return
      }
      chunks.push(bytes)
    })
    response.once('end', () => resolve(new Uint8Array(Buffer.concat(chunks, total))))
    response.once('error', reject)
  }), deadline)
}

function firstHeader(headers: IncomingHttpHeaders, name: string): string {
  const value = headers[name]
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

async function requestPinned(
  target: ResolvedTarget,
  deadline: number,
): Promise<{ response: IncomingMessage; connectedAddress: string; resolvedAddresses: string[] }> {
  const selected = target.addresses[0]
  const request = target.url.protocol === 'https:' ? httpsRequest : httpRequest
  return deadlineBound(new Promise((resolve, reject) => {
    // Dial the vetted numeric address directly. Host/SNI retain the original
    // authority for HTTP routing and TLS certificate verification, but no DNS
    // lookup occurs between validation and connection.
    const req = request(pinnedRequestOptions(target))
    const timer = setTimeout(() => req.destroy(new Error(`capture deadline ${FETCH_TIMEOUT_MS}ms exceeded`)), remainingTime(deadline))
    req.once('response', (response) => {
      clearTimeout(timer)
      const remote = response.socket.remoteAddress
      if (remote && (normalizeRemoteAddress(remote) !== normalizeRemoteAddress(selected.address) || forbiddenIp(remote))) {
        response.destroy()
        reject(new Error(`connected address ${remote} does not match vetted address ${selected.address}`))
        return
      }
      resolve({ response, connectedAddress: remote ?? selected.address, resolvedAddresses: target.addresses.map((item) => item.address) })
    })
    req.once('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    req.end()
  }), deadline)
}

function pinnedRequestOptions(target: ResolvedTarget): Record<string, unknown> {
  const selected = target.addresses[0]
  const authorityHostname = normalizedHostname(target.url)
  return {
      protocol: target.url.protocol,
      hostname: selected.address,
      port: target.url.port || (target.url.protocol === 'https:' ? 443 : 80),
      path: `${target.url.pathname}${target.url.search}`,
      method: 'GET',
      headers: {
        host: target.url.host,
        accept: 'text/html, text/plain, application/json, application/xhtml+xml;q=0.9',
        'accept-encoding': 'identity',
        'user-agent': 'CrabCode-MediaOps/0.4 evidence-capture',
      },
      ...(target.url.protocol === 'https:' && !isIP(authorityHostname) ? { servername: authorityHostname } : {}),
  }
}

export const researchCaptureInternals = {
  forbiddenIp,
  pinnedRequestOptions: (url: string, address: string, family: 4 | 6) => pinnedRequestOptions({ url: new URL(url), addresses: [{ address, family }] }),
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
  const deadline = Date.now() + FETCH_TIMEOUT_MS
  let current = await assertPublicUrl(requestedUrl, deadline)
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    const { response, connectedAddress, resolvedAddresses } = await requestPinned(current, deadline)
    const status = response.statusCode ?? 0
    if (status >= 300 && status < 400) {
      response.resume()
      if (redirect === MAX_REDIRECTS) throw new Error(`redirect limit ${MAX_REDIRECTS} exceeded`)
      const location = firstHeader(response.headers, 'location')
      if (!location) throw new Error(`redirect HTTP ${status} has no Location header`)
      current = await assertPublicUrl(new URL(location, current.url).toString(), deadline)
      continue
    }
    if (status < 200 || status > 299) {
      response.resume()
      throw new Error(`source returned HTTP ${status}`)
    }
    const contentType = firstHeader(response.headers, 'content-type').split(';', 1)[0].trim().toLowerCase()
    if (!/^(?:text\/(?:html|plain)|application\/(?:json|xhtml\+xml))$/.test(contentType)) {
      response.resume()
      throw new Error(`unsupported content type ${contentType || '(missing)'}`)
    }
    return {
      finalUrl: current.url.toString(),
      status,
      contentType,
      bytes: await readLimitedBody(response, deadline),
      connectedAddress,
      resolvedAddresses,
    }
  }
  throw new Error('unreachable redirect state')
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
