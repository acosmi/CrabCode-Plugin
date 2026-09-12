/**
 * Single outbound HTTP(S) egress point for this server.
 *
 * Every network read the plugin performs — evidence capture and hot-topic feeds
 * alike — goes through `fetchPinned`. The SSRF defences used to live only in
 * `tools/research-capture.ts`, so the trend feeds reached the network through
 * the global `fetch` with no address vetting at all: an allowlisted hostname
 * that resolves to a private address, or a redirect to one, was fetched
 * happily. Keeping one implementation means a rule added here cannot be missing
 * from the other caller (audit RC-16).
 *
 * The contract is: resolve every hop, refuse every non-public address, then dial
 * the vetted numeric address directly while preserving the original Host/SNI, so
 * no DNS lookup can happen between validation and connection.
 */

import { lookup } from 'node:dns/promises'
import { request as httpRequest, type IncomingHttpHeaders, type IncomingMessage } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { BlockList, isIP } from 'node:net'

export type OutboundTarget = { url: URL; addresses: Array<{ address: string; family: 4 | 6 }> }

/** Minimal shape of what a dialer returns; `node:http`'s ClientRequest satisfies it. */
export type OutboundClientRequest = {
  once(event: string, listener: (...args: any[]) => void): unknown
  end(): unknown
  destroy(error?: Error): unknown
}

export type OutboundResolver = (hostname: string) => Promise<Array<{ address: string; family: number }>>
export type OutboundDialer = (options: Record<string, unknown>) => OutboundClientRequest

export type FetchPinnedOptions = {
  url: string
  /** Whole-operation budget: DNS, connection, redirects and body read all share it. */
  timeoutMs: number
  maxBytes: number
  /** 0 means "a redirect is a failure", matching the old `redirect: 'error'`. */
  maxRedirects: number
  accept: string
  /** Matched against the bare content-type (parameters stripped, lowercased). */
  acceptContentTypes: RegExp
  userAgent: string
}

export type FetchPinnedResult = {
  finalUrl: string
  status: number
  contentType: string
  bytes: Uint8Array
  connectedAddress: string
  resolvedAddresses: string[]
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

export function forbiddenIp(value: string): boolean {
  if (isIP(value) === 4) return forbiddenV4.check(value, 'ipv4')
  if (isIP(value) === 6) return !globalV6.check(value, 'ipv6') || forbiddenV6.check(value, 'ipv6')
  return true
}

let resolverOverride: OutboundResolver | null = null
let dialerOverride: OutboundDialer | null = null

async function resolveHostname(hostname: string): Promise<Array<{ address: string; family: number }>> {
  if (resolverOverride) return resolverOverride(hostname)
  return lookup(hostname, { all: true, verbatim: true })
}

function remainingTime(deadline: number): number {
  const remaining = deadline - Date.now()
  if (remaining <= 0) throw new Error('request deadline exceeded')
  return remaining
}

async function deadlineBound<T>(promise: Promise<T>, deadline: number): Promise<T> {
  const remaining = remainingTime(deadline)
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('request deadline exceeded')), remaining) }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function normalizedHostname(url: URL): string {
  return url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
}

export async function assertPublicUrl(value: string, deadline: number): Promise<OutboundTarget> {
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
  }
  const resolved = await deadlineBound(resolveHostname(hostname), deadline)
  if (!resolved.length || resolved.some(({ address }) => forbiddenIp(address))) throw new Error(`hostname ${hostname} did not resolve exclusively to public addresses`)
  const addresses = resolved
    .filter((item): item is { address: string; family: 4 | 6 } => item.family === 4 || item.family === 6)
    .sort((left, right) => left.family - right.family || (left.address < right.address ? -1 : left.address > right.address ? 1 : 0))
  if (!addresses.length) throw new Error(`hostname ${hostname} has no usable IPv4/IPv6 address`)
  url.hash = ''
  return { url, addresses }
}

export function pinnedRequestOptions(target: OutboundTarget, extra: { accept: string; userAgent: string }): Record<string, unknown> {
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
      accept: extra.accept,
      'accept-encoding': 'identity',
      'user-agent': extra.userAgent,
    },
    ...(target.url.protocol === 'https:' && !isIP(authorityHostname) ? { servername: authorityHostname } : {}),
  }
}

