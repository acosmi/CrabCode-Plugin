import { writeFileSync, existsSync, rmSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { wrapFrameAsComposition, lintFrameHtml } from '@crabcode/seek-shim'
import { ok, fail, type Envelope } from '../envelope.ts'
import { browsersDir, safeOutputPath, safeWorkFile } from '../paths.ts'
import { previewFrameInputSchema, validationMessage } from '../contracts.ts'
import {
  resolveBrowserPath,
  resolveFfmpegPath,
  probeProducer,
  reserveOutputFile,
  validateProducerBaseUrl,
} from '@crabcode/multi-segment'
import { producerRequestHeaders } from '../producerAuth.ts'
import {
  boundedWallTimeoutMs,
  renderCancellation,
  type ToolContext,
} from '../cancellation.ts'
import { tryAcquireRenderSlot } from '../renderSlots.ts'

export const name = 'previewFrame'
export const description =
  'Wrap a frame HTML into a seekable composition and write it to plugin data for self-check. Optional bounded MP4 rendering is separately user-gated.'

export const inputSchema = previewFrameInputSchema
export const annotations = {
  title: 'Create Video Frame Preview',
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
}

export async function handler(raw: unknown, context: ToolContext = {}): Promise<Envelope> {
  const parsed = inputSchema.safeParse(raw)
  if (!parsed.success) return fail('invalid_args', validationMessage(parsed.error))
  const args = parsed.data
  if (args.render && !args.confirmed) {
    return fail('confirmation_required', 'rendered preview requires confirmed:true after explicit user approval')
  }
  const lint = lintFrameHtml(args.html)
  if (!lint.ok) return fail('lint_failed', lint.errors.join('; '), lint)

  const id = args.id || `preview-${randomUUID()}`
  const width = args.width || 1280
  const height = args.height || 720
  const durationSec = args.durationSec || 2
  const wrapped = wrapFrameAsComposition({
    id,
    width,
    height,
    durationSec,
    html: args.html,
  })

  const htmlPath = safeWorkFile(id, 'html')
  if (existsSync(htmlPath)) return fail('output_exists', 'refusing to overwrite an existing preview HTML')

  let mp4Path: string | undefined
  if (args.render) {
    mp4Path = safeOutputPath(`${id}.mp4`)
    const remoteMode = process.env.CRABCODE_HTML_VIDEO_RENDER_MODE === 'remote'
    const producerHeaders = producerRequestHeaders()
    let producerUrl: string | undefined
    let browserPath: string | undefined
    if (remoteMode) {
      const configured = process.env.CRABCODE_HTML_VIDEO_PRODUCER_URL
      if (!configured) return fail('producer_unavailable', 'remote mode requires CRABCODE_HTML_VIDEO_PRODUCER_URL')
      try {
        producerUrl = validateProducerBaseUrl(configured)
      } catch (error) {
        return fail('producer_url_rejected', error instanceof Error ? error.message : String(error))
      }
      if (!(await probeProducer(producerUrl, 3000, producerHeaders)).ok) {
        return fail('producer_unavailable', 'configured remote producer failed readiness/authentication checks')
      }
    } else {
      const browser = resolveBrowserPath(browsersDir())
      if (!browser.path) return fail('browser_unavailable', 'local preview requires a browser; run doctor first')
      browserPath = browser.path
    }

    let reservation: ReturnType<typeof reserveOutputFile>
    try {
      reservation = reserveOutputFile(mp4Path)
    } catch (error) {
      return fail('output_exists', error instanceof Error ? error.message : String(error))
    }
    const releaseSlot = tryAcquireRenderSlot()
    if (!releaseSlot) {
      reservation.release()
      return fail('render_busy', 'render capacity is busy; retry after the active render completes')
    }
    const cancellation = renderCancellation(
      context.signal,
      boundedWallTimeoutMs('CRABCODE_HTML_VIDEO_PREVIEW_TIMEOUT_MS', 120_000),
    )
    let htmlWritten = false
    try {
      writeFileSync(htmlPath, wrapped.html, { encoding: 'utf-8', flag: 'wx', mode: 0o600 })
      htmlWritten = true
      if (remoteMode) {
        const { renderViaProducerHttp } = await import('@crabcode/multi-segment')
        await renderViaProducerHttp({
          baseUrl: producerUrl!,
          html: args.html,
          outputPath: mp4Path,
          fps: 30,
          id,
          width,
          height,
          durationSec,
          timeoutMs: 300_000,
          headers: producerHeaders,
          signal: cancellation.signal,
        })
      } else {
        process.env.HYPERFRAMES_BROWSER_PATH = browserPath!
        process.env.PRODUCER_HEADLESS_SHELL_PATH = browserPath!
        process.env.HYPERFRAMES_FFMPEG_PATH = resolveFfmpegPath()
        const { renderHtmlWithProducer } = await import('@crabcode/multi-segment')
        await renderHtmlWithProducer({
          html: wrapped.html,
          outputPath: mp4Path,
          fps: 30,
          requireProducer: true,
          signal: cancellation.signal,
        })
      }
    } catch (error) {
      if (htmlWritten) rmSync(htmlPath, { force: true })
      rmSync(mp4Path, { force: true })
      return fail('preview_render_failed', error instanceof Error ? error.message : String(error))
    } finally {
      cancellation.dispose()
      releaseSlot()
      reservation.release()
    }
    if (!existsSync(mp4Path)) mp4Path = undefined
  } else {
    writeFileSync(htmlPath, wrapped.html, { encoding: 'utf-8', flag: 'wx', mode: 0o600 })
  }

  return ok({
    htmlPath,
    mp4Path: mp4Path || null,
    compositionId: wrapped.compositionId,
    lint,
  })
}
