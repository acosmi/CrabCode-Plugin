/**
 * Hot-topic source providers.
 *
 * A source maps an external free, no-auth feed into normalized TopicSignals.
 * Network failures are caught and returned as warnings rather than crashing the
 * agent. The trend tool then treats a zero-result aggregate as action_required;
 * an unavailable feed can never be mistaken for successful research.
 *
 * The registry is config-driven (D6): no scraper for unofficial endpoints is
 * hard-coded here. Users register official/self-hosted JSON feeds via
 * <data>/sources.config.json; the built-in HackerNews source is kept as a
 * reference example. Discovery on sources without an official API is the
 * trend-researcher subagent's job (WebSearch/WebFetch), not this server's.
 *
 * Every fetch here goes through `src/outbound.ts` (RC-16). Feeds used to call
 * the global `fetch`, which meant an allowlisted hostname resolving to a private
 * address — or redirecting to one — was retrieved with no vetting whatsoever;
 * the SSRF rules existed only on the evidence-capture path. The hostname
 * allowlist below is an additional, independent restriction and is kept.
 */

import { createHash } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { dataDir } from '../storage.ts'
import { canonicalUrlIdentity, isSafeHttpUrl } from '../domain.ts'
import { fetchPinned } from '../outbound.ts'

const MAX_FEED_BYTES = 2 * 1024 * 1024
const FETCH_TIMEOUT_MS = 10_000
const FEED_ACCEPT = 'application/json'
const FEED_CONTENT_TYPES = /^application\/(?:[a-z0-9.+-]*\+)?json$/
const FEED_USER_AGENT = 'CrabCode-MediaOps/0.4 trend-feed'

/**
 * A hot-topic signal.
 *
 * `rawScore`/`scoreUnit` keep the source's own number in its own unit, and
 * `sourceRank` is that source's ordering of its own items. Scores from
 * different feeds are different quantities (HN points, a blog's "heat", a
 * view count) and were previously compared directly — the aggregate order was
 * therefore meaningless. `hotScore` stays as `rawScore ?? 0` for callers that
 * still read it.
 *
 * `publishedAt`/`eventAt` are the source's timestamps and are `null` when the
 * source did not give one; `capturedAt` is this process's clock and never
 * stands in for them.
 */
export type TopicSignal = {
  id: string
  source: string
  title: string
  url: string
  hotScore: number
  rawScore: number | null
  scoreUnit: string | null
  sourceRank: number
  publishedAt: string | null
  eventAt: string | null
  capturedAt: string
}

export type FetchResult = {
  signals: TopicSignal[]
  warnings: string[]
}

/**
 * Where a source's audience and data live, and on what authority we read it.
 *
 * `region` exists so the server can say plainly that it has **no** Chinese hot
 * source configured, instead of returning a global-only list that reads like
 * Chinese coverage. `authorization` is mandatory for `cn` sources because the
 * answer to "why may this plugin read that platform" has to be written down by
 * whoever configured it — this server never scrapes a platform that has no
 * official API (§8.2).
 */
export type SourceRegion = 'cn' | 'global'

export type SourceAuthorizationBasis = 'official-api' | 'self-hosted' | 'user-provided' | 'licensed'

export type SourceAuthorization = {
  basis: SourceAuthorizationBasis
  note?: string
}

export const SOURCE_AUTHORIZATION_BASES: readonly SourceAuthorizationBasis[] = Object.freeze([
  'official-api', 'self-hosted', 'user-provided', 'licensed',
])

export const CN_SOURCE_AUTHORIZATION_REQUIRED = '中文来源必须声明授权依据（authorization.basis）'

export interface HotSource {
  id: string
  readonly region: SourceRegion
  readonly authorization?: SourceAuthorization
  fetch(query?: string, limit?: number): Promise<FetchResult>
}

/**
 * Only string timestamps are accepted. A bare number is ambiguous between
 * seconds and milliseconds, and guessing wrong silently relabels an article by
 * decades; an absent timestamp is reported as absent instead.
 */
