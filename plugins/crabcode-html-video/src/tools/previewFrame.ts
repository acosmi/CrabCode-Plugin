import { writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { wrapFrameAsComposition, lintFrameHtml } from '@crabcode/seek-shim'
import { ok, fail, type Envelope } from '../envelope.ts'
import { outputsDir, workDir } from '../paths.ts'

export const name = 'previewFrame'
export const description =
  'Wrap a frame HTML into seekable composition and write it to disk for agent self-check. Optionally call producer single-frame render if producer URL is set.'

export const inputSchema = {
  type: 'object',
  properties: {
    html: { type: 'string' },
    id: { type: 'string' },
    width: { type: 'number' },
    height: { type: 'number' },
    durationSec: { type: 'number' },
    render: {
      type: 'boolean',
      description: 'If true and producer URL available, also render a short mp4 preview',
    },
  },
  required: ['html'],
}

export async function handler(args: {
  html?: string
  id?: string
  width?: number
  height?: number
  durationSec?: number
  render?: boolean
}): Promise<Envelope> {
  if (!args?.html) return fail('invalid_args', 'html is required')
  const lint = lintFrameHtml(args.html)
  if (!lint.ok) return fail('lint_failed', lint.errors.join('; '), lint)

  const id = args.id || `preview-${Date.now()}`
  const wrapped = wrapFrameAsComposition({
    id,
    width: args.width || 1280,
    height: args.height || 720,
    durationSec: args.durationSec || 2,
    html: args.html,
  })

  const htmlPath = join(workDir(), `${id}.html`)
  writeFileSync(htmlPath, wrapped.html, 'utf-8')

  let mp4Path: string | undefined
  const producerUrl = process.env.CRABCODE_HTML_VIDEO_PRODUCER_URL || process.env.PRODUCER_URL
  if (args.render && producerUrl) {
    const { renderViaProducerHttp } = await import('@crabcode/multi-segment')
    mp4Path = join(outputsDir(), `${id}.mp4`)
    await renderViaProducerHttp({
      baseUrl: producerUrl,
      html: wrapped.html,
      outputPath: mp4Path,
      fps: 30,
      timeoutMs: 300_000,
    })
    if (!existsSync(mp4Path)) mp4Path = undefined
  }

  return ok({
    htmlPath,
    mp4Path: mp4Path || null,
    compositionId: wrapped.compositionId,
    lint,
  })
}
