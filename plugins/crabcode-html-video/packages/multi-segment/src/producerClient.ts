import { createWriteStream, mkdirSync, openSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable, Transform } from 'node:stream'

const MAX_DOWNLOAD_BYTES = 1024 * 1024 * 1024
const MAX_RESPONSE_BYTES = 1024 * 1024

export function validateProducerBaseUrl(input: string): string {
  const url = new URL(input)
  const loopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]'
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    throw new Error('remote producer must use https; http is allowed only for loopback')
  }
  if (url.username || url.password) throw new Error('producer URL must not contain credentials')
  if (url.search || url.hash) throw new Error('producer URL must not contain query or fragment data')
  return url.href.replace(/\/$/, '')
}

export interface ProducerRenderOptions {
  /** Producer base URL, e.g. http://127.0.0.1:7788 */
  baseUrl: string
  /** Full HTML document (composition-ready). */
  html: string
  /** Destination mp4 path. */
  outputPath: string
  /** Optional fps override. */
  fps?: number
  id: string
  width: number
  height: number
  durationSec: number
  /** Worker-side safe basename; defaults to the destination basename. */
  outputName?: string
  /** Request timeout ms. Default 10 minutes. */
  timeoutMs?: number
  /** Extra headers (auth for internal worker). */
  headers?: Record<string, string>
  /** Abort an in-flight request/download. */
  signal?: AbortSignal
}

export interface ProducerRenderResult {
  outputPath: string
  durationSec?: number
  fileSize: number
  raw: unknown
}

export interface ProducerProbeResult {
  ok: boolean
  authRequired: boolean | null
  authVerified: boolean | null
  service: string | null
  version: string | null
  healthStatus: number | null
  readyStatus: number | null
}

/**
 * Render a single HTML composition via producer HTTP POST /render.
 */
export async function renderViaProducerHttp(opts: ProducerRenderOptions): Promise<ProducerRenderResult> {
  const base = validateProducerBaseUrl(opts.baseUrl)
  const timeoutMs = opts.timeoutMs ?? 600_000
  const controller = new AbortController()
  const abortFromCaller = () => controller.abort(opts.signal?.reason ?? new Error('render cancelled by caller'))
  if (opts.signal?.aborted) abortFromCaller()
  else opts.signal?.addEventListener('abort', abortFromCaller, { once: true })
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const body: Record<string, unknown> = {
      html: opts.html,
      id: opts.id,
      width: opts.width,
      height: opts.height,
      durationSec: opts.durationSec,
    }
    if (opts.fps) body.fps = opts.fps
    if (opts.outputName) body.outputName = opts.outputName

    const res = await fetch(`${base}/render`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(opts.headers ?? {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      redirect: 'error',
    })

    if (!res.ok) {
      const text = await readBoundedText(res, 64 * 1024).catch(() => '')
      throw new Error(
        `producer /render failed HTTP ${res.status}: ${redactSecrets(text, opts.headers).slice(0, 500)}`,
      )
    }

    const json = JSON.parse(await readBoundedText(res, MAX_RESPONSE_BYTES)) as {
      outputPath?: string
      downloadUrl?: string
      token?: string
      duration?: number
      durationSec?: number
      fileSize?: number
      error?: string
    }

    if (json.error) throw new Error(`producer error: ${json.error}`)

    mkdirSync(dirname(opts.outputPath), { recursive: true })

    // Remote output paths are never trusted, even for loopback. Publish only a
    // file downloaded by a same-origin opaque token/URL into our chosen path.
    if (json.token || json.downloadUrl) {
      // Resolve relative worker URLs, but reject cross-origin download redirects.
      if (json.token && !/^[A-Za-z0-9][A-Za-z0-9._-]*\.mp4$/i.test(json.token)) {
        throw new Error('producer returned an invalid output token')
      }
      const raw = json.token ? `/outputs/${encodeURIComponent(json.token)}` : json.downloadUrl!
      const url = new URL(raw, base + '/')
      if (url.origin !== new URL(base).origin) throw new Error('producer returned a cross-origin download URL')
      await downloadToFile(url.href, opts.outputPath, opts.headers, controller.signal)
    } else {
      throw new Error('producer response missing a same-origin download token or URL')
    }

    const { statSync } = await import('node:fs')
    const st = statSync(opts.outputPath)
    return {
      outputPath: opts.outputPath,
      durationSec: json.durationSec ?? json.duration,
      fileSize: st.size,
      raw: json,
    }
  } finally {
    clearTimeout(timer)
    opts.signal?.removeEventListener('abort', abortFromCaller)
  }
}

