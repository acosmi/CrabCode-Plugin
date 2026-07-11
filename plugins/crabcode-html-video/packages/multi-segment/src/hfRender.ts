/**
 * In-process hyperframes producer render (correct API):
 *   write projectDir/index.html → createRenderJob → executeRenderJob
 *
 * Never call createRenderJob alone and expect a file — it only builds job metadata.
 */

import { mkdtempSync, writeFileSync, existsSync, rmSync, statSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { dirname } from 'node:path'
import { seekRuntimeScript } from '@crabcode/seek-shim'
import { parseHTML } from 'linkedom'

export type RenderEngine = 'hyperframes-producer' | 'solid-fallback'

export interface HfRenderOptions {
  html: string
  outputPath: string
  fps?: number
  quality?: 'draft' | 'standard' | 'high'
  /** If true, throw when producer unavailable instead of falling back. Default true for production safety. */
  requireProducer?: boolean
  /** Explicit allow solid fallback (dev/CI without browser only). */
  allowSolidFallback?: boolean
  /** Abort an in-flight producer job (propagated from the MCP request). */
  signal?: AbortSignal
  log?: (msg: string) => void
}

export interface HfRenderResult {
  outputPath: string
  fileSize: number
  engine: RenderEngine
  durationSec?: number
}

export interface PreparedProducerDocument {
  html: string
  stylesheet: string
  stylesheetName: string
}

const PRODUCER_STYLESHEET = 'crab-author-styles.css'
let producerModulePromise: Promise<typeof import('@hyperframes/producer')> | undefined

async function loadEmbeddedProducer(): Promise<typeof import('@hyperframes/producer')> {
  if (producerModulePromise) return producerModulePromise
  producerModulePromise = (async () => {
    // Hyperframes 0.7.46 mistakes an embedding entry named src/server.ts for
    // its own CLI. Hide that name during module evaluation to prevent an
    // unintended unauthenticated listener from opening on :9847.
    const entry = process.argv[1]
    if (entry) process.argv[1] = `${entry}.embedded`
    try {
      return await import('@hyperframes/producer')
    } finally {
      if (entry) process.argv[1] = entry
    }
  })()
  return producerModulePromise
}

/**
 * Hyperframes 0.7.46's Bun timing compiler can restore inert inline blocks as
 * HFMASK placeholders. Externalize trusted CSS and remove the trusted shim;
 * Hyperframes' virtual-time bridge drives the CSS timeline during capture.
 */
export function prepareProducerDocument(html: string): PreparedProducerDocument {
  const document = parseHTML(html).document
  if (document.documentElement?.localName.toLowerCase() !== 'html' || !document.head) {
    throw new Error('producer composition must be a complete HTML document')
  }

  const styles = Array.from(document.querySelectorAll('style'))
  const stylesheet = styles.map((style) => style.textContent ?? '').join('\n\n')
  for (const style of styles) style.remove()

  const trustedDocument = parseHTML(seekRuntimeScript()).document
  const trustedSeekText = trustedDocument.querySelector('script')?.textContent
  if (!trustedSeekText) throw new Error('trusted seek runtime is malformed')
  for (const script of document.querySelectorAll('script')) {
    if (script.textContent !== trustedSeekText || script.attributes.length !== 0) {
      throw new Error('author <script> is not allowed in the isolated render contract')
    }
    script.remove()
  }

  removeCommentNodes(document)
  const csp = document.querySelector('meta[http-equiv="Content-Security-Policy" i]')
  if (!csp) throw new Error('producer composition must contain the trusted CSP')
  const content = csp.getAttribute('content') ?? ''
  const preparedCsp = content.replace(/style-src\s+([^;]*);/i, (_full, sources: string) => {
    const normalized = /(?:^|\s)'self'(?:\s|$)/.test(sources)
      ? sources.trim()
      : `'self' ${sources.trim()}`
    return `style-src ${normalized};`
  })
  if (preparedCsp === content && !/style-src\s+/i.test(content)) {
    throw new Error('producer composition CSP must contain style-src')
  }
  csp.setAttribute('content', preparedCsp)

  const link = document.createElement('link')
  link.setAttribute('rel', 'stylesheet')
  link.setAttribute('href', `./${PRODUCER_STYLESHEET}`)
  document.head.appendChild(link)
  return { html: document.toString(), stylesheet, stylesheetName: PRODUCER_STYLESHEET }
}

function removeCommentNodes(node: { childNodes: ArrayLike<Node> }): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === 8) child.parentNode?.removeChild(child)
    else if (child.childNodes.length > 0) removeCommentNodes(child)
  }
}

