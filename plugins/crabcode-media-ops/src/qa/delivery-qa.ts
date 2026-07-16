import AxeBuilder from '@axe-core/playwright'
import { chromium, type Browser, type Page } from '@playwright/test'
import { spawn } from 'node:child_process'
import { createServer, type Server } from 'node:http'
import { createRequire } from 'node:module'
import { mkdir, readFile, realpath, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { artifactRef, sha256Bytes, writeJson } from './artifacts.ts'
import type { DeliveryQaResult, QaArtifactRef, QaCheckResult, QaStatus, QaToolVersions } from './types.ts'

const BROWSER_LAUNCH_TIMEOUT_MS = 45_000
const PAGE_GOTO_TIMEOUT_MS = 30_000
const BROWSER_SEGMENT_TIMEOUT_MS = 120_000
const CROSS_PROCESS_LOCK_STALE_MS = 10 * 60_000
const CROSS_PROCESS_LOCK_WAIT_MS = 180_000
const CROSS_PROCESS_LOCK_PATH = join(tmpdir(), 'mediaops-delivery-qa.cross-process.lock')

/** Process-lifetime Chromium: avoid repeated launch/close IPC races under Bun test fan-out. */
let sharedBrowser: Browser | null = null
let sharedBrowserLaunch: Promise<Browser> | null = null
let sharedBrowserExecutable: string | undefined

function isInfraErrorMessage(message: string): boolean {
  return /ENOENT|ECONNREFUSED|EAGAIN|ETIMEDOUT|Failed to connect|browserType\.launch|Target closed|Protocol error/i.test(message)
}

async function acquireCrossProcessLock(): Promise<() => Promise<void>> {
  const started = Date.now()
  while (true) {
    try {
      await writeFile(CROSS_PROCESS_LOCK_PATH, `${process.pid}\n${Date.now()}\n`, { flag: 'wx' })
      return async () => {
        await unlink(CROSS_PROCESS_LOCK_PATH).catch(() => undefined)
      }
    } catch {
      try {
        const raw = await readFile(CROSS_PROCESS_LOCK_PATH, 'utf8')
        const stamped = Number(raw.split('\n')[1] ?? '')
        if (Number.isFinite(stamped) && Date.now() - stamped > CROSS_PROCESS_LOCK_STALE_MS) {
          await unlink(CROSS_PROCESS_LOCK_PATH).catch(() => undefined)
          continue
        }
      } catch {
        // Lock disappeared between failed create and read; retry.
      }
      if (Date.now() - started > CROSS_PROCESS_LOCK_WAIT_MS) {
        throw new Error(`qa_infrastructure_failed: timed out after ${CROSS_PROCESS_LOCK_WAIT_MS}ms waiting for ${CROSS_PROCESS_LOCK_PATH}`)
      }
      await new Promise((resolveWait) => setTimeout(resolveWait, 100))
    }
  }
}

async function getSharedBrowser(executablePath: string | undefined): Promise<{ browser: Browser; launchMs: number }> {
  if (sharedBrowser && sharedBrowser.isConnected() && sharedBrowserExecutable === executablePath) {
    return { browser: sharedBrowser, launchMs: 0 }
  }
  if (sharedBrowser) {
    await sharedBrowser.close().catch(() => undefined)
    sharedBrowser = null
    sharedBrowserLaunch = null
  }
  if (!sharedBrowserLaunch) {
    const launchStarted = Date.now()
    sharedBrowserExecutable = executablePath
    sharedBrowserLaunch = chromium.launch({
      headless: true,
      timeout: BROWSER_LAUNCH_TIMEOUT_MS,
      ...(executablePath ? { executablePath } : {}),
    }).then((browser) => {
      sharedBrowser = browser
      return browser
    }).catch((error) => {
      sharedBrowserLaunch = null
      sharedBrowser = null
      const message = errorMessage(error)
      throw new Error(isInfraErrorMessage(message)
        ? `qa_infrastructure_failed: chromium.launch ${message}`
        : message)
    })
    const browser = await sharedBrowserLaunch
    return { browser, launchMs: Date.now() - launchStarted }
  }
  const launchStarted = Date.now()
  const browser = await sharedBrowserLaunch
  return { browser, launchMs: Date.now() - launchStarted }
}

function installBrowserShutdownHooks(): void {
  const close = () => {
    const browser = sharedBrowser
    sharedBrowser = null
    sharedBrowserLaunch = null
    void browser?.close().catch(() => undefined)
  }
  process.once('exit', close)
  process.once('beforeExit', close)
  process.once('SIGINT', () => { close(); process.exit(130) })
  process.once('SIGTERM', () => { close(); process.exit(143) })
}

let browserHooksInstalled = false
function ensureBrowserHooks(): void {
  if (browserHooksInstalled) return
  browserHooksInstalled = true
  installBrowserShutdownHooks()
}

const REQUIRED_PLAYWRIGHT_VERSION = '1.61.1'
const REQUIRED_AXE_VERSION = '4.12.1'
const REQUIRED_VNU_VERSION = '26.7.15'
const REQUIRED_CHROMIUM_VERSION = '149.0.7827.55'
const VIEWPORTS = [320, 375, 768, 1440] as const
const COLOR_SCHEMES = ['light', 'dark'] as const
const WHITE = 'rgb(255, 255, 255)'
const require = createRequire(import.meta.url)

type CommandResult = {
  command: string[]
  exitCode: number | null
  signal: NodeJS.Signals | null
  stdout: string
  stderr: string
  spawnError: string | null
  timedOut: boolean
  outputLimitExceeded: boolean
}

type ArtifactServer = {
  server: Server
  port: number
  stop: () => Promise<void>
}

type MutableBrowserReport = {
  schemaVersion: 'mediaops-browser-qa@1'
  status: QaStatus
  startedAt: string
  completedAt: string | null
  source: QaArtifactRef
  tools: {
    playwright: string
    axe: string
    chromium: string | null
    requiredChromium: string
    executablePath: string
  }
  timing: {
    queueWaitMs: number
    browserLaunchMs: number
    totalMs: number
  }
  viewportRuns: unknown[]
  stressRuns: unknown[]
  printRuns: unknown[]
  checks: QaCheckResult[]
  evidence: QaArtifactRef[]
  errors: string[]
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function javaMajor(versionLine: string): number | null {
  const match = versionLine.match(/version\s+"(?:(\d+)\.)?(\d+)/i)
  if (!match) return null
  const major = Number(match[1] ?? match[2])
  return Number.isInteger(major) ? major : null
}

async function resolvePackageJson(packageName: string): Promise<string> {
  try {
    return require.resolve(`${packageName}/package.json`)
  } catch {
    let current = dirname(require.resolve(packageName))
    while (true) {
      const candidate = join(current, 'package.json')
      try {
        const parsed = JSON.parse(await readFile(candidate, 'utf8')) as { name?: unknown }
        if (parsed.name === packageName) return candidate
      } catch {
        // Continue walking to the package root.
      }
      const parent = dirname(current)
      if (parent === current) break
      current = parent
    }
    throw new Error(`Cannot locate package.json for ${packageName}.`)
  }
}

async function packageVersion(packageName: string): Promise<string> {
  const packageJsonPath = await resolvePackageJson(packageName)
  const parsed = JSON.parse(await readFile(packageJsonPath, 'utf8')) as { version?: unknown }
  if (typeof parsed.version !== 'string' || !parsed.version) throw new Error(`${packageName} has no readable package version.`)
  return parsed.version
}

async function runCommand(command: string[], cwd: string): Promise<CommandResult> {
  const timeoutMs = 60_000
  const maxOutputBytes = 8 * 1024 * 1024
  return await new Promise<CommandResult>((resolveResult) => {
    let stdout = ''
    let stderr = ''
    let spawnError: string | null = null
    let timedOut = false
    let outputLimitExceeded = false
    let settled = false
    const subprocess = spawn(command[0], command.slice(1), { cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] })
    const finish = (exitCode: number | null, signal: NodeJS.Signals | null): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolveResult({ command, exitCode, signal, stdout, stderr, spawnError, timedOut, outputLimitExceeded })
    }
    const collect = (target: 'stdout' | 'stderr', chunk: Buffer): void => {
      if (target === 'stdout') stdout += chunk.toString('utf8')
      else stderr += chunk.toString('utf8')
      if (Buffer.byteLength(stdout) + Buffer.byteLength(stderr) > maxOutputBytes) {
        outputLimitExceeded = true
        subprocess.kill('SIGKILL')
      }
    }
    subprocess.stdout.on('data', (chunk: Buffer) => collect('stdout', chunk))
    subprocess.stderr.on('data', (chunk: Buffer) => collect('stderr', chunk))
    subprocess.once('error', (error) => {
      spawnError = errorMessage(error)
      finish(null, null)
    })
    subprocess.once('close', (exitCode, signal) => finish(exitCode, signal))
    const timer = setTimeout(() => {
      timedOut = true
      subprocess.kill('SIGKILL')
    }, timeoutMs)
  })
}

function parseNuJson(stdout: string, stderr: string): { messages: unknown[]; raw: unknown } | null {
  for (const candidate of [stdout, stderr, `${stdout}\n${stderr}`]) {
    const trimmed = candidate.trim()
    if (!trimmed) continue
    try {
      const parsed = JSON.parse(trimmed) as { messages?: unknown }
      if (Array.isArray(parsed.messages)) return { messages: parsed.messages, raw: parsed }
    } catch {
      // Keep trying: vnu output placement differs between launchers and versions.
    }
  }
  return null
}

function isInside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate)
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))
}

