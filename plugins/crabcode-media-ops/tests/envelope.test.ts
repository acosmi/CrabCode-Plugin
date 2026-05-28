import { test, expect, describe } from 'bun:test'
import { ok, actionRequired, blocked, err, toToolResult } from '../src/envelope.ts'

describe('envelope factories', () => {
  test('ok marks success + ok status', () => {
    const e = ok({ x: 1 })
    expect(e.success).toBe(true)
    expect(e.status).toBe('ok')
    expect(e.data).toEqual({ x: 1 })
    expect(e.warnings).toBeUndefined()
  })

  test('ok carries warnings when provided', () => {
    const e = ok({ x: 1 }, ['heads up'])
    expect(e.warnings).toEqual(['heads up'])
  })

  test('actionRequired is success with action_required status', () => {
    const e = actionRequired({ issues: [] })
    expect(e.success).toBe(true)
    expect(e.status).toBe('action_required')
  })

  test('blocked is non-success', () => {
    const e = blocked({ reason: 'gate-b' })
    expect(e.success).toBe(false)
    expect(e.status).toBe('blocked')
  })

  test('err carries a code + message', () => {
    const e = err('not_found', 'missing')
    expect(e.success).toBe(false)
    expect(e.status).toBe('error')
    expect(e.error).toEqual({ code: 'not_found', message: 'missing' })
  })

  test('toToolResult serializes envelope into a single text block', () => {
    const result = toToolResult(ok({ a: 2 }))
    expect(result.content).toHaveLength(1)
    expect(result.content[0].type).toBe('text')
    expect(JSON.parse(result.content[0].text)).toEqual({ success: true, status: 'ok', data: { a: 2 } })
  })
})
