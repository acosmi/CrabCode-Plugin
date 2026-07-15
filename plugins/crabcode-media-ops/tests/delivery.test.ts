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
    const fixture = await createReviewedContent({ dir, brandId: 'delivery-brand', profileVersion, body: '## 第一部分\n\n正文段落。\n\n## 第二部分\n\n结论。\n\n本文包含 AI 辅助创作内容' })
    const { getDeliveryManifest } = await import('../src/tools/delivery.ts')
    const manifest = await getDeliveryManifest(fixture.deliveryId)
    const html = await readFile(join(manifest!.artifactRoot, manifest!.primaryArtifact.relativePath), 'utf8')
    const markdown = await readFile(join(manifest!.artifactRoot, manifest!.backupArtifact.relativePath), 'utf8')
    expect(manifest!.primaryArtifact.format).toBe('html')
    expect(manifest!.backupArtifact.format).toBe('markdown')
    expect((html.match(/<h1(?:\s|>)/g) ?? []).length).toBe(1)
    expect(html).toContain('background: #FFFFFF')
    expect(html).toContain('@media print')
    expect(markdown.startsWith('# 一个经过审校的标题')).toBe(true)
  })

  test('the same reviewed revision renders identical artifact bytes', async () => {
    const fixture = await createReviewedContent({ dir, brandId: 'delivery-brand', profileVersion })
    const second = await renderHandler({ contentId: fixture.contentId, generatedBy: '另一排版员' })
    expect((second.data as any).primary.artifactHash).toBeDefined()
    const { getDeliveryManifest } = await import('../src/tools/delivery.ts')
    const firstManifest = await getDeliveryManifest(fixture.deliveryId)
    expect((second.data as any).primary.artifactHash).toBe(firstManifest!.primaryArtifact.artifactHash)
    expect((second.data as any).backup.artifactHash).toBe(firstManifest!.backupArtifact.artifactHash)
  })

  test('incomplete viewport/print evidence cannot mark a candidate verified', async () => {
    const fixture = await createReviewedContent({ dir, brandId: 'delivery-brand', profileVersion })
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
  })
})
