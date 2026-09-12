import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { EventEmitter } from 'node:events'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { outboundInternals, type OutboundClientRequest } from '../src/outbound.ts'
import { clusterHandler, searchHandler } from '../src/tools/trends.ts'

describe('Chinese topic clustering', () => {
  test('clusters differently worded Chinese titles about the same event', async () => {
    const env = await clusterHandler({ signals: [
      { id: '1', title: '字节跳动发布豆包新模型，推理能力升级', hotScore: 10 },
      { id: '2', title: '豆包推理模型正式升级，字节发布新版本', hotScore: 8 },
      { id: '3', title: '新能源汽车销量继续增长', hotScore: 7 },
    ] })
    expect((env.data as any).clusterCount).toBe(2)
    expect((env.data as any).clusters.some((cluster: any) => cluster.size === 2)).toBe(true)
  })

  test('does not merge unrelated Chinese stories that share generic words', async () => {
    const env = await clusterHandler({ signals: [
      { id: '1', title: '某手机品牌发布新款折叠屏', hotScore: 5 },
      { id: '2', title: '教育部门发布新学期招生通知', hotScore: 4 },
    ] })
    expect((env.data as any).clusterCount).toBe(2)
  })
})

// ---- shared feed fixtures (zero real network; the outbound seams do the work) ----

type FeedItem = { guid: string; title: string; url?: string; score?: number; published_at?: string }
type FeedSpec = {
  id: string
  path: string
  items: FeedItem[]
  scoreUnit?: string
  region?: 'cn' | 'global'
  authorization?: { basis: string; note?: string }
}

function respondWithJson(body: string): OutboundClientRequest {
  const request = new EventEmitter() as EventEmitter & OutboundClientRequest
  ;(request as any).end = (): void => {
    setTimeout(() => {
      const response = new Readable({ read() {} }) as any
      response.statusCode = 200
      response.headers = { 'content-type': 'application/json' }
      response.socket = { remoteAddress: '93.184.216.34' }
      response.push(Buffer.from(body, 'utf8'))
      response.push(null)
      request.emit('response', response)
    }, 0)
  }
  ;(request as any).destroy = (): void => undefined
  return request
}

async function installFeeds(dir: string, specs: FeedSpec[]): Promise<void> {
  await writeFile(join(dir, 'sources.config.json'), JSON.stringify({
    sources: [
      { id: 'hackernews', type: 'builtin', enabled: false },
      ...specs.map((spec) => ({
        id: spec.id,
        type: 'json-feed',
        url: `https://example.com${spec.path}`,
        itemsPath: 'items',
        idPath: 'guid',
        titlePath: 'title',
        urlPath: 'url',
        scorePath: 'score',
        scoreUnit: spec.scoreUnit ?? 'score',
        publishedAtPath: 'published_at',
        ...(spec.region ? { region: spec.region } : {}),
        ...(spec.authorization ? { authorization: spec.authorization } : {}),
      })),
    ],
  }))
  const bodyByPath = new Map(specs.map((spec) => [spec.path, JSON.stringify({ items: spec.items })]))
  outboundInternals.__setResolverForTest(async () => [{ address: '93.184.216.34', family: 4 }])
  outboundInternals.__setDialerForTest((options) => respondWithJson(bodyByPath.get(String(options.path).split('?')[0]) ?? '{"items":[]}'))
}

function useFeedFixtures(): { dir: () => string } {
  let dir: string
  let previousDataDir: string | undefined
  let previousAllowlist: string | undefined

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mediaops-trends-'))
    previousDataDir = process.env.MEDIAOPS_DATA_DIR
    previousAllowlist = process.env.MEDIAOPS_FEED_HOST_ALLOWLIST
    process.env.MEDIAOPS_DATA_DIR = dir
    process.env.MEDIAOPS_FEED_HOST_ALLOWLIST = 'example.com'
  })

  afterEach(async () => {
    outboundInternals.__setResolverForTest(null)
    outboundInternals.__setDialerForTest(null)
    if (previousDataDir === undefined) delete process.env.MEDIAOPS_DATA_DIR
    else process.env.MEDIAOPS_DATA_DIR = previousDataDir
    if (previousAllowlist === undefined) delete process.env.MEDIAOPS_FEED_HOST_ALLOWLIST
    else process.env.MEDIAOPS_FEED_HOST_ALLOWLIST = previousAllowlist
    await rm(dir, { recursive: true, force: true })
  })

  return { dir: () => dir }
}