function normalizeRemoteAddress(value: string): string {
  return value.toLowerCase().replace(/^::ffff:/, '')
}

function firstHeader(headers: IncomingHttpHeaders, name: string): string {
  const value = headers[name]
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

function readLimitedBody(response: IncomingMessage, deadline: number, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(response.headers['content-length'] ?? 0)
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error(`response exceeds ${maxBytes} bytes`)
  return deadlineBound(new Promise<Uint8Array>((resolve, reject) => {
    const chunks: Buffer[] = []
    let total = 0
    response.on('data', (chunk: Buffer | Uint8Array | string) => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      total += bytes.byteLength
      if (total > maxBytes) {
        response.destroy(new Error(`response exceeds ${maxBytes} bytes`))
        return
      }
      chunks.push(bytes)
    })
    response.once('end', () => resolve(new Uint8Array(Buffer.concat(chunks, total))))
    response.once('error', reject)
  }), deadline)
}

async function requestPinned(
  target: OutboundTarget,
  deadline: number,
  extra: { accept: string; userAgent: string },
): Promise<{ response: IncomingMessage; connectedAddress: string; resolvedAddresses: string[] }> {
  const selected = target.addresses[0]
  const dial: OutboundDialer = dialerOverride ??
    ((options) => (target.url.protocol === 'https:' ? httpsRequest : httpRequest)(options))
  return deadlineBound(new Promise((resolve, reject) => {
    // Dial the vetted numeric address directly. Host/SNI retain the original
    // authority for HTTP routing and TLS certificate verification, but no DNS
    // lookup occurs between validation and connection.
    const req = dial(pinnedRequestOptions(target, extra))
    const timer = setTimeout(() => req.destroy(new Error('request deadline exceeded')), remainingTime(deadline))
    req.once('response', (response: IncomingMessage) => {
      clearTimeout(timer)
      const remote = response.socket?.remoteAddress
      if (remote && (normalizeRemoteAddress(remote) !== normalizeRemoteAddress(selected.address) || forbiddenIp(remote))) {
        response.destroy()
        reject(new Error(`connected address ${remote} does not match vetted address ${selected.address}`))
        return
      }
      resolve({ response, connectedAddress: remote ?? selected.address, resolvedAddresses: target.addresses.map((item) => item.address) })
    })
    req.once('error', (error: Error) => {
      clearTimeout(timer)
      reject(error)
    })
    req.end()
  }), deadline)
}

export async function fetchPinned(options: FetchPinnedOptions): Promise<FetchPinnedResult> {
  const deadline = Date.now() + options.timeoutMs
  const extra = { accept: options.accept, userAgent: options.userAgent }
  let current = await assertPublicUrl(options.url, deadline)
  for (let redirect = 0; redirect <= options.maxRedirects; redirect++) {
    const { response, connectedAddress, resolvedAddresses } = await requestPinned(current, deadline, extra)
    const status = response.statusCode ?? 0
    if (status >= 300 && status < 400) {
      response.resume()
      if (redirect === options.maxRedirects) throw new Error(`redirect limit ${options.maxRedirects} exceeded`)
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
    if (!options.acceptContentTypes.test(contentType)) {
      response.resume()
      throw new Error(`unsupported content type ${contentType || '(missing)'}`)
    }
    return {
      finalUrl: current.url.toString(),
      status,
      contentType,
      bytes: await readLimitedBody(response, deadline, options.maxBytes),
      connectedAddress,
      resolvedAddresses,
    }
  }
  throw new Error('unreachable redirect state')
}

/**
 * Test seams. Both replace exactly one uncontrollable input — name resolution
 * and socket dialling — so the SSRF rules themselves stay in the code under
 * test and no suite has to reach the real network.
 */
export const outboundInternals = {
  __setResolverForTest(fn: OutboundResolver | null): void {
    resolverOverride = fn
  },
  __setDialerForTest(fn: OutboundDialer | null): void {
    dialerOverride = fn
  },
}
