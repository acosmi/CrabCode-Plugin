import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { handler } from '../src/tools/preview.ts'
import { createProfile, createReviewedContent } from './helpers.ts'

describe('traceable previews', () => {
  let dir: string
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mediaops-preview-'))
    process.env.MEDIAOPS_DATA_DIR = dir
  })
  afterEach(async () => rm(dir, { recursive: true, force: true }))

  test('renders only from stored content and returns revision/hash', async () => {
    const version = await createProfile('preview-brand')
    const content = await createReviewedContent({ dir, brandId: 'preview-brand', profileVersion: version })
    const env = await handler({ contentId: content.contentId, platform: 'wechat' })
    expect(env.status).toBe('ok')
    expect((env.data as any).revisionId).toBe(content.revisionId)
    expect((env.data as any).contentHash).toBe(content.contentHash)
    expect(existsSync((env.data as any).path)).toBe(true)
  })
})