/**
 * Cross-source ordering used to be `sort by hotScore descending`, which compares
 * quantities that are not the same quantity: Hacker News points, a blog's
 * "heat", a view count. One loud unit simply owned the top of the list and the
 * ordering carried no information. The replacement claims nothing it cannot
 * explain — and the interleave is now only the final tie-break.
 */
describe('cross-source ordering', () => {
  const fixtures = useFeedFixtures()

  beforeEach(async () => {
    await installFeeds(fixtures.dir(), [
      { id: 'feed-a', path: '/a.json', scoreUnit: 'points', items: [
        { guid: 'a1', title: '钢铁产量创新高', score: 1000 },
        { guid: 'a2', title: '港口吞吐量统计', score: 900 },
      ] },
      { id: 'feed-b', path: '/b.json', scoreUnit: 'views', items: [
        { guid: 'b1', title: '影视票房周报出炉', score: 9 },
        { guid: 'b2', title: '音乐榜单本周变化', score: 8 },
      ] },
    ])
  })

  test('two sources with incomparable units interleave by their own rank', async () => {
    const env = await searchHandler({ sources: ['feed-a', 'feed-b'], limit: 10 })
    const data = env.data as any
    expect(data.ordering).toBe('explainable@1')
    expect(data.rules).toHaveLength(5)
    expect(data.maxAgeHours).toBe(72)
    expect(data.signals.map((signal: any) => signal.title)).toEqual(['钢铁产量创新高', '影视票房周报出炉', '港口吞吐量统计', '音乐榜单本周变化'])
    // Positive control: a plain hotScore sort would have put both A items first.
    expect([...data.signals].sort((left: any, right: any) => right.hotScore - left.hotScore).map((signal: any) => signal.title))
      .toEqual(['钢铁产量创新高', '港口吞吐量统计', '影视票房周报出炉', '音乐榜单本周变化'])
    expect(data.signals.map((signal: any) => [signal.source, signal.sourceRank, signal.scoreUnit])).toEqual([
      ['feed-a', 1, 'points'],
      ['feed-b', 1, 'views'],
      ['feed-a', 2, 'points'],
      ['feed-b', 2, 'views'],
    ])
  })

  test('the limit truncates the interleaved list and every source still gets its rank-1 item', async () => {
    const env = await searchHandler({ sources: ['feed-a', 'feed-b'], limit: 3 })
    const data = env.data as any
    expect(data.count).toBe(4)
    expect(data.signals.map((signal: any) => signal.title)).toEqual(['钢铁产量创新高', '影视票房周报出炉', '港口吞吐量统计'])
  })
})

