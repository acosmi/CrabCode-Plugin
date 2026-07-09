import { createWriteStream, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

export interface ProducerRenderOptions {
  /** Producer base URL, e.g. http://127.0.0.1:7788 */
  baseUrl: string
  /** Full HTML document (composition-ready). */
  html: string
  /** Destination mp4 path. */
  outputPath: string
  /** Optional fps override. */
  fps?: number
  /** Request timeout ms. Default 10 minutes. */
  timeoutMs?: number
  /** Extra headers (auth for internal worker). */
  headers?: Record<string, string>
}

export interface ProducerRenderResult {
  outputPath: string
  durationSec?: number
  fileSize: number
  raw: unknown
}

/**
 * Render a single HTML composition via producer HTTP POST /render.
 */
export async function renderViaProducerHttp(opts: ProducerRenderOptions): Promise<ProducerRenderResult> {
  const base = opts.baseUrl.replace(/\/$/, '')
  const timeoutMs = opts.timeoutMs ?? 600_000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const body: Record<string, unknown> = {
      html: opts.html,
      outputPath: opts.outputPath,
    }
    if (opts.fps) body.fps = opts.fps

    const res = await fetch(`${base}/render`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(opts.headers ?? {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`producer /render failed HTTP ${res.status}: ${text.slice(0, 500)}`)
    }

    const json = (await res.json()) as {
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

    // Prefer server-written path if it matches or exists; else download via token.
    let finalPath = opts.outputPath
    if (json.outputPath && existsSync(json.outputPath)) {
      if (json.outputPath !== opts.outputPath) {
        // copy via fetch not needed — rename/copy with fs
        const { copyFileSync } = await import('node:fs')
        copyFileSync(json.outputPath, opts.outputPath)
      }
      finalPath = opts.outputPath
    } else if (json.token || json.downloadUrl) {
      // Always resolve against base — worker may return relative /outputs/:token
      const raw = json.downloadUrl || `/outputs/${json.token}`
      const url = raw.startsWith('http://') || raw.startsWith('https://') ? raw : new URL(raw, base + '/').href
      await downloadToFile(url, opts.outputPath, opts.headers)
      finalPath = opts.outputPath
    } else if (!existsSync(opts.outputPath)) {
      throw new Error('producer response missing outputPath/token and local file not written')
    }

    const { statSync } = await import('node:fs')
    const st = statSync(finalPath)
    return {
      outputPath: finalPath,
      durationSec: json.durationSec ?? json.duration,
      fileSize: st.size,
      raw: json,
    }
  } finally {
    clearTimeout(timer)
  }
}

async function downloadToFile(url: string, dest: string, headers?: Record<string, string>): Promise<void> {
  const res = await fetch(url, { headers })
  if (!res.ok || !res.body) {
    throw new Error(`download failed HTTP ${res.status} for ${url}`)
  }
  mkdirSync(dirname(dest), { recursive: true })
  // @ts-expect-error Readable.fromWeb types vary across node versions
  await pipeline(Readable.fromWeb(res.body as any), createWriteStream(dest))
}

/**
 * Health check against producer server.
 */
export async function producerHealth(baseUrl: string, timeoutMs = 5000): Promise<boolean> {
  const base = baseUrl.replace(/\/$/, '')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${base}/health`, { signal: controller.signal })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

export function defaultWorkDir(base?: string): string {
  return join(base || process.cwd(), '.crabcode-html-video-work')
}
