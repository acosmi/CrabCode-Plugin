import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(import.meta.dir, '..')
const dist = join(root, 'dist')
rmSync(dist, { recursive: true, force: true })
mkdirSync(dist, { recursive: true })

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
  /var __dirname = "[^"]*\/node_modules\/esbuild\/lib", __filename = "[^"]*\/node_modules\/esbuild\/lib\/main\.js";/,
  'var __dirname = import.meta.dir, __filename = import.meta.path;',
)
if (portable === bundled) throw new Error('expected bundled esbuild path marker was not found')
if (portable.includes(root)) throw new Error('MCP bundle contains the build machine plugin path')
writeFileSync(serverPath, portable, { encoding: 'utf8', mode: 0o755 })

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
