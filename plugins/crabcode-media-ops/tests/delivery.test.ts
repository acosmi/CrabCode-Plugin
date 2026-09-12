import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { renderHandler, verifyHandler } from '../src/tools/delivery.ts'
import { createProfile, createReviewedContent } from './helpers.ts'

describe('HTML-primary frozen delivery', () => {
  let dir: string
  let profileVersion: string
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mediaops-delivery-'))
    process.env.MEDIAOPS_DATA_DIR = dir
    profileVersion = await createProfile('delivery-brand')
  })
  afterEach(async () => rm(dir, { recursive: true, force: true }))

  test('produces refined white HTML as primary and Markdown as byte-bound backup', async () => {
    // render-only: structure/hash contract without launching Chromium/Nu
    const fixture = await createReviewedContent({
      dir,
      brandId: 'delivery-brand',
      profileVersion,
      body: '## 第一部分\n\n正文段落。\n\n## 第二部分\n\n结论。\n\n本文包含 AI 辅助创作内容',
      deliveryMode: 'render-only',
    })
    const { getDeliveryManifest } = await import('../src/tools/delivery.ts')
    const manifest = await getDeliveryManifest(fixture.deliveryId)
    const html = await readFile(join(manifest!.artifactRoot, manifest!.primaryArtifact.relativePath), 'utf8')
    const markdown = await readFile(join(manifest!.artifactRoot, manifest!.backupArtifact.relativePath), 'utf8')
    const channel = await readFile(join(manifest!.artifactRoot, manifest!.channelArtifacts[0].relativePath), 'utf8')
    expect(manifest!.primaryArtifact.format).toBe('html')
    expect(manifest!.backupArtifact.format).toBe('markdown')
    expect(manifest!.visualReviewStatus).toBe('pending')
    expect(manifest!.qaEvidence).toBeUndefined()
    expect((html.match(/<h1(?:\s|>)/g) ?? []).length).toBe(1)
    expect(html).toContain('background: #FFFFFF')
    expect(html).toContain('@media print')
    expect(markdown.startsWith('# 一个经过审校的标题')).toBe(true)
    expect(channel).toContain('一个经过审校的标题')
    expect(channel).not.toMatch(/<script[\s>]/i)
  })

  test('the same reviewed revision renders identical artifact bytes', async () => {
    const fixture = await createReviewedContent({ dir, brandId: 'delivery-brand', profileVersion, deliveryMode: 'render-only' })
    const second = await renderHandler({ contentId: fixture.contentId, generatedBy: '另一排版员' })
    expect((second.data as any).primary.artifactHash).toBeDefined()
    const { getDeliveryManifest } = await import('../src/tools/delivery.ts')
    const firstManifest = await getDeliveryManifest(fixture.deliveryId)
    expect((second.data as any).primary.artifactHash).toBe(firstManifest!.primaryArtifact.artifactHash)
    expect((second.data as any).backup.artifactHash).toBe(firstManifest!.backupArtifact.artifactHash)
  })

  // Static mode runs neither Chromium nor Nu. The evidence it writes must say
  // so: a local draft stays reachable (the manifest still verifies) while the
  // record keeps its own grade instead of borrowing the full run's.
  test('static QA evidence declares its own grade and records skipped checks as skipped', async () => {
    const previous = process.env.MEDIAOPS_QA_MODE
    process.env.MEDIAOPS_QA_MODE = 'static'
    try {
      const fixture = await createReviewedContent({ dir, brandId: 'delivery-brand', profileVersion, deliveryMode: 'verified-static' })
      const { getDeliveryManifest } = await import('../src/tools/delivery.ts')
      const manifest = await getDeliveryManifest(fixture.deliveryId)
      expect(manifest!.visualReviewStatus).toBe('passed')
      expect(manifest!.qaEvidence!.status).toBe('static')
      expect(manifest!.qaEvidence!.mode).toBe('static')
      const evidenceChecks = new Map(manifest!.qaEvidence!.checks.map((item) => [item.id, item.status]))
      expect(evidenceChecks.get('static-qa-mode')).toBe('skipped')
      // Positive control: the binding really was performed, so it stays passed.
      expect(evidenceChecks.get('static-html-binding')).toBe('passed')
      expect(manifest!.checks.find((item) => item.id === 'automated-static-qa-mode')?.status).toBe('skipped')
      expect(manifest!.checks.some((item) => item.status === 'failed')).toBe(false)

      const browserReport = JSON.parse(await readFile(join(manifest!.artifactRoot, 'qa/browser-report.json'), 'utf8'))
      expect(browserReport.status).toBe('skipped')
      const summary = JSON.parse(await readFile(join(manifest!.artifactRoot, 'qa/summary.json'), 'utf8'))
      expect(summary.status).toBe('static')
      expect(summary.checks.find((item: any) => item.id === 'static-qa-mode').status).toBe('skipped')
    } finally {
      if (previous === undefined) delete process.env.MEDIAOPS_QA_MODE
      else process.env.MEDIAOPS_QA_MODE = previous
    }
  })

  test('incomplete viewport/print evidence cannot mark a candidate verified', async () => {
    // Negative path: never launch full browser QA (MEDIAOPS_QA_MODE=off).
    const previous = process.env.MEDIAOPS_QA_MODE
    process.env.MEDIAOPS_QA_MODE = 'off'
    try {
      const fixture = await createReviewedContent({ dir, brandId: 'delivery-brand', profileVersion, deliveryMode: 'render-only' })
      const pending = await renderHandler({ contentId: fixture.contentId, generatedBy: '排版员二' })
      const result = await verifyHandler({
        deliveryId: (pending.data as any).deliveryId, verifiedBy: '视觉员', visualReviewStatus: 'passed',
        viewports: [
          { width: 320, height: 640, noHorizontalOverflow: true, whiteBackground: true, readable: true },
          { width: 768, height: 900, noHorizontalOverflow: true, whiteBackground: true, readable: true },
          { width: 1000, height: 900, noHorizontalOverflow: true, whiteBackground: true, readable: true },
        ],
        printChecked: false, notes: [],
      })
      expect(result.status).toBe('action_required')
      expect((result.data as any).checks.some((item: any) => item.id === 'visual-evidence' && item.status === 'failed')).toBe(true)
      expect((result.data as any).checks.some((item: any) => item.id === 'automated-delivery-qa')).toBe(false)
    } finally {
      if (previous === undefined) delete process.env.MEDIAOPS_QA_MODE
      else process.env.MEDIAOPS_QA_MODE = previous
    }
  })
})
