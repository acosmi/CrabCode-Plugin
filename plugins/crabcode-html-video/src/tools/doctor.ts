import { existsSync } from 'node:fs'
import { resolveFfmpegPath, resolveBrowserPath, ensureBrowser } from '@crabcode/multi-segment'
import { ok, fail, type Envelope } from '../envelope.ts'
import { browsersDir, pluginData, pluginRoot } from '../paths.ts'

export const name = 'doctor'
export const description =
  'Probe runtime dependencies (bun, ffmpeg, browser). Optionally download chrome-headless-shell via domestic mirror into CRABCODE_PLUGIN_DATA.'

export const inputSchema = {
  type: 'object',
  properties: {
    install: {
      type: 'boolean',
      description: 'If true, attempt to install missing browser into plugin data dir',
    },
    useMirror: {
      type: 'boolean',
      description: 'Use npmmirror chrome-for-testing mirror (default true)',
    },
  },
}

export async function handler(args: { install?: boolean; useMirror?: boolean } = {}): Promise<Envelope> {
  const checks: Record<string, unknown> = {}

  // bun
  checks.bun = {
    path: process.execPath,
    version: process.versions.bun || process.version,
    ok: true,
  }

  // node note
  checks.nodeHint = {
    message: 'Producer prefers Node>=22 when bun path is insufficient; host PATH must provide bun.',
    nodeVersion: process.version,
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

  // browser
  let browser = resolveBrowserPath(browsersDir())
  if (args.install && !browser.path) {
    const useMirror = args.useMirror !== false
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
  checks.browser = browser

  // paths
  checks.paths = {
    pluginRoot: pluginRoot(),
    pluginData: pluginData(),
    browsersDir: browsersDir(),
  }

  // producer / worker optional
  const producerUrl = process.env.CRABCODE_HTML_VIDEO_PRODUCER_URL || process.env.PRODUCER_URL || ''
  checks.producerUrl = producerUrl || null

  const ready = Boolean(ffmpegOk && (browser.path || producerUrl))
  checks.ready = ready

  if (!ready) {
    const tips: string[] = []
    if (!ffmpegOk) {
      tips.push(
        'ffmpeg missing: install system ffmpeg, or set HYPERFRAMES_FFMPEG_PATH. On first install with network, ffmpeg-static optionalDependency may help.',
      )
    }
    if (!browser.path && !producerUrl) {
      tips.push(
        'browser missing: call doctor with install:true (uses npmmirror by default), or set HYPERFRAMES_BROWSER_PATH, or point CRABCODE_HTML_VIDEO_PRODUCER_URL at a running worker.',
      )
    }
    return fail('not_ready', tips.join(' '), checks)
  }

  return ok(checks, 'runtime ready')
}
