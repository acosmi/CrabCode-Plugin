import { expect, test } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createReleaseFixture, writeReleaseFixture } from '../../src/qa/release-fixture.ts'
import { serveArtifactRoot, settlePage, type TestArtifactServer } from './helpers.ts'

test.describe('fixed release fixture', () => {
  let artifactRoot: string
  let server: TestArtifactServer

  test.beforeAll(async () => {
    artifactRoot = await mkdtemp(join(tmpdir(), 'mediaops-golden-'))
    await writeReleaseFixture(artifactRoot)
    server = await serveArtifactRoot(artifactRoot)
  })

  test.afterAll(async () => {
    await server?.stop()
    await rm(artifactRoot, { recursive: true, force: true })
  })

  for (const golden of [
    { width: 320, colorScheme: 'light' },
    { width: 375, colorScheme: 'light' },
    { width: 375, colorScheme: 'dark' },
    { width: 768, colorScheme: 'light' },
    { width: 1440, colorScheme: 'light' },
  ] as const) {
    test(`matches the ${golden.width}px ${golden.colorScheme} editorial-white golden screenshot`, async ({ page }) => {
      await page.setViewportSize({ width: golden.width, height: 900 })
      await page.emulateMedia({ colorScheme: golden.colorScheme, reducedMotion: 'reduce' })
      const response = await page.goto(`http://127.0.0.1:${server.port}/article.html`, { waitUntil: 'load' })
      expect(response?.status()).toBe(200)
      await expect(page.locator('article.media-article')).toHaveCount(1)
      await page.evaluate(settlePage)
      await expect(page).toHaveScreenshot(`release-${golden.width}-${golden.colorScheme}.png`, { fullPage: true })
    })
  }

  test('renders byte-identically 100 consecutive times', () => {
    const outputs = Array.from({ length: 100 }, () => createReleaseFixture())
    const first = outputs[0]
    expect(first).toBeDefined()
    for (const output of outputs) {
      expect(Buffer.from(output.html)).toEqual(Buffer.from(first.html))
      expect(Buffer.from(output.markdown)).toEqual(Buffer.from(first.markdown))
      expect(Buffer.from(output.wechatHtml)).toEqual(Buffer.from(first.wechatHtml))
      expect(output.articleDocHash).toBe(first.articleDocHash)
      expect(output.semanticHash).toBe(first.semanticHash)
      expect(output.originalitySubjectHash).toBe(first.originalitySubjectHash)
    }
  })
})
