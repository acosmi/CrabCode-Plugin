import { describe, expect, test } from 'bun:test'
import { wrapFrameAsComposition, lintFrameHtml, extractDocumentParts } from './index.ts'

describe('seek-shim', () => {
  test('wraps fragment with composition + seek runtime', () => {
    const r = wrapFrameAsComposition({
      id: 'intro!',
      width: 1280,
      height: 720,
      durationSec: 3,
      html: '<div class="t">Hi</div>',
    })
    expect(r.compositionId).toBe('intro')
    expect(r.html).toContain('data-composition-id="intro"')
    expect(r.html).toContain('window.__hf')
    expect(r.html).toContain('__crab_root')
    expect(r.html).toContain('data-no-timeline')
    expect(r.html).toContain('Hi')
  })

  test('lint rejects rAF', () => {
    const r = lintFrameHtml('<script>requestAnimationFrame(()=>{})</script>')
    expect(r.ok).toBe(false)
  })

  test('extracts styles from full document', () => {
    const { styles, body } = extractDocumentParts(
      '<!doctype html><html><head><style>.x{}</style></head><body><p>Y</p></body></html>',
    )
    expect(styles).toContain('.x{}')
    expect(body).toContain('<p>Y</p>')
  })
})
