import { test, expect, describe, beforeEach, afterEach } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildSources, mapJsonFeedItems, type JsonFeedConfig } from '../src/sources/index.ts'

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
})
