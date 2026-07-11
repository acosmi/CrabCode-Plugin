import { accessSync, constants, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { delimiter } from 'node:path'
import { spawnSync } from 'node:child_process'

// Keep this aligned with puppeteer-core's PUPPETEER_REVISIONS in the frozen
// @hyperframes/producer dependency graph.
export const PINNED_CHROME_VERSION = '150.0.7871.24'

export interface BrowserResolveResult {
  path: string | null
  source: 'env' | 'cache' | 'system' | 'missing'
  message: string
}

export interface BrowserProbeResult {
  ok: boolean
  versionLine: string | null
  error?: string
}

/** Reject arbitrary executable files masquerading as a configured browser. */
export function probeBrowserExecutable(path: string): BrowserProbeResult {
  if (!isExecutableFile(path)) return { ok: false, versionLine: null, error: 'not an executable file' }
  try {
    const result = spawnSync(path, ['--version'], { encoding: 'utf8', timeout: 10_000 })
    const versionLine = `${result.stdout || ''}\n${result.stderr || ''}`
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean) ?? null
    const looksLikeChromium = Boolean(versionLine && /(?:chrome|chromium)/i.test(versionLine))
    return {
      ok: result.status === 0 && looksLikeChromium,
      versionLine,
      ...(result.status === 0 && looksLikeChromium
        ? {}
        : { error: 'version probe did not identify Chrome/Chromium' }),
    }
  } catch (error) {
    return { ok: false, versionLine: null, error: error instanceof Error ? error.message : String(error) }
  }
}

const CHROME_NAMES = [
  'chrome-headless-shell',
  'headless_shell',
  'chromium',
  'chromium-browser',
  'google-chrome',
  'Google Chrome',
]

/**
 * Resolve browser binary for hyperframes producer/engine.
 * Prefer HYPERFRAMES_BROWSER_PATH / PRODUCER_HEADLESS_SHELL_PATH.
 */
