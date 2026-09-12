import { readFile, readdir } from 'node:fs/promises'
import { resolve, join, dirname, basename } from 'node:path'
import { existsSync } from 'node:fs'

const pluginRoot = resolve(import.meta.dir, '..')
const repoRoot = resolve(pluginRoot, '..', '..')
const errors: string[] = []

async function json(path: string): Promise<any> {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (error) {
    errors.push(`${path}: invalid or missing JSON (${error instanceof Error ? error.message : String(error)})`)
    return null
  }
}

const manifest = await json(join(pluginRoot, '.crabcode-plugin', 'plugin.json'))
const pkg = await json(join(pluginRoot, 'package.json'))
const marketplace = await json(join(repoRoot, '.crabcode-plugin', 'marketplace.json'))
const expectedSkills = new Set([
  'media-ops', 'media-topic-research', 'media-human-editor', 'wechat-original-opinion', 'media-originality-review',
  'media-style-intake', 'media-style-manager', 'media-platform-adapter', 'media-publish-gate',
])
const knownTools = new Set([
  'mediaops.capabilities', 'mediaops.doctor', 'mediaops.policy_status', 'mediaops.trends.search', 'mediaops.trends.cluster',
  'mediaops.content.save', 'mediaops.content.get', 'mediaops.content.list', 'mediaops.profile.save', 'mediaops.profile.get',
  'mediaops.profile.list', 'mediaops.profile.history', 'mediaops.profile.rollback', 'mediaops.style.form.template',
  'mediaops.style.form.save_draft', 'mediaops.style.form.submit', 'mediaops.style.form.get', 'mediaops.profile.propose',
  'mediaops.profile.confirm', 'mediaops.preview.create', 'mediaops.readiness.inspect', 'mediaops.approval.request',
  'mediaops.approval.decide', 'mediaops.approval.get', 'mediaops.approval.list', 'mediaops.publish.package',
  'mediaops.publish.history', 'mediaops.platform.rules.get', 'mediaops.reference.register',
  'mediaops.reference.get_metadata', 'mediaops.research.capture', 'mediaops.research.complete', 'mediaops.research.get', 'mediaops.originality.scan',
  'mediaops.originality.review', 'mediaops.editorial.review', 'mediaops.delivery.render', 'mediaops.delivery.verify',
  'mediaops.delivery.export_draft',
])

if (!manifest || !pkg) process.exit(1)
if (manifest.version !== pkg.version) errors.push(`version mismatch: plugin=${manifest.version}, package=${pkg.version}`)
const marketEntry = marketplace?.plugins?.find((entry: any) => entry.name === manifest.name)
if (!marketEntry) errors.push('marketplace entry missing')
else if (marketEntry.version !== manifest.version) errors.push(`version mismatch: marketplace=${marketEntry.version}, plugin=${manifest.version}`)