function isoTimestampOrNull(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? new Date(time).toISOString() : null
}

/** Rank within one source: rawScore descending, unscored last, source order kept on ties. */
function withSourceRanks(signals: Array<Omit<TopicSignal, 'sourceRank'>>): TopicSignal[] {
  const ordered = signals.map((signal, index) => ({ signal, index }))
  ordered.sort((left, right) => {
    const leftScore = left.signal.rawScore
    const rightScore = right.signal.rawScore
    if (leftScore === null && rightScore === null) return left.index - right.index
    if (leftScore === null) return 1
    if (rightScore === null) return -1
    return rightScore - leftScore || left.index - right.index
  })
  const rankByIndex = new Map<number, number>()
  ordered.forEach((item, position) => rankByIndex.set(item.index, position + 1))
  return signals.map((signal, index) => ({ ...signal, sourceRank: rankByIndex.get(index) ?? index + 1 }))
}

/** Translate an outbound failure into the warning shape callers already parse. */
function feedWarning(id: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const httpStatus = /^source returned HTTP (\d+)$/.exec(message)
  return httpStatus ? `${id}: HTTP ${httpStatus[1]}` : `${id}: fetch failed (${message})`
}

async function fetchFeedJson(url: string): Promise<unknown> {
  const response = await fetchPinned({
    url,
    timeoutMs: FETCH_TIMEOUT_MS,
    maxBytes: MAX_FEED_BYTES,
    // A feed redirect is a failure, exactly as the previous `redirect: 'error'`.
    maxRedirects: 0,
    accept: FEED_ACCEPT,
    acceptContentTypes: FEED_CONTENT_TYPES,
    userAgent: FEED_USER_AGENT,
  })
  return JSON.parse(new TextDecoder().decode(response.bytes))
}

/**
 * Hacker News front page via the free, no-auth Algolia search API.
 */
export class HackerNewsSource implements HotSource {
  id = 'hackernews'
  readonly region: SourceRegion = 'global'
  readonly authorization: SourceAuthorization = { basis: 'official-api', note: 'Algolia 公开只读搜索 API，无需鉴权' }

