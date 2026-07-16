import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createProfile, createReviewedContent } from './helpers.ts'

/**
 * Full automated delivery QA (Nu + Playwright + axe).
 * Run only via: MEDIAOPS_QA_MODE=full bun test --timeout 180000 --max-concurrency 1 tests/delivery.qa.test.ts
 */
describe('full automated delivery QA', () => {
  let dir: string
  let profileVersion: string
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mediaops-delivery-qa-'))
    process.env.MEDIAOPS_DATA_DIR = dir
    process.env.MEDIAOPS_QA_MODE = 'full'
    profileVersion = await createProfile('delivery-qa-brand')
  })
  afterEach(async () => rm(dir, { recursive: true, force: true }))

  test('verified delivery binds Nu/axe/Playwright evidence to primary HTML', async () => {
    const fixture = await createReviewedContent({
      dir,
      brandId: 'delivery-qa-brand',
      profileVersion,
      body: '## 第一部分\n\n正文段落。\n\n## 第二部分\n\n结论。\n\n本文包含 AI 辅助创作内容',
      deliveryMode: 'verified',
    })
    const { getDeliveryManifest } = await import('../src/tools/delivery.ts')
    const manifest = await getDeliveryManifest(fixture.deliveryId)
    expect(manifest!.visualReviewStatus).toBe('passed')
    expect(manifest!.qaEvidence?.status).toBe('passed')
    expect(manifest!.qaEvidence?.tools.playwright).toBe('1.61.1')
    expect(manifest!.qaEvidence?.tools.axe).toBe('4.12.1')
    expect(manifest!.qaEvidence?.tools.vnuPackage).toBe('26.7.15')
    expect(manifest!.qaEvidence?.artifacts.some((item) => item.relativePath === 'qa/screenshots/viewport-320-light.png')).toBe(true)
    expect(manifest!.qaEvidence?.checks.every((item) => item.status === 'passed')).toBe(true)
    expect(manifest!.qaEvidence?.htmlSha256).toBe(manifest!.primaryArtifact.artifactHash)
  }, 180_000)
})
