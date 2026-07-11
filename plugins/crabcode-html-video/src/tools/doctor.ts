import {
  resolveFfmpegPath,
  resolveBrowserPath,
  ensureBrowser,
  probeBrowserExecutable,
  probeProducer,
} from '@crabcode/multi-segment'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { ok, fail, type Envelope } from '../envelope.ts'
import { browsersDir, pluginData, pluginRoot } from '../paths.ts'
import { doctorInputSchema, validationMessage } from '../contracts.ts'
import { producerRequestHeaders, producerTokenConfigured } from '../producerAuth.ts'
import { sidecarEnvironmentIsolationStatus } from '../environmentIsolation.ts'

export const name = 'doctor'
export const description =
  'Probe runtime dependencies (bun, ffmpeg, browser). Optionally download chrome-headless-shell via domestic mirror into CRABCODE_PLUGIN_DATA.'

export const inputSchema = doctorInputSchema
export const annotations = {
  title: 'Check HTML Video Runtime',
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
}

export async function handler(raw: unknown = {}): Promise<Envelope> {
  const parsed = inputSchema.safeParse(raw)
  if (!parsed.success) return fail('invalid_args', validationMessage(parsed.error))
  const args = parsed.data
  const checks: Record<string, unknown> = {}

  // Names only, never values. This lets CI/operations verify that the MCP was
  // entered through the security bootstrap without exposing its worker token.
  checks.environmentIsolation = sidecarEnvironmentIsolationStatus()

  // bun
  checks.bun = {
    path: process.execPath,
    version: process.versions.bun || process.version,
    ok: true,
  }

  // ffmpeg
  const ffmpeg = resolveFfmpegPath()
  let ffmpegOk = false
  try {
    const { spawnSync } = await import('node:child_process')
    const r = spawnSync(ffmpeg, ['-version'], { encoding: 'utf-8', timeout: 10_000 })
    ffmpegOk = r.status === 0
    checks.ffmpeg = {
      path: ffmpeg,
      ok: ffmpegOk,
      versionLine: (r.stdout || '').split('\n')[0] || r.stderr?.split('\n')[0],
      env: {
        HYPERFRAMES_FFMPEG_PATH: process.env.HYPERFRAMES_FFMPEG_PATH || null,
        CRABCODE_FFMPEG_PATH: process.env.CRABCODE_FFMPEG_PATH || null,
      },
    }
  } catch (e) {
    checks.ffmpeg = { path: ffmpeg, ok: false, error: e instanceof Error ? e.message : String(e) }
  }
  if (ffmpegOk) process.env.HYPERFRAMES_FFMPEG_PATH = ffmpeg

  // browser
  let browser = resolveBrowserPath(browsersDir())
  if (args.install && !browser.path) {
    const useMirror = args.useMirror === true
    browser = await ensureBrowser({
      cacheDir: browsersDir(),
      mirrorBase: useMirror
        ? process.env.CRABCODE_CHROME_MIRROR || 'https://cdn.npmmirror.com/binaries/chrome-for-testing'
        : '',
      log: (m) => process.stderr.write(`[doctor] ${m}\n`),
    })
  }
  if (browser.path) {
    process.env.HYPERFRAMES_BROWSER_PATH = browser.path
    process.env.PRODUCER_HEADLESS_SHELL_PATH = browser.path
  }
  const browserProbe = browser.path
    ? probeBrowserExecutable(browser.path)
    : { ok: false, versionLine: null, error: 'browser not found' }
  checks.browser = { ...browser, probe: browserProbe }

  // paths
  checks.paths = {
    pluginRoot: pluginRoot(),
    pluginData: pluginData(),
    browsersDir: browsersDir(),
  }

  const remoteMode = process.env.CRABCODE_HTML_VIDEO_RENDER_MODE === 'remote'
  const producerUrl = process.env.CRABCODE_HTML_VIDEO_PRODUCER_URL || ''
  const authConfigured = producerTokenConfigured()
  const remoteProbe =
    remoteMode && producerUrl
      ? await probeProducer(producerUrl, 3000, producerRequestHeaders())
      : null
  const producerOk = Boolean(
    remoteProbe?.ok && (remoteProbe.authRequired !== true || authConfigured),
  )

  let localProducerOk = false
  const runtimeAssets = verifyProducerRuntimeAssets()
  if (!remoteMode) {
    try {
      const producer = await import('@hyperframes/producer')
      localProducerOk =
        typeof producer.createRenderJob === 'function' &&
        typeof producer.executeRenderJob === 'function' &&
        runtimeAssets.ok
    } catch {
      localProducerOk = false
    }
  }
  checks.renderMode = remoteMode ? 'remote' : 'local'
  checks.producer = remoteMode
    ? {
        url: producerUrl || null,
        ok: producerOk,
        health: remoteProbe,
        authConfigured,
      }
    : { package: '@hyperframes/producer', ok: localProducerOk, runtimeAssets }

  const ready = remoteMode
    ? Boolean(ffmpegOk && producerUrl && producerOk)
    : Boolean(ffmpegOk && browser.path && browserProbe.ok && localProducerOk)
  checks.ready = ready

  if (!ready) {
    const tips: string[] = []
    if (!ffmpegOk) {
      tips.push(
        'ffmpeg missing: install system ffmpeg, or set HYPERFRAMES_FFMPEG_PATH. On first install with network, ffmpeg-static optionalDependency may help.',
      )
    }
    if (!remoteMode && !browser.path) {
      tips.push(
        'browser missing: call doctor with install:true (official CDN), opt in with useMirror:true, or set HYPERFRAMES_BROWSER_PATH.',
      )
    }
    if (!remoteMode && !localProducerOk) tips.push('local producer unavailable: reinstall the plugin from its frozen lockfile.')
    if (remoteMode && !producerUrl) tips.push('remote mode requires CRABCODE_HTML_VIDEO_PRODUCER_URL.')
    if (remoteMode && producerUrl && !remoteProbe?.ok) tips.push('configured remote producer failed its health check.')
    if (remoteMode && remoteProbe?.authRequired && !authConfigured) {
      tips.push('remote producer requires CRABCODE_HTML_VIDEO_PRODUCER_TOKEN (HTML_VIDEO_WORKER_TOKEN is also supported).')
    }
    return fail('not_ready', tips.join(' '), checks)
  }

  return ok(checks, 'runtime ready')
}

function verifyProducerRuntimeAssets(): {
  ok: boolean
  manifestPath: string
  runtimePath: string | null
  error?: string
} {
  const manifestPath = resolve(join(pluginRoot(), 'dist', 'hyperframe.manifest.json'))
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      artifacts?: { iife?: unknown }
      sha256?: unknown
    }
    const file = manifest.artifacts?.iife
    const expected = manifest.sha256
    if (typeof file !== 'string' || basename(file) !== file || typeof expected !== 'string') {
      throw new Error('manifest is missing a safe IIFE filename or checksum')
    }
    const runtimePath = resolve(dirname(manifestPath), file)
    if (!existsSync(runtimePath)) throw new Error('runtime IIFE is missing')
    const actual = createHash('sha256').update(readFileSync(runtimePath)).digest('hex')
    if (actual !== expected) throw new Error('runtime IIFE checksum mismatch')
    return { ok: true, manifestPath, runtimePath }
  } catch (error) {
    return {
      ok: false,
      manifestPath,
      runtimePath: null,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
