import { z } from 'zod'
import { actionRequired, ok, type Envelope } from '../envelope.ts'
import { buildSources, describeSourceRegions, type TopicSignal } from '../sources/index.ts'

// ---- mediaops.trends.search -------------------------------------------------

export const searchName = 'mediaops.trends.search'
export const searchDescription =
  'Fetch hot-topic signals from registered free, no-auth sources (built-in examples plus <data>/sources.config.json entries). Does not call any LLM; pure feed retrieval. Results are ordered by an explainable, deterministic pipeline and every signal carries the reasons for its position. Sources without an official API belong to the trend-researcher agent, not here.'

const DEFAULT_MAX_AGE_HOURS = 72
/** Same threshold and same token/similarity functions as clusterHandler, on purpose. */
const DUPLICATE_SIMILARITY_THRESHOLD = 0.30
const RECENCY_ORDER: Record<SignalRanking['recency'], number> = { fresh: 0, unknown: 1, aged: 2 }

export const searchInputSchema = {
  query: z.string().optional().describe('Optional keyword filter passed to sources that support search.'),
  sources: z.array(z.string()).optional().describe('Source ids to query; defaults to all registered sources.'),
  limit: z.number().int().positive().max(50).optional().describe('Max signals to return (default 20).'),
  maxAgeHours: z.number().positive().max(24 * 365).optional().describe('How old a signal may be and still count as fresh (default 72). Signals whose source gave no publication time stay "unknown"; capturedAt is never used as a publication time.'),
}

type SearchArgs = {
  query?: string
  sources?: string[]
  limit?: number
  maxAgeHours?: number
}

export type SignalRanking = {
  queryMatch: number | null
  recency: 'fresh' | 'aged' | 'unknown'
  ageHours: number | null
  sourceRank: number
  duplicateOf: string | null
  reasons: string[]
}

export type RankedSignal = TopicSignal & { ranking: SignalRanking }

/** The pipeline, in the order it runs, in the words the response hands the reader. */
export const RANKING_RULES: readonly string[] = Object.freeze([
  '第一步：每个来源先按它自己给出的源内名次（sourceRank）排好自己的结果。',
  '第二步：标题高度相似的信号归为同一事件，只有代表参与后续排序，其余成员紧跟代表并标注 duplicateOf。',
  '第三步：给了 query 时，按标题命中查询词的比例（queryMatch）从高到低。',
  '第四步：再按发布时效分桶——maxAgeHours 之内为 fresh，来源未给发布时间为 unknown，更早为 aged；顺序为 fresh、unknown、aged。',
  '第五步：仍然并列时，按各来源的源内名次轮转交错，来源顺序即请求或注册顺序。',
])

/**
 * The final tie-break: within one (query match, recency) bucket, take every
 * source's #1, then every source's #2, and so on, sources in the order they
 * were requested or registered.
 *
 * The original implementation sorted the whole merged list by `hotScore`
 * descending. That compares quantities that are not the same quantity — Hacker
 * News points against a company blog's "heat" against a view count — so one
 * loud unit owned the top of every result and the order carried no information.
 * Interleaving claims no cross-source comparison at all, which is exactly why
 * it belongs last rather than as the whole ordering.
 */
function interleaveGroups<T>(groups: T[], sourceOf: (item: T) => string, rankOf: (item: T) => number, sourceOrder: string[]): T[] {
  const perSource = new Map<string, T[]>()
  for (const item of groups) {
    const list = perSource.get(sourceOf(item))
    if (list) list.push(item)
    else perSource.set(sourceOf(item), [item])
  }
  for (const list of perSource.values()) list.sort((left, right) => rankOf(left) - rankOf(right))
  const queues = sourceOrder.map((id) => perSource.get(id)).filter((queue): queue is T[] => Boolean(queue?.length))
  const merged: T[] = []
  const deepest = Math.max(0, ...queues.map((queue) => queue.length))
  for (let position = 0; position < deepest; position++) {
    for (const queue of queues) {
      const item = queue[position]
      if (item) merged.push(item)
    }
  }
  return merged
}

/** Share of the query's tokens that the title carries; `null` when no query was given. */
function queryMatchOf(query: string | undefined, title: string): { ratio: number | null; hit: number; total: number } {
  if (!query || !query.trim()) return { ratio: null, hit: 0, total: 0 }
  const queryTokens = tokenSet(query)
  if (!queryTokens.size) return { ratio: null, hit: 0, total: 0 }
  const titleTokens = tokenSet(title)
  let hit = 0
  for (const token of queryTokens) if (titleTokens.has(token)) hit += 1
  return { ratio: Math.round((hit / queryTokens.size) * 100) / 100, hit, total: queryTokens.size }
}

/**
 * Freshness comes only from what the source published. `capturedAt` is this
 * process's clock; using it here would make every signal look brand new.
 */
function recencyOf(signal: TopicSignal, now: number, maxAgeHours: number): { recency: SignalRanking['recency']; ageHours: number | null } {
  if (!signal.publishedAt) return { recency: 'unknown', ageHours: null }
  const published = new Date(signal.publishedAt).getTime()
  if (!Number.isFinite(published)) return { recency: 'unknown', ageHours: null }
  const ageHours = Math.round(((now - published) / 3_600_000) * 100) / 100
  return { recency: ageHours <= maxAgeHours ? 'fresh' : 'aged', ageHours }
}

function recencyReason(recency: SignalRanking['recency'], ageHours: number | null): string {
  if (recency === 'unknown' || ageHours === null) return '发布时间未知'
  if (ageHours < 0) return '发布时间晚于当前时钟'
  return `发布于 ${Math.round(ageHours)} 小时前`
}

