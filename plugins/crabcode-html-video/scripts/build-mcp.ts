import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const root = join(import.meta.dir, '..')
const output = resolveOutputDirectory(process.argv.slice(2))
const dist = output.path
if (output.resetCommittedDist) {
  if (existsSync(dist)) {
    const stats = lstatSync(dist)
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      throw new Error('committed dist must be an ordinary directory before rebuild')
    }
  }
  rmSync(dist, { recursive: true, force: true })
  mkdirSync(dist, { recursive: false })
} else {
  // Custom output is used only by the freshness checker. Never delete or
  // overwrite a caller-selected path: its parent must already be an ordinary
  // directory under the real OS temp root and the final dist path must not yet
  // exist. mkdir's EEXIST behavior also closes the check/create race.
  if (existsSync(dist)) throw new Error('custom --outdir must not already exist')
  const parent = dirname(dist)
  const parentStats = lstatSync(parent)
  if (!parentStats.isDirectory() || parentStats.isSymbolicLink()) {
    throw new Error('custom --outdir parent must be an ordinary directory')
  }
  const realParent = realpathSync(parent)
  const realTempRoot = realpathSync(tmpdir())
  if (!isWithin(realTempRoot, realParent)) {
    throw new Error('custom --outdir parent must resolve inside the OS temporary directory')
  }
  mkdirSync(dist, { recursive: false })
}

// Every first-party tool schema is Zod v4. The MCP SDK nevertheless imports
// its legacy v3 JSON-schema converter unconditionally; replace that unreachable
// branch at bundle time so provider-specific dead code is not distributed.
const v4OnlySchemaPlugin: Bun.BunPlugin = {
  name: 'mcp-v4-only-schema-converter',
  setup(build) {
    build.onResolve({ filter: /^zod-to-json-schema$/ }, () => ({
      path: 'v4-only-schema-converter',
      namespace: 'crabcode-security',
    }))
    build.onLoad(
      { filter: /.*/, namespace: 'crabcode-security' },
      () => ({
        contents:
          'export function zodToJsonSchema() { throw new Error("legacy Zod v3 schema conversion is disabled") }',
        loader: 'js',
      }),
    )
  },
}

const result = await Bun.build({
  entrypoints: [join(root, 'src/bootstrap.ts'), join(root, 'src/server.ts')],
  outdir: dist,
  naming: '[name].js',
  target: 'bun',
  format: 'esm',
  plugins: [v4OnlySchemaPlugin],
})
if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}

// Bun preserves esbuild's CommonJS __dirname as the build machine's absolute
// node_modules path. Plain-HTML rendering does not invoke esbuild's native
// binary, but keeping that path would leak the builder home and make the bundle
// non-reproducible. Replace only the known generated declaration.
const serverPath = join(dist, 'server.js')
const bundled = readFileSync(serverPath, 'utf8')
const portable = bundled.replace(
  // Windows builds embed escaped backslash separators, POSIX builds forward
  // slashes; match either so the marker is found on every build platform.
  /var __dirname = "[^"]*[\/\\]node_modules[\/\\]+esbuild[\/\\]+lib", __filename = "[^"]*[\/\\]node_modules[\/\\]+esbuild[\/\\]+lib[\/\\]+main\.js";/,
  'var __dirname = import.meta.dir, __filename = import.meta.path;',
)
if (portable === bundled) throw new Error('expected bundled esbuild path marker was not found')
if (portable.includes(root)) throw new Error('MCP bundle contains the build machine plugin path')

// Upstream bundles can contain credential-shaped example literals even when the
// sidecar receives a sanitized environment. They are not required at runtime and
// must not be redistributed. Replace only complete, high-confidence token shapes;
// the distribution check independently fails if any survive.
const credentialLiteralPatterns = [
  /(?:A3T[A-Z0-9]|AKIA|ASIA)[A-Z0-9]{16}/g,
  /gh[pousr]_[A-Za-z0-9]{30,}/g,
  /sk-[A-Za-z0-9_-]{20,}/g,
  /xox[baprs]-[A-Za-z0-9-]{10,}/g,
  /AIza[0-9A-Za-z_-]{30,}/g,
]
let sanitized = portable
for (const pattern of credentialLiteralPatterns) {
  sanitized = sanitized.replace(pattern, 'CRABCODE_REDACTED_CREDENTIAL')
}
writeFileSync(serverPath, sanitized, { encoding: 'utf8', mode: 0o755 })

// bootstrap.js is the security boundary: it may contain this repository's
// dependency-free sanitizer and node:url, but never the MCP/producer bundle.
const bootstrapPath = join(dist, 'bootstrap.js')
const bootstrap = readFileSync(bootstrapPath, 'utf8')
for (const forbidden of [
  '@modelcontextprotocol',
  '@hyperframes',
  'node_modules',
  'VENDOR_API_KEY',
  'AWS_SECRET_ACCESS_KEY',
]) {
  if (bootstrap.includes(forbidden)) {
    throw new Error(`security bootstrap unexpectedly contains ${forbidden}`)
  }
}
const sanitizeAt = bootstrap.indexOf('sanitizeSidecarEnvironment(process.env)')
const serverImportAt = bootstrap.indexOf('new URL("./server.js"')
if (sanitizeAt < 0 || serverImportAt < 0 || sanitizeAt >= serverImportAt) {
  throw new Error('security bootstrap must sanitize process.env before dynamically importing server.js')
}
if (bootstrap.includes('from "./server.js"') || bootstrap.includes("from './server.js'")) {
  throw new Error('security bootstrap must not statically import server.js')
}
if (bootstrap.includes(root)) throw new Error('security bootstrap contains the build machine plugin path')
writeFileSync(bootstrapPath, bootstrap, { encoding: 'utf8', mode: 0o755 })

// The producer resolves these runtime artifacts from disk at render time; JS
// bundling alone cannot inline them because the manifest verifies the IIFE hash.
const producerEntry = fileURLToPath(import.meta.resolve('@hyperframes/producer'))
const producerDist = dirname(producerEntry)
for (const file of ['hyperframe.manifest.json', 'hyperframe.runtime.iife.js']) {
  copyFileSync(join(producerDist, file), join(dist, file))
}

console.log(`built security bootstrap, MCP bundle, and Hyperframes runtime assets in ${dist}`)

function resolveOutputDirectory(args: string[]): {
  path: string
  resetCommittedDist: boolean
} {
  const optionIndexes = args.flatMap((arg, index) => (arg === '--outdir' ? [index] : []))
  if (optionIndexes.length > 1) throw new Error('--outdir may be specified only once')
  if (optionIndexes.length === 0) {
    if (args.length > 0) throw new Error(`unexpected build argument: ${args[0]}`)
    return { path: join(root, 'dist'), resetCommittedDist: true }
  }

  const optionIndex = optionIndexes[0]
  const value = args[optionIndex + 1]
  if (!value || args.length !== 2 || optionIndex !== 0) {
    throw new Error('usage: bun scripts/build-mcp.ts [--outdir <path>]')
  }

  const output = resolve(root, value)
  // Custom builds never reset a directory and are restricted to isolated temp
  // roots. The default no-argument path is the sole destructive rebuild target.
  if (basename(output) !== 'dist' || !isWithin(resolve(tmpdir()), output)) {
    throw new Error('--outdir must name a dist directory inside the OS temporary directory')
  }
  return { path: output, resetCommittedDist: false }
}

function isWithin(parent: string, candidate: string): boolean {
  const path = relative(parent, candidate)
  return path !== '' && path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path)
}