describe('explainable ranking', () => {
  const fixtures = useFeedFixtures()

  test('a query match outranks the item its own source ranked higher', async () => {
    await installFeeds(fixtures.dir(), [
      { id: 'feed-a', path: '/a.json', items: [
        { guid: 'a1', title: '港口吞吐量统计', score: 100 },
        { guid: 'a2', title: '豆包大模型发布', score: 1 },
      ] },
      { id: 'feed-b', path: '/b.json', items: [
        { guid: 'b1', title: '影视票房周报出炉', score: 50 },
        { guid: 'b2', title: '音乐榜单本周变化', score: 40 },
      ] },
    ])
    const env = await searchHandler({ query: '豆包 模型', sources: ['feed-a', 'feed-b'], limit: 10 })
    const data = env.data as any
    // a2 is only rank 2 inside its own source; the query match is what lifts it.
    expect(data.signals[0].title).toBe('豆包大模型发布')
    expect(data.signals[0].ranking.sourceRank).toBe(2)
    expect(data.signals[0].ranking.queryMatch).toBe(1)
    expect(data.signals[0].ranking.reasons.some((reason: string) => reason.includes('查询词命中'))).toBe(true)
    expect(data.signals.slice(1).every((signal: any) => signal.ranking.queryMatch === 0)).toBe(true)
  })

  test('without a query there is no query match to report', async () => {
    await installFeeds(fixtures.dir(), [
      { id: 'feed-a', path: '/a.json', items: [
        { guid: 'a1', title: '港口吞吐量统计', score: 100 },
        { guid: 'a2', title: '豆包大模型发布', score: 1 },
      ] },
    ])
    const env = await searchHandler({ sources: ['feed-a'], limit: 10 })
    const data = env.data as any
    expect(data.signals.every((signal: any) => signal.ranking.queryMatch === null)).toBe(true)
    expect(data.signals.every((signal: any) => signal.ranking.reasons.every((reason: string) => !reason.includes('查询词命中')))).toBe(true)
    // Without a query, the source's own rank decides again.
    expect(data.signals.map((signal: any) => signal.title)).toEqual(['港口吞吐量统计', '豆包大模型发布'])
  })

  /**
   * An unknown publication time sits between fresh and aged on purpose: the
   * source did not say, and pretending it is either new or old would be an
   * invented fact. `capturedAt` is never promoted into `publishedAt`.
   */
  test('recency buckets order fresh, then unknown, then aged', async () => {
    const now = Date.now()
    await installFeeds(fixtures.dir(), [
      { id: 'feed-fresh', path: '/fresh.json', items: [{ guid: 'f1', title: '甲事件最新进展', score: 5, published_at: new Date(now - 3_600_000).toISOString() }] },
      { id: 'feed-unknown', path: '/unknown.json', items: [{ guid: 'u1', title: '乙领域政策解读', score: 5 }] },
      { id: 'feed-aged', path: '/aged.json', items: [{ guid: 'g1', title: '丙行业年度总结', score: 5, published_at: new Date(now - 1_000 * 3_600_000).toISOString() }] },
    ])
    const env = await searchHandler({ sources: ['feed-aged', 'feed-unknown', 'feed-fresh'], limit: 10 })
    const data = env.data as any
    // Requested in the opposite order on purpose: the bucket decides, not the
    // request order (which is only the final tie-break).
    expect(data.signals.map((signal: any) => signal.ranking.recency)).toEqual(['fresh', 'unknown', 'aged'])
    expect(data.signals.every((signal: any) => signal.ranking.sourceRank === 1)).toBe(true)
    const [fresh, unknown, aged] = data.signals
    expect(fresh.ranking.ageHours).toBeCloseTo(1, 1)
    expect(unknown.ranking.ageHours).toBeNull()
    expect(unknown.ranking.reasons).toContain('发布时间未知')
    expect(aged.ranking.ageHours).toBeGreaterThan(72)
    expect(fresh.ranking.reasons.some((reason: string) => reason.includes('小时前'))).toBe(true)
  })

  test('maxAgeHours moves the fresh boundary', async () => {
    const now = Date.now()
    await installFeeds(fixtures.dir(), [
      { id: 'feed-a', path: '/a.json', items: [{ guid: 'a1', title: '甲事件最新进展', score: 5, published_at: new Date(now - 100 * 3_600_000).toISOString() }] },
    ])
    const strict = await searchHandler({ sources: ['feed-a'], limit: 10 })
    expect((strict.data as any).signals[0].ranking.recency).toBe('aged')
    const relaxed = await searchHandler({ sources: ['feed-a'], limit: 10, maxAgeHours: 200 })
    expect((relaxed.data as any).maxAgeHours).toBe(200)
    expect((relaxed.data as any).signals[0].ranking.recency).toBe('fresh')
  })

  /**
   * Members of a duplicate group are kept, not dropped: "these two sources are
   * covering one event" is information, and silently deleting one source's
   * coverage is not the same as de-duplicating it.
   */
  test('the same event across two sources keeps one representative and marks the rest', async () => {
    const now = Date.now()
    await installFeeds(fixtures.dir(), [
      { id: 'feed-a', path: '/a.json', items: [{ guid: 'a1', title: '字节跳动发布豆包新模型，推理能力升级', score: 5, published_at: new Date(now - 3 * 3_600_000).toISOString() }] },
      { id: 'feed-b', path: '/b.json', items: [{ guid: 'b1', title: '豆包推理模型正式升级，字节发布新版本', score: 5, published_at: new Date(now - 3_600_000).toISOString() }] },
    ])
    const env = await searchHandler({ sources: ['feed-a', 'feed-b'], limit: 10 })
    const data = env.data as any
    expect(data.count).toBe(2)
    // The newer copy whose source actually stated a publication time represents.
    expect(data.signals[0].id).toBe('feed-b:b1')
    expect(data.signals[0].ranking.duplicateOf).toBeNull()
    expect(data.signals[1].id).toBe('feed-a:a1')
    expect(data.signals[1].ranking.duplicateOf).toBe('feed-b:b1')
    expect(data.signals[1].ranking.reasons).toContain('与 feed-b:b1 为同一事件')
  })

  test('unrelated stories are not merged', async () => {
    await installFeeds(fixtures.dir(), [
      { id: 'feed-a', path: '/a.json', items: [
        { guid: 'a1', title: '某手机品牌发布新款折叠屏', score: 5 },
        { guid: 'a2', title: '教育部门发布新学期招生通知', score: 4 },
      ] },
    ])
    const env = await searchHandler({ sources: ['feed-a'], limit: 10 })
    const data = env.data as any
    expect(data.signals).toHaveLength(2)
    expect(data.signals.every((signal: any) => signal.ranking.duplicateOf === null)).toBe(true)
  })
})

