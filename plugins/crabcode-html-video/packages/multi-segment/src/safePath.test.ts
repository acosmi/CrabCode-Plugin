import { describe, expect, test } from 'bun:test'
import { resolveSafeOutputPath } from './safePath.ts'
import { join, sep } from 'node:path'
import { tmpdir } from 'node:os'

describe('resolveSafeOutputPath', () => {
  const root = join(tmpdir(), 'crab-safe-root')

  test('accepts basename mp4', () => {
    const p = resolveSafeOutputPath(root, 'ok.mp4')
    expect(p.endsWith('ok.mp4')).toBe(true)
    expect(p.includes('..')).toBe(false)
  })

  test('strips directory components', () => {
    const p = resolveSafeOutputPath(root, 'foo/bar.mp4')
    expect(p.endsWith('bar.mp4')).toBe(true)
  })

  test('rejects traversal names after basename still unsafe pattern', () => {
    // basename of ../../tmp/x.mp4 is x.mp4 — accepted as name under root only
    const p = resolveSafeOutputPath(root, '../../tmp/x.mp4')
    expect(p.endsWith(`${sep}x.mp4`) || p.endsWith('/x.mp4')).toBe(true)
    expect(p.includes(`${sep}tmp${sep}`)).toBe(false)
  })

  test('rejects non-mp4', () => {
    expect(() => resolveSafeOutputPath(root, 'evil.sh')).toThrow()
  })
})