export function resolveBrowserPath(cacheDir?: string): BrowserResolveResult {
  const env =
    process.env.HYPERFRAMES_BROWSER_PATH ||
    process.env.PRODUCER_HEADLESS_SHELL_PATH ||
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    process.env.CHROME_PATH
  if (env && probeBrowserExecutable(env).ok) {
    return { path: env, source: 'env', message: `Using browser from env: ${env}` }
  }

  const roots = [
    cacheDir,
    process.env.CRABCODE_PLUGIN_DATA ? join(process.env.CRABCODE_PLUGIN_DATA, 'browsers') : null,
  ].filter(Boolean) as string[]

  for (const root of roots) {
    const found = findBinary(root, CHROME_NAMES, PINNED_CHROME_VERSION)
    if (found) {
      return { path: found, source: 'cache', message: `Found browser in cache: ${found}` }
    }
  }

  // System chromium (linux worker / brew)
  for (const name of [
    'chromium',
    'chromium-browser',
    'google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ]) {
    const executable = name.startsWith('/') ? (probeBrowserExecutable(name).ok ? name : null) : findExecutableOnPath(name)
    if (executable) return { path: executable, source: 'system', message: `Using system browser: ${executable}` }
  }

  return {
    path: null,
    source: 'missing',
    message:
      'No browser found. Run doctor to download chrome-headless-shell (npmmirror mirror supported), or set HYPERFRAMES_BROWSER_PATH.',
  }
}

function findBinary(root: string, names: string[], requiredVersion?: string): string | null {
  if (!existsSync(root)) return null
  const wanted = new Set(names)
  const pending = [root]
  let visited = 0
  while (pending.length && visited < 20_000) {
    const current = pending.pop()!
    let entries
    try {
      entries = readdirSync(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      visited += 1
      const candidate = join(current, entry.name)
      if (
        entry.isFile() &&
        wanted.has(entry.name) &&
        (!requiredVersion || candidate.includes(requiredVersion)) &&
        probeBrowserExecutable(candidate).ok
      ) return candidate
      if (entry.isDirectory()) pending.push(candidate)
    }
  }
  return null
}

function findExecutableOnPath(name: string): string | null {
  for (const root of (process.env.PATH || '').split(delimiter)) {
    if (!root) continue
    const candidate = join(root, process.platform === 'win32' ? `${name}.exe` : name)
    if (probeBrowserExecutable(candidate).ok) return candidate
  }
  return null
}

function isExecutableFile(path: string): boolean {
  try {
    if (!statSync(path).isFile()) return false
    accessSync(path, process.platform === 'win32' ? constants.F_OK : constants.X_OK)
    return true
  } catch {
    return false
  }
}

export interface EnsureBrowserOptions {
  /** Cache directory for downloads. */
  cacheDir: string
  /**
   * Mirror base for chrome-for-testing.
   * Default: npmmirror (domestic). Override with empty string for Google CDN.
   */
  mirrorBase?: string
  /** Platform: mac/linux/win. Auto-detect if omitted. */
  platform?: 'mac-arm64' | 'mac-x64' | 'linux64' | 'linux-arm64' | 'win64'
  log?: (msg: string) => void
}

/**
 * Ensure the Hyperframes-pinned chrome-headless-shell binary exists.
 */
export async function ensureBrowser(opts: EnsureBrowserOptions): Promise<BrowserResolveResult> {
  const existing = resolveBrowserPath(opts.cacheDir)
  if (existing.path) return existing

  mkdirSync(opts.cacheDir, { recursive: true })
  const log = opts.log ?? ((m: string) => process.stderr.write(`[browser] ${m}\n`))

  const platform = opts.platform ?? detectPlatform()
  const mirror =
    opts.mirrorBase ??
    process.env.CRABCODE_CHROME_MIRROR ??
    ''

  log(`Installing chrome-headless-shell ${PINNED_CHROME_VERSION} for ${platform} (mirror=${mirror || 'default'})…`)

  try {
    const { Browser, BrowserPlatform, install } = await import('@puppeteer/browsers')
    const platformMap: Record<NonNullable<EnsureBrowserOptions['platform']>, (typeof BrowserPlatform)[keyof typeof BrowserPlatform]> = {
      'mac-arm64': BrowserPlatform.MAC_ARM,
      'mac-x64': BrowserPlatform.MAC,
      linux64: BrowserPlatform.LINUX,
      'linux-arm64': BrowserPlatform.LINUX_ARM,
      win64: BrowserPlatform.WIN64,
    }
    const installed = await install({
      browser: Browser.CHROMEHEADLESSSHELL,
      buildId: PINNED_CHROME_VERSION,
      cacheDir: opts.cacheDir,
      platform: platformMap[platform],
      baseUrl: mirror || undefined,
      downloadProgressCallback: (downloaded, total) => {
        if (total > 0) log(`download ${Math.floor((downloaded / total) * 100)}%`)
      },
    })
    if (installed.executablePath && probeBrowserExecutable(installed.executablePath).ok) {
      process.env.HYPERFRAMES_BROWSER_PATH = installed.executablePath
      process.env.PRODUCER_HEADLESS_SHELL_PATH = installed.executablePath
      return { path: installed.executablePath, source: 'cache', message: `Installed browser: ${installed.executablePath}` }
    }
  } catch (error) {
    return {
      path: null,
      source: 'missing',
      message: `Browser install failed: ${error instanceof Error ? error.message : String(error)}. Set HYPERFRAMES_BROWSER_PATH or install chromium manually.`,
    }
  }

  const after = resolveBrowserPath(opts.cacheDir)
  if (after.path) {
    // Wire env for downstream hyperframes
    process.env.HYPERFRAMES_BROWSER_PATH = after.path
    process.env.PRODUCER_HEADLESS_SHELL_PATH = after.path
    return { ...after, message: `Installed browser: ${after.path}` }
  }

  return {
    path: null,
    source: 'missing',
    message: 'Browser install reported success but binary not found in cache.',
  }
}

function detectPlatform(): NonNullable<EnsureBrowserOptions['platform']> {
  const p = process.platform
  const a = process.arch
  if (p === 'darwin' && a === 'arm64') return 'mac-arm64'
  if (p === 'darwin' && a === 'x64') return 'mac-x64'
  if (p === 'linux' && a === 'arm64') return 'linux-arm64'
  if (p === 'linux' && a === 'x64') return 'linux64'
  if (p === 'win32' && (a === 'x64' || a === 'arm64')) return 'win64'
  throw new Error(`unsupported browser platform: ${p}/${a}`)
}
