import { test, expect, describe } from 'bun:test'
import { handler } from '../src/tools/readiness.ts'

describe('readiness rules', () => {
  test('flags wechat title over 32 chars', async () => {
    const env = await handler({
      platform: 'wechat',
      title: 'x'.repeat(40),
      body: 'short body',
      coverPresent: true,
    })
    const data = env.data as { ready: boolean; issues: { code: string }[] }
    expect(data.ready).toBe(false)
    expect(data.issues.some((i) => i.code === 'title_too_long')).toBe(true)
    expect(env.status).toBe('action_required')
  })

  test('flags missing cover when required', async () => {
    const env = await handler({
      platform: 'wechat',
      title: 'ok title',
      body: 'body',
      coverPresent: false,
    })
    const data = env.data as { issues: { code: string }[] }
    expect(data.issues.some((i) => i.code === 'cover_missing')).toBe(true)
  })

  test('passes a compliant wechat draft (with AI label)', async () => {
    const env = await handler({
      platform: 'wechat',
      title: 'a fine title',
      body: 'body text\n\n本文由 AI 辅助创作',
      coverPresent: true,
      imageCount: 3,
    })
    const data = env.data as { ready: boolean; issues: unknown[] }
    expect(data.ready).toBe(true)
    expect(data.issues).toHaveLength(0)
    expect(env.status).toBe('ok')
  })

  test('flags missing AI-assist disclosure label (compliance D-10)', async () => {
    const env = await handler({
      platform: 'wechat',
      title: 'a fine title',
      body: 'body text without any label',
      coverPresent: true,
    })
    const data = env.data as { ready: boolean; issues: { code: string }[] }
    expect(data.ready).toBe(false)
    expect(data.issues.some((i) => i.code === 'ai_label_missing')).toBe(true)
  })

  test('honors a custom AI label and passes when present', async () => {
    const env = await handler({
      platform: 'wechat',
      title: 'a fine title',
      body: 'body\n\nGenerated with AI assistance',
      coverPresent: true,
      aiLabelText: 'Generated with AI assistance',
    })
    const data = env.data as { issues: { code: string }[] }
    expect(data.issues.some((i) => i.code === 'ai_label_missing')).toBe(false)
  })

  test('skips AI-label check only when aiAssisted is explicitly false', async () => {
    const env = await handler({
      platform: 'wechat',
      title: 'a fine title',
      body: 'fully human-authored body',
      coverPresent: true,
      aiAssisted: false,
    })
    const data = env.data as { issues: { code: string }[] }
    expect(data.issues.some((i) => i.code === 'ai_label_missing')).toBe(false)
  })

  test('flags too many images', async () => {
    const env = await handler({
      platform: 'wechat',
      title: 'title',
      body: 'body',
      coverPresent: true,
      imageCount: 99,
    })
    const data = env.data as { issues: { code: string }[] }
    expect(data.issues.some((i) => i.code === 'too_many_images')).toBe(true)
  })

  test('errors on unknown platform', async () => {
    const env = await handler({ platform: 'nope', title: 't', body: 'b' })
    expect(env.status).toBe('error')
    expect(env.error?.code).toBe('unknown_platform')
  })
})
