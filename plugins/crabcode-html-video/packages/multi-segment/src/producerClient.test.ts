import { afterEach, describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { rmSync } from 'node:fs'
import { probeProducer, renderViaProducerHttp, validateProducerBaseUrl } from './producerClient.ts'

let server: ReturnType<typeof Bun.serve> | undefined
afterEach(() => {
  server?.stop(true)
  server = undefined
})

describe('validateProducerBaseUrl', () => {
  test('allows https and loopback http', () => {
    expect(validateProducerBaseUrl('https://render.example.com')).toBe('https://render.example.com')
    expect(validateProducerBaseUrl('http://127.0.0.1:7788/')).toBe('http://127.0.0.1:7788')
  })

  test('rejects insecure remote, credentials, and query data', () => {
    expect(() => validateProducerBaseUrl('http://10.0.0.8:7788')).toThrow()
    expect(() => validateProducerBaseUrl('https://user:pass@example.com')).toThrow()
    expect(() => validateProducerBaseUrl('https://example.com?token=x')).toThrow()
  })

  test('requires health, readiness, service identity, and a valid worker token', async () => {
    server = Bun.serve({
      port: 0,
      fetch(request) {
        const path = new URL(request.url).pathname
        if (path === '/health') {
          return Response.json({
            ok: true,
            service: 'crabcode-html-video-worker',
            version: '0.2.0',
            authRequired: true,
          })
        }
        if (path === '/ready') return Response.json({ ok: true })
        if (path.startsWith('/outputs/')) {
          const authorization = request.headers.get('authorization')
          if (authorization === 'Bearer correct') {
            return Response.json({ error: 'not found' }, { status: 404 })
          }
          if (authorization === 'Bearer false-200') return Response.json({ ok: true })
          if (authorization === 'Bearer fault-500') {
            return Response.json({ error: 'worker fault' }, { status: 500 })
          }
          return Response.json({ error: 'unauthorized' }, { status: 401 })
        }
        return new Response('not found', { status: 404 })
      },
    })
    const base = `http://127.0.0.1:${server.port}`
    expect((await probeProducer(base, 1000, { authorization: 'Bearer wrong' })).ok).toBe(false)
    const false200 = await probeProducer(base, 1000, { authorization: 'Bearer false-200' })
    expect(false200.ok).toBe(false)
    expect(false200.authVerified).toBe(false)
    const fault500 = await probeProducer(base, 1000, { authorization: 'Bearer fault-500' })
    expect(fault500.ok).toBe(false)
    expect(fault500.authVerified).toBe(false)
    const valid = await probeProducer(base, 1000, { authorization: 'Bearer correct' })
    expect(valid.ok).toBe(true)
    expect(valid.authVerified).toBe(true)
  })

  test('sends raw worker metadata and downloads only by same-origin token', async () => {
    let received: Record<string, unknown> | undefined
    server = Bun.serve({
      port: 0,
      async fetch(request) {
        const path = new URL(request.url).pathname
        if (path === '/render') {
          received = await request.json() as Record<string, unknown>
          return Response.json({
            ok: true,
            token: 'worker-result.mp4',
            downloadUrl: 'https://untrusted.example/result.mp4',
            durationSec: 1.25,
          })
        }
        if (path === '/outputs/worker-result.mp4') {
          return new Response(new Uint8Array(1024), { headers: { 'content-type': 'video/mp4' } })
        }
        return new Response('not found', { status: 404 })
      },
    })
    const outputPath = join(tmpdir(), `producer-client-${randomUUID()}.mp4`)
    try {
      const result = await renderViaProducerHttp({
        baseUrl: `http://127.0.0.1:${server.port}`,
        html: '<div>raw authored html</div>',
        outputPath,
        id: 'intro',
        width: 640,
        height: 360,
        durationSec: 1.25,
        fps: 24,
      })
      expect(result.fileSize).toBe(1024)
      expect(received).toMatchObject({
        html: '<div>raw authored html</div>',
        id: 'intro',
        width: 640,
        height: 360,
        durationSec: 1.25,
        fps: 24,
      })
      expect(received).not.toHaveProperty('outputPath')
      expect(received).not.toHaveProperty('outputName')
    } finally {
      rmSync(outputPath, { force: true })
    }
  })
})
