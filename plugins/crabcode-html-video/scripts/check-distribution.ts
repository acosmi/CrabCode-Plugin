import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'

const root = join(import.meta.dir, '..')
const textExtensions = new Set(['.ts', '.js', '.json', '.md'])

// Build names from fragments so this first-party guard does not itself add a
// prohibited brand literal. Word boundaries avoid false positives in codec or
// ordinary library identifiers.
const prohibitedTermParts = [
  ['op', 'en', 'ai'],
  ['anth', 'ropic'],
  ['c', 'la', 'ude'],
  ['chat', 'gpt'],
  ['gem', 'ini'],
  ['deep', 'seek'],
  ['q', 'wen'],
] as const
const prohibitedTerms = prohibitedTermParts.map((parts) => parts.join(''))

const files = [
  ...collectFirstPartyFiles(root),
  join(root, 'dist', 'bootstrap.js'),
  join(root, 'dist', 'server.js'),
  join(root, 'dist', 'hyperframe.runtime.iife.js'),
  join(root, 'dist', 'hyperframe.manifest.json'),
]

const violations: string[] = []
for (const file of new Set(files)) {
  const text = readFileSync(file, 'utf8')
  for (const term of prohibitedTerms) {
    const match = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i').exec(text)
    if (match) violations.push(`${relative(root, file)}:${match.index + 1}:${term}`)
  }
}

if (violations.length > 0) {
  throw new Error(`model/provider brand literals found in first-party or executable distribution files:\n${violations.join('\n')}`)
}

console.log(`distribution brand scan passed (${new Set(files).size} files)`)

// Execute a copy containing only the four shipped files. This catches bundle
// regressions such as a dependency retaining a node_modules-relative JSON
// require that succeeds in a developer checkout but fails after installation.
const probeRoot = mkdtempSync(join(tmpdir(), 'crabcode-html-video-dist-'))
try {
  const probeDist = join(probeRoot, 'dist')
  cpSync(join(root, 'dist'), probeDist, { recursive: true })
  const probe = spawnSync(
    process.execPath,
    ['--no-env-file', join(probeDist, 'bootstrap.js')],
    {
      cwd: probeRoot,
      env: {
        HOME: process.env.HOME,
        PATH: process.env.PATH,
        TMPDIR: process.env.TMPDIR,
        CRABCODE_PLUGIN_ROOT: probeRoot,
        CRABCODE_PLUGIN_DATA: join(probeRoot, 'data'),
      },
      input: '',
      encoding: 'utf8',
      timeout: 10_000,
    },
  )
  if (probe.error || probe.status !== 0) {
    const detail = [probe.error?.message, probe.stderr.trim()].filter(Boolean).join('\n')
    throw new Error(`standalone distribution bootstrap failed${detail ? `:\n${detail}` : ''}`)
  }
  if (!probe.stderr.includes('html-video: MCP server ready')) {
    throw new Error('standalone distribution bootstrap exited without reaching MCP readiness')
  }
} finally {
  rmSync(probeRoot, { recursive: true, force: true })
}

console.log('standalone distribution bootstrap passed (dist-only copy)')

function collectFirstPartyFiles(directory: string): string[] {
  const results: string[] = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.data'].includes(entry.name)) continue
    if (entry.name === 'docs') continue // legal attribution is not executable branding
    const path = join(directory, entry.name)
    if (entry.isDirectory()) results.push(...collectFirstPartyFiles(path))
    else if (entry.isFile() && textExtensions.has(extname(entry.name))) results.push(path)
  }
  return results
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
