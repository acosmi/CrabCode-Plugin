/**
 * @crabcode/seek-shim
 *
 * Bridges plain HTML frames (LLM-generated CSS/WAAPI animations) into the
 * hyperframes seek-and-capture contract (`window.__hf.seek(t)`).
 *
 * Constraints (must be enforced by video-frames SKILL.md):
 * - Prefer pure CSS / WAAPI declarative animations
 * - Forbid rAF / setTimeout self-driven animation (not seekable)
 * - Animations should be written as if they run [0, durationSec]
 */

/// <reference path="./css-tree-subpaths.d.ts" />

import { parseHTML } from 'linkedom'
import parse from 'css-tree/parser'
import walk from 'css-tree/walker'
import type { CssNode } from 'css-tree'

export interface WrapFrameOptions {
  /** Stable composition id (node id from content-graph). */
  id: string
  /** Frame width in CSS pixels. */
  width: number
  /** Frame height in CSS pixels. */
  height: number
  /** Frame duration in seconds. */
  durationSec: number
  /** Capture fps. Default 30. */
  fps?: number
  /**
   * Inner HTML body (or full document). If a full document is provided, body
   * contents + head styles are extracted.
   */
  html: string
  /** Optional background color when body has none. */
  background?: string
}

export interface WrapFrameResult {
  html: string
  compositionId: string
  width: number
  height: number
  durationSec: number
  fps: number
}

export interface DocumentParts {
  styles: string
  body: string
}

export interface ValidatedFrameHtml {
  ok: boolean
  errors: string[]
  warnings: string[]
  /** Serialized from the exact parsed DOM that was inspected. */
  parts?: DocumentParts
}

type ParsedDocument = ReturnType<typeof parseHTML>['document']

interface ParsedAuthoredHtml {
  document: ParsedDocument
  inspectionRoot: Pick<ParsedDocument, 'querySelectorAll'>
  serializationRoot: { innerHTML: string }
}

const DEFAULT_FPS = 30

/**
 * Extract styles and body through the HTML parser only. Security-sensitive HTML
 * must never be split with regex after DOM validation: attribute text can
 * contain `>` and markup-looking bytes that are not elements in the parsed DOM.
 */
export function extractDocumentParts(input: string): DocumentParts {
  const parsed = parseAuthoredHtml(input)
  if (!parsed) throw new Error('frame HTML could not be parsed safely')
  return serializeDocumentParts(parsed)
}

/**
 * Runtime that maps wall-clock seek time onto CSS/WAAPI animations.
 * Injected into every wrapped frame so producer seek-and-capture works without
 * the hyperframes composition timeline compiler.
 */
