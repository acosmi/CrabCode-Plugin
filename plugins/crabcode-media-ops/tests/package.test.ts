import { test, expect, describe, afterAll } from 'bun:test'
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { handler } from '../src/tools/package.ts'

const LABEL = '本文由 AI 辅助创作'
const tmp = mkdtempSync(join(tmpdir(), 'mediaops-pkg-test-'))
process.env.MEDIAOPS_DATA_DIR = tmp

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true })
})

describe('publish.package compliance guard (D-10)', () => {
  test('refuses to package AI-assisted content missing the disclosure label', async () => {
    const env = await handler({
      platform: 'wechat',
      title: 'A title',
      bodyMarkdown: 'body with no label at all',
    })
    expect(env.success).toBe(false)
    expect(env.error?.code).toBe('ai_label_missing')
    // No package directory should have been created on refusal.
    expect(existsSync(join(tmp, 'publish-packages'))).toBe(false)
  })

  test('packages successfully when the AI label is present', async () => {
    const env = await handler({
      platform: 'wechat',
      title: 'A compliant title',
      bodyMarkdown: `Some real body.\n\n${LABEL}`,
    })
    expect(env.success).toBe(true)
    const data = env.data as { packagePath: string; files: string[] }
    expect(existsSync(join(data.packagePath, 'manifest.json'))).toBe(true)
    expect(existsSync(join(data.packagePath, 'article.md'))).toBe(true)
    const article = readFileSync(join(data.packagePath, 'article.md'), 'utf8')
    expect(article.includes(LABEL)).toBe(true)
  })

  test('packages fully human-authored content when aiAssisted is explicitly false', async () => {
    const env = await handler({
      platform: 'xhs',
      title: 'Human note',
      bodyMarkdown: 'fully human-authored, no label needed',
      aiAssisted: false,
    })
    expect(env.success).toBe(true)
  })

  test('rejects an unknown platform', async () => {
    const env = await handler({
      platform: 'nope',
      title: 't',
      bodyMarkdown: `b\n\n${LABEL}`,
    })
    expect(env.error?.code).toBe('unknown_platform')
  })
})
