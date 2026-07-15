import { createHash, randomUUID } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { z } from 'zod'
import { err, ok, type Envelope } from '../envelope.ts'
import { ResearchCaptureSchema, SafeHttpUrlSchema, stableHash, type ResearchCapture } from '../domain.ts'
import { appendRecord, getRecord, storageWarnings } from '../storage.ts'

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

function ipv4Number(value: string): number | null {
  const parts = value.split('.')
  if (parts.length !== 4) return null
  const octets = parts.map(Number)
  if (octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null
  return (((octets[0] << 24) >>> 0) + (octets[1] << 16) + (octets[2] << 8) + octets[3]) >>> 0
}

function inV4Range(value: number, base: number, bits: number): boolean {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
  return (value & mask) === (base & mask)
}

function forbiddenIp(value: string): boolean {
  if (isIP(value) === 4) {
    const ip = ipv4Number(value)!
    return [
      ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
      ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
      ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
    ].some(([base, bits]) => inV4Range(ip, ipv4Number(String(base))!, Number(bits)))
  }
  if (isIP(value) === 6) {
    const normalized = value.toLowerCase()
    if (normalized === '::' || normalized === '::1') return true
    if (/^(?:fc|fd|fe8|fe9|fea|feb|ff)/.test(normalized)) return true
    if (normalized.startsWith('2001:db8:')) return true
    const mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1]
    return mapped ? forbiddenIp(mapped) : false
  }
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

async function assertPublicUrl(value: string, deadline: number): Promise<URL> {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('only HTTP(S) evidence URLs are allowed')
  if (url.username || url.password) throw new Error('URL credentials are not allowed')
  if ((url.protocol === 'http:' && url.port && url.port !== '80') || (url.protocol === 'https:' && url.port && url.port !== '443')) {
    throw new Error('custom network ports are not allowed')
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '')
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname.endsWith('.lan') || hostname.endsWith('.home')) {
    throw new Error('local/internal hostnames are not allowed')
  }
  if (isIP(hostname)) {
    if (forbiddenIp(hostname)) throw new Error(`non-public address ${hostname} is not allowed`)
  } else {
    const addresses = await deadlineBound(lookup(hostname, { all: true, verbatim: true }), deadline)
    if (!addresses.length || addresses.some(({ address }) => forbiddenIp(address))) throw new Error(`hostname ${hostname} did not resolve exclusively to public addresses`)
  }
  url.hash = ''
  return url
}

async function readLimitedBody(response: Response): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length') ?? 0)
  if (Number.isFinite(declared) && declared > MAX_CAPTURE_BYTES) throw new Error(`response exceeds ${MAX_CAPTURE_BYTES} bytes`)
  if (!response.body) throw new Error('response body is missing')
  const chunks: Uint8Array[] = []
  let total = 0
  const reader = response.body.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_CAPTURE_BYTES) {
      await reader.cancel()
      throw new Error(`response exceeds ${MAX_CAPTURE_BYTES} bytes`)
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

async function fetchCapture(requestedUrl: string): Promise<{ finalUrl: string; status: number; contentType: string; bytes: Uint8Array }> {
  const deadline = Date.now() + FETCH_TIMEOUT_MS
  let current = await assertPublicUrl(requestedUrl, deadline)
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), remainingTime(deadline))
    try {
      const response = await fetch(current, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { accept: 'text/html, text/plain, application/json, application/xhtml+xml, application/xml;q=0.9' },
      })
      if (response.status >= 300 && response.status < 400) {
        if (redirect === MAX_REDIRECTS) throw new Error(`redirect limit ${MAX_REDIRECTS} exceeded`)
        const location = response.headers.get('location')
        if (!location) throw new Error(`redirect HTTP ${response.status} has no Location header`)
        current = await assertPublicUrl(new URL(location, current).toString(), deadline)
        continue
      }
      if (response.status < 200 || response.status > 299) throw new Error(`source returned HTTP ${response.status}`)
      const contentType = (response.headers.get('content-type') ?? '').split(';', 1)[0].trim().toLowerCase()
      if (!/^(?:text\/(?:html|plain|xml)|application\/(?:json|xhtml\+xml|xml))$/.test(contentType)) {
        throw new Error(`unsupported content type ${contentType || '(missing)'}`)
      }
      return { finalUrl: current.toString(), status: response.status, contentType, bytes: await readLimitedBody(response) }
    } finally {
      clearTimeout(timer)
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
  const snapshotText = normalizeSnapshot(new TextDecoder('utf-8', { fatal: false }).decode(fetched.bytes))
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
    capturedAt,
    capturedBy: parsed.data.capturedBy,
  }
  const captureHash = stableHash(captureHashPayload(withoutHash))
  const capture = ResearchCaptureSchema.parse({ ...withoutHash, captureHash })
  await appendRecord('research-captures', { id: captureId, ...capture })
  await appendRecord('audit-events', {
    event: 'research.source.captured', captureId, requestedUrl: capture.requestedUrl, finalUrl: capture.finalUrl,
    snapshotHash: capture.snapshotHash, contentHash: capture.contentHash, actor: capture.capturedBy,
  })
  return ok({
    captureId,
    requestedUrl: capture.requestedUrl,
    finalUrl: capture.finalUrl,
    httpStatus: capture.httpStatus,
    contentType: capture.contentType,
    snapshotHash: capture.snapshotHash,
    contentHash: capture.contentHash,
    byteSize: capture.byteSize,
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
