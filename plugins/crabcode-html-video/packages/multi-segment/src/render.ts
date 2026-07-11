import { constants, copyFileSync, linkSync, mkdirSync, writeFileSync, existsSync, rmSync, unlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

import { wrapFrameAsComposition, lintFrameHtml } from '@crabcode/seek-shim'
import { concatVideos, muxAudio, probeDurationSec } from './ffmpeg.ts'
import { renderViaProducerHttp } from './producerClient.ts'
import { renderHtmlWithProducer } from './hfRender.ts'
import { reserveOutputFile } from './safePath.ts'

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
  /** Explicit remote producer HTTP base URL. Omit for the default in-process producer. */
  producerUrl?: string
  /** Optional audio file to mux over the full timeline. */
  audioPath?: string | null
  /** Work directory for intermediate segments. */
  workDir?: string
  /** Keep intermediate segment mp4s. Default false. */
  keepIntermediates?: boolean
  /** Progress callback. */
  onProgress?: (event: { stage: string; index?: number; total?: number; message: string }) => void
  /** Auth headers for producer. */
  headers?: Record<string, string>
  /** Per-segment render timeout. Default 10min. */
  segmentTimeoutMs?: number
  /** Cancel producer and ffmpeg work. */
  signal?: AbortSignal
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
  validateInput(input)

  const fps = input.fps ?? 30
  const workDir = input.workDir ?? join(process.cwd(), '.crabcode-html-video-work', randomUUID())
  const segDir = join(workDir, 'segments')
  const wrappedDir = join(workDir, 'wrapped')
  mkdirSync(segDir, { recursive: true })
  mkdirSync(wrappedDir, { recursive: true })
  mkdirSync(resolve(input.outputPath, '..'), { recursive: true })
  const outputReservation = reserveOutputFile(input.outputPath)

  const progress = input.onProgress ?? (() => {})
  const segmentPaths: string[] = []

  try {
    for (let i = 0; i < input.segments.length; i++) {
      input.signal?.throwIfAborted()
      const seg = input.segments[i]!
      progress({
        stage: 'lint',
        index: i,
        total: input.segments.length,
        message: `Linting segment ${seg.id}`,
      })

      const lint = lintFrameHtml(seg.html)
      if (!lint.ok) {
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

      if (input.producerUrl) {
        await renderViaProducerHttp({
          baseUrl: input.producerUrl,
          // The remote worker owns validation + wrapping. Sending our wrapped
          // document would violate its untrusted-HTML contract and double-wrap.
          html: seg.html,
          outputPath: segOut,
          fps,
          id: seg.id,
          width: seg.width ?? input.width,
          height: seg.height ?? input.height,
          durationSec: seg.durationSec,
          timeoutMs: input.segmentTimeoutMs ?? 600_000,
          headers: input.headers,
          signal: input.signal,
        })
      } else {
        await renderHtmlWithProducer({
          html: wrapped.html,
          outputPath: segOut,
          fps,
          requireProducer: true,
          signal: input.signal,
        })
      }

      if (!existsSync(segOut)) {
        throw new Error(`segment render produced no file: ${segOut}`)
      }
      segmentPaths.push(segOut)
    }

    progress({ stage: 'concat', message: `Concatenating ${segmentPaths.length} segments` })
    const concatPath = join(workDir, 'concat.mp4')
    input.signal?.throwIfAborted()
    await concatVideos(segmentPaths, concatPath, { signal: input.signal })

    progress({ stage: 'mux', message: input.audioPath ? 'Muxing audio' : 'Finalizing (no audio)' })
    const finalTmp = join(workDir, 'final.mp4')
    await muxAudio(concatPath, input.audioPath ?? null, finalTmp, { signal: input.signal })

    publishWithoutOverwrite(finalTmp, input.outputPath)

    const { statSync } = await import('node:fs')
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
    outputReservation.release()
    if (!input.keepIntermediates) {
      try {
        rmSync(workDir, { recursive: true, force: true })
      } catch {
        // best-effort cleanup
      }
    }
  }
}

function publishWithoutOverwrite(source: string, destination: string): void {
  try {
    linkSync(source, destination)
    unlinkSync(source)
    return
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw error
  }
  copyFileSync(source, destination, constants.COPYFILE_EXCL)
  unlinkSync(source)
}

function pad(n: number): string {
  return String(n).padStart(3, '0')
}

function validateInput(input: MultiSegmentInput): void {
  if (!input.segments.length) throw new Error('renderMultiSegment: segments is empty')
  if (input.segments.length > 40) throw new Error('renderMultiSegment: maximum 40 segments')
  if (!Number.isInteger(input.width) || input.width < 64 || input.width > 3840) {
    throw new Error('renderMultiSegment: width must be an integer from 64 to 3840')
  }
  if (!Number.isInteger(input.height) || input.height < 64 || input.height > 2160) {
    throw new Error('renderMultiSegment: height must be an integer from 64 to 2160')
  }
  if (input.width % 2 !== 0 || input.height % 2 !== 0) {
    throw new Error('renderMultiSegment: width and height must be even for yuv420p output')
  }
  if (input.width * input.height > 8_294_400) throw new Error('renderMultiSegment: pixel limit exceeded')
  const fps = input.fps ?? 30
  if (!Number.isInteger(fps) || fps < 1 || fps > 60) throw new Error('renderMultiSegment: fps must be 1..60')

  let totalDuration = 0
  let totalHtmlBytes = 0
  let totalFrames = 0
  let pixelFrames = 0
  const ids = new Set<string>()
  for (const segment of input.segments) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(segment.id)) {
      throw new Error(`renderMultiSegment: unsafe segment id ${JSON.stringify(segment.id)}`)
    }
    if (ids.has(segment.id)) throw new Error(`renderMultiSegment: duplicate segment id ${segment.id}`)
    ids.add(segment.id)
    if (!Number.isFinite(segment.durationSec) || segment.durationSec < 0.1 || segment.durationSec > 30) {
      throw new Error(`renderMultiSegment: invalid duration for ${segment.id}`)
    }
    if (!segment.html || segment.html.length > 256 * 1024 || Buffer.byteLength(segment.html, 'utf8') > 256 * 1024) {
      throw new Error(`renderMultiSegment: invalid HTML size for ${segment.id}`)
    }
    const segmentWidth = segment.width ?? input.width
    const segmentHeight = segment.height ?? input.height
    if (
      !Number.isInteger(segmentWidth) ||
      !Number.isInteger(segmentHeight) ||
      segmentWidth < 64 ||
      segmentHeight < 64 ||
      segmentWidth > 3840 ||
      segmentHeight > 2160 ||
      segmentWidth % 2 !== 0 ||
      segmentHeight % 2 !== 0 ||
      segmentWidth * segmentHeight > 8_294_400
    ) {
      throw new Error(`renderMultiSegment: invalid dimensions for ${segment.id}`)
    }
    const frames = Math.ceil(segment.durationSec * fps)
    totalFrames += frames
    pixelFrames += segmentWidth * segmentHeight * frames
    totalDuration += segment.durationSec
    totalHtmlBytes += Buffer.byteLength(segment.html, 'utf8')
  }
  if (totalDuration > 120) throw new Error('renderMultiSegment: total duration exceeds 120s')
  if (totalHtmlBytes > 5_000_000) throw new Error('renderMultiSegment: total HTML exceeds 5MB')
  if (totalFrames > 7_200) throw new Error('renderMultiSegment: total frame count exceeds 7200')
  if (pixelFrames > 1920 * 1080 * 120 * 30) {
    throw new Error('renderMultiSegment: pixel-frame work exceeds safety limit')
  }
}
