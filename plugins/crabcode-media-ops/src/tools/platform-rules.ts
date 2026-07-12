import { z } from 'zod'
import { err, ok, type Envelope } from '../envelope.ts'
import { getPlatform, PLATFORMS } from '../platforms/registry.ts'

export const name = 'mediaops.platform.rules.get'
export const description = 'Return versioned platform rules with source, scope, rule type, verification date and staleness.'
export const inputSchema = {
  platform: z.enum(['wechat', 'xhs', 'toutiao']).optional(),
  now: z.string().datetime().optional(),
}

export async function handler(args: { platform?: string; now?: string }): Promise<Envelope> {
  const platforms = args.platform ? [getPlatform(args.platform)].filter(Boolean) : PLATFORMS
  if (!platforms.length) return err('UNKNOWN_PLATFORM', `Unknown platform ${args.platform}.`)
  const now = args.now ? new Date(args.now) : new Date()
  return ok({
    platforms: platforms.map((platform) => ({
      id: platform!.id,
      displayName: platform!.displayName,
      ruleVersion: platform!.ruleVersion,
      limits: platform!.limits,
      rules: platform!.rules.map((rule) => ({
        ...rule,
        stale: (now.getTime() - new Date(rule.verifiedAt).getTime()) / 86_400_000 > rule.maxAgeDays,
      })),
    })),
  })
}