async function resolveHtmlInput(artifactRoot: string, htmlRelativePath: string): Promise<{ root: string; htmlPath: string }> {
  if (!htmlRelativePath || isAbsolute(htmlRelativePath) || htmlRelativePath.includes('\\')) {
    throw new Error('htmlRelativePath must be a non-empty package-relative POSIX path.')
  }
  const segments = htmlRelativePath.split('/')
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error('htmlRelativePath must be canonical and may not contain dot segments.')
  }
  if (segments[0] === 'qa') throw new Error('The HTML input may not live inside the generated qa directory.')

  const root = await realpath(resolve(artifactRoot))
  const htmlPath = await realpath(resolve(root, htmlRelativePath))
  if (!isInside(root, htmlPath)) throw new Error('htmlRelativePath resolves outside artifactRoot.')
  const info = await stat(htmlPath)
  if (!info.isFile()) throw new Error('htmlRelativePath must resolve to a regular file.')
  return { root, htmlPath }
}

async function backgroundSnapshot(page: Page): Promise<{ values: Record<string, string>; allWhite: boolean }> {
  return page.evaluate((white) => {
    const selectors = ['html', 'body', 'main', '.article-shell', 'article.media-article']
    const values: Record<string, string> = {}
    for (const selector of selectors) {
      const element = document.querySelector(selector)
      values[selector] = element ? getComputedStyle(element).backgroundColor : 'missing'
    }
    return { values, allWhite: Object.values(values).every((value) => value === white) }
  }, WHITE)
}

