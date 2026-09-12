import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { EventEmitter } from 'node:events'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { assertPublicUrl, fetchPinned, outboundInternals, type OutboundClientRequest } from '../src/outbound.ts'
import { HackerNewsSource, buildSources } from '../src/sources/index.ts'

const JSON_ONLY = /^application\/(?:[a-z0-9.+-]*\+)?json$/
const PUBLIC_ADDRESS = '93.184.216.34'

type FakeHop = {
  status: number
  headers: Record<string, string>
  body?: string
  remoteAddress?: string
}

/**
 * Replace exactly one uncontrollable input — the socket dial — so the SSRF and
 * limit rules under test are the real ones and no suite touches the network.
 */
function fakeDialer(hops: FakeHop[], seen: Array<Record<string, unknown>> = []) {
  let call = 0
  return (options: Record<string, unknown>): OutboundClientRequest => {
    seen.push(options)
    const hop = hops[Math.min(call, hops.length - 1)]
    call += 1
    const request = new EventEmitter() as EventEmitter & OutboundClientRequest
    ;(request as any).end = (): void => {
      setTimeout(() => {
        const response = new Readable({ read() {} }) as any
        response.statusCode = hop.status
        response.headers = hop.headers
        response.socket = { remoteAddress: hop.remoteAddress ?? PUBLIC_ADDRESS }
        if (hop.body !== undefined) response.push(Buffer.from(hop.body, 'utf8'))
        response.push(null)
        request.emit('response', response)
      }, 0)
    }
    ;(request as any).destroy = (): void => undefined
    return request
  }
}

function publicResolver() {
  return async () => [{ address: PUBLIC_ADDRESS, family: 4 }]
}

