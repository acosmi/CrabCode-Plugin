import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dir, '..')

describe('skill routing contracts', () => {
  test('manifest exposes exactly the nine planned skills with valid frontmatter', () => {
    const manifest = JSON.parse(readFileSync(resolve(root, '.crabcode-plugin/plugin.json'), 'utf8'))
    expect(manifest.skills).toHaveLength(9)
    const names = manifest.skills.map((path: string) => {
      const text = readFileSync(resolve(root, path, 'SKILL.md'), 'utf8')
      expect(text).toContain('PRACTICE.md')
      expect(text).toMatch(/^description:\s*.+$/m)
      return text.match(/^name:\s*(.+)$/m)?.[1]
    })
    expect(new Set(names).size).toBe(9)
  })

  test('wechat opinion and full orchestration descriptions state their near-miss boundary', () => {
    const orchestration = readFileSync(resolve(root, 'media-core/skills/media-ops/SKILL.md'), 'utf8')
    const wechat = readFileSync(resolve(root, 'editorial/skills/wechat-original-opinion/SKILL.md'), 'utf8')
    expect(orchestration).toContain('只写一篇公众号观点稿时改用 wechat-original-opinion')
    expect(wechat).toContain('纯新闻摘要、品牌软文、多平台营销稿')
  })

  test('trigger evaluation set has balanced, adjacent cases', () => {
    const evals = JSON.parse(readFileSync(resolve(root, 'evals/trigger-evals.json'), 'utf8'))
    expect(evals).toHaveLength(20)
    expect(evals.filter((item: any) => item.should_trigger)).toHaveLength(11)
    expect(evals.filter((item: any) => !item.should_trigger)).toHaveLength(9)
    expect(evals.filter((item: any) => !item.should_trigger).every((item: any) => item.near_miss)).toBe(true)
  })
})
