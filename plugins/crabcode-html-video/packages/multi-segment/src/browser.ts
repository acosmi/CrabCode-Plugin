import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

export interface BrowserResolveResult {
  path: string | null
  source: 'env' | 'cache' | 'system' | 'missing'
  message: string
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
  if (env && existsSync(env)) {
    return { path: env, source: 'env', message: `Using browser from env: ${env}` }
  }

  const roots = [
    cacheDir,
    process.env.CRABCODE_PLUGIN_DATA ? join(process.env.CRABCODE_PLUGIN_DATA, 'browsers') : null,
    process.env.HOME ? join(process.env.HOME, '.cache', 'puppeteer') : null,
    process.env.HOME ? join(process.env.HOME, '.cache', 'ms-playwright') : null,
    '/root/.cache/puppeteer',
    '/root/.cache/ms-playwright',
  ].filter(Boolean) as string[]

  for (const root of roots) {
    const found = findBinary(root, CHROME_NAMES)
    if (found) {
      return { path: found, source: 'cache', message: `Found browser in cache: ${found}` }
    }
  }

  // System chromium (linux worker / brew)
  for (const name of ['chromium', 'chromium-browser', 'google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']) {
    if (name.startsWith('/') && existsSync(name)) {
      return { path: name, source: 'system', message: `Using system browser: ${name}` }
    }
  }

  return {
    path: null,
    source: 'missing',
    message:
      'No browser found. Run doctor to download chrome-headless-shell (npmmirror mirror supported), or set HYPERFRAMES_BROWSER_PATH.',
  }
}

function findBinary(root: string, names: string[]): string | null {
  if (!existsSync(root)) return null
  try {
    // lazy require keeps this file usable before types resolve
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { execSync } = require('node:child_process') as typeof import('node:child_process')
    for (const name of names) {
      try {
        const out = execSync(
          `find ${JSON.stringify(root)} -name ${JSON.stringify(name)} -type f 2>/dev/null | head -1`,
          {
            encoding: 'utf-8',
            timeout: 10_000,
          },
        ).trim()
        if (out && existsSync(out)) return out
      } catch {
        // continue
      }
    }
  } catch {
    // ignore
  }
  return null
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
  platform?: 'mac-arm64' | 'mac-x64' | 'linux64' | 'win64'
  log?: (msg: string) => void
}

/**
 * Ensure a chrome-headless-shell binary exists. Uses @puppeteer/browsers when available;
 * otherwise downloads via npmmirror chrome-for-testing mirror.
 */
export async function ensureBrowser(opts: EnsureBrowserOptions): Promise<BrowserResolveResult> {
  const existing = resolveBrowserPath(opts.cacheDir)
  if (existing.path) return existing

  mkdirSync(opts.cacheDir, { recursive: true })
  const log = opts.log ?? ((m: string) => process.stderr.write(`[browser] ${m}\n`))

  // Try @puppeteer/browsers install with optional mirror
  const platform = opts.platform ?? detectPlatform()
  const mirror =
    opts.mirrorBase ??
    process.env.CRABCODE_CHROME_MIRROR ??
    'https://cdn.npmmirror.com/binaries/chrome-for-testing'

  log(`Installing chrome-headless-shell for ${platform} (mirror=${mirror || 'default'})…`)

  // Prefer npx @puppeteer/browsers; set download base via env if supported
  const env = {
    ...process.env,
    // puppeteer browsers respects PUPPETEER_DOWNLOAD_BASE_URL in some versions
    PUPPETEER_DOWNLOAD_BASE_URL: mirror || process.env.PUPPETEER_DOWNLOAD_BASE_URL || '',
  }

  const code = await new Promise<number>((resolvePromise) => {
    const child = spawn(
      'npx',
      ['--yes', '@puppeteer/browsers', 'install', 'chrome-headless-shell@stable', `--path`, opts.cacheDir],
      { env, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    child.stdout.on('data', (d) => log(String(d).trimEnd()))
    child.stderr.on('data', (d) => log(String(d).trimEnd()))
    child.on('error', () => resolvePromise(1))
    child.on('close', (c) => resolvePromise(c ?? 1))
  })

  if (code !== 0) {
    return {
      path: null,
      source: 'missing',
      message: `Browser install failed (exit ${code}). Set HYPERFRAMES_BROWSER_PATH or install chromium manually.`,
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

function detectPlatform(): EnsureBrowserOptions['platform'] {
  const p = process.platform
  const a = process.arch
  if (p === 'darwin') return a === 'arm64' ? 'mac-arm64' : 'mac-x64'
  if (p === 'win32') return 'win64'
  return 'linux64'
}
