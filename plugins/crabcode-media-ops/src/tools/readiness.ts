import { z } from 'zod'
import { ok, actionRequired, err, type Envelope } from '../envelope.ts'
import { getPlatform, platformIds } from '../platforms/registry.ts'
import { loadProfile } from './profiles.ts'

export const name = 'mediaops.readiness.inspect'
export const description =
  'Validate a draft against a platform\'s structural limits (title length, cover, body length, image count), banned words, fact-check claim resolution, and the mandatory AI-assist disclosure label, returning any issues.'

/** Default mandatory AI-assist disclosure label (compliance D-10). */
export const DEFAULT_AI_LABEL = '本文由 AI 辅助创作'

/** Fact-check verdicts are produced by the model (fact-checker agent); this tool
 *  only enforces the deterministic state "no unresolved claim without an explicit
 *  human waiver" — it never judges truth itself. */
const claimSchema = z.object({
  claim: z.string().min(1).describe('The checkable statement, as annotated by the fact-checker.'),
  status: z.enum(['verified', 'doubtful', 'unsourced']),
  sourceUrl: z.string().optional().describe('Required when status is verified.'),
})

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
  // Brand profile integration: when brandId is given, the stored profile supplies
  // banned words and the default AI label text (compliance.ai_label_text).
  brandId: z.string().optional(),
  bannedWords: z.array(z.string()).optional().describe('Words that must not appear in title/digest/body; merged with the brand profile\'s banned_words when brandId is set.'),
  claims: z.array(claimSchema).optional().describe('Fact-check annotations from the review step.'),
  claimWaiver: z
    .object({
      waived: z.boolean(),
      by: z.string().min(1).describe('Human who explicitly accepted the unresolved claims.'),
      reason: z.string().optional(),
    })
    .optional()
    .describe('Explicit human sign-off allowing unresolved (doubtful/unsourced) claims through.'),
}

type Claim = z.infer<typeof claimSchema>

type Args = {
  platform: string
  title: string
  body: string
  digest?: string
  coverPresent?: boolean
  imageCount?: number
  aiAssisted?: boolean
  aiLabelText?: string
  brandId?: string
  bannedWords?: string[]
  claims?: Claim[]
  claimWaiver?: { waived: boolean; by: string; reason?: string }
}

type Issue = { code: string; severity: 'error' | 'warning'; message: string }

export async function handler(args: Args): Promise<Envelope> {
  const platform = getPlatform(args.platform)
  if (!platform) {
    return err('unknown_platform', `unknown platform '${args.platform}'. Known: ${platformIds().join(', ')}`)
  }

  // Resolve the brand profile up front so banned words and the compliance AI
  // label come from one governed place instead of ad-hoc parameters.
  let profileBannedWords: string[] = []
  let profileAiLabel: string | undefined
  if (args.brandId) {
    const profile = await loadProfile(args.brandId)
    if (!profile) {
      return err('profile_not_found', `no valid profile for brand '${args.brandId}'; save one via mediaops.profile.save or omit brandId.`)
    }
    profileBannedWords = profile.banned_words
    profileAiLabel = profile.compliance.ai_label_text
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

  // Banned words: deterministic substring scan over title/digest/body against
  // the explicit list merged with the brand profile's banned_words.
  const bannedWords = [...new Set([...(args.bannedWords ?? []), ...profileBannedWords])].filter((w) => w.trim())
  const scanned = `${args.title}\n${args.digest ?? ''}\n${args.body}`
  const foundBanned = bannedWords.filter((w) => scanned.includes(w))
  if (foundBanned.length > 0) {
    issues.push({
      code: 'banned_word_present',
      severity: 'error',
      message: `banned word(s) present: ${foundBanned.join('、')}. Remove or rephrase before publishing.`,
    })
  }

  // Claim resolution gate (fact-check integration): the fact-checker agent
  // annotates claims; here we enforce only deterministic facts about that
  // annotation — verified claims must carry a source, and unresolved claims
  // (doubtful/unsourced) block readiness unless a named human explicitly waives.
  const claims = args.claims ?? []
  const verifiedWithoutSource = claims.filter((c) => c.status === 'verified' && !(c.sourceUrl && c.sourceUrl.trim()))
  if (verifiedWithoutSource.length > 0) {
    issues.push({
      code: 'verified_claim_missing_source',
      severity: 'error',
      message: `${verifiedWithoutSource.length} claim(s) marked verified but missing sourceUrl: ${verifiedWithoutSource
        .map((c) => `"${c.claim}"`)
        .join('; ')}`,
    })
  }
  const unresolved = claims.filter((c) => c.status === 'doubtful' || c.status === 'unsourced')
  if (unresolved.length > 0) {
    const waiver = args.claimWaiver
    if (waiver?.waived && waiver.by.trim()) {
      issues.push({
        code: 'unresolved_claims_waived',
        severity: 'warning',
        message: `${unresolved.length} unresolved claim(s) explicitly waived by ${waiver.by}${waiver.reason ? ` (${waiver.reason})` : ''}. Recorded for audit.`,
      })
    } else {
      issues.push({
        code: 'unresolved_claims',
        severity: 'error',
        message: `${unresolved.length} claim(s) still doubtful/unsourced: ${unresolved
          .map((c) => `"${c.claim}" [${c.status}]`)
          .join('; ')}. Fix them or record an explicit human waiver (claimWaiver.by).`,
      })
    }
  }

  // Compliance (D-10): AI-assisted content must carry an explicit, perceivable
  // disclosure label. This is a legal hard requirement — a publish package must
  // be refused when it is missing. Defaults to enforced (aiAssisted !== false).
  const aiAssisted = args.aiAssisted !== false
  if (aiAssisted) {
    const label = (args.aiLabelText ?? profileAiLabel ?? DEFAULT_AI_LABEL).trim()
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
