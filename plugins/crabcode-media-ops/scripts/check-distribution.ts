/**
 * Distribution gate for the self-contained MCP sidecar (audit §7.6/§8.2).
 *
 * 1. Freshness: rebuild dist/server.js into a temp dir with the exact
 *    package.json build command and compare (line-ending normalized) against the
 *    checked-out dist/server.js. Git-free so it also works in containers and
 *    tarball checkouts.
 * 2. Cold start: stage only dist/server.js in an empty directory (no
 *    node_modules, no sources, no lockfile) and complete a real MCP
 *    initialize -> tools/list -> mediaops.capabilities round trip within the
 *    startup budget, asserting that startup performs no dependency install and
 *    writes nothing outside MEDIAOPS_DATA_DIR.
 */
import { cp, mkdir, mkdtemp, readdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const EXPECTED_TOOL_COUNT = 38
const STARTUP_BUDGET_MS = Number(process.env.MEDIAOPS_SMOKE_TIMEOUT_MS ?? 10_000)

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const errors: string[] = []

function normalize(text: string): string {
  return text.replace(/\r\n/g, '\n')
}

async function buildToTemp(): Promise<string> {
  const pkg = JSON.parse(await readFile(join(pluginRoot, 'package.json'), 'utf8')) as { scripts?: Record<string, string> }
  const buildScript = pkg.scripts?.build
  if (!buildScript || !buildScript.includes('--outdir dist')) {
    throw new Error('package.json build script must bundle with `--outdir dist` so this check can rebuild it verbatim.')
  }
  const outDir = await mkdtemp(join(tmpdir(), 'mediaops-dist-check-'))
  const command = buildScript.replace('--outdir dist', `--outdir ${outDir}`)
  const proc = Bun.spawn(['bun', ...command.split(' ').slice(1)], { cwd: pluginRoot, stdout: 'pipe', stderr: 'pipe' })
  const exitCode = await proc.exited
  if (exitCode !== 0) {
    throw new Error(`rebuild failed (${exitCode}): ${await new Response(proc.stderr).text()}`)
  }
  return outDir
}

async function checkFreshness(tempOut: string): Promise<void> {
  const committed = normalize(await readFile(join(pluginRoot, 'dist', 'server.js'), 'utf8'))
  const rebuilt = normalize(await readFile(join(tempOut, 'server.js'), 'utf8'))
  if (committed !== rebuilt) {
    errors.push('dist/server.js is stale: rebuild output differs from the committed bundle. Run `bun run build` and commit dist/server.js.')
  }
  const extras = (await readdir(tempOut)).filter((entry) => entry !== 'server.js')
  if (extras.length) errors.push(`build emitted unexpected extra artifacts not covered by the distribution contract: ${extras.join(', ')}`)
}

async function coldStartSmoke(tempOut: string): Promise<{ startupMs: number; toolCount: number }> {
  const stage = await mkdtemp(join(tmpdir(), 'mediaops-cold-start-'))
  await mkdir(join(stage, 'dist'))
  await cp(join(tempOut, 'server.js'), join(stage, 'dist', 'server.js'))
  const dataDir = join(stage, 'mediaops-data')
  const beforeEntries = new Set(await readdir(stage))

  const startedAt = performance.now()
  const transport = new StdioClientTransport({
    command: 'bun',
    args: ['--no-env-file', join(stage, 'dist', 'server.js')],
    cwd: stage,
    env: { PATH: process.env.PATH ?? '', MEDIAOPS_DATA_DIR: dataDir },
    stderr: 'pipe',
  })
  const client = new Client({ name: 'mediaops-distribution-check', version: '1.0.0' })
  const stderrChunks: string[] = []
  transport.stderr?.on('data', (chunk: Buffer) => { stderrChunks.push(chunk.toString()) })
  try {
    await client.connect(transport).catch((error) => {
      const detail = stderrChunks.join('').trim()
      throw new Error(`${error instanceof Error ? error.message : String(error)}${detail ? ` | server stderr: ${detail.slice(0, 800)}` : ''}`)
    })
    const tools = await client.listTools()
    const startupMs = performance.now() - startedAt
    if (tools.tools.length !== EXPECTED_TOOL_COUNT) {
      errors.push(`cold start exposed ${tools.tools.length} tools; the distribution contract expects ${EXPECTED_TOOL_COUNT}.`)
    }
    const capability = await client.callTool({ name: 'mediaops.capabilities', arguments: {} })
    const text = Array.isArray(capability.content) ? (capability.content as Array<{ type?: string; text?: string }>).find((item) => item.type === 'text')?.text : undefined
    const envelope = text ? JSON.parse(text) as { success?: boolean } : undefined
    if (!envelope?.success) errors.push('mediaops.capabilities did not return a successful envelope during cold start.')
    if (startupMs > STARTUP_BUDGET_MS) {
      errors.push(`cold start took ${Math.round(startupMs)}ms; the required-local startup budget is ${STARTUP_BUDGET_MS}ms.`)
    }
    const afterEntries = (await readdir(stage)).filter((entry) => !beforeEntries.has(entry) && entry !== 'mediaops-data')
    if (afterEntries.length) {
      errors.push(`cold start wrote outside MEDIAOPS_DATA_DIR (install side effects are forbidden): ${afterEntries.join(', ')}`)
    }
    if (afterEntries.includes('node_modules') || beforeEntries.has('node_modules')) {
      errors.push('cold start must not create or require node_modules.')
    }
    return { startupMs, toolCount: tools.tools.length }
  } finally {
    await client.close().catch(() => undefined)
  }
}

const tempOut = await buildToTemp()
await checkFreshness(tempOut)
let smoke: { startupMs: number; toolCount: number } | null = null
try {
  smoke = await coldStartSmoke(tempOut)
} catch (error) {
  errors.push(`cold start failed: ${error instanceof Error ? error.message : String(error)}`)
}

const status = errors.length ? 'failed' : 'passed'
console.log(JSON.stringify({
  schemaVersion: 'mediaops-distribution-check@1',
  status,
  toolCount: smoke?.toolCount ?? null,
  startupMs: smoke ? Math.round(smoke.startupMs) : null,
  startupBudgetMs: STARTUP_BUDGET_MS,
  errors,
}, null, 2))
if (status === 'failed') process.exitCode = 1