async function overflowSnapshot(page: Page): Promise<{
  clientWidth: number
  scrollWidth: number
  horizontalOverflow: number
  clippedTextElements: Array<{ tag: string; className: string; overflowX: string; overflowY: string }>
}> {
  return page.evaluate(() => {
    const root = document.documentElement
    const clippedTextElements = Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .filter((element) => (element.innerText ?? '').trim().length > 0)
      .map((element) => {
        const style = getComputedStyle(element)
        const clippedX = style.overflowX === 'hidden' && element.scrollWidth > element.clientWidth + 1
        const clippedY = style.overflowY === 'hidden' && element.scrollHeight > element.clientHeight + 1
        return clippedX || clippedY
          ? { tag: element.tagName.toLowerCase(), className: element.className, overflowX: style.overflowX, overflowY: style.overflowY }
          : null
      })
      .filter((item): item is { tag: string; className: string; overflowX: string; overflowY: string } => item !== null)
    return {
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      horizontalOverflow: Math.max(0, root.scrollWidth - root.clientWidth),
      clippedTextElements,
    }
  })
}

async function waitForStablePage(page: Page): Promise<void> {
  await page.waitForLoadState('load')
  await page.evaluate(async () => {
    if ('fonts' in document) await document.fonts.ready
    const images = Array.from(document.images)
    for (const image of images) image.loading = 'eager'
    await Promise.all(images.map(async (image) => {
      if (!image.complete) {
        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(() => reject(new Error(`Image load timed out: ${image.currentSrc || image.src}`)), 10_000)
          image.addEventListener('load', () => { window.clearTimeout(timeout); resolve() }, { once: true })
          image.addEventListener('error', () => { window.clearTimeout(timeout); reject(new Error(`Image failed to load: ${image.currentSrc || image.src}`)) }, { once: true })
        })
      }
      if (!image.naturalWidth || !image.naturalHeight) throw new Error(`Image has no decodable pixels: ${image.currentSrc || image.src}`)
      if (typeof image.decode === 'function') await image.decode()
    }))
  })
}

function contentType(path: string): string {
  const types: Record<string, string> = {
    '.css': 'text/css; charset=utf-8',
    '.gif': 'image/gif',
    '.html': 'text/html; charset=utf-8',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  }
  return types[extname(path).toLowerCase()] ?? 'application/octet-stream'
}

function inspectPdf(bytes: Buffer, format: 'A4' | 'Letter'): {
  validHeader: boolean
  pageCount: number
  contentReferenceCount: number
  mediaBoxes: Array<{ widthPoints: number; heightPoints: number }>
  expected: { widthPoints: number; heightPoints: number; tolerancePoints: number }
  passed: boolean
} {
  const text = bytes.toString('latin1')
  const validHeader = bytes.subarray(0, 5).toString() === '%PDF-'
  const pageCount = [...text.matchAll(/\/Type\s*\/Page\b/g)].length
  const contentReferenceCount = [...text.matchAll(/\/Contents(?:\s+\d+\s+\d+\s+R|\s*\[)/g)].length
  const mediaBoxes = [...text.matchAll(/\/MediaBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]/g)]
    .map((match) => ({
      widthPoints: Number(match[3]) - Number(match[1]),
      heightPoints: Number(match[4]) - Number(match[2]),
    }))
  const expected = format === 'A4'
    ? { widthPoints: 595.92, heightPoints: 842.88, tolerancePoints: 1 }
    : { widthPoints: 612, heightPoints: 792, tolerancePoints: 1 }
  const dimensionsMatch = mediaBoxes.length === pageCount && mediaBoxes.every((box) =>
    Math.abs(box.widthPoints - expected.widthPoints) <= expected.tolerancePoints
    && Math.abs(box.heightPoints - expected.heightPoints) <= expected.tolerancePoints)
  return {
    validHeader,
    pageCount,
    contentReferenceCount,
    mediaBoxes,
    expected,
    passed: validHeader && bytes.byteLength > 1000 && pageCount > 0 && contentReferenceCount >= pageCount && dimensionsMatch,
  }
}