const skillNames = new Set<string>()
for (const relative of manifest.skills ?? []) {
  const path = join(pluginRoot, relative, 'SKILL.md')
  let text = ''
  try {
    text = await readFile(path, 'utf8')
  } catch {
    errors.push(`${relative}: missing SKILL.md`)
    continue
  }
  const invocationName = basename(relative.replace(/[\\/]+$/, ''))
  const name = text.match(/^name:\s*([^\n]+)$/m)?.[1]?.trim()
  const shortDescription = text.match(/^short-description:\s*([^\n]+)$/m)?.[1]?.trim()
  const description = text.match(/^description:\s*([^\n]+)$/m)?.[1]?.trim()
  if (!name || !shortDescription || !description) {
    errors.push(`${relative}: frontmatter requires display name, short-description and description`)
  }
  if (name && !/[\u3400-\u9fff]/u.test(name)) errors.push(`${relative}: display name must contain Chinese text`)
  if (shortDescription && !/[\u3400-\u9fff]/u.test(shortDescription)) {
    errors.push(`${relative}: short-description must contain Chinese text`)
  }
  skillNames.add(invocationName)
  if (!text.includes('PRACTICE.md')) errors.push(`${relative}: must reference shared PRACTICE.md`)
  for (const match of text.matchAll(/`((?:\.\.\/)+[^`]+\.md)`/g)) {
    const target = resolve(dirname(path), match[1])
    if (!existsSync(target)) errors.push(`${relative}: dead relative reference ${match[1]}`)
  }
  for (const tool of text.match(/mediaops\.[a-z0-9_.]+/g) ?? []) {
    if (!knownTools.has(tool)) errors.push(`${relative}: unknown tool reference ${tool}`)
  }
}
for (const name of expectedSkills) if (!skillNames.has(name)) errors.push(`required skill missing: ${name}`)
for (const name of skillNames) if (!expectedSkills.has(name)) errors.push(`unexpected skill in manifest: ${name}`)

// Commands orchestrate mediaops.* from the main thread, so their references
// must be real tools; subagents must not claim direct mediaops calls at all —
// they return structured data for the main thread to submit (audit P1-C).
for (const dir of ['commands', 'agents'] as const) {
  for (const file of (await readdir(join(pluginRoot, dir))).filter((entry) => entry.endsWith('.md'))) {
    const text = await readFile(join(pluginRoot, dir, file), 'utf8')
    for (const tool of text.match(/mediaops\.[a-z0-9_.]+/g) ?? []) {
      if (dir === 'agents') {
        errors.push(`${dir}/${file}: subagents must not reference mediaops tools directly (${tool}); return structured data and let the main thread orchestrate`)
      } else if (!knownTools.has(tool)) {
        errors.push(`${dir}/${file}: unknown tool reference ${tool}`)
      }
    }
  }
}

const schemaNames = [
  'content-manifest', 'claim', 'approval', 'creator-style-form', 'platform-rule', 'reference-material',
  'research-capture', 'research-review', 'originality-scan', 'editorial-review', 'article-doc', 'delivery-artifact', 'delivery-manifest', 'package-manifest',
]
const schemas = new Map<string, any>()
for (const schema of schemaNames) {
  const document = await json(join(pluginRoot, 'media-core', 'schemas', `${schema}.schema.json`))
  if (document) schemas.set(schema, document)
  if (document && document.$schema !== 'https://json-schema.org/draft/2020-12/schema') errors.push(`${schema}: must declare JSON Schema 2020-12`)
  if (document && document.type === 'object' && document.additionalProperties !== false) errors.push(`${schema}: top-level records must reject unknown fields`)
}

const server = await readFile(join(pluginRoot, 'src', 'server.ts'), 'utf8')
const capabilities = await readFile(join(pluginRoot, 'src', 'tools', 'capabilities.ts'), 'utf8')
const domain = await readFile(join(pluginRoot, 'src', 'domain.ts'), 'utf8')
if (!server.includes("import { VERSION }")) errors.push('server must use shared VERSION')
if (!capabilities.includes("import { VERSION }")) errors.push('capabilities must use shared VERSION')
if (!domain.includes("import packageMetadata from '../package.json' with { type: 'json' }")) {
  errors.push('domain VERSION must import package.json as the single version source')
}
if (!domain.includes('export const VERSION = packageMetadata.version')) {
  errors.push('domain VERSION must derive from packageMetadata.version')
}
if (/\b(?:bun|npm|pnpm|yarn)\s+install\b/.test(pkg.scripts?.start ?? '')) {
  errors.push('start script must not install dependencies: the required-local sidecar has to cold-start offline from the prebuilt dist')
}
if (!pkg.scripts?.start?.includes('dist/server.js')) errors.push('start script must launch the prebuilt dist/server.js distribution entry')
if (pkg.bin !== './dist/server.js') errors.push('package bin must point at the prebuilt dist/server.js')
if (!existsSync(join(pluginRoot, 'dist', 'server.js'))) errors.push('dist/server.js is missing; run `bun run build` (the distribution bundle ships in-repo)')

// 2026-09-12 decision D-0(c): the principal-config-missing containment is lifted
// because the host now injects the trusted local principal from user_config, so
// the executable configuration must be present and bound to that injection.
const mcpConfigPath = join(pluginRoot, '.mcp.json')
if (!existsSync(mcpConfigPath)) {
  errors.push('.mcp.json is missing; the mediaops sidecar is a required local server since 0.4.4')
} else {
  const mcpConfig = await json(mcpConfigPath)
  const servers: Record<string, any> = mcpConfig?.mcpServers ?? {}
  const serverNames = Object.keys(servers)
  if (serverNames.length !== 1 || serverNames[0] !== 'mediaops') {
    errors.push(`.mcp.json must declare exactly one server named "mediaops", found [${serverNames.join(', ')}]`)
  }
  const mediaops = servers.mediaops
  if (mediaops) {
    if (mediaops.url !== undefined || mediaops.type === 'http' || mediaops.type === 'sse') {
      errors.push('.mcp.json mediaops must stay a local stdio server; remote transport is not permitted')
    }
    const env: Record<string, unknown> = mediaops.env ?? {}
    if (env.MEDIAOPS_IDENTITY_MODE !== 'local-editorial') {
      errors.push('.mcp.json must pin MEDIAOPS_IDENTITY_MODE=local-editorial; the sidecar never invents an identity mode')
    }
    // Every ${user_config.X} the host substitutes must be a required manifest
    // field: substitution throws when the value is missing and the host never
    // writes the declared default.
    const declaredUserConfig: Record<string, any> = manifest.userConfig ?? {}
    for (const value of Object.values(env)) {
      if (typeof value !== 'string') continue
      for (const match of value.matchAll(/\$\{user_config\.([A-Za-z0-9_]+)\}/g)) {
        if (declaredUserConfig[match[1]!]?.required !== true) {
          errors.push(`.mcp.json references \${user_config.${match[1]}} but plugin.json userConfig.${match[1]} is not declared required: true`)
        }
      }
    }
  }
}
const requiredServers: unknown[] = Array.isArray(manifest.requiredMcpServers) ? manifest.requiredMcpServers : []
if (requiredServers.length !== 1 || requiredServers[0] !== 'mediaops') {
  errors.push('requiredMcpServers must be exactly ["mediaops"] so the host activates the bundled sidecar on install')
}
if (pkg.overrides?.hono !== '4.12.25') errors.push('Hono security override must remain pinned at 4.12.25 until the SDK resolves above it')
if (existsSync(join(pluginRoot, 'editorial', 'scripts', '__pycache__'))) errors.push('generated __pycache__ must not ship in the plugin')

const importedToolAliases = new Map<string, string>()
for (const match of server.matchAll(/import \* as (\w+) from '\.\/tools\/([^']+)\.ts'/g)) importedToolAliases.set(match[2], match[1])
const declaredTools = new Set<string>()
for (const file of (await readdir(join(pluginRoot, 'src', 'tools'))).filter((entry) => entry.endsWith('.ts'))) {
  const base = file.slice(0, -3)
  const source = await readFile(join(pluginRoot, 'src', 'tools', file), 'utf8')
  for (const match of source.matchAll(/export const (\w+) = '(mediaops\.[a-z0-9_.]+)'/g)) {
    const [, exportName, toolName] = match
    declaredTools.add(toolName)
    const alias = importedToolAliases.get(base)
    if (!alias) errors.push(`${file}: declares ${toolName} but server has no namespace import`)
    else if (!server.includes(`register(${alias}.${exportName},`)) errors.push(`${file}: ${toolName} is declared but not registered by the MCP server`)
  }
}
for (const tool of declaredTools) if (!knownTools.has(tool)) errors.push(`runtime declares unexpected tool ${tool}`)
for (const tool of knownTools) if (!declaredTools.has(tool)) errors.push(`validator expects undeclared runtime tool ${tool}`)
const registrationCount = (server.match(/^register\(/gm) ?? []).length
if (registrationCount !== knownTools.size) errors.push(`server registers ${registrationCount} tools but validator contract contains ${knownTools.size}`)

function requireStructuredArray(schema: string, property: string, maxItems: number): void {
  const field = schemas.get(schema)?.properties?.[property]
  if (!field || field.type !== 'array' || field.maxItems !== maxItems || !field.items || Object.keys(field.items).length === 0) {
    errors.push(`${schema}.${property}: must be a bounded structured array (maxItems=${maxItems})`)
  }
}
requireStructuredArray('research-review', 'claims', 200)
requireStructuredArray('research-review', 'sources', 100)
requireStructuredArray('research-review', 'evidenceLinks', 1000)
requireStructuredArray('research-review', 'searches', 100)
requireStructuredArray('originality-scan', 'referenceHashes', 100)
requireStructuredArray('originality-scan', 'exactMatches', 20)
requireStructuredArray('originality-scan', 'paragraphAlignments', 100)
requireStructuredArray('article-doc', 'citations', 200)
requireStructuredArray('article-doc', 'assets', 100)
requireStructuredArray('delivery-manifest', 'assets', 100)
if (schemas.get('originality-scan')?.properties?.parameters?.additionalProperties !== false) errors.push('originality-scan.parameters must reject unknown fields')
if (schemas.get('delivery-manifest')?.properties?.visualReview?.additionalProperties !== false) errors.push('delivery-manifest.visualReview must reject unknown fields')

const sbom = await json(join(pluginRoot, 'docs', 'legal', 'SBOM.cdx.json'))
if (sbom?.bomFormat !== 'CycloneDX' || sbom?.specVersion !== '1.5') errors.push('SBOM must use CycloneDX 1.5')
if (sbom?.metadata?.component?.version !== pkg.version) errors.push(`SBOM version mismatch: ${sbom?.metadata?.component?.version ?? 'missing'} != ${pkg.version}`)
const sbomVersions = new Map((sbom?.components ?? []).map((component: any) => [component.name, component.version]))
for (const [dependency, version] of Object.entries(pkg.dependencies ?? {})) {
  if (sbomVersions.get(dependency) !== version) errors.push(`SBOM missing exact direct dependency ${dependency}@${version}`)
}
if (sbomVersions.get('hono') !== pkg.overrides?.hono) errors.push(`SBOM must contain security-pinned hono@${pkg.overrides?.hono}`)

const docs = await Promise.all([
  readFile(join(pluginRoot, 'README.md'), 'utf8'),
  readFile(join(pluginRoot, 'references', 'ai-labeling-compliance.md'), 'utf8'),
])
if (!docs[0].includes(`# crabcode-media-ops ${manifest.version}`)) errors.push(`README heading must declare ${manifest.version}`)
if (!docs[0].includes('HTML') || !docs[0].includes('Markdown')) errors.push('README must state the HTML-primary/Markdown-backup contract')
if (docs.some((text) => text.includes('唯一固定句子') || text.includes('唯一的法律硬要求'))) {
  errors.push('AI disclosure docs overstate a fixed body sentence as the sole legal requirement')
}

if (errors.length) {
  process.stderr.write(errors.map((error) => `ERROR ${error}`).join('\n') + '\n')
  process.exit(1)
}
process.stdout.write(`validate-media-plugin: bundled local stdio sidecar, ${skillNames.size} skills, ${declaredTools.size} tested tools, ${schemaNames.length} schemas, runtime/docs/manifest/marketplace/SBOM aligned at ${manifest.version}\n`)