describe('single outbound egress point', () => {
  afterEach(() => {
    outboundInternals.__setResolverForTest(null)
    outboundInternals.__setDialerForTest(null)
  })

  describe('configured feeds now obey the same SSRF rules as evidence capture', () => {
    let dir: string
    let previousDataDir: string | undefined
    let previousAllowlist: string | undefined

    beforeEach(async () => {
      dir = await mkdtemp(join(tmpdir(), 'mediaops-outbound-feed-'))
      previousDataDir = process.env.MEDIAOPS_DATA_DIR
      previousAllowlist = process.env.MEDIAOPS_FEED_HOST_ALLOWLIST
      process.env.MEDIAOPS_DATA_DIR = dir
    })

    afterEach(async () => {
      if (previousDataDir === undefined) delete process.env.MEDIAOPS_DATA_DIR
      else process.env.MEDIAOPS_DATA_DIR = previousDataDir
      if (previousAllowlist === undefined) delete process.env.MEDIAOPS_FEED_HOST_ALLOWLIST
      else process.env.MEDIAOPS_FEED_HOST_ALLOWLIST = previousAllowlist
      await rm(dir, { recursive: true, force: true })
    })

    /**
     * The load-bearing regression: an operator can put a loopback host on the
     * feed allowlist, and before RC-16 the feed was fetched through the global
     * `fetch` with no address vetting at all. The allowlist still admits the
     * source — that is its job — and the egress layer is what refuses.
     */
    test('an allowlisted loopback feed is registered but never fetched', async () => {
      process.env.MEDIAOPS_FEED_HOST_ALLOWLIST = '127.0.0.1'
      await writeFile(join(dir, 'sources.config.json'), JSON.stringify({
        sources: [{ id: 'private', type: 'json-feed', url: 'https://127.0.0.1/feed.json', titlePath: 'title' }],
      }))
      // Any dial at all would be a failure; this one also records it.
      const dialled: Array<Record<string, unknown>> = []
      outboundInternals.__setDialerForTest(fakeDialer([{ status: 200, headers: { 'content-type': 'application/json' }, body: '{"items":[]}' }], dialled))

      const { sources, warnings } = buildSources()
      expect(warnings).toHaveLength(0)
      expect(sources.private).toBeDefined()

      const result = await sources.private!.fetch(undefined, 5)
      expect(result.signals).toEqual([])
      expect(result.warnings.join(' ')).toContain('non-public address')
      expect(dialled).toHaveLength(0)
    })

    /** Positive control: an allowlisted public host does reach the egress layer and map items. */
    test('an allowlisted public feed is fetched and mapped', async () => {
      process.env.MEDIAOPS_FEED_HOST_ALLOWLIST = 'example.com'
      await writeFile(join(dir, 'sources.config.json'), JSON.stringify({
        sources: [{ id: 'company-blog', type: 'json-feed', url: 'https://example.com/feed.json', itemsPath: 'items', titlePath: 'headline' }],
      }))
      outboundInternals.__setResolverForTest(publicResolver())
      outboundInternals.__setDialerForTest(fakeDialer([{
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ items: [{ headline: '公网条目' }] }),
      }]))

      const { sources } = buildSources()
      const result = await sources['company-blog']!.fetch(undefined, 5)
      expect(result.warnings).toEqual([])
      expect(result.signals.map((signal) => signal.title)).toEqual(['公网条目'])
    })
  })

  describe('the built-in HackerNews source dials only vetted addresses', () => {
    test('a vetted address returns signals', async () => {
      outboundInternals.__setResolverForTest(publicResolver())
      const dialled: Array<Record<string, unknown>> = []
      outboundInternals.__setDialerForTest(fakeDialer([{
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ hits: [{ objectID: '42', title: 'HN 头条', url: 'https://example.com/hn', points: 120, created_at: '2026-09-01T00:00:00.000Z' }] }),
      }], dialled))

      const result = await new HackerNewsSource().fetch(undefined, 10)
      expect(result.warnings).toEqual([])
      expect(result.signals).toHaveLength(1)
      expect(result.signals[0]).toMatchObject({ id: 'hackernews:42', rawScore: 120, scoreUnit: 'points', sourceRank: 1, publishedAt: '2026-09-01T00:00:00.000Z' })
      // Pinning: the dial targets the numeric address while Host/SNI keep the authority.
      expect(dialled[0]?.hostname).toBe(PUBLIC_ADDRESS)
      expect((dialled[0]?.headers as Record<string, string>).host).toBe('hn.algolia.com')
    })

    test('a connection that lands on a private address is refused after connect', async () => {
      outboundInternals.__setResolverForTest(publicResolver())
      outboundInternals.__setDialerForTest(fakeDialer([{
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ hits: [] }),
        remoteAddress: '10.0.0.1',
      }]))

      const result = await new HackerNewsSource().fetch(undefined, 10)
      expect(result.signals).toEqual([])
      expect(result.warnings.join(' ')).toContain('does not match vetted address')
    })
  })

  describe('redirect budget', () => {
    test('maxRedirects 0 turns any redirect into a failure', async () => {
      outboundInternals.__setResolverForTest(publicResolver())
      outboundInternals.__setDialerForTest(fakeDialer([{ status: 301, headers: { location: 'https://example.com/final' } }]))
      await expect(fetchPinned({
        url: 'https://example.com/feed.json',
        timeoutMs: 5_000,
        maxBytes: 1_000_000,
        maxRedirects: 0,
        accept: 'application/json',
        acceptContentTypes: JSON_ONLY,
        userAgent: 'test',
      })).rejects.toThrow('redirect limit 0 exceeded')
    })

    test('maxRedirects 1 follows one public hop', async () => {
      outboundInternals.__setResolverForTest(publicResolver())
      outboundInternals.__setDialerForTest(fakeDialer([
        { status: 301, headers: { location: 'https://example.com/final' } },
        { status: 200, headers: { 'content-type': 'application/json' }, body: '{"ok":true}' },
      ]))
      const result = await fetchPinned({
        url: 'https://example.com/feed.json',
        timeoutMs: 5_000,
        maxBytes: 1_000_000,
        maxRedirects: 1,
        accept: 'application/json',
        acceptContentTypes: JSON_ONLY,
        userAgent: 'test',
      })
      expect(result.finalUrl).toBe('https://example.com/final')
      expect(new TextDecoder().decode(result.bytes)).toBe('{"ok":true}')
    })
  })

  describe('body and type limits', () => {
    test('a body over the budget is refused', async () => {
      outboundInternals.__setResolverForTest(publicResolver())
      outboundInternals.__setDialerForTest(fakeDialer([{ status: 200, headers: { 'content-type': 'application/json' }, body: 'x'.repeat(4_096) }]))
      await expect(fetchPinned({
        url: 'https://example.com/feed.json',
        timeoutMs: 5_000,
        maxBytes: 1_024,
        maxRedirects: 0,
        accept: 'application/json',
        acceptContentTypes: JSON_ONLY,
        userAgent: 'test',
      })).rejects.toThrow('response exceeds 1024 bytes')
    })

    test('an unexpected content type is refused', async () => {
      outboundInternals.__setResolverForTest(publicResolver())
      outboundInternals.__setDialerForTest(fakeDialer([{ status: 200, headers: { 'content-type': 'text/html' }, body: '<p>x</p>' }]))
      await expect(fetchPinned({
        url: 'https://example.com/feed.json',
        timeoutMs: 5_000,
        maxBytes: 1_000_000,
        maxRedirects: 0,
        accept: 'application/json',
        acceptContentTypes: JSON_ONLY,
        userAgent: 'test',
      })).rejects.toThrow('unsupported content type text/html')
    })

    test('a non-2xx response carries the capture-side wording', async () => {
      outboundInternals.__setResolverForTest(publicResolver())
      outboundInternals.__setDialerForTest(fakeDialer([{ status: 503, headers: {} }]))
      await expect(fetchPinned({
        url: 'https://example.com/feed.json',
        timeoutMs: 5_000,
        maxBytes: 1_000_000,
        maxRedirects: 0,
        accept: 'application/json',
        acceptContentTypes: JSON_ONLY,
        userAgent: 'test',
      })).rejects.toThrow('source returned HTTP 503')
    })
  })

  describe('URL admission keeps the original capture wording', () => {
    const deadline = () => Date.now() + 5_000

    test('credentials, custom ports and local hostnames are refused verbatim', async () => {
      await expect(assertPublicUrl('https://user:pass@example.com/a', deadline())).rejects.toThrow('URL credentials are not allowed')
      await expect(assertPublicUrl('https://example.com:8443/a', deadline())).rejects.toThrow('custom network ports are not allowed')
      await expect(assertPublicUrl('https://api.localhost/a', deadline())).rejects.toThrow('local/internal hostnames are not allowed')
      await expect(assertPublicUrl('http://127.0.0.1/', deadline())).rejects.toThrow('non-public address 127.0.0.1 is not allowed')
    })

    test('a hostname resolving to a private address is refused before any dial', async () => {
      outboundInternals.__setResolverForTest(async () => [{ address: '10.1.2.3', family: 4 }])
      const dialled: Array<Record<string, unknown>> = []
      outboundInternals.__setDialerForTest(fakeDialer([{ status: 200, headers: { 'content-type': 'application/json' }, body: '{}' }], dialled))
      await expect(assertPublicUrl('https://rebound.example/a', deadline())).rejects.toThrow('did not resolve exclusively to public addresses')
      expect(dialled).toHaveLength(0)
    })

    /** Positive control: the same admission path accepts an ordinary public host. */
    test('an ordinary public hostname is admitted', async () => {
      outboundInternals.__setResolverForTest(publicResolver())
      const target = await assertPublicUrl('https://example.com/a#fragment', deadline())
      expect(target.url.toString()).toBe('https://example.com/a')
      expect(target.addresses).toEqual([{ address: PUBLIC_ADDRESS, family: 4 }])
    })
  })
})