export function seekRuntimeScript(): string {
  return `<script>
(function () {
  if (window.__CRAB_SEEK_SHIM__) return;
  window.__CRAB_SEEK_SHIM__ = true;

  function seekCssAnimations(t) {
    var list = document.getAnimations ? document.getAnimations({ subtree: true }) : [];
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      try {
        if (typeof a.pause === 'function') a.pause();
        // currentTime includes delay and every iteration. Clamping it to
        // getTiming().duration collapses delayed/repeated animations.
        a.currentTime = Math.max(0, t * 1000);
      } catch (e) {}
    }
  }

  function seekMedia(t) {
    var medias = document.querySelectorAll('video, audio');
    for (var i = 0; i < medias.length; i++) {
      var m = medias[i];
      try {
        if (typeof m.pause === 'function') m.pause();
        if (isFinite(m.duration) && m.duration > 0) {
          m.currentTime = Math.min(Math.max(0, t), m.duration);
        } else {
          m.currentTime = Math.max(0, t);
        }
      } catch (e) {}
    }
  }

  function applySeek(t) {
    var time = typeof t === 'number' && isFinite(t) ? t : 0;
    seekCssAnimations(time);
    seekMedia(time);
  }

  // Hyperframes installs an early __hf stub and assigns another seek function
  // after page load. Keep an accessor so that later assignment becomes the
  // downstream seek while callers always receive the combined seek.
  var hfSlot = window.__hf || {};
  function hookHfObject(hf) {
    var current = typeof hf.seek === 'function' ? hf.seek : null;
    if (current && current.__crabHfSeekCombined) return true;
    var downstreamSeek = current;
    var combinedSeek = function (t, options) {
      var result;
      if (downstreamSeek && downstreamSeek !== combinedSeek) {
        result = downstreamSeek.call(this, t, options);
      }
      applySeek(t);
      return result === undefined ? Promise.resolve() : result;
    };
    combinedSeek.__crabHfSeekCombined = true;
    try {
      Object.defineProperty(hf, 'seek', {
        configurable: true,
        enumerable: true,
        get: function () { return combinedSeek; },
        set: function (next) {
          if (typeof next === 'function' && next !== combinedSeek) downstreamSeek = next;
        }
      });
      return true;
    } catch (e) {
      hf.seek = combinedSeek;
      return false;
    }
  }
  function installHfSeekHook() {
    return hookHfObject(window.__hf || hfSlot);
  }
  try {
    Object.defineProperty(window, '__hf', {
      configurable: true,
      enumerable: true,
      get: function () { return hfSlot; },
      set: function (next) {
        hfSlot = next && typeof next === 'object' ? next : {};
        hookHfObject(hfSlot);
      }
    });
  } catch (e) {
    window.__hf = hfSlot;
  }
  installHfSeekHook();

  function patchPlayer() {
    var player = window.__player;
    if (!player || typeof player.renderSeek !== 'function') return false;
    if (player.renderSeek.__crabSeekShimWrapped) return true;
    var originalRenderSeek = player.renderSeek;
    var wrappedRenderSeek = function (t, options) {
      var result = originalRenderSeek.call(this, t, options);
      applySeek(t);
      return result;
    };
    wrappedRenderSeek.__crabSeekShimWrapped = true;
    player.renderSeek = wrappedRenderSeek;
    return true;
  }

  // Hyperframes virtualizes timers. Poll with its preserved wall-clock timer
  // so player discovery does not depend on virtual render time advancing.
  var realSetInterval = window.__HF_VIRTUAL_TIME__ && window.__HF_VIRTUAL_TIME__.originalSetInterval
    ? window.__HF_VIRTUAL_TIME__.originalSetInterval
    : window.setInterval.bind(window);
  var realClearInterval = window.__HF_VIRTUAL_TIME__ && window.__HF_VIRTUAL_TIME__.originalClearInterval
    ? window.__HF_VIRTUAL_TIME__.originalClearInterval
    : window.clearInterval.bind(window);
  var attempts = 0;
  var playerPoll = null;
  if (!patchPlayer()) {
    playerPoll = realSetInterval(function () {
      attempts += 1;
      installHfSeekHook();
      if (patchPlayer() || attempts >= 1000) realClearInterval(playerPoll);
    }, 10);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      applySeek(0);
      patchPlayer();
    });
  } else {
    applySeek(0);
    patchPlayer();
  }
})();
</script>`
}

/**
 * Wrap a plain HTML frame into a hyperframes-compatible composition document
 * with seek runtime + data-composition attributes.
 */
export function wrapFrameAsComposition(opts: WrapFrameOptions): WrapFrameResult {
  const fps = opts.fps ?? DEFAULT_FPS
  const durationSec = Math.max(0.1, opts.durationSec)
  const width = Math.max(1, Math.round(opts.width))
  const height = Math.max(1, Math.round(opts.height))
  const compositionId = sanitizeId(opts.id)
  const validation = validateUntrustedHtml(opts.html)
  if (!validation.ok || !validation.parts) {
    throw new Error(`unsafe frame HTML: ${validation.errors.join('; ')}`)
  }
  // styles/body are serialized from the exact DOM instance inspected by the
  // policy. There is no regex/token-stream reinterpretation between them.
  const { styles, body } = validation.parts
  const bg = opts.background ?? '#000000'

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; media-src data:; font-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; script-src-attr 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; worker-src 'none'" />
  <title>${escapeHtml(compositionId)}</title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background: ${bg};
    }
    #__crab_root {
      position: relative;
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
    }
    /* Nudge CSS animations toward seekable form when author forgot 'paused'. */
    #__crab_root * {
      animation-play-state: paused !important;
    }
  </style>
  ${styles}
  ${seekRuntimeScript()}
</head>
<body>
  <div
    id="__crab_root"
    data-composition-id="${escapeAttr(compositionId)}"
    data-width="${width}"
    data-height="${height}"
    data-duration="${durationSec}"
    data-fps="${fps}"
    data-no-timeline="true"
  >
    ${body}
  </div>
