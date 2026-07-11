import { describe, expect, test } from 'bun:test'
import { wrapFrameAsComposition } from '@crabcode/seek-shim'
import { prepareProducerDocument } from './hfRender.ts'

describe('prepareProducerDocument', () => {
  test('externalizes CSS and removes the trusted shim before Bun producer compilation', () => {
    const wrapped = wrapFrameAsComposition({
      id: 'motion',
      width: 640,
      height: 360,
      durationSec: 1.5,
      html: '<style>@keyframes rise{to{opacity:1}}.x{animation:rise 1s paused}</style><div class="x">x</div>',
    })
    const prepared = prepareProducerDocument(wrapped.html)
    expect(prepared.html).not.toMatch(/<style\b/i)
    expect(prepared.html).not.toMatch(/<script\b/i)
    expect(prepared.html).not.toContain('HFMASK')
    expect(prepared.html).toContain(`href="./${prepared.stylesheetName}"`)
    expect(prepared.html).toMatch(/style-src\s+'self'\s+'unsafe-inline'/)
    expect(prepared.stylesheet).toContain('@keyframes rise')
  })

  test('fails closed for any author script', () => {
    expect(() =>
      prepareProducerDocument(
        '<!doctype html><html><head><script>globalThis.pwned=true</script></head><body></body></html>',
      ),
    ).toThrow('author <script> is not allowed')
  })

  test('externalizes only parsed style elements, never markup-looking attribute text', () => {
    const wrapped = wrapFrameAsComposition({
      id: 'structured-extraction',
      width: 320,
      height: 180,
      durationSec: 1,
      html: '<style>.safe{color:green}</style><div data-note=\"><style>.evil{color:red}</style>\">ok</div>',
    }).html
    const prepared = prepareProducerDocument(wrapped)
    expect(prepared.stylesheet).toContain('.safe{color:green}')
    expect(prepared.stylesheet).not.toContain('.evil{color:red}')
    expect(prepared.html).not.toContain('<script>globalThis.PWNED')
  })
})
