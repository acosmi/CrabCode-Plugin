import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getHandler, saveHandler } from '../src/tools/content.ts'
import { createProfile } from './helpers.ts'

describe('content manifest revisions', () => {
  let dir: string
  let version: string
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mediaops-content-v2-'))
    process.env.MEDIAOPS_DATA_DIR = dir
    version = await createProfile('content-brand')
  })
  afterEach(async () => rm(dir, { recursive: true, force: true }))

  test('creates immutable revisions and stable trace fields', async () => {
    const first = await saveHandler({ kind: 'draft', brandId: 'content-brand', profileVersion: version, stage: 'drafted', title: '第一版', bodyMarkdown: '正文', savedBy: '作者' })
    const id = (first.data as any).contentId
    const second = await saveHandler({ contentId: id, expectedRevision: 1, kind: 'draft', brandId: 'content-brand', profileVersion: version, stage: 'drafted', title: '第二版', bodyMarkdown: '正文更新', savedBy: '作者' })
    expect((second.data as any).revision).toBe(2)
    expect((second.data as any).contentHash).not.toBe((first.data as any).contentHash)
    expect(((await getHandler({ contentId: id })).data as any).title).toBe('第二版')
    expect(((await getHandler({ revisionId: (first.data as any).revisionId })).data as any).title).toBe('第一版')
  })

  test('blocks cross-brand mutation, stale expected revision and backward stages', async () => {
    const first = await saveHandler({ kind: 'draft', brandId: 'content-brand', profileVersion: version, stage: 'drafted', title: '稿', bodyMarkdown: '正文', savedBy: '作者' })
    const id = (first.data as any).contentId
    expect((await saveHandler({ contentId: id, kind: 'draft', brandId: 'other-brand', profileVersion: version, stage: 'drafted', title: '稿', bodyMarkdown: '正文', savedBy: '作者' })).error?.code).toBe('BRAND_SCOPE_MISMATCH')
    expect((await saveHandler({ contentId: id, expectedRevision: 9, kind: 'draft', brandId: 'content-brand', profileVersion: version, stage: 'drafted', title: '稿', bodyMarkdown: '正文', savedBy: '作者' })).error?.code).toBe('REVISION_CONFLICT')
    expect((await saveHandler({ contentId: id, kind: 'draft', brandId: 'content-brand', profileVersion: version, stage: 'researched', title: '稿', bodyMarkdown: '正文', savedBy: '作者' })).error?.code).toBe('INVALID_STAGE_TRANSITION')
  })
})
