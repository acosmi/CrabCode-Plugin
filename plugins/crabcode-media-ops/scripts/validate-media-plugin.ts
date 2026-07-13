import { readFile } from 'node:fs/promises'
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
  'mediaops.publish.history', 'mediaops.platform.rules.get',
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

for (const schema of ['content-manifest', 'claim', 'approval', 'creator-style-form', 'platform-rule']) {
  await json(join(pluginRoot, 'media-core', 'schemas', `${schema}.schema.json`))
}

const server = await readFile(join(pluginRoot, 'src', 'server.ts'), 'utf8')
const capabilities = await readFile(join(pluginRoot, 'src', 'tools', 'capabilities.ts'), 'utf8')
if (!server.includes("import { VERSION }")) errors.push('server must use shared VERSION')
if (!capabilities.includes("import { VERSION }")) errors.push('capabilities must use shared VERSION')

const docs = await Promise.all([
  readFile(join(pluginRoot, 'README.md'), 'utf8'),
  readFile(join(pluginRoot, 'references', 'ai-labeling-compliance.md'), 'utf8'),
])
if (docs.some((text) => text.includes('唯一固定句子') || text.includes('唯一的法律硬要求'))) {
  errors.push('AI disclosure docs overstate a fixed body sentence as the sole legal requirement')
}

if (errors.length) {
  process.stderr.write(errors.map((error) => `ERROR ${error}`).join('\n') + '\n')
  process.exit(1)
}
process.stdout.write(`validate-media-plugin: ${skillNames.size} skills, 5 schemas, versions aligned at ${manifest.version}\n`)
