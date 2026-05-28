import { z } from 'zod'
import { ok, actionRequired, err, type Envelope } from '../envelope.ts'
import { getPlatform, platformIds } from '../platforms/registry.ts'

export const name = 'mediaops.readiness.inspect'
export const description =
  'Validate a draft against a platform\'s structural limits (title length, cover, body length, image count) and the mandatory AI-assist disclosure label, returning any issues.'

/** Default mandatory AI-assist disclosure label (compliance D-10). */
export const DEFAULT_AI_LABEL = '本文由 AI 辅助创作'

export const inputSchema = {
  platform: z.string(),
  title: z.string(),
  body: z.string(),
  digest: z.string().optional(),
  coverPresent: z.boolean().optional(),
  imageCount: z.number().int().nonnegative().optional(),
  // Compliance (D-10): AI-assisted content must carry an explicit disclosure label.
  // Defaults to true because this plugin's content is agent-assisted by design.
  aiAssisted: z.boolean().optional(),
  aiLabelText: z.string().optional(),
}

type Args = {
  platform: string
  title: string
  body: string
  digest?: string
  coverPresent?: boolean
  imageCount?: number
  aiAssisted?: boolean
  aiLabelText?: string
}

type Issue = { code: string; severity: 'error' | 'warning'; message: string }

export async function handler(args: Args): Promise<Envelope> {
  const platform = getPlatform(args.platform)
  if (!platform) {
    return err('unknown_platform', `unknown platform '${args.platform}'. Known: ${platformIds().join(', ')}`)
  }

  const limits = platform.limits
  const issues: Issue[] = []

  const titleLen = [...args.title].length
  if (titleLen > limits.titleMax) {
    issues.push({
      code: 'title_too_long',
      severity: 'error',
      message: `title is ${titleLen} chars; ${platform.displayName} allows at most ${limits.titleMax}.`,
    })
  }

  if (args.digest !== undefined && limits.digestMax > 0) {
    const digestLen = [...args.digest].length
    if (digestLen > limits.digestMax) {
      issues.push({
        code: 'digest_too_long',
        severity: 'error',
        message: `digest is ${digestLen} chars; ${platform.displayName} allows at most ${limits.digestMax}.`,
      })
    }
  }

  const bodyLen = [...args.body].length
  if (bodyLen > limits.bodyMaxChars) {
    issues.push({
      code: 'body_too_long',
      severity: 'error',
      message: `body is ${bodyLen} chars; ${platform.displayName} allows at most ${limits.bodyMaxChars}.`,
    })
  }

  if (limits.coverRequired && args.coverPresent !== true) {
    issues.push({
      code: 'cover_missing',
      severity: 'error',
      message: `${platform.displayName} requires a cover image.`,
    })
  }

  if (args.imageCount !== undefined && args.imageCount > limits.imageMaxCount) {
    issues.push({
      code: 'too_many_images',
      severity: 'error',
      message: `${args.imageCount} images exceeds the ${platform.displayName} limit of ${limits.imageMaxCount}.`,
    })
  }

  // Compliance (D-10): AI-assisted content must carry an explicit, perceivable
  // disclosure label. This is a legal hard requirement — a publish package must
  // be refused when it is missing. Defaults to enforced (aiAssisted !== false).
  const aiAssisted = args.aiAssisted !== false
  if (aiAssisted) {
    const label = (args.aiLabelText ?? DEFAULT_AI_LABEL).trim()
    if (label.length === 0 || !args.body.includes(label)) {
      issues.push({
        code: 'ai_label_missing',
        severity: 'error',
        message: `AI-assist disclosure label "${label || DEFAULT_AI_LABEL}" is missing from the body. Compliance (D-10) requires an explicit AI-assist label before publishing; do not remove, fake, or hide it.`,
      })
    }
  }

  const data = {
    platform: platform.id,
    ready: issues.every((i) => i.severity !== 'error'),
    issues,
  }
  return data.ready ? ok(data) : actionRequired(data)
}
