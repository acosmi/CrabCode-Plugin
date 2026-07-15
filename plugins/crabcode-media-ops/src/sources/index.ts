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
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { dataDir } from '../storage.ts'
import { isSafeHttpUrl } from '../domain.ts'

const MAX_FEED_BYTES = 2 * 1024 * 1024
const FETCH_TIMEOUT_MS = 10_000

async function readJsonResponse(res: Response, sourceId: string): Promise<unknown> {
  const type = res.headers.get('content-type') ?? ''
  if (!/^(application\/(?:[a-z0-9.+-]*\+)?json)(?:;|$)/i.test(type)) throw new Error(`${sourceId}: unsupported content type ${type || '(missing)'}`)
  const declared = Number(res.headers.get('content-length') ?? 0)
  if (Number.isFinite(declared) && declared > MAX_FEED_BYTES) throw new Error(`${sourceId}: response exceeds ${MAX_FEED_BYTES} bytes`)
  if (!res.body) throw new Error(`${sourceId}: response body is missing`)
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_FEED_BYTES) {
      await reader.cancel()
      throw new Error(`${sourceId}: response exceeds ${MAX_FEED_BYTES} bytes`)
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return JSON.parse(new TextDecoder().decode(bytes))
}

export type TopicSignal = {
  id: string
  source: string
  title: string
  url: string
  hotScore: number
  capturedAt: string
}

export type FetchResult = {
  signals: TopicSignal[]
  warnings: string[]
}

export interface HotSource {
  id: string
  fetch(query?: string, limit?: number): Promise<FetchResult>
}

/**
 * Hacker News front page via the free, no-auth Algolia search API.
 */
export class HackerNewsSource implements HotSource {
  id = 'hackernews'

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
      const res = await fetch(`${base}?${params.toString()}`, {
        headers: { accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
      if (!res.ok) {
        return { signals: [], warnings: [`hackernews: HTTP ${res.status}`] }
      }
      const json = (await readJsonResponse(res, this.id)) as { hits?: HnHit[] }
      const hits = Array.isArray(json.hits) ? json.hits : []
      const capturedAt = new Date().toISOString()
      const signals: TopicSignal[] = hits.slice(0, limit).map((hit) => ({
        id: `hackernews:${hit.objectID}`,
        source: this.id,
        title: hit.title ?? hit.story_title ?? '(untitled)',
        url: hit.url ?? hit.story_url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`,
        hotScore: typeof hit.points === 'number' ? hit.points : 0,
        capturedAt,
      }))
      return { signals, warnings: [] }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { signals: [], warnings: [`hackernews: fetch failed (${msg})`] }
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

/** Pure mapping from a fetched JSON document to TopicSignals (exported for tests). */
export function mapJsonFeedItems(config: JsonFeedConfig, json: unknown, limit: number): TopicSignal[] {
  const items = getByPath(json, config.itemsPath)
  if (!Array.isArray(items)) return []
  const capturedAt = new Date().toISOString()
  const signals: TopicSignal[] = []
  for (const [index, item] of items.slice(0, limit).entries()) {
    const title = getByPath(item, config.titlePath)
    if (typeof title !== 'string' || !title.trim()) continue
    const url = getByPath(item, config.urlPath)
    const score = getByPath(item, config.scorePath)
    signals.push({
      id: `${config.id}:${index}`,
      source: config.id,
      title,
      url: typeof url === 'string' && isSafeHttpUrl(url) ? url : config.url,
      hotScore: typeof score === 'number' ? score : 0,
      capturedAt,
    })
  }
  return signals
}

class JsonFeedSource implements HotSource {
  constructor(private config: JsonFeedConfig) {}

  get id(): string {
    return this.config.id
  }

  async fetch(query?: string, limit = 20): Promise<FetchResult> {
    const requestUrl = new URL(this.config.url)
    if (query && query.trim() && this.config.queryParam) {
      requestUrl.searchParams.set(this.config.queryParam, query.trim())
    }
    try {
      const res = await fetch(requestUrl, {
        headers: { accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
      if (!res.ok) return { signals: [], warnings: [`${this.id}: HTTP ${res.status}`] }
      const json = await readJsonResponse(res, this.id)
      return { signals: mapJsonFeedItems(this.config, json, limit), warnings: [] }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { signals: [], warnings: [`${this.id}: fetch failed (${msg})`] }
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
      sources[entry.id] = new JsonFeedSource(entry)
      continue
    }
    warnings.push(`sources.config.json: '${(entry as { id: string }).id}' has unsupported type; skipped`)
  }
  return { sources, warnings }
}