async function startArtifactServer(artifactRoot: string): Promise<ArtifactServer> {
  const server = createServer((request, response) => {
    void (async () => {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405).end('Method not allowed')
        return
      }
      let pathname: string
      try {
        pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname)
      } catch {
        response.writeHead(400).end('Bad path')
        return
      }
      const segments = pathname.split('/').filter(Boolean)
      if (segments.some((segment) => segment === '.' || segment === '..' || segment.includes('\\'))) {
        response.writeHead(403).end('Forbidden')
        return
      }
      const candidate = resolve(artifactRoot, ...segments)
      if (!isInside(artifactRoot, candidate)) {
        response.writeHead(403).end('Forbidden')
        return
      }
      let actualPath: string
      try {
        actualPath = await realpath(candidate)
        if (!isInside(artifactRoot, actualPath) || !(await stat(actualPath)).isFile()) throw new Error('Not a served file')
      } catch {
        response.writeHead(404).end('Not found')
        return
      }
      const bytes = request.method === 'HEAD' ? null : await readFile(actualPath)
      response.writeHead(200, {
        'Content-Type': contentType(actualPath),
        'Content-Length': String((await stat(actualPath)).size),
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      })
      response.end(bytes)
    })().catch((error) => {
      if (!response.headersSent) response.writeHead(500)
      response.end(errorMessage(error))
    })
  })
  await new Promise<void>((resolveListening, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject)
      resolveListening()
    })
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('QA artifact server did not receive a TCP port.')
  return {
    server,
    port: address.port,
    stop: async () => await new Promise<void>((resolveStopped, reject) => server.close((error) => error ? reject(error) : resolveStopped())),
  }
}

async function runNuQa(args: {
  artifactRoot: string
  htmlPath: string
  html: QaArtifactRef
  qaRoot: string
  javaBin: string
  vnuVersion: string
}): Promise<{ report: QaArtifactRef; status: QaStatus; check: QaCheckResult; javaVersion: string | null; runtimeVersion: string | null; errors: string[] }> {
  const startedAt = new Date().toISOString()
  const errors: string[] = []
  const vnuPackagePath = await resolvePackageJson('vnu-jar')
  const jarPath = join(dirname(vnuPackagePath), 'build', 'dist', 'vnu.jar')
  const jar = await artifactRef(dirname(jarPath), jarPath)
  const javaProbe = await runCommand([args.javaBin, '-version'], args.artifactRoot)
  const javaVersion = javaProbe.exitCode === 0
    ? (javaProbe.stderr || javaProbe.stdout).trim().split(/\r?\n/)[0] ?? null
    : null
  if (javaProbe.spawnError) errors.push(`Java executable unavailable: ${javaProbe.spawnError}`)
  else if (javaProbe.timedOut) errors.push('Java version probe timed out.')
  else if (javaProbe.signal) errors.push(`Java version probe ended by signal ${javaProbe.signal}.`)
  else if (javaProbe.outputLimitExceeded) errors.push('Java version probe exceeded the output limit.')
  else if (javaProbe.exitCode !== 0) errors.push(`Java version probe exited ${javaProbe.exitCode}: ${(javaProbe.stderr || javaProbe.stdout).trim()}`)
  else if (javaVersion && (javaMajor(javaVersion) ?? 0) < 17) errors.push(`Nu ${REQUIRED_VNU_VERSION} requires Java 17 or newer; found ${javaVersion}.`)

  let runtimeProbe: CommandResult | null = null
  let validation: CommandResult | null = null
  let parsed: { messages: unknown[]; raw: unknown } | null = null
  if (javaVersion) {
    runtimeProbe = await runCommand([args.javaBin, '-jar', jarPath, '--version'], args.artifactRoot)
    if (runtimeProbe.exitCode !== 0) {
      errors.push(`Nu runtime version probe failed: ${runtimeProbe.spawnError ?? (runtimeProbe.stderr || runtimeProbe.stdout).trim()}`)
    }
    validation = await runCommand([args.javaBin, '-jar', jarPath, '--format', 'json', '--errors-only', args.htmlPath], args.artifactRoot)
    parsed = parseNuJson(validation.stdout, validation.stderr)
    if (validation.spawnError) errors.push(`Nu Html Checker could not start: ${validation.spawnError}`)
    if (validation.timedOut) errors.push('Nu Html Checker timed out after 60 seconds.')
    if (validation.signal) errors.push(`Nu Html Checker ended by signal ${validation.signal}.`)
    if (validation.outputLimitExceeded) errors.push('Nu Html Checker exceeded the 8 MiB output limit.')
    if (!parsed) errors.push('Nu Html Checker did not return parseable JSON output.')
    if (validation.exitCode !== 0) errors.push(`Nu Html Checker reported exit code ${validation.exitCode}.`)
    if (parsed && parsed.messages.length > 0) errors.push(`Nu Html Checker reported ${parsed.messages.length} HTML error(s).`)
  }
  const runtimeVersion = runtimeProbe?.exitCode === 0 ? (runtimeProbe.stdout || runtimeProbe.stderr).trim() : null
  if (args.vnuVersion !== REQUIRED_VNU_VERSION) errors.push(`Expected vnu-jar ${REQUIRED_VNU_VERSION}, found ${args.vnuVersion}.`)
  if (runtimeVersion && !runtimeVersion.startsWith(REQUIRED_VNU_VERSION)) {
    errors.push(`Expected Nu runtime ${REQUIRED_VNU_VERSION}, found ${runtimeVersion}.`)
  }
  const status: QaStatus = errors.length === 0 ? 'passed' : 'failed'
  const reportPath = join(args.qaRoot, 'nu-report.json')
  await writeJson(reportPath, {
    schemaVersion: 'mediaops-nu-qa@1',
    status,
    startedAt,
    completedAt: new Date().toISOString(),
    source: args.html,
    tools: {
      javaExecutable: args.javaBin,
      javaVersion,
      vnuPackageVersion: args.vnuVersion,
      vnuRuntimeVersion: runtimeVersion,
      jarPath,
      jarSha256: jar.sha256,
      jarByteSize: jar.byteSize,
    },
    javaProbe,
    runtimeProbe,
    validation,
    messages: parsed?.messages ?? [],
    rawResult: parsed?.raw ?? null,
    errors,
  })
  const report = await artifactRef(args.artifactRoot, reportPath)
  return {
    report,
    status,
    check: {
      id: 'nu-html-validator',
      status,
      detail: status === 'passed' ? 'Nu Html Checker returned valid JSON with zero HTML errors.' : errors.join(' '),
      evidence: [report.relativePath],
    },
    javaVersion,
    runtimeVersion,
    errors,
  }
}

