import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import {
  renderMultiSegment,
  resolveBrowserPath,
  resolveFfmpegPath,
  validateProducerBaseUrl,
} from '@crabcode/multi-segment'
import { ok, fail, type Envelope } from '../envelope.ts'
import { browsersDir, resolveAllowedAudioPath, safeOutputPath, workDir } from '../paths.ts'
import {
  renderFramesInputSchema,
  validateRenderCrossFields,
  validationMessage,
} from '../contracts.ts'
import { producerRequestHeaders } from '../producerAuth.ts'
import {
  boundedWallTimeoutMs,
  renderCancellation,
  type ToolContext,
} from '../cancellation.ts'
import { tryAcquireRenderSlot } from '../renderSlots.ts'

export const name = 'renderFrames'
export const description =
  'USER-GATED: Render multiple independent HTML frames via multi-segment orchestration (producer per segment → concat → optional audio). Do NOT call automatically — wait for explicit user confirmation (render is minutes-scale and CPU heavy).'

export const inputSchema = renderFramesInputSchema
export const annotations = {
  title: 'Render HTML Video',
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
}

export async function handler(raw: unknown, context: ToolContext = {}): Promise<Envelope> {
  const parsed = inputSchema.safeParse(raw)
  if (!parsed.success) return fail('invalid_args', validationMessage(parsed.error))
  const args = parsed.data

  if (!args.confirmed) {
    return fail(
      'confirmation_required',
      'renderFrames requires confirmed:true after explicit user approval. Rendering is CPU-heavy and may take minutes.',
    )
  }

  const crossFieldError = validateRenderCrossFields(args)
  if (crossFieldError) return fail('invalid_args', crossFieldError)

  let audioPath: string | null = null
  if (args.audioPath) {
    try {
      audioPath = resolveAllowedAudioPath(args.audioPath)
    } catch (error) {
      return fail('audio_path_rejected', error instanceof Error ? error.message : String(error))
    }
  }

  const outputPath = safeOutputPath(args.outputName)

  const remoteMode = process.env.CRABCODE_HTML_VIDEO_RENDER_MODE === 'remote'
  const producerHeaders = producerRequestHeaders()
  let producerUrl: string | undefined
  if (remoteMode) {
    const configured = process.env.CRABCODE_HTML_VIDEO_PRODUCER_URL
    if (!configured) return fail('producer_unavailable', 'remote mode requires CRABCODE_HTML_VIDEO_PRODUCER_URL')
    try {
      producerUrl = validateProducerBaseUrl(configured)
    } catch (error) {
      return fail('producer_url_rejected', error instanceof Error ? error.message : String(error))
    }
    const { probeProducer } = await import('@crabcode/multi-segment')
    if (!(await probeProducer(producerUrl, 3000, producerHeaders)).ok) {
      return fail('producer_unavailable', 'configured remote producer failed readiness/authentication checks')
    }
  } else {
    const browser = resolveBrowserPath(browsersDir())
    if (!browser.path) return fail('browser_unavailable', 'local render requires a browser; run doctor first')
    process.env.HYPERFRAMES_BROWSER_PATH = browser.path
    process.env.PRODUCER_HEADLESS_SHELL_PATH = browser.path
    process.env.HYPERFRAMES_FFMPEG_PATH = resolveFfmpegPath()
  }

  const releaseSlot = tryAcquireRenderSlot()
  if (!releaseSlot) return fail('render_busy', 'render capacity is busy; retry after the active render completes')
  const cancellation = renderCancellation(
    context.signal,
    boundedWallTimeoutMs('CRABCODE_HTML_VIDEO_WALL_TIMEOUT_MS', 270_000),
  )
  try {
    const result = await renderMultiSegment({
      segments: args.segments,
      width: args.width || 1280,
      height: args.height || 720,
      fps: args.fps || 30,
      producerUrl,
      headers: producerHeaders,
      signal: cancellation.signal,
      outputPath,
      audioPath,
      workDir: join(workDir(), `render-${randomUUID()}`),
      keepIntermediates: false,
      onProgress: (e) => process.stderr.write(`[renderFrames] ${e.stage}: ${e.message}\n`),
    })

    if (!existsSync(result.outputPath)) {
      return fail('render_failed', 'render completed but output missing')
    }

    return ok({
      outputPath: result.outputPath,
      durationSec: result.durationSec,
      fileSize: result.fileSize,
      segmentCount: result.segmentCount,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (/output path (?:already exists|is already reserved)/.test(message)) {
      return fail('output_exists', 'refusing to overwrite or concurrently render the same output')
    }
    return fail('render_failed', message)
  } finally {
    cancellation.dispose()
    releaseSlot()
  }
}