type SignalGroup = { representative: RankedSignal; members: RankedSignal[] }

/**
 * Group signals that describe the same event, using the same tokeniser,
 * similarity and threshold as `clusterHandler` — one implementation, so the
 * de-duplication a caller sees in search can never disagree with the one they
 * get from cluster.
 *
 * The representative is the copy a reader should look at first: the newest one
 * whose source actually stated a publication time, otherwise the best-ranked in
 * its own source. Members are kept, not dropped — "we merged these" is
 * information, and silently deleting a source's coverage is not.
 */
function groupSameEvent(signals: RankedSignal[]): SignalGroup[] {
  const groups: Array<{ members: RankedSignal[]; tokens: Set<string> }> = []
  for (const signal of signals) {
    const tokens = tokenSet(signal.title)
    const existing = groups.find((group) => similarity(tokens, group.tokens) >= DUPLICATE_SIMILARITY_THRESHOLD)
    if (existing) existing.members.push(signal)
    else groups.push({ members: [signal], tokens })
  }
  return groups.map(({ members }) => {
    const byPreference = [...members].sort((left, right) => {
      const leftTime = left.publishedAt ? new Date(left.publishedAt).getTime() : null
      const rightTime = right.publishedAt ? new Date(right.publishedAt).getTime() : null
      if (leftTime !== null && rightTime !== null && leftTime !== rightTime) return rightTime - leftTime
      if (leftTime !== null && rightTime === null) return -1
      if (leftTime === null && rightTime !== null) return 1
      return left.ranking.sourceRank - right.ranking.sourceRank
    })
    const [representative, ...rest] = byPreference
    for (const member of rest) {
      member.ranking.duplicateOf = representative.id
      member.ranking.reasons.push(`与 ${representative.id} 为同一事件`)
    }
    return { representative, members: rest.sort((left, right) => left.ranking.sourceRank - right.ranking.sourceRank) }
  })
}

export async function searchHandler(args: SearchArgs): Promise<Envelope> {
  const limit = args.limit ?? 20
  const maxAgeHours = args.maxAgeHours ?? DEFAULT_MAX_AGE_HOURS
  const registry = buildSources()
  const regions = describeSourceRegions(registry.sources)
  const wanted = args.sources && args.sources.length ? args.sources : Object.keys(registry.sources)
  const warnings: string[] = [...registry.warnings]
  const sourceOrder: string[] = []
  const collected: RankedSignal[] = []
  const now = Date.now()
  const hasQuery = Boolean(args.query && args.query.trim())

  for (const id of wanted) {
    const source = registry.sources[id]
    if (!source) {
      warnings.push(`unknown source: ${id}`)
      continue
    }
    try {
      const result = await source.fetch(args.query, limit)
      sourceOrder.push(id)
      warnings.push(...result.warnings)
      for (const signal of [...result.signals].sort((left, right) => left.sourceRank - right.sourceRank)) {
        const match = queryMatchOf(args.query, signal.title)
        const { recency, ageHours } = recencyOf(signal, now, maxAgeHours)
        const reasons: string[] = []
        if (match.ratio !== null) reasons.push(`查询词命中 ${match.hit}/${match.total}`)
        reasons.push(recencyReason(recency, ageHours))
        reasons.push(`${signal.source} 源内第 ${signal.sourceRank} 名`)
        collected.push({ ...signal, ranking: { queryMatch: match.ratio, recency, ageHours, sourceRank: signal.sourceRank, duplicateOf: null, reasons } })
      }
    } catch (error) {
      warnings.push(`${id}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Representatives are bucketed by (query match, recency) and only then
  // interleaved, so the interleave is the final tie-break rather than the whole
  // ordering — and every step above it is something the response can explain.
  const groups = groupSameEvent(collected)
  const bucketed = new Map<string, SignalGroup[]>()
  for (const group of groups) {
    const match = hasQuery ? group.representative.ranking.queryMatch ?? 0 : 0
    const key = `${(1 - match).toFixed(2)}|${RECENCY_ORDER[group.representative.ranking.recency]}`
    const list = bucketed.get(key)
    if (list) list.push(group)
    else bucketed.set(key, [group])
  }
  const signals: RankedSignal[] = []
  for (const key of [...bucketed.keys()].sort()) {
    const ordered = interleaveGroups(
      bucketed.get(key) ?? [],
      (group) => group.representative.source,
      (group) => group.representative.ranking.sourceRank,
      sourceOrder,
    )
    for (const group of ordered) signals.push(group.representative, ...group.members)
  }

  if (/[㐀-鿿]/u.test(args.query ?? '') && !regions.cnConfigured) {
    warnings.push(`中文热点源未配置：结果只来自 ${regions.global.join('、') || '（无已注册来源）'}，不能代表中文平台热度`)
  }

  const data = {
    count: signals.length,
    ordering: 'explainable@1',
    rules: RANKING_RULES,
    maxAgeHours,
    signals: signals.slice(0, limit),
  }
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
        // Carried through unchanged so a caller can pass mediaops.trends.search
        // output back verbatim; clustering itself still only reads titles.
        rawScore: z.number().nullable().optional(),
        scoreUnit: z.string().nullable().optional(),
        sourceRank: z.number().optional(),
        publishedAt: z.string().nullable().optional(),
        eventAt: z.string().nullable().optional(),
        // Accepted so search output round-trips verbatim; clustering never reads it.
        ranking: z.any().optional(),
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
    rawScore?: number | null
    scoreUnit?: string | null
    sourceRank?: number
    publishedAt?: string | null
    eventAt?: string | null
    ranking?: unknown
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
