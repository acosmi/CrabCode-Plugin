import { lintFrameHtml, wrapFrameAsComposition } from '@crabcode/seek-shim'
import { ok, fail, type Envelope } from '../envelope.ts'
import { lintFrameInputSchema, validationMessage } from '../contracts.ts'

export const name = 'lintFrame'
export const description =
  'Lint a single frame HTML for seekability (no rAF/setTimeout) and optionally preview the wrapped composition shell.'

export const inputSchema = lintFrameInputSchema
export const annotations = {
  title: 'Lint Video Frame',
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
}

export async function handler(raw: unknown): Promise<Envelope> {
  const parsed = inputSchema.safeParse(raw)
  if (!parsed.success) return fail('invalid_args', validationMessage(parsed.error))
  const args = parsed.data
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
