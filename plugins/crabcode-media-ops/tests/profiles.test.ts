import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getHandler, historyHandler, listHandler, rollbackHandler, saveHandler } from '../src/tools/profiles.ts'
import { listRecords } from '../src/storage.ts'

describe('versioned profiles', () => {
  let dir: string
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mediaops-profile-v2-'))
    process.env.MEDIAOPS_DATA_DIR = dir
  })
  afterEach(async () => rm(dir, { recursive: true, force: true }))

  const profile = (name: string) => ({
    brand_id: 'tech-daily', name, persona: { identity: '科技评论' }, voice: { tone: '克制' }, audience: { segments: ['工程师'] },
    columns: [{ name: '深度' }], platforms: [{ platform: 'wechat' }], banned_words: ['震惊'],
    compliance: { ai_label_text: '本文包含 AI 辅助创作内容' }, confirmedBy: '创作者本人' as const,
  })

  test('save creates immutable versions and current pointer', async () => {
    const first = await saveHandler(profile('科技日读'))
    const second = await saveHandler(profile('科技日读新版'))
    expect((first.data as any).profileVersion).not.toBe((second.data as any).profileVersion)
    const current = await getHandler({ brandId: 'tech-daily' })
    expect((current.data as any).name).toBe('科技日读新版')
    const history = await historyHandler({ brandId: 'tech-daily' })
    expect((history.data as any).count).toBe(2)
  })

  test('rollback creates another version instead of deleting history', async () => {
    const first = await saveHandler(profile('旧版'))
    await saveHandler(profile('新版'))
    const targetVersion = (first.data as any).profileVersion
    const rolled = await rollbackHandler({ brandId: 'tech-daily', targetVersion, confirmedBy: '负责人' })
    expect(rolled.status).toBe('ok')
    const current = await getHandler({ brandId: 'tech-daily' })
    expect((current.data as any).name).toBe('旧版')
    expect((current.data as any).rolledBackFrom).toBe(targetVersion)
    expect((await historyHandler({ brandId: 'tech-daily' })).data).toMatchObject({ count: 3 })
  })

  test('requires named confirmation and isolates unsafe brand ids', async () => {
    const noConfirm = await saveHandler({ ...profile('x'), confirmedBy: '' })
    expect(noConfirm.error?.code).toBe('INVALID_PROFILE')
    const unsafe = await saveHandler({ ...profile('x'), brand_id: '../escape' })
    expect(unsafe.error?.code).toBe('INVALID_PROFILE')
    const rawStyle = await saveHandler({ ...profile('x'), style: { verbatimExcerpt: '第三方文章逐字内容' } } as any)
    expect(rawStyle.error?.code).toBe('INVALID_PROFILE')
  })

  test('rejects profile-version path traversal and cross-brand reads', async () => {
    const saved = await saveHandler(profile('品牌 A'))
    expect(saved.status).toBe('ok')
    expect((await getHandler({ brandId: 'tech-daily', version: '../../another-brand/current' })).error?.code).toBe('NOT_FOUND')
    expect((await rollbackHandler({ brandId: 'tech-daily', targetVersion: '../../another-brand/current', confirmedBy: '负责人' })).error?.code).toBe('NOT_FOUND')
  })

  test('list returns only current version per brand', async () => {
    await saveHandler(profile('一'))
    await saveHandler(profile('二'))
    const list = await listHandler()
    expect((list.data as any).count).toBe(1)
  })

  test('fails closed before committing or materializing a profile when its audit transaction cannot be verified', async () => {
    await writeFile(join(dir, 'audit-events.jsonl'), '{malformed\n', 'utf8')
    await expect(saveHandler(profile('不得落盘'))).rejects.toThrow('malformed JSON')
    expect(await listRecords('profiles')).toHaveLength(0)
    expect(existsSync(join(dir, 'profiles', 'tech-daily', 'current.json'))).toBe(false)
  })
})
