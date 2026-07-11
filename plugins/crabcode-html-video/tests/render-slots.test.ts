import { describe, expect, test } from 'bun:test'
import { tryAcquireRenderSlot } from '../src/renderSlots.ts'

describe('render concurrency guard', () => {
  test('defaults to one in-flight render and releases idempotently', () => {
    const old = process.env.CRABCODE_HTML_VIDEO_MAX_CONCURRENT_RENDERS
    delete process.env.CRABCODE_HTML_VIDEO_MAX_CONCURRENT_RENDERS
    try {
    const release = tryAcquireRenderSlot()
    expect(release).toBeFunction()
    expect(tryAcquireRenderSlot()).toBeNull()
    release!()
    release!()
    const next = tryAcquireRenderSlot()
    expect(next).toBeFunction()
    next!()
    } finally {
      if (old === undefined) delete process.env.CRABCODE_HTML_VIDEO_MAX_CONCURRENT_RENDERS
      else process.env.CRABCODE_HTML_VIDEO_MAX_CONCURRENT_RENDERS = old
    }
  })
})