/**
 * Detect whether HTML is already a crab/hyperframes composition shell.
 */
export function isAlreadyWrappedComposition(html: string): boolean {
  return (
    /data-composition-id\s*=/.test(html) &&
    (/window\.__hf\b/.test(html) || /data-no-timeline\s*=/.test(html) || /id=["']__crab_root["']/.test(html))
  )
}

export async function renderHtmlWithProducer(opts: HfRenderOptions): Promise<HfRenderResult> {
  const log = opts.log ?? ((m: string) => process.stderr.write(`[hfRender] ${m}\n`))
  const requireProducer = opts.requireProducer !== false && !opts.allowSolidFallback
  const fps = opts.fps ?? 30
  const quality = opts.quality ?? 'standard'

  mkdirSync(dirname(opts.outputPath), { recursive: true })
  opts.signal?.throwIfAborted()

  try {
    const producer = await loadEmbeddedProducer()
    const { createRenderJob, executeRenderJob } = producer as {
      createRenderJob: (c: { fps: number; quality: string }) => { id: string; status: string }
      executeRenderJob: (
        job: unknown,
        projectDir: string,
        outputPath: string,
        onProgress?: (j: unknown, msg?: string) => void | Promise<void>,
        abortSignal?: AbortSignal,
      ) => Promise<void>
    }

    if (typeof createRenderJob !== 'function' || typeof executeRenderJob !== 'function') {
      throw new Error('@hyperframes/producer missing createRenderJob/executeRenderJob')
    }

    const projectDir = mkdtempSync(join(tmpdir(), 'crab-hf-project-'))
    try {
      const prepared = prepareProducerDocument(opts.html)
      writeFileSync(join(projectDir, 'index.html'), prepared.html, 'utf-8')
      writeFileSync(join(projectDir, prepared.stylesheetName), prepared.stylesheet, 'utf-8')
      const job = createRenderJob({ fps, quality })
      log(`executeRenderJob start job=${(job as { id?: string }).id} fps=${fps} quality=${quality}`)
      await executeRenderJob(job, projectDir, opts.outputPath, (_j, message) => {
        if (message) log(`progress: ${message}`)
      }, opts.signal)
    } finally {
      try {
        rmSync(projectDir, { recursive: true, force: true })
      } catch {
        /* ignore */
      }
    }

    if (!existsSync(opts.outputPath)) {
      throw new Error(`executeRenderJob completed but output missing: ${opts.outputPath}`)
    }
    const st = statSync(opts.outputPath)
    if (st.size < 500) {
      throw new Error(`output suspiciously small (${st.size} bytes): ${opts.outputPath}`)
    }
    log(`producer ok size=${st.size}`)
    return { outputPath: opts.outputPath, fileSize: st.size, engine: 'hyperframes-producer' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    log(`producer failed: ${msg}`)
    rmSync(opts.outputPath, { force: true })
    if (requireProducer || !opts.allowSolidFallback) {
      throw new Error(`hyperframes producer render failed: ${msg}`)
    }
    log('ALLOW_SOLID_FALLBACK=1 — using solid placeholder (NOT seek-and-capture)')
    return renderSolidFallback(opts)
  }
}

async function renderSolidFallback(opts: HfRenderOptions): Promise<HfRenderResult> {
  const { runFfmpeg } = await import('./ffmpeg.ts')
  const durationSec = 2
  const width = 640
  const height = 360
  // Fixed label only — never interpolate untrusted HTML into drawtext (injection surface).
  const r = await runFfmpeg(
    [
      '-y',
      '-f',
      'lavfi',
      '-i',
      `color=c=0x0f172a:s=${width}x${height}:d=${durationSec}:r=${opts.fps ?? 30}`,
      '-vf',
      "drawtext=text='FALLBACK':fontsize=36:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2",
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      opts.outputPath,
    ],
    { timeoutMs: 120_000 },
  )
  if (r.code !== 0) throw new Error(`solid fallback failed: ${r.stderr}`)
  const st = statSync(opts.outputPath)
  return {
    outputPath: opts.outputPath,
    fileSize: st.size,
    engine: 'solid-fallback',
    durationSec,
  }
}