async function addScreenshotEvidence(args: {
  page: Page
  path: string
  artifactRoot: string
  evidence: QaArtifactRef[]
}): Promise<QaArtifactRef> {
  await args.page.screenshot({ path: args.path, fullPage: true, animations: 'disabled' })
  const ref = await artifactRef(args.artifactRoot, args.path)
  args.evidence.push(ref)
  return ref
}

function addCheck(report: MutableBrowserReport, id: string, passed: boolean, detail: string, evidence?: string[]): void {
  report.checks.push({ id, status: passed ? 'passed' : 'failed', detail, ...(evidence?.length ? { evidence } : {}) })
  if (!passed) report.errors.push(`${id}: ${detail}`)
}

async function runBrowserQa(args: {
  artifactRoot: string
  htmlPath: string
  html: QaArtifactRef
  qaRoot: string
  playwrightVersion: string
  axeVersion: string
  queueWaitMs: number
}): Promise<{ report: QaArtifactRef; status: QaStatus; checks: QaCheckResult[]; evidence: QaArtifactRef[]; chromiumVersion: string | null; errors: string[] }> {
  ensureBrowserHooks()
  const screenshotsRoot = join(args.qaRoot, 'screenshots')
  const printRoot = join(args.qaRoot, 'print')
  await mkdir(screenshotsRoot, { recursive: true })
  await mkdir(printRoot, { recursive: true })
  const startedMs = Date.now()

  const reportData: MutableBrowserReport = {
    schemaVersion: 'mediaops-browser-qa@1',
    status: 'failed',
    startedAt: new Date().toISOString(),
    completedAt: null,
    source: args.html,
    tools: {
      playwright: args.playwrightVersion,
      axe: args.axeVersion,
      chromium: null,
      requiredChromium: REQUIRED_CHROMIUM_VERSION,
      executablePath: process.env.MEDIAOPS_QA_CHROMIUM_EXECUTABLE?.trim() || chromium.executablePath(),
    },
    timing: {
      queueWaitMs: args.queueWaitMs,
      browserLaunchMs: 0,
      totalMs: 0,
    },
    viewportRuns: [],
    stressRuns: [],
    printRuns: [],
    checks: [],
    evidence: [],
    errors: [],
  }
  if (args.playwrightVersion !== REQUIRED_PLAYWRIGHT_VERSION) {
    reportData.errors.push(`Expected @playwright/test ${REQUIRED_PLAYWRIGHT_VERSION}, found ${args.playwrightVersion}.`)
  }
  if (args.axeVersion !== REQUIRED_AXE_VERSION) {
    reportData.errors.push(`Expected @axe-core/playwright ${REQUIRED_AXE_VERSION}, found ${args.axeVersion}.`)
  }

  let server: ArtifactServer | null = null
  try {
    const executablePath = process.env.MEDIAOPS_QA_CHROMIUM_EXECUTABLE?.trim() || undefined
    const { browser, launchMs } = await getSharedBrowser(executablePath)
    reportData.timing.browserLaunchMs = launchMs
    reportData.tools.chromium = browser.version()
    if (reportData.tools.chromium !== REQUIRED_CHROMIUM_VERSION) {
      reportData.errors.push(`Expected bundled Chromium ${REQUIRED_CHROMIUM_VERSION}, found ${reportData.tools.chromium}.`)
    }
    server = await startArtifactServer(args.artifactRoot)
    const relativeHtml = relative(args.artifactRoot, args.htmlPath).split(sep).map(encodeURIComponent).join('/')
    const htmlUrl = `http://127.0.0.1:${server.port}/${relativeHtml}`

    const runWithBrowserBudget = async (): Promise<void> => {
    for (const width of VIEWPORTS) {
      for (const colorScheme of COLOR_SCHEMES) {
        const context = await browser.newContext({
          viewport: { width, height: 900 },
          colorScheme,
          locale: 'zh-CN',
          reducedMotion: 'reduce',
        })
        try {
          const page = await context.newPage()
          await page.goto(htmlUrl, { waitUntil: 'load', timeout: PAGE_GOTO_TIMEOUT_MS })
          await waitForStablePage(page)
          const background = await backgroundSnapshot(page)
          const overflow = await overflowSnapshot(page)
          const axe = await new AxeBuilder({ page }).analyze()
          const screenshot = await addScreenshotEvidence({
            page,
            path: join(screenshotsRoot, `viewport-${width}-${colorScheme}.png`),
            artifactRoot: args.artifactRoot,
            evidence: reportData.evidence,
          })
          const run = {
            width,
            height: 900,
            colorScheme,
            background,
            overflow,
            axe: {
              testEngine: axe.testEngine,
              testEnvironment: axe.testEnvironment,
              violationCount: axe.violations.length,
              violations: axe.violations,
              incomplete: axe.incomplete,
            },
            screenshot,
          }
          reportData.viewportRuns.push(run)
          addCheck(reportData, `viewport-${width}-${colorScheme}-white`, background.allWhite,
            background.allWhite ? 'All required page containers resolve to rgb(255, 255, 255).' : JSON.stringify(background.values), [screenshot.relativePath])
          const viewportFits = overflow.horizontalOverflow === 0 && overflow.clippedTextElements.length === 0
          addCheck(reportData, `viewport-${width}-${colorScheme}-overflow`, viewportFits,
            viewportFits
              ? `documentElement clientWidth=${overflow.clientWidth}, scrollWidth=${overflow.scrollWidth}; no hidden clipped text.`
              : JSON.stringify(overflow), [screenshot.relativePath])
          addCheck(reportData, `viewport-${width}-${colorScheme}-axe`, axe.violations.length === 0,
            axe.violations.length === 0 ? 'axe found zero accessibility violations.' : `axe found ${axe.violations.length} violation(s).`, [screenshot.relativePath])
          addCheck(reportData, `viewport-${width}-${colorScheme}-axe-incomplete`, axe.incomplete.length === 0,
            axe.incomplete.length === 0 ? 'axe returned no results requiring manual determination.' : `axe returned ${axe.incomplete.length} incomplete result(s) that require review.`, [screenshot.relativePath])
        } finally {
          await context.close()
        }
      }
    }

    const stressContext = await browser.newContext({ viewport: { width: 375, height: 900 }, colorScheme: 'light', locale: 'zh-CN' })
    try {
      const page = await stressContext.newPage()
      await page.goto(htmlUrl, { waitUntil: 'load', timeout: PAGE_GOTO_TIMEOUT_MS })
      await waitForStablePage(page)
      await page.addStyleTag({ content: `
        *:not(svg *) {
          line-height: 1.5 !important;
          letter-spacing: 0.12em !important;
          word-spacing: 0.16em !important;
        }
        p { margin-bottom: 2em !important; }
      ` })
      const textSpacingOverflow = await overflowSnapshot(page)
      const textSpacingShot = await addScreenshotEvidence({
        page,
        path: join(screenshotsRoot, 'stress-text-spacing-375.png'),
        artifactRoot: args.artifactRoot,
        evidence: reportData.evidence,
      })
      const textSpacingPassed = textSpacingOverflow.horizontalOverflow === 0 && textSpacingOverflow.clippedTextElements.length === 0
      reportData.stressRuns.push({ id: 'wcag-text-spacing', overflow: textSpacingOverflow, screenshot: textSpacingShot })
      addCheck(reportData, 'wcag-text-spacing', textSpacingPassed,
        textSpacingPassed ? 'No whole-page overflow or hidden clipped text after WCAG text-spacing overrides.' : JSON.stringify(textSpacingOverflow),
        [textSpacingShot.relativePath])

      await page.goto(htmlUrl, { waitUntil: 'load', timeout: PAGE_GOTO_TIMEOUT_MS })
      await waitForStablePage(page)
      await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll<HTMLElement>('h1,h2,h3,h4,p,li,a,blockquote,pre,code,th,td,figcaption'))
        const sizes = elements.map((element) => ({ element, size: Number.parseFloat(getComputedStyle(element).fontSize) }))
        for (const { element, size } of sizes) {
          if (Number.isFinite(size)) element.style.setProperty('font-size', `${size * 2}px`, 'important')
        }
      })
      const textZoomOverflow = await overflowSnapshot(page)
      const textZoomShot = await addScreenshotEvidence({
        page,
        path: join(screenshotsRoot, 'stress-text-200-percent-375.png'),
        artifactRoot: args.artifactRoot,
        evidence: reportData.evidence,
      })
      const textZoomPassed = textZoomOverflow.horizontalOverflow === 0 && textZoomOverflow.clippedTextElements.length === 0
      reportData.stressRuns.push({ id: 'text-200-percent', overflow: textZoomOverflow, screenshot: textZoomShot })
      addCheck(reportData, 'text-200-percent', textZoomPassed,
        textZoomPassed ? 'No whole-page overflow or hidden clipped text after doubling rendered text sizes.' : JSON.stringify(textZoomOverflow),
        [textZoomShot.relativePath])
    } finally {
      await stressContext.close()
    }

    const printContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'dark', locale: 'zh-CN' })
    try {
      const page = await printContext.newPage()
      await page.goto(htmlUrl, { waitUntil: 'load', timeout: PAGE_GOTO_TIMEOUT_MS })
      await waitForStablePage(page)
      await page.emulateMedia({ media: 'print', colorScheme: 'dark' })
      const printBackground = await backgroundSnapshot(page)
      const printShot = await addScreenshotEvidence({
        page,
        path: join(screenshotsRoot, 'print-media-dark-request.png'),
        artifactRoot: args.artifactRoot,
        evidence: reportData.evidence,
      })
      addCheck(reportData, 'print-background-white', printBackground.allWhite,
        printBackground.allWhite ? 'Print media remains white when the browser requests dark color scheme.' : JSON.stringify(printBackground.values),
        [printShot.relativePath])

      for (const format of ['A4', 'Letter'] as const) {
        const pdfPath = join(printRoot, `article-${format.toLowerCase()}.pdf`)
        await page.pdf({ path: pdfPath, format, printBackground: true, preferCSSPageSize: false })
        const bytes = await readFile(pdfPath)
        const pdf = await artifactRef(args.artifactRoot, pdfPath)
        reportData.evidence.push(pdf)
        const inspection = inspectPdf(bytes, format)
        reportData.printRuns.push({ format, inspection, artifact: pdf })
        addCheck(reportData, `print-${format.toLowerCase()}`, inspection.passed,
          inspection.passed
            ? `Chromium generated ${bytes.byteLength} bytes, ${inspection.pageCount} non-empty page object(s), all MediaBox dimensions match ${format}.`
            : JSON.stringify(inspection), [pdf.relativePath])
      }
    } finally {
      await printContext.close()
    }
    }

    await Promise.race([
      runWithBrowserBudget(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`qa_infrastructure_failed: browser segment exceeded ${BROWSER_SEGMENT_TIMEOUT_MS}ms`)), BROWSER_SEGMENT_TIMEOUT_MS)
      }),
    ])
  } catch (error) {
    const message = errorMessage(error)
    reportData.errors.push(isInfraErrorMessage(message)
      ? `qa_infrastructure_failed: ${message}`
      : `Playwright Chromium QA could not complete: ${message}`)
  } finally {
    // Contexts are closed per-run; shared browser stays warm for process lifetime.
    await server?.stop().catch(() => undefined)
  }

  reportData.timing.totalMs = Date.now() - startedMs
  reportData.status = reportData.errors.length === 0 && reportData.checks.every((check) => check.status === 'passed') ? 'passed' : 'failed'
  reportData.completedAt = new Date().toISOString()
  const reportPath = join(args.qaRoot, 'browser-report.json')
  await writeJson(reportPath, reportData)
  return {
    report: await artifactRef(args.artifactRoot, reportPath),
    status: reportData.status,
    checks: reportData.checks,
    evidence: reportData.evidence,
    chromiumVersion: reportData.tools.chromium,
    errors: reportData.errors,
  }
}

