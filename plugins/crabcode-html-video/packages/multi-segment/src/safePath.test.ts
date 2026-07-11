import { describe, expect, test } from 'bun:test'
import { reserveOutputFile, resolveSafeOutputPath } from './safePath.ts'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

describe('resolveSafeOutputPath', () => {
  const root = join(tmpdir(), 'crab-safe-root')

  test('accepts basename mp4', () => {
    const p = resolveSafeOutputPath(root, 'ok.mp4')
    expect(p.endsWith('ok.mp4')).toBe(true)
    expect(p.includes('..')).toBe(false)
  })

  test('rejects directory components', () => {
    expect(() => resolveSafeOutputPath(root, 'foo/bar.mp4')).toThrow()
  })

  test('rejects traversal names after basename still unsafe pattern', () => {
    expect(() => resolveSafeOutputPath(root, '../../tmp/x.mp4')).toThrow()
  })

  test('rejects non-mp4', () => {
    expect(() => resolveSafeOutputPath(root, 'evil.sh')).toThrow()
  })

  test('atomically serializes writers targeting the same output', () => {
    const path = join(root, `${randomUUID()}.mp4`)
    const first = reserveOutputFile(path)
    expect(() => reserveOutputFile(path)).toThrow('already reserved')
    first.release()
    const next = reserveOutputFile(path)
    next.release()
  })
})
