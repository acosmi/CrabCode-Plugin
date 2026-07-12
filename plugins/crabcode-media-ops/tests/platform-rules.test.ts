import { describe, expect, test } from 'bun:test'
import { handler } from '../src/tools/platform-rules.ts'

describe('platform rule provenance', () => {
  test('returns source, verification time, rule type and staleness', async () => {
    const env = await handler({ platform: 'wechat', now: '2026-07-12T12:00:00.000Z' })
    const platform = (env.data as any).platforms[0]
    expect(platform.ruleVersion).toBe('wechat-2026-07-12')
    expect(platform.rules.every((rule: any) => rule.sourceUrl && rule.verifiedAt && rule.ruleType && rule.stale === false)).toBe(true)
  })
})