async function runDeliveryQaOnce(artifactRoot: string, htmlRelativePath: string, queueWaitMs: number): Promise<DeliveryQaResult> {
  const { root, htmlPath } = await resolveHtmlInput(artifactRoot, htmlRelativePath)
  const qaRoot = join(root, 'qa')
  await rm(qaRoot, { recursive: true, force: true })
  await mkdir(qaRoot, { recursive: true })
  const html = await artifactRef(root, htmlPath)
  const [playwrightVersion, axeVersion, vnuVersion] = await Promise.all([
    packageVersion('@playwright/test'),
    packageVersion('@axe-core/playwright'),
    packageVersion('vnu-jar'),
  ])

  const nu = await runNuQa({
    artifactRoot: root,
    htmlPath,
    html,
    qaRoot,
    javaBin: process.env.MEDIAOPS_QA_JAVA?.trim() || 'java',
    vnuVersion,
  })
  const browser = await runBrowserQa({ artifactRoot: root, htmlPath, html, qaRoot, playwrightVersion, axeVersion, queueWaitMs })
  const htmlAfterQa = await artifactRef(root, htmlPath)
  const htmlUnchanged = html.sha256 === htmlAfterQa.sha256 && html.byteSize === htmlAfterQa.byteSize
  const tools: QaToolVersions = {
    java: nu.javaVersion,
    vnuPackage: vnuVersion,
    vnuRuntime: nu.runtimeVersion,
    playwright: playwrightVersion,
    chromium: browser.chromiumVersion,
    axe: axeVersion,
  }
  const integrityCheck: QaCheckResult = {
    id: 'html-unchanged-during-qa',
    status: htmlUnchanged ? 'passed' : 'failed',
    detail: htmlUnchanged
      ? `HTML remained ${html.sha256} (${html.byteSize} bytes) through all QA checks.`
      : `HTML changed during QA: before=${html.sha256}/${html.byteSize}, after=${htmlAfterQa.sha256}/${htmlAfterQa.byteSize}.`,
  }
  const checks = [nu.check, ...browser.checks, integrityCheck]
  const errors = [...nu.errors, ...browser.errors, ...(htmlUnchanged ? [] : [integrityCheck.detail])]
  const status: QaStatus = nu.status === 'passed' && browser.status === 'passed' && htmlUnchanged ? 'passed' : 'failed'
  const evidence = [...browser.evidence]
  const summaryPath = join(qaRoot, 'summary.json')
  await writeJson(summaryPath, {
    schemaVersion: 'mediaops-delivery-qa-summary@1',
    status,
    generatedAt: new Date().toISOString(),
    artifactRoot: root,
    html,
    htmlAfterQa,
    tools,
    checks,
    reports: { nu: nu.report, browser: browser.report },
    evidence,
    errors,
    timing: { queueWaitMs },
  })
  const summary = await artifactRef(root, summaryPath)
  return {
    schemaVersion: 'mediaops-delivery-qa-result@1',
    status,
    artifactRoot: root,
    html,
    tools,
    checks,
    reports: { nu: nu.report, browser: browser.report, summary },
    evidence,
    errors,
  }
}

