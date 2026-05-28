import { z } from 'zod'
import { ok, type Envelope } from '../envelope.ts'
import { RegisteredSources, availableSourceIds, type TopicSignal } from '../sources/index.ts'

// ---- mediaops.trends.search -------------------------------------------------

export const searchName = 'mediaops.trends.search'
export const searchDescription =
  'Fetch hot-topic signals from registered free, no-auth sources. Does not call any LLM; pure feed retrieval.'

export const searchInputSchema = {
  query: z.string().optional().describe('Optional keyword filter passed to sources that support search.'),
  sources: z.array(z.string()).optional().describe('Source ids to query; defaults to all registered sources.'),
  limit: z.number().int().positive().max(50).optional().describe('Max signals to return (default 20).'),
}

type SearchArgs = {
  query?: string
  sources?: string[]
  limit?: number
}

export async function searchHandler(args: SearchArgs): Promise<Envelope> {
  const limit = args.limit ?? 20
  const wanted = args.sources && args.sources.length ? args.sources : availableSourceIds()
  const warnings: string[] = []
  const signals: TopicSignal[] = []

  for (const id of wanted) {
    const source = RegisteredSources[id]
    if (!source) {
      warnings.push(`unknown source: ${id}`)
      continue
    }
    const result = await source.fetch(args.query, limit)
    signals.push(...result.signals)
    warnings.push(...result.warnings)
  }

  signals.sort((a, b) => b.hotScore - a.hotScore)
  return ok({ count: signals.length, signals: signals.slice(0, limit) }, warnings)
}

// ---- mediaops.trends.cluster ------------------------------------------------

export const clusterName = 'mediaops.trends.cluster'
export const clusterDescription =
  'Heuristically de-duplicate and cluster topic signals by title similarity. No LLM involved.'

export const clusterInputSchema = {
  signals: z
    .array(
      z.object({
        id: z.string(),
        source: z.string().optional(),
        title: z.string(),
        url: z.string().optional(),
        hotScore: z.number().optional(),
        capturedAt: z.string().optional(),
      }),
    )
    .describe('Topic signals to cluster (typically the output of mediaops.trends.search).'),
}

type ClusterArgs = {
  signals: {
    id: string
    source?: string
    title: string
    url?: string
    hotScore?: number
    capturedAt?: string
  }[]
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿]+/g, ' ')
    .trim()
}

function tokenSet(title: string): Set<string> {
  return new Set(normalizeTitle(title).split(' ').filter(Boolean))
}

/** Jaccard similarity over token sets. */
function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  const union = a.size + b.size - inter
  return union === 0 ? 0 : inter / union
}

export async function clusterHandler(args: ClusterArgs): Promise<Envelope> {
  const SIM_THRESHOLD = 0.5
  const items = args.signals.map((s) => ({ signal: s, tokens: tokenSet(s.title) }))
  const clusters: { repTitle: string; members: ClusterArgs['signals']; topScore: number }[] = []

  for (const item of items) {
    let placed = false
    for (const cluster of clusters) {
      const rep = tokenSet(cluster.repTitle)
      if (similarity(item.tokens, rep) >= SIM_THRESHOLD) {
        cluster.members.push(item.signal)
        cluster.topScore = Math.max(cluster.topScore, item.signal.hotScore ?? 0)
        placed = true
        break
      }
    }
    if (!placed) {
      clusters.push({
        repTitle: item.signal.title,
        members: [item.signal],
        topScore: item.signal.hotScore ?? 0,
      })
    }
  }

  clusters.sort((a, b) => b.topScore - a.topScore)
  return ok({
    inputCount: args.signals.length,
    clusterCount: clusters.length,
    clusters: clusters.map((c) => ({
      representativeTitle: c.repTitle,
      size: c.members.length,
      topScore: c.topScore,
      members: c.members,
    })),
  })
}
