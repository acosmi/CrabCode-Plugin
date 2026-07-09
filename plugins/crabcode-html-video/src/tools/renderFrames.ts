import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { renderMultiSegment } from '@crabcode/multi-segment'
import { ok, fail, type Envelope } from '../envelope.ts'
import { outputsDir, workDir } from '../paths.ts'

export const name = 'renderFrames'
export const description =
  'USER-GATED: Render multiple independent HTML frames via multi-segment orchestration (producer per segment → concat → optional audio). Do NOT call automatically — wait for explicit user confirmation (render is minutes-scale and CPU heavy).'

export const inputSchema = {
  type: 'object',
  properties: {
    segments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          html: { type: 'string' },
          durationSec: { type: 'number' },
        },
        required: ['id', 'html', 'durationSec'],
      },
    },
    width: { type: 'number' },
    height: { type: 'number' },
    fps: { type: 'number' },
    audioPath: { type: 'string', description: 'Optional local audio file to mux' },
    outputName: { type: 'string' },
    confirmed: {
      type: 'boolean',
      description: 'Must be true — explicit user confirmation gate',
    },
    producerUrl: {
      type: 'string',
      description: 'Override producer/worker URL (default env CRABCODE_HTML_VIDEO_PRODUCER_URL)',
    },
  },
  required: ['segments', 'confirmed'],
}

export async function handler(args: {
  segments?: Array<{ id: string; html: string; durationSec: number }>
  width?: number
  height?: number
  fps?: number
  audioPath?: string
  outputName?: string
  confirmed?: boolean
  producerUrl?: string
}): Promise<Envelope> {
  if (!args?.confirmed) {
    return fail(
      'confirmation_required',
      'renderFrames requires confirmed:true after explicit user approval. Rendering is CPU-heavy and may take minutes.',
    )
  }
  if (!args.segments?.length) return fail('invalid_args', 'segments required')

  const producerUrl =
    args.producerUrl ||
    process.env.CRABCODE_HTML_VIDEO_PRODUCER_URL ||
    process.env.PRODUCER_URL ||
    'http://127.0.0.1:7788'

  // Health check
  try {
    const { producerHealth } = await import('@crabcode/multi-segment')
    const healthy = await producerHealth(producerUrl, 3000)
    if (!healthy) {
      return fail(
        'producer_unavailable',
        `Producer/worker not reachable at ${producerUrl}. Start the worker or set CRABCODE_HTML_VIDEO_PRODUCER_URL. Run doctor first.`,
      )
    }
  } catch {
    // producerHealth may not be exported path — continue and let render fail clearly
  }

  const outputPath = join(outputsDir(), args.outputName || `video-${Date.now()}.mp4`)
  const total = args.segments.reduce((s, x) => s + (x.durationSec || 0), 0)
  if (total > 120) {
    return fail('duration_limit', `Total duration ${total}s exceeds 120s safety limit`)
  }

  try {
    const result = await renderMultiSegment({
      segments: args.segments,
      width: args.width || 1280,
      height: args.height || 720,
      fps: args.fps || 30,
      producerUrl,
      outputPath,
      audioPath: args.audioPath || null,
      workDir: join(workDir(), `render-${Date.now()}`),
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
    return fail('render_failed', e instanceof Error ? e.message : String(e))
  }
}
