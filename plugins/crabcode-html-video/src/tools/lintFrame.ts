import { lintFrameHtml, wrapFrameAsComposition } from '@crabcode/seek-shim'
import { ok, fail, type Envelope } from '../envelope.ts'

export const name = 'lintFrame'
export const description =
  'Lint a single frame HTML for seekability (no rAF/setTimeout) and optionally preview the wrapped composition shell.'

export const inputSchema = {
  type: 'object',
  properties: {
    html: { type: 'string', description: 'Plain or full HTML for one frame' },
    id: { type: 'string' },
    width: { type: 'number' },
    height: { type: 'number' },
    durationSec: { type: 'number' },
    wrap: { type: 'boolean', description: 'If true, return wrapped composition HTML' },
  },
  required: ['html'],
}

export async function handler(args: {
  html?: string
  id?: string
  width?: number
  height?: number
  durationSec?: number
  wrap?: boolean
}): Promise<Envelope> {
  if (!args?.html) return fail('invalid_args', 'html is required')
  const lint = lintFrameHtml(args.html)
  if (!lint.ok) {
    return fail('lint_failed', lint.errors.join('; '), lint)
  }
  let wrapped: string | undefined
  if (args.wrap) {
    wrapped = wrapFrameAsComposition({
      id: args.id || 'frame',
      width: args.width || 1280,
      height: args.height || 720,
      durationSec: args.durationSec || 3,
      html: args.html,
    }).html
  }
  return ok({ lint, wrappedHtml: wrapped })
}
