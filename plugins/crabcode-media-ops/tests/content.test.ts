import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getHandler, saveHandler } from '../src/tools/content.ts'
import { createProfile } from './helpers.ts'

describe('strict content manifest revisions', () => {
  let dir: string
  let version: string
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mediaops-content-v2-'))
    process.env.MEDIAOPS_DATA_DIR = dir
    version = await createProfile('content-brand')
  })
  afterEach(async () => rm(dir, { recursive: true, force: true }))

  const base = () => ({ kind: 'draft' as const, brandId: 'content-brand', profileVersion: version, researchSubject: '测试选题', stage: 'intake' as const, title: '选题', bodyMarkdown: '', savedBy: '作者' })

  test('requires intake first and allows immutable same-stage refinement', async () => {
    const jumped = await saveHandler({ ...base(), stage: 'drafted' })
    expect(jumped.error?.code).toBe('INVALID_STAGE_TRANSITION')
    const first = await saveHandler(base())
    const id = (first.data as any).contentId
    const second = await saveHandler({ ...base(), contentId: id, expectedRevision: 1, title: '选题第二版' })
    expect((second.data as any).revision).toBe(2)
    expect((second.data as any).contentHash).not.toBe((first.data as any).contentHash)
    expect(((await getHandler({ contentId: id })).data as any).title).toBe('选题第二版')
    expect(((await getHandler({ revisionId: (first.data as any).revisionId })).data as any).title).toBe('选题')
  })

  test('blocks cross-brand mutation, stale revision, stage skip and research without evidence', async () => {
    const first = await saveHandler(base())
    const id = (first.data as any).contentId
    expect((await saveHandler({ ...base(), contentId: id, brandId: 'other-brand' })).error?.code).toBe('BRAND_SCOPE_MISMATCH')
    expect((await saveHandler({ ...base(), contentId: id, expectedRevision: 9 })).error?.code).toBe('REVISION_CONFLICT')
    expect((await saveHandler({ ...base(), contentId: id, stage: 'drafted' })).error?.code).toBe('INVALID_STAGE_TRANSITION')
    expect((await saveHandler({ ...base(), contentId: id, stage: 'researched' })).error?.code).toBe('RESEARCH_EVIDENCE_REQUIRED')
  })

  test('serializes concurrent compare-and-append revisions for one content id', async () => {
    const first = await saveHandler(base())
    const contentId = (first.data as any).contentId
    const attempts = await Promise.all([
      saveHandler({ ...base(), contentId, expectedRevision: 1, title: '并发版本 A' }),
      saveHandler({ ...base(), contentId, expectedRevision: 1, title: '并发版本 B' }),
    ])
    expect(attempts.filter((item) => item.status === 'ok')).toHaveLength(1)
    expect(attempts.filter((item) => item.error?.code === 'REVISION_CONFLICT')).toHaveLength(1)
    expect(((await getHandler({ contentId })).data as any).revision).toBe(2)
  })
})