  async fetch(query?: string, limit = 20): Promise<FetchResult> {
    const base = 'https://hn.algolia.com/api/v1/search'
    const params = new URLSearchParams()
    if (query && query.trim()) {
      params.set('query', query.trim())
    } else {
      params.set('tags', 'front_page')
    }
    params.set('hitsPerPage', String(Math.max(1, Math.min(limit, 50))))

    try {
      const json = (await fetchFeedJson(`${base}?${params.toString()}`)) as { hits?: HnHit[] }
      const hits = Array.isArray(json.hits) ? json.hits : []
      const capturedAt = new Date().toISOString()
      const signals = hits.slice(0, limit).map((hit) => {
        const rawScore = typeof hit.points === 'number' ? hit.points : null
        return {
          id: `hackernews:${hit.objectID}`,
          source: this.id,
          title: hit.title ?? hit.story_title ?? '(untitled)',
          url: hit.url ?? hit.story_url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`,
          hotScore: rawScore ?? 0,
          rawScore,
          scoreUnit: 'points',
          publishedAt: isoTimestampOrNull(hit.created_at),
          eventAt: null,
          capturedAt,
        }
      })
      return { signals: withSourceRanks(signals), warnings: [] }
    } catch (e) {
      return { signals: [], warnings: [feedWarning(this.id, e)] }
    }
  }
}

type HnHit = {
  objectID: string
  title?: string
  story_title?: string
  url?: string
  story_url?: string
  points?: number
  created_at?: string
}

// ---- config-driven registry ---------------------------------------------------

/** A generic JSON feed mapped into TopicSignals via dot-path field selectors. */
export type JsonFeedConfig = {
  id: string
  type: 'json-feed'
  url: string
  /** Dot path to the item array in the response, e.g. "data.items". Empty = response root. */
  itemsPath?: string
  titlePath: string
  urlPath?: string
  scorePath?: string
  /** Dot path to the feed's own stable item identifier; the first choice for a signal id. */
  idPath?: string
  /** Dot path to the publication timestamp; parsed strictly, never invented. */
  publishedAtPath?: string
  /** Dot path to the timestamp of the event the item is about, when the feed distinguishes it. */
  eventAtPath?: string
  /** What `scorePath` counts (e.g. "points", "views"); recorded, never compared across sources. */
  scoreUnit?: string
  /** Audience/data region; defaults to `global`. `cn` additionally requires `authorization`. */
  region?: SourceRegion
  /** Why this deployment may read the feed. Mandatory for `region: 'cn'`. */
  authorization?: SourceAuthorization
  /** Appended to the request URL when a query is given, e.g. "q". */
  queryParam?: string
}

export type SourceConfigEntry = JsonFeedConfig | { id: string; type: 'builtin'; enabled: boolean }

function getByPath(obj: unknown, path: string | undefined): unknown {
  if (!path) return obj
  let cur: unknown = obj
  for (const key of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[key]
  }
  return cur
}

/**
 * Signal identity, in descending order of stability:
 *
 * 1. `idPath`: the feed's own identifier — `<sourceId>:<value>`.
 * 2. the item URL: `<sourceId>:url:<first 16 hex of sha256(canonical url)>`.
 * 3. nothing usable: `<sourceId>:index:<position>`.
 *
 * Only the third form depends on where the item happened to sit in the
 * response, and it says so in the id. The previous implementation always used
 * the position, so yesterday's `feed:0` and today's `feed:0` were two different
 * stories wearing one id, and nothing downstream could tell.
 */
function signalId(config: JsonFeedConfig, item: unknown, index: number): string {
  if (config.idPath) {
    const declared = getByPath(item, config.idPath)
    if (typeof declared === 'string' || typeof declared === 'number') {
      const value = String(declared).trim()
      if (value) return `${config.id}:${value}`
    }
  }
  const url = getByPath(item, config.urlPath)
  if (typeof url === 'string' && isSafeHttpUrl(url)) {
    return `${config.id}:url:${createHash('sha256').update(canonicalUrlIdentity(url)).digest('hex').slice(0, 16)}`
  }
  return `${config.id}:index:${index}`
}

/** Pure mapping from a fetched JSON document to TopicSignals (exported for tests). */
export function mapJsonFeedItems(config: JsonFeedConfig, json: unknown, limit: number): TopicSignal[] {
  const items = getByPath(json, config.itemsPath)
  if (!Array.isArray(items)) return []
  const capturedAt = new Date().toISOString()
  const signals: Array<Omit<TopicSignal, 'sourceRank'>> = []
  for (const [index, item] of items.slice(0, limit).entries()) {
    const title = getByPath(item, config.titlePath)
    if (typeof title !== 'string' || !title.trim()) continue
    const url = getByPath(item, config.urlPath)
    const score = getByPath(item, config.scorePath)
    const rawScore = typeof score === 'number' ? score : null
    signals.push({
      id: signalId(config, item, index),
      source: config.id,
      title,
      url: typeof url === 'string' && isSafeHttpUrl(url) ? url : config.url,
      hotScore: rawScore ?? 0,
      rawScore,
      scoreUnit: config.scoreUnit ?? null,
      publishedAt: isoTimestampOrNull(getByPath(item, config.publishedAtPath)),
      eventAt: isoTimestampOrNull(getByPath(item, config.eventAtPath)),
      capturedAt,
    })
  }
  return withSourceRanks(signals)
}

class JsonFeedSource implements HotSource {
  constructor(private config: JsonFeedConfig) {}

  get id(): string {
    return this.config.id
  }

  get region(): SourceRegion {
    return this.config.region ?? 'global'
  }

  get authorization(): SourceAuthorization | undefined {
    return this.config.authorization
  }

  async fetch(query?: string, limit = 20): Promise<FetchResult> {
    const requestUrl = new URL(this.config.url)
    if (query && query.trim() && this.config.queryParam) {
      requestUrl.searchParams.set(this.config.queryParam, query.trim())
    }
    try {
      const json = await fetchFeedJson(requestUrl.toString())
      return { signals: mapJsonFeedItems(this.config, json, limit), warnings: [] }
    } catch (e) {
      return { signals: [], warnings: [feedWarning(this.id, e)] }
    }
  }
}

const CONFIG_FILE = 'sources.config.json'

function configuredFeedAllowed(value: string): { allowed: true } | { allowed: false; reason: string } {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return { allowed: false, reason: 'URL is invalid' }
  }
  if (parsed.protocol !== 'https:') return { allowed: false, reason: 'only HTTPS feeds are allowed' }
  const allowedHosts = new Set((process.env.MEDIAOPS_FEED_HOST_ALLOWLIST ?? '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean))
  if (!allowedHosts.has(parsed.hostname.toLowerCase())) return { allowed: false, reason: `hostname ${parsed.hostname} is not in MEDIAOPS_FEED_HOST_ALLOWLIST` }
  return { allowed: true }
}

/**
 * Build the source registry: built-in example sources plus user-configured JSON
 * feeds from <data>/sources.config.json. A malformed config degrades to the
 * built-ins with a warning instead of failing the tool call.
 */
export function buildSources(): { sources: Record<string, HotSource>; warnings: string[] } {
  const sources: Record<string, HotSource> = { hackernews: new HackerNewsSource() }
  const warnings: string[] = []
  const path = join(dataDir(), CONFIG_FILE)
  if (!existsSync(path)) return { sources, warnings }

  let entries: SourceConfigEntry[]
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as { sources?: SourceConfigEntry[] }
    entries = Array.isArray(parsed.sources) ? parsed.sources : []
  } catch (e) {
    warnings.push(`sources.config.json is not valid JSON; using built-in sources only (${e instanceof Error ? e.message : String(e)})`)
    return { sources, warnings }
  }

  for (const entry of entries) {
    if (!entry || typeof entry.id !== 'string' || !entry.id) {
      warnings.push('sources.config.json: skipped an entry without a string id')
      continue
    }
    if (entry.type === 'builtin') {
      if (entry.enabled === false) delete sources[entry.id]
      continue
    }
    if (entry.type === 'json-feed') {
      if (typeof entry.url !== 'string' || typeof entry.titlePath !== 'string') {
        warnings.push(`sources.config.json: json-feed '${entry.id}' needs url and titlePath; skipped`)
        continue
      }
      const allowed = configuredFeedAllowed(entry.url)
      if (!allowed.allowed) {
        warnings.push(`sources.config.json: json-feed '${entry.id}' is disabled (${allowed.reason})`)
        continue
      }
      if ((entry.region ?? 'global') === 'cn' && !SOURCE_AUTHORIZATION_BASES.includes(entry.authorization?.basis as SourceAuthorizationBasis)) {
        warnings.push(`sources.config.json: json-feed '${entry.id}' 被跳过：${CN_SOURCE_AUTHORIZATION_REQUIRED}`)
        continue
      }
      sources[entry.id] = new JsonFeedSource(entry)
      continue
    }
    warnings.push(`sources.config.json: '${(entry as { id: string }).id}' has unsupported type; skipped`)
  }
  return { sources, warnings }
}

/**
 * Which regions the registry actually covers.
 *
 * `cnConfigured` is the thing every caller needs: with no Chinese source
 * registered, a hot-topic result is a global-only result, and saying so is the
 * difference between "we have nothing here" and a silently misleading list.
 */
export function describeSourceRegions(registry: Record<string, HotSource>): { cn: string[]; global: string[]; cnConfigured: boolean } {
  const cn: string[] = []
  const global: string[] = []
  for (const [id, source] of Object.entries(registry)) {
    if (source.region === 'cn') cn.push(id)
    else global.push(id)
  }
  cn.sort()
  global.sort()
  return { cn, global, cnConfigured: cn.length > 0 }
}
