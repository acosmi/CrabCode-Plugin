import { describe, expect, test } from 'bun:test'
import { handler as validateGraph } from '../src/tools/validateGraph.ts'
import { handler as lintFrame } from '../src/tools/lintFrame.ts'
import { handler as renderFrames } from '../src/tools/renderFrames.ts'
import { handler as previewFrame } from '../src/tools/previewFrame.ts'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('plugin tools', () => {
  test('validateGraph ok', async () => {
    const r = await validateGraph({
      graph: {
        schemaVersion: 1,
        intent: 'promo',
        nodes: [{ id: 'a', kind: 'text', text: 'hi', durationSec: 2 }],
        edges: [],
      },
    })
    expect(r.success).toBe(true)
  })

  test('validateGraph rejects a storyboard that cannot pass render limits', async () => {
    const r = await validateGraph({
      graph: {
        schemaVersion: 1,
        intent: 'promo',
        nodes: Array.from({ length: 5 }, (_, index) => ({
          id: `n${index}`,
          kind: 'text',
          text: 'x',
          durationSec: 30,
        })),
        edges: [],
      },
    })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.code).toBe('invalid_args')
  })

  test('lintFrame rejects setInterval', async () => {
    const r = await lintFrame({ html: '<script>setInterval(()=>{},1)</script>' })
    expect(r.success).toBe(false)
  })

  test('renderFrames requires confirmation', async () => {
    const r = await renderFrames({
      segments: [{ id: 'a', html: '<div>x</div>', durationSec: 1 }],
      confirmed: false,
    })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.code).toBe('confirmation_required')
  })

  test('renderFrames rejects path traversal and non-boolean confirmation', async () => {
    const segment = { id: 'a', html: '<div>x</div>', durationSec: 1 }
    const traversal = await renderFrames({ segments: [segment], confirmed: true, outputName: '../../evil.mp4' })
    expect(traversal.success).toBe(false)
    if (!traversal.success) expect(traversal.error.code).toBe('invalid_args')

    const fakeConfirmation = await renderFrames({ segments: [segment], confirmed: 'yes' })
    expect(fakeConfirmation.success).toBe(false)
    if (!fakeConfirmation.success) expect(fakeConfirmation.error.code).toBe('invalid_args')
  })

  test('renderFrames enforces resource limits before rendering', async () => {
    const r = await renderFrames({
      segments: [{ id: 'a', html: '<div>x</div>', durationSec: 30 }],
      confirmed: true,
      width: 3840,
      height: 3840,
    })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.code).toBe('invalid_args')
  })

  test('renderFrames rejects excessive pixel-frame work', async () => {
    const r = await renderFrames({
      segments: Array.from({ length: 4 }, (_, index) => ({
        id: `p${index}`,
        html: '<div>x</div>',
        durationSec: 30,
      })),
      confirmed: true,
      width: 3840,
      height: 2160,
      fps: 60,
    })
    expect(r.success).toBe(false)
  })

  test('previewFrame rejects unsafe ids and authored scripts', async () => {
    const badId = await previewFrame({ html: '<div>x</div>', id: '../../escape' })
    expect(badId.success).toBe(false)

    const script = await previewFrame({ html: '<script>fetch("https://example.com")</script>' })
    expect(script.success).toBe(false)
    if (!script.success) expect(script.error.code).toBe('lint_failed')
  })

  test('preview preflight failure leaves no poison file and remains retryable', async () => {
    const oldMode = process.env.CRABCODE_HTML_VIDEO_RENDER_MODE
    const oldUrl = process.env.CRABCODE_HTML_VIDEO_PRODUCER_URL
    const oldData = process.env.CRABCODE_PLUGIN_DATA
    const data = mkdtempSync(join(tmpdir(), 'crab-preview-transaction-'))
    try {
      process.env.CRABCODE_HTML_VIDEO_RENDER_MODE = 'remote'
      delete process.env.CRABCODE_HTML_VIDEO_PRODUCER_URL
      process.env.CRABCODE_PLUGIN_DATA = data
      const input = { html: '<div>x</div>', id: 'retry', render: true, confirmed: true }
      const first = await previewFrame(input)
      const second = await previewFrame(input)
      expect(first.success).toBe(false)
      expect(second.success).toBe(false)
      if (!first.success) expect(first.error.code).toBe('producer_unavailable')
      if (!second.success) expect(second.error.code).toBe('producer_unavailable')
    } finally {
      if (oldMode === undefined) delete process.env.CRABCODE_HTML_VIDEO_RENDER_MODE
      else process.env.CRABCODE_HTML_VIDEO_RENDER_MODE = oldMode
      if (oldUrl === undefined) delete process.env.CRABCODE_HTML_VIDEO_PRODUCER_URL
      else process.env.CRABCODE_HTML_VIDEO_PRODUCER_URL = oldUrl
      if (oldData === undefined) delete process.env.CRABCODE_PLUGIN_DATA
      else process.env.CRABCODE_PLUGIN_DATA = oldData
      rmSync(data, { recursive: true, force: true })
    }
  })
})
