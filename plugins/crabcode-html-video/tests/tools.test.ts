import { describe, expect, test } from 'bun:test'
import { handler as validateGraph } from '../src/tools/validateGraph.ts'
import { handler as lintFrame } from '../src/tools/lintFrame.ts'
import { handler as renderFrames } from '../src/tools/renderFrames.ts'

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
})