const MAX_CONCURRENT_QA_RUNS = 1
let activeQaRuns = 0
const qaWaiters: Array<() => void> = []
const qaRootQueues = new Map<string, Promise<void>>()

async function acquireQaSlot(): Promise<void> {
  if (activeQaRuns < MAX_CONCURRENT_QA_RUNS) {
    activeQaRuns++
    return
  }
  // When a waiter is released, activeQaRuns stays at MAX until that waiter finishes.
  await new Promise<void>((resolve) => qaWaiters.push(resolve))
}

function releaseQaSlot(): void {
  const next = qaWaiters.shift()
  if (next) next()
  else activeQaRuns--
}

/**
 * Chromium, Nu and their local artifact server use bounded process-wide
 * concurrency plus a cross-process lock, while calls for the same artifact
 * root are serialized. This prevents browser IPC exhaustion and avoids two
 * verifiers deleting the same qa/ directory.
 */
export async function runDeliveryQa(artifactRoot: string, htmlRelativePath: string): Promise<DeliveryQaResult> {
  const rootKey = resolve(artifactRoot)
  const previousForRoot = qaRootQueues.get(rootKey) ?? Promise.resolve()
  let releaseRoot: () => void = () => undefined
  const rootTail = new Promise<void>((resolveRoot) => {
    releaseRoot = resolveRoot
  })
  qaRootQueues.set(rootKey, rootTail)
  const waitStarted = Date.now()
  await previousForRoot
  await acquireQaSlot()
  const queueWaitMs = Date.now() - waitStarted
  const releaseCrossProcess = await acquireCrossProcessLock()
  try {
    return await runDeliveryQaOnce(artifactRoot, htmlRelativePath, queueWaitMs)
  } finally {
    await releaseCrossProcess()
    releaseQaSlot()
    releaseRoot()
    if (qaRootQueues.get(rootKey) === rootTail) qaRootQueues.delete(rootKey)
  }
}
