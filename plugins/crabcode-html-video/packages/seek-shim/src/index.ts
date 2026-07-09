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

const DEFAULT_FPS = 30

/**
 * Extract style blocks + body innerHTML from either a fragment or full document.
 */
export function extractDocumentParts(input: string): { styles: string; body: string } {
  const trimmed = input.trim()
  const isFullDoc = /<!doctype html>|<html[\s>]/i.test(trimmed)

  if (!isFullDoc) {
    // Treat as body fragment; pull out any <style> tags that authors embedded.
    const styles: string[] = []
    const body = trimmed.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, (m) => {
      styles.push(m)
      return ''
    })
    return { styles: styles.join('\n'), body: body.trim() }
  }

  const styleMatches = [...trimmed.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map((m) => m[0])
  const bodyMatch = trimmed.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)
  const body = (bodyMatch?.[1] ?? trimmed).trim()
  // Strip nested style tags already collected from full doc
  const cleanBody = body.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').trim()
  return { styles: styleMatches.join('\n'), body: cleanBody }
}

/**
 * Runtime that maps wall-clock seek time onto CSS/WAAPI animations.
 * Injected into every wrapped frame so producer seek-and-capture works without
 * the hyperframes composition timeline compiler.
 */
export function seekRuntimeScript(): string {
  return `<script>
(function () {
  if (window.__hf && typeof window.__hf.seek === 'function') return;

  function seekCssAnimations(t) {
    var list = document.getAnimations ? document.getAnimations({ subtree: true }) : [];
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      try {
        // Pause and set currentTime in ms. WAAPI currentTime is milliseconds.
        if (typeof a.pause === 'function') a.pause();
        var dur = Infinity;
        if (a.effect && typeof a.effect.getTiming === 'function') {
          var timing = a.effect.getTiming();
          var d = timing.duration;
          if (typeof d === 'number' && isFinite(d)) dur = d;
        }
        // If animation uses iterations + duration, clamp into active range.
        var ms = Math.max(0, t * 1000);
        if (isFinite(dur) && dur > 0) {
          // Allow fill: both beyond end by clamping to duration for freeze frame.
          ms = Math.min(ms, dur);
        }
        a.currentTime = ms;
      } catch (e) {
        // Ignore unseekable animations (e.g. scroll-driven).
      }
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

  window.__hf = window.__hf || {};
  window.__hf.seek = function (t) {
    var time = typeof t === 'number' && isFinite(t) ? t : 0;
    seekCssAnimations(time);
    seekMedia(time);
    return Promise.resolve();
  };
  // Initial freeze at t=0 so first capture is stable.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      window.__hf.seek(0);
    });
  } else {
    window.__hf.seek(0);
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
  const { styles, body } = extractDocumentParts(opts.html)
  const bg = opts.background ?? '#000000'

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
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
  const errors: string[] = []
  const warnings: string[] = []

  if (!html || !html.trim()) {
    errors.push('empty html')
    return { ok: false, errors, warnings }
  }

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

  return { ok: errors.length === 0, errors, warnings }
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
