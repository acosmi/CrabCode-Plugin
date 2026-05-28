/**
 * Hot-topic source providers.
 *
 * A source maps an external free, no-auth feed into normalized TopicSignals.
 * Network failures are caught and degrade to an empty list + a warning rather
 * than throwing — the agent should never crash because a feed is down.
 */

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
      })
      if (!res.ok) {
        return { signals: [], warnings: [`hackernews: HTTP ${res.status}`] }
      }
      const json = (await res.json()) as { hits?: HnHit[] }
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

export const RegisteredSources: Record<string, HotSource> = {
  hackernews: new HackerNewsSource(),
}

export function availableSourceIds(): string[] {
  return Object.keys(RegisteredSources)
}
