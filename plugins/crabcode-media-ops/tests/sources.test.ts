import { test, expect, describe, beforeEach, afterEach } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildSources, describeSourceRegions, mapJsonFeedItems, type JsonFeedConfig } from '../src/sources/index.ts'
import { CHINESE_HOT_SOURCES_UNCONFIGURED_NOTE, handler as capabilities } from '../src/tools/capabilities.ts'
import { handler as doctor } from '../src/tools/doctor.ts'

describe('config-driven source registry', () => {
  let dir: string
  let prev: string | undefined
  let prevAllowlist: string | undefined

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mediaops-sources-test-'))
    prev = process.env.MEDIAOPS_DATA_DIR
    prevAllowlist = process.env.MEDIAOPS_FEED_HOST_ALLOWLIST
    process.env.MEDIAOPS_DATA_DIR = dir
    process.env.MEDIAOPS_FEED_HOST_ALLOWLIST = 'example.com'
  })

  afterEach(async () => {
    if (prev === undefined) delete process.env.MEDIAOPS_DATA_DIR
    else process.env.MEDIAOPS_DATA_DIR = prev
    if (prevAllowlist === undefined) delete process.env.MEDIAOPS_FEED_HOST_ALLOWLIST
    else process.env.MEDIAOPS_FEED_HOST_ALLOWLIST = prevAllowlist
    await rm(dir, { recursive: true, force: true })
  })

  test('defaults to the built-in example source without a config file', () => {
    const { sources, warnings } = buildSources()
    expect(Object.keys(sources)).toEqual(['hackernews'])
    expect(warnings).toHaveLength(0)
  })

  test('registers a configured json-feed source and can disable built-ins', async () => {
    await writeFile(
      join(dir, 'sources.config.json'),
      JSON.stringify({
        sources: [
          { id: 'hackernews', type: 'builtin', enabled: false },
          {
            id: 'company-blog',
            type: 'json-feed',
            url: 'https://example.com/feed.json',
            itemsPath: 'data.items',
            titlePath: 'headline',
            urlPath: 'link',
            scorePath: 'heat',
          },
        ],
      }),
    )
    const { sources, warnings } = buildSources()
    expect(Object.keys(sources)).toEqual(['company-blog'])
    expect(warnings).toHaveLength(0)
  })

  test('malformed config degrades to built-ins with a warning', async () => {
    await writeFile(join(dir, 'sources.config.json'), '{not json')
    const { sources, warnings } = buildSources()
    expect(Object.keys(sources)).toEqual(['hackernews'])
    expect(warnings.length).toBe(1)
  })

  test('json-feed entry missing titlePath is skipped with a warning', async () => {
    await writeFile(
      join(dir, 'sources.config.json'),
      JSON.stringify({ sources: [{ id: 'broken', type: 'json-feed', url: 'https://example.com' }] }),
    )
    const { sources, warnings } = buildSources()
    expect(sources['broken']).toBeUndefined()
    expect(warnings.some((w) => w.includes('broken'))).toBe(true)
  })

  test('custom feeds are disabled unless an HTTPS hostname is explicitly allowlisted', async () => {
    process.env.MEDIAOPS_FEED_HOST_ALLOWLIST = ''
    await writeFile(join(dir, 'sources.config.json'), JSON.stringify({ sources: [{ id: 'private', type: 'json-feed', url: 'http://127.0.0.1/feed', titlePath: 'title' }] }))
    const { sources, warnings } = buildSources()
    expect(sources.private).toBeUndefined()
    expect(warnings.join(' ')).toContain('only HTTPS')
  })

  test('mapJsonFeedItems maps dot paths into TopicSignals', () => {
    const config: JsonFeedConfig = {
      id: 'company-blog',
      type: 'json-feed',
      url: 'https://example.com/feed.json',
      itemsPath: 'data.items',
      titlePath: 'headline',
      urlPath: 'link',
      scorePath: 'stats.heat',
    }
    const json = {
      data: {
        items: [
          { headline: '国产大模型再提速', link: 'https://example.com/a', stats: { heat: 42 } },
          { headline: '', link: 'https://example.com/skip' },
          { headline: '开源社区周报', stats: {} },
        ],
      },
    }
    const signals = mapJsonFeedItems(config, json, 10)
    expect(signals).toHaveLength(2)
    expect(signals[0]).toMatchObject({ source: 'company-blog', title: '国产大模型再提速', url: 'https://example.com/a', hotScore: 42 })
    // Missing url/score fall back to the feed url and 0.
    expect(signals[1]).toMatchObject({ title: '开源社区周报', url: 'https://example.com/feed.json', hotScore: 0 })
  })

  /**
   * Signal identity used to be `${feedId}:${arrayIndex}`, so the same story got
   * a new id whenever the feed reordered, and two different stories shared an id
   * across two fetches. Nothing downstream could tell, because the id looked
   * stable. The three rules below are ordered by how much they depend on
   * position, and only the last one depends on it at all — and says so.
   */
  describe('stable signal identity', () => {
    const base: JsonFeedConfig = {
      id: 'feed',
      type: 'json-feed',
      url: 'https://example.com/feed.json',
      itemsPath: 'items',
      titlePath: 'headline',
      urlPath: 'link',
    }

    test('an idPath value survives reordering', () => {
      const config: JsonFeedConfig = { ...base, idPath: 'guid' }
      const first = mapJsonFeedItems(config, { items: [{ guid: 'a-1', headline: '甲' }, { guid: 'b-2', headline: '乙' }] }, 10)
      const second = mapJsonFeedItems(config, { items: [{ guid: 'b-2', headline: '乙' }, { guid: 'a-1', headline: '甲' }] }, 10)
      expect(first.map((signal) => signal.id)).toEqual(['feed:a-1', 'feed:b-2'])
      expect(second.map((signal) => signal.id)).toEqual(['feed:b-2', 'feed:a-1'])
      // Positive control: the position really did change between the two calls.
      expect(first[0].title).not.toBe(second[0].title)
    })

    test('without an idPath a safe item URL gives a position-independent id', () => {
      const first = mapJsonFeedItems(base, { items: [{ headline: '甲', link: 'https://example.com/A?b=2&a=1' }, { headline: '乙', link: 'https://example.com/B' }] }, 10)
      const second = mapJsonFeedItems(base, { items: [{ headline: '乙', link: 'https://example.com/B/' }, { headline: '甲', link: 'https://example.com/A?a=1&b=2#x' }] }, 10)
      expect(first[0].id.startsWith('feed:url:')).toBe(true)
      expect(first[0].id).toBe(second[1].id)
      expect(first[1].id).toBe(second[0].id)
    })

    test('with neither an id nor a usable URL the id says it is positional', () => {
      const signals = mapJsonFeedItems(base, { items: [{ headline: '甲' }, { headline: '乙', link: 'javascript:alert(1)' }] }, 10)
      expect(signals.map((signal) => signal.id)).toEqual(['feed:index:0', 'feed:index:1'])
    })
  })

  /**
   * `capturedAt` is this process's clock. Using it as a publication time turns
   * "the feed did not say" into "published just now", which is a fabricated
   * fact, so an unparseable or absent timestamp stays null.
   */
  test('publication timestamps are parsed or reported absent, never invented', () => {
    const config: JsonFeedConfig = {
      id: 'feed',
      type: 'json-feed',
      url: 'https://example.com/feed.json',
      itemsPath: 'items',
      titlePath: 'headline',
      publishedAtPath: 'published',
      eventAtPath: 'happened',
      scorePath: 'heat',
      scoreUnit: 'heat',
    }
    const signals = mapJsonFeedItems(config, {
      items: [
        { headline: '合法时间', published: '2026-09-01T10:00:00+08:00', happened: '2026-08-30T00:00:00Z', heat: 5 },
        { headline: '非法时间', published: '昨天', heat: 3 },
        { headline: '缺时间', heat: 1 },
        // A bare number is ambiguous between seconds and milliseconds, so it is refused.
        { headline: '数字时间', published: 1_756_000_000, heat: 0 },
      ],
    }, 10)
    expect(signals.map((signal) => signal.publishedAt)).toEqual(['2026-09-01T02:00:00.000Z', null, null, null])
    expect(signals.map((signal) => signal.eventAt)).toEqual(['2026-08-30T00:00:00.000Z', null, null, null])
    expect(signals.map((signal) => signal.capturedAt).every(Boolean)).toBe(true)
    // Rank is per source, by the source's own unit, with unscored items last.
    expect(signals.map((signal) => signal.sourceRank)).toEqual([1, 2, 3, 4])
    expect(signals.map((signal) => signal.scoreUnit)).toEqual(['heat', 'heat', 'heat', 'heat'])
  })

  test('an unscored item ranks after every scored one and keeps rawScore null', () => {
    const config: JsonFeedConfig = {
      id: 'feed', type: 'json-feed', url: 'https://example.com/feed.json', itemsPath: 'items', titlePath: 'headline', scorePath: 'heat',
    }
    const signals = mapJsonFeedItems(config, { items: [{ headline: '无分' }, { headline: '低分', heat: 1 }, { headline: '高分', heat: 9 }] }, 10)
    expect(signals.map((signal) => [signal.title, signal.rawScore, signal.hotScore, signal.sourceRank])).toEqual([
      ['无分', null, 0, 3],
      ['低分', 1, 1, 2],
      ['高分', 9, 9, 1],
    ])
  })

  /**
   * §8.2: this server does not scrape platforms without an official API, so a
   * Chinese source has to come with a written reason it may be read at all. An
   * entry that cannot state one is not registered — and the absence of any
   * Chinese source is then reported as a fact, not left to be inferred from a
   * list of global source names.
   */
  describe('Chinese source authorization and region disclosure', () => {
    test('a cn feed without an authorization basis is skipped and named', async () => {
      await writeFile(join(dir, 'sources.config.json'), JSON.stringify({
        sources: [{ id: 'cn-unsourced', type: 'json-feed', region: 'cn', url: 'https://example.com/cn.json', titlePath: 'title' }],
      }))
      const { sources, warnings } = buildSources()
      expect(sources['cn-unsourced']).toBeUndefined()
      expect(warnings.join(' ')).toContain('中文来源必须声明授权依据（authorization.basis）')
      expect(describeSourceRegions(sources).cnConfigured).toBe(false)
    })

    test('an unknown authorization basis is refused just like a missing one', async () => {
      await writeFile(join(dir, 'sources.config.json'), JSON.stringify({
        sources: [{ id: 'cn-vague', type: 'json-feed', region: 'cn', url: 'https://example.com/cn.json', titlePath: 'title', authorization: { basis: '我觉得可以' } }],
      }))
      const { sources, warnings } = buildSources()
      expect(sources['cn-vague']).toBeUndefined()
      expect(warnings.join(' ')).toContain('中文来源必须声明授权依据')
    })

    test('a declared cn feed registers and is bucketed as cn', async () => {
      await writeFile(join(dir, 'sources.config.json'), JSON.stringify({
        sources: [
          { id: 'cn-mirror', type: 'json-feed', region: 'cn', url: 'https://example.com/cn.json', titlePath: 'title', authorization: { basis: 'self-hosted', note: '自建聚合服务' } },
          { id: 'world-feed', type: 'json-feed', url: 'https://example.com/w.json', titlePath: 'title' },
        ],
      }))
      const { sources, warnings } = buildSources()
      expect(warnings).toHaveLength(0)
      const regions = describeSourceRegions(sources)
      expect(regions.cn).toEqual(['cn-mirror'])
      expect(regions.global).toEqual(['hackernews', 'world-feed'])
      expect(regions.cnConfigured).toBe(true)
      expect(sources['cn-mirror']!.authorization).toEqual({ basis: 'self-hosted', note: '自建聚合服务' })
      // The built-in example is global and states its own basis.
      expect(sources.hackernews!.region).toBe('global')
      expect(sources.hackernews!.authorization?.basis).toBe('official-api')
    })

    test('capabilities and doctor both say plainly that no cn source is configured', async () => {
      const capability = await capabilities()
      const chinese = (capability.data as any).chineseHotSources
      expect(chinese.configured).toBe(false)
      expect(chinese.sources).toEqual([])
      expect(chinese.note).toBe(CHINESE_HOT_SOURCES_UNCONFIGURED_NOTE)

      const diagnostics = await doctor()
      const probe = (diagnostics.data as any).sourceProbes.find((item: any) => item.id === 'chinese-hot-sources')
      expect(probe.status).toBe('not-configured')
      // Not configured is a legitimate state, so it must not be reported as a failure.
      expect(diagnostics.status).toBe('ok')
    })

    test('a configured cn source flips both disclosures to configured', async () => {
      await writeFile(join(dir, 'sources.config.json'), JSON.stringify({
        sources: [{ id: 'cn-mirror', type: 'json-feed', region: 'cn', url: 'https://example.com/cn.json', titlePath: 'title', authorization: { basis: 'licensed' } }],
      }))
      const capability = await capabilities()
      const chinese = (capability.data as any).chineseHotSources
      expect(chinese.configured).toBe(true)
      expect(chinese.sources).toEqual(['cn-mirror'])
      expect(chinese.note).toContain('已配置')

      const diagnostics = await doctor()
      const probe = (diagnostics.data as any).sourceProbes.find((item: any) => item.id === 'chinese-hot-sources')
      expect(probe.status).toBe('configured')
      expect(probe.sources).toEqual(['cn-mirror'])
    })
  })
})