/**
 * §8.2: with no Chinese source registered, a hot-topic result is a global-only
 * result. Handing that back without comment reads as Chinese coverage, so the
 * absence is stated rather than left to be inferred from a list of source names.
 */
describe('Chinese hot-source disclosure', () => {
  const fixtures = useFeedFixtures()

  test('a Chinese query with no cn source says so', async () => {
    await installFeeds(fixtures.dir(), [
      { id: 'feed-global', path: '/g.json', items: [{ guid: 'g1', title: '国际市场行情概览', score: 5 }] },
    ])
    const env = await searchHandler({ query: '豆包', sources: ['feed-global'], limit: 10 })
    expect((env.warnings ?? []).join(' ')).toContain('中文热点源未配置')
    expect((env.warnings ?? []).join(' ')).toContain('feed-global')
  })

  test('a configured cn source removes the warning', async () => {
    await installFeeds(fixtures.dir(), [
      { id: 'feed-global', path: '/g.json', items: [{ guid: 'g1', title: '国际市场行情概览', score: 5 }] },
      {
        id: 'feed-cn',
        path: '/cn.json',
        region: 'cn',
        authorization: { basis: 'self-hosted', note: '自建聚合服务，数据来自官方授权接口' },
        items: [{ guid: 'c1', title: '国内制造业景气度回升', score: 7 }],
      },
    ])
    const env = await searchHandler({ query: '豆包', sources: ['feed-global', 'feed-cn'], limit: 10 })
    expect((env.warnings ?? []).join(' ')).not.toContain('中文热点源未配置')
    expect((env.data as any).signals).toHaveLength(2)
  })

  test('a non-Chinese query never raises the Chinese-source warning', async () => {
    await installFeeds(fixtures.dir(), [
      { id: 'feed-global', path: '/g.json', items: [{ guid: 'g1', title: '国际市场行情概览', score: 5 }] },
    ])
    const env = await searchHandler({ query: 'market outlook', sources: ['feed-global'], limit: 10 })
    expect((env.warnings ?? []).join(' ')).not.toContain('中文热点源未配置')
  })
})
