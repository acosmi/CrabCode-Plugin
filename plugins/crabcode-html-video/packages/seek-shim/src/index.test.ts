import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { launch } from 'puppeteer-core'
import {
  wrapFrameAsComposition,
  lintFrameHtml,
  extractDocumentParts,
  seekRuntimeScript,
  validateUntrustedHtml,
} from './index.ts'

const parserDifferentialHtml =
  '<html><head><style>.x{color:red}</style></head><body data-x="><script>globalThis.PWNED=777</script>"><div>ok</div></body></html>'

const chromiumPath = [
  process.env.HYPERFRAMES_BROWSER_PATH,
  process.env.PRODUCER_HEADLESS_SHELL_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  Bun.which('google-chrome'),
  Bun.which('chromium'),
].find((path): path is string => Boolean(path && existsSync(path)))

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

  test('lint rejects active content and network URLs', () => {
    const script = lintFrameHtml('<script>console.log(1)</script>')
    expect(script.ok).toBe(false)
    expect(script.errors.join(' ')).toContain('<script>')

    const network = lintFrameHtml(
      '<style>.x{background:url(https://example.com/x.png)}</style><div class="x"></div>',
    )
    expect(network.ok).toBe(false)
    expect(network.errors.join(' ')).toContain('CSS url()')

    expect(lintFrameHtml('<img src="//127.0.0.1/private">').ok).toBe(false)
    expect(lintFrameHtml('<img src="&#x68;ttps://example.com/pixel">').ok).toBe(false)
    expect(lintFrameHtml('<svg/onload=alert(1)>').ok).toBe(false)
    expect(lintFrameHtml('<svg><image href="//example.com/x.png" /></svg>').ok).toBe(false)
    expect(lintFrameHtml('<template><img src="http://127.0.0.1/private"></template>').ok).toBe(false)
    expect(lintFrameHtml('<svg filter="url(http://127.0.0.1/private)"></svg>').ok).toBe(false)
    expect(lintFrameHtml('<svg filter="url(#blur)"></svg>').ok).toBe(true)
    expect(lintFrameHtml('<img src="data:image/png;base64,AA==">').ok).toBe(false)
    expect(lintFrameHtml('<animate attributeName="x" />').ok).toBe(false)
    expect(lintFrameHtml('<marquee>moving</marquee>').ok).toBe(false)
    expect(lintFrameHtml('<video src="data:video/mp4;base64,AA=="></video>').ok).toBe(false)
  })

  test('lint parses CSS AST before rejecting escaped network syntax', () => {
    for (const html of [
      String.raw`<style>@\69mport "./private.css";</style>`,
      String.raw`<style>.x{background:url("h\74tps://example.com/x.png")}</style>`,
      String.raw`<style>.x{background:\69mage-set("./private.png" 1x)}</style>`,
      String.raw`<div style="background-image:-webkit-\69mage-set('./private.png' 1x)"></div>`,
    ]) {
      expect(lintFrameHtml(html).ok).toBe(false)
    }
  })

  test('extracts styles from full document', () => {
    const { styles, body } = extractDocumentParts(
      '<!doctype html><html><head><style>.x{}</style></head><body><p>Y</p></body></html>',
    )
    expect(styles).toContain('.x{}')
    expect(body).toContain('<p>Y</p>')
  })

  test('serializes the inspected DOM without reinterpreting attribute text as script', () => {
    const validated = validateUntrustedHtml(parserDifferentialHtml)
    expect(validated.ok).toBe(true)
    expect(validated.parts?.styles).toContain('.x{color:red}')
    expect(validated.parts?.body).toBe('<div>ok</div>')

    const wrapped = wrapFrameAsComposition({
      id: 'parser-differential',
      width: 320,
      height: 180,
      durationSec: 1,
      html: parserDifferentialHtml,
    }).html
    expect(wrapped).not.toContain('globalThis.PWNED')
    expect(wrapped).not.toContain('<script>globalThis.PWNED')
    expect(wrapped).toContain('<div>ok</div>')
  })

  test.skipIf(!chromiumPath)(
    'real Chromium does not receive or execute parser-differential author script',
    async () => {
      const wrapped = wrapFrameAsComposition({
        id: 'parser-differential-browser',
        width: 320,
        height: 180,
        durationSec: 1,
        html: parserDifferentialHtml,
      }).html
      const browser = await launch({
        executablePath: chromiumPath!,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      })
      try {
        const page = await browser.newPage()
        await page.setContent(wrapped, { waitUntil: 'load' })
        const observed = await page.evaluate(() => ({
          pwned: (globalThis as typeof globalThis & { PWNED?: unknown }).PWNED ?? null,
          authoredScriptCount: Array.from(document.scripts).filter((script) =>
            script.textContent?.includes('PWNED'),
          ).length,
          content: document.querySelector('#__crab_root')?.textContent?.trim(),
        }))
        expect(observed).toEqual({ pwned: null, authoredScriptCount: 0, content: 'ok' })
      } finally {
        await browser.close()
      }
    },
    30_000,
  )

  test('hooks producer seek and applies a browser-layer network deny policy', () => {
    const runtime = seekRuntimeScript()
    expect(runtime).toContain('player.renderSeek')
    expect(runtime).toContain('__crabSeekShimWrapped')
    expect(runtime).toContain('__crabHfSeekCombined')
    expect(runtime).toContain("Object.defineProperty(hf, 'seek'")
    expect(runtime).toContain('originalSetInterval')
    expect(runtime).not.toContain('Math.min(ms, dur)')

    const wrapped = wrapFrameAsComposition({
      id: 'secure',
      width: 320,
      height: 180,
      durationSec: 2,
      html: '<div>safe</div>',
    }).html
    expect(wrapped).toContain("default-src 'none'")
    expect(wrapped).toContain("connect-src 'none'")
  })
})
