import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

type LockEntry = {
  key: string
  name: string
  version: string
  integrity?: string
}

const root = resolve(import.meta.dir, '..')
const outputPath = join(root, 'docs', 'legal', 'SBOM.cdx.json')
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as {
  name: string
  version: string
  dependencies: Record<string, string>
  devDependencies?: Record<string, string>
  overrides?: Record<string, string>
}

function parseDescriptor(descriptor: string): { name: string; version: string } {
  const separator = descriptor.lastIndexOf('@')
  if (separator <= 0 || separator === descriptor.length - 1) throw new Error(`unsupported bun.lock descriptor: ${descriptor}`)
  return { name: descriptor.slice(0, separator), version: descriptor.slice(separator + 1) }
}

function parseLockEntries(text: string): LockEntry[] {
  const marker = '  "packages": {'
  const start = text.indexOf(marker)
  if (start < 0) throw new Error('bun.lock has no packages block')
  const entries: LockEntry[] = []
  for (const line of text.slice(start + marker.length).split('\n')) {
    if (line === '  }' || line === '  },') break
    const trimmed = line.trim()
    if (!trimmed || !trimmed.includes(': [') || !(trimmed.endsWith('],') || trimmed.endsWith(']'))) continue
    const parsed = JSON.parse(`{${trimmed.replace(/,$/, '')}}`) as Record<string, unknown[]>
    const [key, value] = Object.entries(parsed)[0]
    if (!Array.isArray(value) || typeof value[0] !== 'string') continue
    const descriptor = parseDescriptor(value[0])
    entries.push({ key, ...descriptor, ...(typeof value[3] === 'string' ? { integrity: value[3] } : {}) })
  }
  if (!entries.length) throw new Error('bun.lock packages block produced no components')
  return entries
}

function purl(name: string, version: string): string {
  if (name.startsWith('@')) {
    const [scope, packageName] = name.slice(1).split('/', 2)
    return `pkg:npm/%40${encodeURIComponent(scope)}/${encodeURIComponent(packageName)}@${encodeURIComponent(version)}`
  }
  return `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}`
}

function hashRecord(integrity?: string): { alg: string; content: string }[] | undefined {
  if (!integrity) return undefined
  const match = integrity.match(/^(sha256|sha384|sha512)-(.+)$/)
  if (!match) return undefined
  return [{ alg: match[1].toUpperCase().replace('SHA', 'SHA-'), content: Buffer.from(match[2], 'base64').toString('hex') }]
}

const knownLicenses: Record<string, string> = {
  '@modelcontextprotocol/sdk': 'MIT',
  'rehype-sanitize': 'MIT',
  'rehype-stringify': 'MIT',
  'remark-gfm': 'MIT',
  'remark-parse': 'MIT',
  'remark-rehype': 'MIT',
  'remark-stringify': 'MIT',
  unified: 'MIT',
  zod: 'MIT',
  hono: 'MIT',
  '@types/bun': 'MIT',
  typescript: 'Apache-2.0',
}

const lockEntries = parseLockEntries(await readFile(join(root, 'bun.lock'), 'utf8'))
const directRuntime = new Set(Object.keys(pkg.dependencies ?? {}))
const directDevelopment = new Set(Object.keys(pkg.devDependencies ?? {}))
const unique = new Map<string, LockEntry>()
for (const entry of lockEntries) unique.set(`${entry.name}@${entry.version}`, entry)
const compareCodeUnits = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0
const components = [...unique.values()]
  .sort((left, right) => left.name === right.name ? compareCodeUnits(left.version, right.version) : compareCodeUnits(left.name, right.name))
  .map((entry) => {
    const ref = purl(entry.name, entry.version)
    const dependencyKind = directRuntime.has(entry.name) ? 'direct-runtime' : directDevelopment.has(entry.name) ? 'direct-development' : 'transitive'
    const hashes = hashRecord(entry.integrity)
    return {
      type: 'library',
      name: entry.name,
      version: entry.version,
      'bom-ref': ref,
      purl: ref,
      ...(dependencyKind === 'direct-runtime' ? { scope: 'required' } : dependencyKind === 'direct-development' ? { scope: 'optional' } : {}),
      ...(hashes ? { hashes } : {}),
      ...(knownLicenses[entry.name] ? { licenses: [{ expression: knownLicenses[entry.name] }] } : {}),
      properties: [
        { name: 'crabcode:bun-lock-key', value: entry.key },
        { name: 'crabcode:dependency-kind', value: dependencyKind },
      ],
    }
  })

const rootRef = purl(pkg.name, pkg.version)
const document = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  version: 1,
  metadata: {
    component: {
      type: 'application',
      name: pkg.name,
      version: pkg.version,
      'bom-ref': rootRef,
      purl: rootRef,
      licenses: [{ expression: 'Apache-2.0' }],
    },
    properties: [
      { name: 'crabcode:source-lockfile', value: 'bun.lock' },
      { name: 'crabcode:component-coverage', value: 'all locked runtime and development components' },
    ],
  },
  components,
  dependencies: [{ ref: rootRef, dependsOn: components.map((component) => component['bom-ref']).sort() }],
}
const rendered = `${JSON.stringify(document, null, 2)}\n`

if (process.argv.includes('--check')) {
  let existing = ''
  try {
    existing = await readFile(outputPath, 'utf8')
  } catch {
    // The comparison below emits the single actionable failure.
  }
  if (existing !== rendered) {
    process.stderr.write('SBOM is missing or stale; run `bun run sbom` and review the generated diff.\n')
    process.exit(1)
  }
  process.stdout.write(`sbom: ${components.length} locked components match ${pkg.name}@${pkg.version}\n`)
} else {
  await Bun.write(outputPath, rendered)
  process.stdout.write(`sbom: wrote ${components.length} locked components to ${outputPath}\n`)
}
