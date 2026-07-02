import { test, expect, describe, beforeEach, afterEach } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { saveHandler, getHandler, listHandler, type BrandProfile } from '../src/tools/profiles.ts'

const validProfile: BrandProfile = {
  brand_id: 'tech-daily',
  name: '科技日读',
  persona: { identity: '面向开发者的科技内容栏目', domain: ['软件工程'], stance: '务实' },
  voice: { tone: '专业但不端着', person: '我们', formality: 'medium' },
  audience: { segments: ['一线工程师'], pain_points: ['信息过载'] },
  columns: [{ name: '深度拆解', cadence: 'biweekly' }],
  platforms: [{ platform: 'wechat', columns: ['深度拆解'] }],
  banned_words: ['震惊', '必看'],
  compliance: { ai_label_text: '本文由 AI 辅助创作', avoid_domains: ['荐股'] },
}

describe('profile save/get/list', () => {
  let dir: string
  let prev: string | undefined

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mediaops-profile-test-'))
    prev = process.env.MEDIAOPS_DATA_DIR
    process.env.MEDIAOPS_DATA_DIR = dir
  })

  afterEach(async () => {
    if (prev === undefined) delete process.env.MEDIAOPS_DATA_DIR
    else process.env.MEDIAOPS_DATA_DIR = prev
    await rm(dir, { recursive: true, force: true })
  })

  test('save then get round-trips a valid profile', async () => {
    const saved = await saveHandler(validProfile)
    expect(saved.status).toBe('ok')
    expect((saved.data as { updated: boolean }).updated).toBe(false)

    const got = await getHandler({ brandId: 'tech-daily' })
    expect(got.status).toBe('ok')
    expect((got.data as BrandProfile).banned_words).toEqual(['震惊', '必看'])
  })

  test('save overwrites and reports updated=true', async () => {
    await saveHandler(validProfile)
    const again = await saveHandler({ ...validProfile, name: '科技日读·改' })
    expect((again.data as { updated: boolean }).updated).toBe(true)
    const got = await getHandler({ brandId: 'tech-daily' })
    expect((got.data as BrandProfile).name).toBe('科技日读·改')
  })

  test('rejects an unsafe brand_id (path traversal shape)', async () => {
    const bad = await saveHandler({ ...validProfile, brand_id: '../evil' })
    expect(bad.status).toBe('error')
    expect(bad.error?.code).toBe('invalid_profile')
  })

  test('rejects a profile missing required compliance label', async () => {
    const { compliance: _omit, ...rest } = validProfile
    const bad = await saveHandler(rest as unknown as BrandProfile)
    expect(bad.status).toBe('error')
  })

  test('get returns not_found for unknown brand', async () => {
    const got = await getHandler({ brandId: 'nope' })
    expect(got.status).toBe('error')
    expect(got.error?.code).toBe('not_found')
  })

  test('list returns saved profiles', async () => {
    await saveHandler(validProfile)
    await saveHandler({ ...validProfile, brand_id: 'life-weekly', name: '生活周记' })
    const listed = await listHandler()
    const data = listed.data as { count: number; profiles: { brandId: string }[] }
    expect(data.count).toBe(2)
    expect(data.profiles.map((p) => p.brandId).sort()).toEqual(['life-weekly', 'tech-daily'])
  })
})
