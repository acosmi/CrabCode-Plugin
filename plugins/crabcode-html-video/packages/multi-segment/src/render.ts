import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

import { wrapFrameAsComposition, lintFrameHtml } from '@crabcode/seek-shim'
import { concatVideos, muxAudio, probeDurationSec } from './ffmpeg.ts'
import { renderViaProducerHttp } from './producerClient.ts'

export interface SegmentInput {
  /** Stable id (content-graph node id). */
  id: string
  /** Plain or full HTML for this frame. */
  html: string
  /** Duration in seconds. */
  durationSec: number
  /** Optional per-segment width/height overrides. */
  width?: number
  height?: number
}

export interface MultiSegmentInput {
  segments: SegmentInput[]
  /** Output mp4 path. */
  outputPath: string
  width: number
  height: number
  fps?: number
  /** Producer HTTP base URL. Required for remote/local producer render. */
  producerUrl: string
  /** Optional audio file to mux over the full timeline. */
  audioPath?: string | null
  /** Work directory for intermediate segments. */
  workDir?: string
  /** Keep intermediate segment mp4s. Default false. */
  keepIntermediates?: boolean
  /** Skip lint errors (not recommended). Default false. */
  force?: boolean
  /** Progress callback. */
  onProgress?: (event: { stage: string; index?: number; total?: number; message: string }) => void
  /** Auth headers for producer. */
  headers?: Record<string, string>
  /** Per-segment render timeout. Default 10min. */
  segmentTimeoutMs?: number
}

export interface MultiSegmentResult {
  outputPath: string
  durationSec: number
  segmentPaths: string[]
  segmentCount: number
  fileSize: number
}

/**
 * Render multiple independent HTML frames → concat → optional audio mux.
 */
export async function renderMultiSegment(input: MultiSegmentInput): Promise<MultiSegmentResult> {
  if (!input.segments.length) throw new Error('renderMultiSegment: segments is empty')

  const fps = input.fps ?? 30
  const workDir = input.workDir ?? join(process.cwd(), '.crabcode-html-video-work', randomUUID())
  const segDir = join(workDir, 'segments')
  const wrappedDir = join(workDir, 'wrapped')
  mkdirSync(segDir, { recursive: true })
  mkdirSync(wrappedDir, { recursive: true })
  mkdirSync(resolve(input.outputPath, '..'), { recursive: true })

  const progress = input.onProgress ?? (() => {})
  const segmentPaths: string[] = []

  try {
    for (let i = 0; i < input.segments.length; i++) {
      const seg = input.segments[i]!
      progress({
        stage: 'lint',
        index: i,
        total: input.segments.length,
        message: `Linting segment ${seg.id}`,
      })

      const lint = lintFrameHtml(seg.html)
      if (!lint.ok && !input.force) {
        throw new Error(`segment ${seg.id} lint failed: ${lint.errors.join('; ')}`)
      }
      for (const w of lint.warnings) {
        progress({ stage: 'lint', index: i, message: `warn ${seg.id}: ${w}` })
      }

      const wrapped = wrapFrameAsComposition({
        id: seg.id,
        width: seg.width ?? input.width,
        height: seg.height ?? input.height,
        durationSec: seg.durationSec,
        fps,
        html: seg.html,
      })

      const wrappedPath = join(wrappedDir, `${pad(i)}-${seg.id}.html`)
      writeFileSync(wrappedPath, wrapped.html, 'utf-8')

      const segOut = join(segDir, `${pad(i)}-${seg.id}.mp4`)
      progress({
        stage: 'render',
        index: i,
        total: input.segments.length,
        message: `Rendering segment ${seg.id} via producer`,
      })

      await renderViaProducerHttp({
        baseUrl: input.producerUrl,
        html: wrapped.html,
        outputPath: segOut,
        fps,
        timeoutMs: input.segmentTimeoutMs ?? 600_000,
        headers: input.headers,
      })

      if (!existsSync(segOut)) {
        throw new Error(`segment render produced no file: ${segOut}`)
      }
      segmentPaths.push(segOut)
    }

    progress({ stage: 'concat', message: `Concatenating ${segmentPaths.length} segments` })
    const concatPath = join(workDir, 'concat.mp4')
    await concatVideos(segmentPaths, concatPath)

    progress({ stage: 'mux', message: input.audioPath ? 'Muxing audio' : 'Finalizing (no audio)' })
    const finalTmp = join(workDir, 'final.mp4')
    await muxAudio(concatPath, input.audioPath ?? null, finalTmp)

    // Move to destination
    const { copyFileSync, renameSync, statSync } = await import('node:fs')
    try {
      renameSync(finalTmp, input.outputPath)
    } catch {
      copyFileSync(finalTmp, input.outputPath)
    }

    const durationSec = await probeDurationSec(input.outputPath)
    const fileSize = statSync(input.outputPath).size

    progress({ stage: 'done', message: `Wrote ${input.outputPath} (${durationSec.toFixed(2)}s, ${fileSize} bytes)` })

    return {
      outputPath: input.outputPath,
      durationSec,
      segmentPaths: input.keepIntermediates ? segmentPaths : [],
      segmentCount: input.segments.length,
      fileSize,
    }
  } finally {
    if (!input.keepIntermediates) {
      try {
        rmSync(workDir, { recursive: true, force: true })
      } catch {
        // best-effort cleanup
      }
    }
  }
}

function pad(n: number): string {
  return String(n).padStart(3, '0')
}
