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
  log?: (msg: string) => void
}

export interface HfRenderResult {
  outputPath: string
  fileSize: number
  engine: RenderEngine
  durationSec?: number
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

  try {
    const producer = await import('@hyperframes/producer')
    const { createRenderJob, executeRenderJob } = producer as {
      createRenderJob: (c: { fps: number; quality: string }) => { id: string; status: string }
      executeRenderJob: (
        job: unknown,
        projectDir: string,
        outputPath: string,
        onProgress?: (j: unknown, msg?: string) => void | Promise<void>,
      ) => Promise<void>
    }

    if (typeof createRenderJob !== 'function' || typeof executeRenderJob !== 'function') {
      throw new Error('@hyperframes/producer missing createRenderJob/executeRenderJob')
    }

    const projectDir = mkdtempSync(join(tmpdir(), 'crab-hf-project-'))
    try {
      writeFileSync(join(projectDir, 'index.html'), opts.html, 'utf-8')
      const job = createRenderJob({ fps, quality })
      log(`executeRenderJob start job=${(job as { id?: string }).id} fps=${fps} quality=${quality}`)
      await executeRenderJob(job, projectDir, opts.outputPath, (_j, message) => {
        if (message) log(`progress: ${message}`)
      })
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
