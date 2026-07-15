import { z } from 'zod'
import { actionRequired, ok, type Envelope } from '../envelope.ts'
import { buildSources, type TopicSignal } from '../sources/index.ts'

// ---- mediaops.trends.search -------------------------------------------------

export const searchName = 'mediaops.trends.search'
export const searchDescription =
  'Fetch hot-topic signals from registered free, no-auth sources (built-in examples plus <data>/sources.config.json entries). Does not call any LLM; pure feed retrieval. Sources without an official API belong to the trend-researcher agent, not here.'

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
  const registry = buildSources()
  const wanted = args.sources && args.sources.length ? args.sources : Object.keys(registry.sources)
  const warnings: string[] = [...registry.warnings]
  const signals: TopicSignal[] = []

  for (const id of wanted) {
    const source = registry.sources[id]
    if (!source) {
      warnings.push(`unknown source: ${id}`)
      continue
    }
    try {
      const result = await source.fetch(args.query, limit)
      signals.push(...result.signals)
      warnings.push(...result.warnings)
    } catch (error) {
      warnings.push(`${id}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  signals.sort((a, b) => b.hotScore - a.hotScore)
  const data = { count: signals.length, signals: signals.slice(0, limit) }
  return signals.length ? ok(data, warnings) : actionRequired(data, [...warnings, 'No usable trend signals were retrieved; do not treat this as completed web research.'])
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
  const normalized = normalizeTitle(title)
  const tokens = new Set<string>()
  for (const part of normalized.split(/\s+/).filter(Boolean)) {
    const latin = part.match(/[a-z0-9]+(?:[.-][a-z0-9]+)*/g) ?? []
    latin.forEach((token) => tokens.add(token))
    const hanParts = part.match(/[一-鿿]+/g) ?? []
    for (const han of hanParts) {
      for (const character of han) tokens.add(`char:${character}`)
      for (let i = 0; i < han.length - 1; i++) tokens.add(han.slice(i, i + 2))
      for (let i = 0; i < han.length - 2; i++) tokens.add(han.slice(i, i + 3))
    }
  }
  return tokens
}

/** Jaccard similarity over token sets. */
function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  const union = a.size + b.size - inter
  const jaccard = union === 0 ? 0 : inter / union
  const overlap = Math.min(a.size, b.size) === 0 ? 0 : inter / Math.min(a.size, b.size)
  return Math.max(jaccard, overlap * 0.8)
}

export async function clusterHandler(args: ClusterArgs): Promise<Envelope> {
  const SIM_THRESHOLD = 0.30
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
