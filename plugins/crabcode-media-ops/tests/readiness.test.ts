import { test, expect, describe, beforeEach, afterEach } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { handler } from '../src/tools/readiness.ts'
import { saveHandler as saveProfile, type BrandProfile } from '../src/tools/profiles.ts'

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

const OK_BODY = 'body text\n\n本文由 AI 辅助创作'

describe('banned-word check', () => {
  test('flags banned words found in title or body', async () => {
    const env = await handler({
      platform: 'wechat',
      title: '震惊!这个标题',
      body: '正文里也有 必看 字样\n\n本文由 AI 辅助创作',
      coverPresent: true,
      bannedWords: ['震惊', '必看', '颠覆'],
    })
    const data = env.data as { ready: boolean; issues: { code: string; message: string }[] }
    expect(data.ready).toBe(false)
    const issue = data.issues.find((i) => i.code === 'banned_word_present')
    expect(issue).toBeDefined()
    expect(issue!.message).toContain('震惊')
    expect(issue!.message).toContain('必看')
    expect(issue!.message).not.toContain('颠覆')
  })

  test('passes when no banned word appears', async () => {
    const env = await handler({
      platform: 'wechat',
      title: '一个平实的标题',
      body: OK_BODY,
      coverPresent: true,
      bannedWords: ['震惊'],
    })
    const data = env.data as { issues: { code: string }[] }
    expect(data.issues.some((i) => i.code === 'banned_word_present')).toBe(false)
  })
})

describe('claim-resolution gate (fact-check integration)', () => {
  test('unresolved claims block readiness without a waiver', async () => {
    const env = await handler({
      platform: 'wechat',
      title: 'title',
      body: OK_BODY,
      coverPresent: true,
      claims: [
        { claim: 'A 公司营收翻倍', status: 'doubtful' },
        { claim: 'B 框架已开源', status: 'verified', sourceUrl: 'https://example.com/b' },
      ],
    })
    const data = env.data as { ready: boolean; issues: { code: string }[] }
    expect(data.ready).toBe(false)
    expect(data.issues.some((i) => i.code === 'unresolved_claims')).toBe(true)
  })

  test('a named human waiver downgrades unresolved claims to a warning', async () => {
    const env = await handler({
      platform: 'wechat',
      title: 'title',
      body: OK_BODY,
      coverPresent: true,
      claims: [{ claim: '行业规模将达千亿', status: 'unsourced' }],
      claimWaiver: { waived: true, by: '张运营', reason: '已电话向当事方确认' },
    })
    const data = env.data as { ready: boolean; issues: { code: string; severity: string; message: string }[] }
    expect(data.ready).toBe(true)
    const issue = data.issues.find((i) => i.code === 'unresolved_claims_waived')
    expect(issue?.severity).toBe('warning')
    expect(issue?.message).toContain('张运营')
  })

  test('a waiver without a name does not unblock', async () => {
    const env = await handler({
      platform: 'wechat',
      title: 'title',
      body: OK_BODY,
      coverPresent: true,
      claims: [{ claim: 'X', status: 'doubtful' }],
      claimWaiver: { waived: true, by: '  ' },
    })
    const data = env.data as { ready: boolean; issues: { code: string }[] }
    expect(data.ready).toBe(false)
    expect(data.issues.some((i) => i.code === 'unresolved_claims')).toBe(true)
  })

  test('verified claims must carry a source url', async () => {
    const env = await handler({
      platform: 'wechat',
      title: 'title',
      body: OK_BODY,
      coverPresent: true,
      claims: [{ claim: '已证但没给出处', status: 'verified' }],
    })
    const data = env.data as { ready: boolean; issues: { code: string }[] }
    expect(data.ready).toBe(false)
    expect(data.issues.some((i) => i.code === 'verified_claim_missing_source')).toBe(true)
  })
})

describe('brand-profile integration', () => {
  let dir: string
  let prev: string | undefined

  const profile: BrandProfile = {
    brand_id: 'tech-daily',
    name: '科技日读',
    persona: { identity: '开发者栏目' },
    voice: { tone: '务实' },
    audience: { segments: ['工程师'] },
    columns: [{ name: '速览' }],
    platforms: [{ platform: 'wechat' }],
    banned_words: ['史上最强'],
    compliance: { ai_label_text: '内容由 AI 辅助生成' },
  }

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mediaops-readiness-profile-'))
    prev = process.env.MEDIAOPS_DATA_DIR
    process.env.MEDIAOPS_DATA_DIR = dir
    await saveProfile(profile)
  })

  afterEach(async () => {
    if (prev === undefined) delete process.env.MEDIAOPS_DATA_DIR
    else process.env.MEDIAOPS_DATA_DIR = prev
    await rm(dir, { recursive: true, force: true })
  })

  test('reads banned words and AI label text from the profile', async () => {
    const env = await handler({
      platform: 'wechat',
      title: '史上最强指南',
      body: '正文,但标签用的是默认文案\n\n本文由 AI 辅助创作',
      coverPresent: true,
      brandId: 'tech-daily',
    })
    const data = env.data as { ready: boolean; issues: { code: string }[] }
    expect(data.issues.some((i) => i.code === 'banned_word_present')).toBe(true)
    // Profile's compliance.ai_label_text overrides the default label expectation.
    expect(data.issues.some((i) => i.code === 'ai_label_missing')).toBe(true)
  })

  test('passes with the profile-defined label and clean copy', async () => {
    const env = await handler({
      platform: 'wechat',
      title: '平实标题',
      body: '正文\n\n内容由 AI 辅助生成',
      coverPresent: true,
      brandId: 'tech-daily',
    })
    const data = env.data as { ready: boolean }
    expect(data.ready).toBe(true)
  })

  test('errors when brandId has no stored profile', async () => {
    const env = await handler({
      platform: 'wechat',
      title: 't',
      body: OK_BODY,
      coverPresent: true,
      brandId: 'ghost',
    })
    expect(env.status).toBe('error')
    expect(env.error?.code).toBe('profile_not_found')
  })
})