</body>
</html>
`

  return {
    html,
    compositionId,
    width,
    height,
    durationSec,
    fps,
  }
}

/**
 * Best-effort lint: detect common non-seekable patterns.
 */
export function lintFrameHtml(html: string): { ok: boolean; errors: string[]; warnings: string[] } {
  const { parts: _parts, ...lint } = validateUntrustedHtml(html)
  return lint
}

/** Parse once, inspect once, then serialize that same DOM if and only if safe. */
export function validateUntrustedHtml(html: string): ValidatedFrameHtml {
  const errors: string[] = []
  const warnings: string[] = []

  if (!html || !html.trim()) {
    errors.push('empty html')
    return { ok: false, errors, warnings }
  }

  if (html.length > 500_000) {
    errors.push('frame HTML exceeds 500000 character limit')
  }

  // HTML's parser decodes entities and accepts syntax such as <svg/onload>.
  // Inspect the parsed DOM rather than treating security-sensitive markup as
  // a regular language. The wrapper's deny-by-default CSP is a second layer.
  const parsed = parseAuthoredHtml(html)
  if (!parsed) errors.push('frame HTML could not be parsed safely')
  else errors.push(...inspectAuthoredDom(parsed.inspectionRoot))

  if (/\brequestAnimationFrame\s*\(/.test(html) || /\braf\s*\(/.test(html)) {
    errors.push('requestAnimationFrame is not seekable; use CSS/WAAPI animations only')
  }
  if (/\bsetTimeout\s*\(/.test(html) || /\bsetInterval\s*\(/.test(html)) {
    errors.push('setTimeout/setInterval driven animation is not seekable; use CSS/WAAPI only')
  }
  if (/animation\s*:[^;]+(?!.*\bpaused\b)/i.test(html) && !/animation-play-state\s*:\s*paused/i.test(html)) {
    warnings.push(
      "CSS animation may not be paused; seek-shim will force animation-play-state:paused but prefer writing animations as 'paused'",
    )
  }
  if (!/<html[\s>]|<!doctype/i.test(html) && html.length > 200_000) {
    warnings.push('very large fragment; consider splitting frames')
  }

  const uniqueErrors = [...new Set(errors)]
  return {
    ok: uniqueErrors.length === 0,
    errors: uniqueErrors,
    warnings,
    ...(uniqueErrors.length === 0 && parsed
      ? { parts: serializeDocumentParts(parsed) }
      : {}),
  }
}

const FORBIDDEN_ELEMENTS = new Set([
  'script',
  'iframe',
  'object',
  'embed',
  'applet',
  'base',
  'link',
  'form',
  'template',
  'marquee',
  'animate',
  'animatecolor',
  'animatemotion',
  'animatetransform',
  'set',
  'video',
  'audio',
  'source',
  'track',
])

const URL_ATTRIBUTES = new Set([
  'src',
  'href',
  'xlink:href',
  'poster',
  'action',
  'formaction',
  'data',
  'cite',
  'background',
  'ping',
])

function parseAuthoredHtml(html: string): ParsedAuthoredHtml | null {
  try {
    const candidate = parseHTML(html).document
    if (candidate.documentElement?.localName.toLowerCase() === 'html') {
      return {
        document: candidate,
        inspectionRoot: candidate,
        serializationRoot: candidate.body,
      }
    }

    // Parse fragments in a real element context. Assigning innerHTML prevents
    // authored closing tags from escaping the trusted container.
    const document = parseHTML(
      '<!doctype html><html><head></head><body></body></html>',
    ).document
    const container = document.createElement('div')
    container.setAttribute('data-crab-authored-root', '')
    container.innerHTML = html
    document.body.appendChild(container)
    return {
      document,
      inspectionRoot: container,
      serializationRoot: container,
    }
  } catch {
    return null
  }
}

function serializeDocumentParts(parsed: ParsedAuthoredHtml): DocumentParts {
  const styles = Array.from(parsed.inspectionRoot.querySelectorAll('style'))
  const serializedStyles = styles.map((style) => style.outerHTML)
  for (const style of styles) style.remove()
  return {
    styles: serializedStyles.join('\n'),
    body: parsed.serializationRoot.innerHTML.trim(),
  }
}

function inspectAuthoredDom(root: Pick<ParsedDocument, 'querySelectorAll'>): string[] {
  const errors: string[] = []

  for (const element of root.querySelectorAll('*')) {
    const tag = element.localName.toLowerCase()
    if (FORBIDDEN_ELEMENTS.has(tag)) errors.push(`element <${tag}> is forbidden in frame HTML`)

    for (const attribute of element.attributes) {
      const name = attribute.name.toLowerCase()
      const value = attribute.value.trim()
      if (name.startsWith('on')) errors.push(`inline event handler ${name} is forbidden`)
      if (name === 'srcset') errors.push('srcset is forbidden; embed one data: asset with src')
      if (URL_ATTRIBUTES.has(name) && value && !value.startsWith('#')) {
        if (!/^data:/i.test(value)) {
          errors.push(`${name} may only reference a local fragment or approved embedded asset`)
        } else if (!(tag === 'img' && name === 'src' && isStaticImageDataUrl(value))) {
          errors.push(`${name} data: asset is not an approved static JPEG/PNG image`)
        }
      }
      if (name === 'style') inspectCssStylesheet(value, errors, true)
      else if (CSS_PRESENTATION_ATTRIBUTES.has(name)) inspectCssValue(value, errors)
      if (tag === 'meta' && name === 'http-equiv') errors.push('meta http-equiv is forbidden in authored HTML')
    }

    if (tag === 'style') inspectCssStylesheet(element.textContent || '', errors, false)
  }

  return errors
}

const CSS_PRESENTATION_ATTRIBUTES = new Set([
  'background',
  'background-image',
  'border-image',
  'clip-path',
  'content',
  'cursor',
  'fill',
  'filter',
  'list-style',
  'list-style-image',
  'marker',
  'marker-end',
  'marker-mid',
  'marker-start',
  'mask',
  'offset-path',
  'shape-outside',
  'stroke',
])

const NETWORK_CAPABLE_CSS_FUNCTIONS = new Set([
  'cross-fade',
  '-webkit-cross-fade',
  'image',
  'image-set',
  '-webkit-image-set',
])

function inspectCssStylesheet(css: string, errors: string[], declarationList: boolean): void {
  let ast: CssNode
  try {
    ast = parse(css, { context: declarationList ? 'declarationList' : 'stylesheet' })
  } catch {
    errors.push('CSS could not be parsed safely')
    return
  }
  inspectCssAst(ast, errors)
}

function inspectCssValue(css: string, errors: string[]): void {
  let ast: CssNode
  try {
    ast = parse(css, { context: 'value' })
  } catch {
    errors.push('CSS value could not be parsed safely')
    return
  }
  inspectCssAst(ast, errors)
}

function inspectCssAst(ast: CssNode, errors: string[]): void {
  walk(ast, (node) => {
    if (node.type === 'Raw') errors.push('CSS contains unsupported raw syntax')
    if (node.type === 'Atrule' && cssUnescape(node.name).toLowerCase() === 'import') {
      errors.push('CSS @import is forbidden')
    }
    if (node.type === 'Function') {
      const functionName = cssUnescape(node.name).toLowerCase()
      if (functionName === 'url' || NETWORK_CAPABLE_CSS_FUNCTIONS.has(functionName)) {
        errors.push(`CSS function is forbidden: ${functionName}`)
      }
    }
    if (node.type === 'Url') inspectCssUrl(cssUnescape(node.value).trim(), errors)
  })
}

function inspectCssUrl(value: string, errors: string[]): void {
  if (!value || value.startsWith('#')) return
  if (!/^data:/i.test(value)) {
    errors.push('CSS url() may only contain a local fragment or approved data: asset')
  } else if (!isSafeCssDataUrl(value)) {
    errors.push('CSS data: URL must be a static JPEG/PNG image or embedded font')
  }
}

function cssUnescape(value: string): string {
  return value.replace(
    /\\([0-9a-fA-F]{1,6})(?:\r\n|[\t\n\f\r ])?|\\(?:\r\n|[\n\f\r])|\\(.)/gs,
    (_match, hex: string | undefined, simple: string | undefined) => {
      if (hex) {
        const point = Number.parseInt(hex, 16)
        if (point === 0 || point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)) return '\uFFFD'
        return String.fromCodePoint(point)
      }
      return simple ?? ''
    },
  )
}

function isSafeCssDataUrl(value: string): boolean {
  const mime = dataUrlMime(value)
  if (mime.startsWith('font/') || mime === 'application/font-woff' || mime === 'application/font-woff2') {
    return /;base64,/i.test(value)
  }
  return isStaticImageDataUrl(value)
}

function isStaticImageDataUrl(value: string): boolean {
  const mime = dataUrlMime(value)
  const marker = value.indexOf(',')
  if (marker < 0 || !/;base64$/i.test(value.slice(0, marker))) return false
  let bytes: Buffer
  try {
    bytes = Buffer.from(value.slice(marker + 1).replace(/\s+/g, ''), 'base64')
  } catch {
    return false
  }
  if (mime === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  }
  if (mime === 'image/png') {
    const signature = '89504e470d0a1a0a'
    return bytes.length >= 24 && bytes.subarray(0, 8).toString('hex') === signature && !bytes.includes(Buffer.from('acTL'))
  }
  return false
}

function dataUrlMime(value: string): string {
  const match = value.match(/^data:([^;,]+)/i)
  return (match?.[1] || '').toLowerCase()
}

function sanitizeId(id: string): string {
  const s = id.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '')
  return s || 'frame'
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, '&#39;')
}