async function downloadToFile(
  url: string,
  dest: string,
  headers?: Record<string, string>,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(url, { headers, redirect: 'error', signal })
  if (!res.ok || !res.body) {
    throw new Error(`download failed HTTP ${res.status} for ${url}`)
  }
  const declared = Number(res.headers.get('content-length') || 0)
  if (Number.isFinite(declared) && declared > MAX_DOWNLOAD_BYTES) {
    throw new Error(`download exceeds ${MAX_DOWNLOAD_BYTES} byte limit`)
  }
  mkdirSync(dirname(dest), { recursive: true })
  let received = 0
  const limiter = new Transform({
    transform(chunk, _encoding, callback) {
      received += chunk.length
      if (received > MAX_DOWNLOAD_BYTES) callback(new Error(`download exceeds ${MAX_DOWNLOAD_BYTES} byte limit`))
      else callback(null, chunk)
    },
  })
  const fd = openSync(dest, 'wx', 0o600)
  try {
    await pipeline(Readable.fromWeb(res.body as any), limiter, createWriteStream(dest, { fd, autoClose: true }))
  } catch (error) {
    rmSync(dest, { force: true })
    throw error
  }
}

/**
 * Health check against producer server.
 */
export async function probeProducer(
  baseUrl: string,
  timeoutMs = 5000,
  headers?: Record<string, string>,
): Promise<ProducerProbeResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const base = validateProducerBaseUrl(baseUrl)
    const healthResponse = await fetch(`${base}/health`, { signal: controller.signal, redirect: 'error' })
    const health = JSON.parse(await readBoundedText(healthResponse, 64 * 1024)) as {
      service?: unknown
      version?: unknown
      authRequired?: unknown
    }
    const service = typeof health.service === 'string' ? health.service : null
    const version = typeof health.version === 'string' ? health.version : null
    const authRequired = typeof health.authRequired === 'boolean' ? health.authRequired : null
    const healthOk =
      healthResponse.ok &&
      service === 'crabcode-html-video-worker' &&
      Boolean(version) &&
      authRequired !== null

    const readyResponse = await fetch(`${base}/ready`, { signal: controller.signal, redirect: 'error' })
    const ready = JSON.parse(await readBoundedText(readyResponse, 64 * 1024)) as { ok?: unknown }
    const readyOk = readyResponse.ok && ready.ok === true

    let authVerified: boolean | null = null
    if (authRequired) {
      const authResponse = await fetch(`${base}/outputs/__crabcode_auth_probe__.mp4`, {
        headers,
        signal: controller.signal,
        redirect: 'error',
      })
      // The worker contract for an authenticated-but-nonexistent opaque output
      // is exactly 404. A default 200 route or a 5xx failure must never be
      // mistaken for successful bearer verification.
      const authStatus = authResponse.status
      const bodyDrained = await readBoundedText(authResponse, 16 * 1024)
        .then(() => true)
        .catch(() => false)
      authVerified = authStatus === 404 && bodyDrained
    }
    return {
      ok: healthOk && readyOk && (authRequired !== true || authVerified === true),
      authRequired,
      authVerified,
      service,
      version,
      healthStatus: healthResponse.status,
      readyStatus: readyResponse.status,
    }
  } catch {
    return {
      ok: false,
      authRequired: null,
      authVerified: null,
      service: null,
      version: null,
      healthStatus: null,
      readyStatus: null,
    }
  } finally {
    clearTimeout(timer)
  }
}

export async function producerHealth(
  baseUrl: string,
  timeoutMs = 5000,
  headers?: Record<string, string>,
): Promise<boolean> {
  return (await probeProducer(baseUrl, timeoutMs, headers)).ok
}

async function readBoundedText(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return ''
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let total = 0
  let text = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) throw new Error(`producer response exceeds ${maxBytes} bytes`)
      text += decoder.decode(value, { stream: true })
    }
    return text + decoder.decode()
  } catch (error) {
    await reader.cancel().catch(() => {})
    throw error
  } finally {
    reader.releaseLock()
  }
}

function redactSecrets(text: string, headers?: Record<string, string>): string {
  let redacted = text.replace(/(authorization|x-render-token)\s*[:=]\s*[^\s"']+/gi, '$1=<redacted>')
  for (const value of Object.values(headers || {})) {
    const secret = value.replace(/^Bearer\s+/i, '')
    if (secret.length >= 4) redacted = redacted.split(secret).join('<redacted>')
  }
  return redacted
}

export function defaultWorkDir(base?: string): string {
  return join(base || process.cwd(), '.crabcode-html-video-work')
}
