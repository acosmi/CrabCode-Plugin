import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { runDeliveryQa } from '../src/qa/delivery-qa.ts'
import { writeReleaseFixture } from '../src/qa/release-fixture.ts'

const EXPECTED = {
  '@playwright/test': '1.61.1',
  '@axe-core/playwright': '4.12.1',
  'vnu-jar': '26.7.15',
} as const

async function readPackageVersion(path: string): Promise<string> {
  const parsed = JSON.parse(await readFile(path, 'utf8')) as { version?: unknown }
  if (typeof parsed.version !== 'string') throw new Error(`${path} has no string version.`)
  return parsed.version
}

function parseToolEnvelope(result: unknown): any {
  const content = (result as { content?: unknown }).content
  const block = Array.isArray(content)
    ? content.find((item): item is { type: 'text'; text: string } => Boolean(item) && typeof item === 'object' && (item as any).type === 'text' && typeof (item as any).text === 'string')
    : undefined
  if (!block) throw new Error('Installed MCP tool result has no text envelope.')
  return JSON.parse(block.text)
}

/**
 * Launch the server exactly the way `.mcp.json` does: the prebuilt
 * self-contained dist entry. Falling back to src/server.ts is reported as an
 * error because a 0.4.1+ distribution must ship dist/server.js.
 */
async function resolveServerEntry(installRoot: string): Promise<{ entry: string; distributionEntry: boolean }> {
  const dist = join(installRoot, 'dist', 'server.js')
  try {
    await readFile(dist)
    return { entry: dist, distributionEntry: true }
  } catch {
    return { entry: join(installRoot, 'src', 'server.ts'), distributionEntry: false }
  }
}

async function installedClient(installRoot: string, env: Record<string, string>): Promise<Client> {
  const { entry } = await resolveServerEntry(installRoot)
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--no-env-file', entry],
    cwd: installRoot,
    env,
    stderr: 'pipe',
  })
  const client = new Client({ name: 'mediaops-installed-check', version: '1.0.0' })
  await client.connect(transport)
  return client
}

async function checkInstalledIdentity(installRoot: string): Promise<{ checks: Record<string, boolean>; errors: string[] }> {
  const checks: Record<string, boolean> = {}
  const errors: string[] = []
  const baseEnv = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
  delete baseEnv.MEDIAOPS_IDENTITY_MODE
  delete baseEnv.MEDIAOPS_TRUSTED_PRINCIPAL_ID
  delete baseEnv.MEDIAOPS_TRUSTED_PRINCIPAL_ISSUER
  delete baseEnv.MEDIAOPS_TRUSTED_PRINCIPAL_ROLES

  const anonymousData = await mkdtemp(join(tmpdir(), 'mediaops-installed-anonymous-'))
  let anonymous: Client | null = null
  try {
    anonymous = await installedClient(installRoot, { ...baseEnv, MEDIAOPS_DATA_DIR: anonymousData })
    const rejected = parseToolEnvelope(await anonymous.callTool({
      name: 'mediaops.content.save',
      arguments: { kind: 'brief', brandId: 'installed-anonymous', profileVersion: 'v1', stage: 'intake', title: '安装态匿名检查', researchSubject: '安装态匿名检查', bodyMarkdown: '', savedBy: 'spoofed' },
    }))
    checks.anonymousMutationFailsClosed = rejected.error?.code === 'AUTHENTICATION_REQUIRED'
    if (!checks.anonymousMutationFailsClosed) errors.push(`Anonymous mutation did not fail closed: ${JSON.stringify(rejected)}`)
  } catch (error) {
    errors.push(`Anonymous installed MCP check failed: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    await anonymous?.close().catch(() => undefined)
  }

  const principalData = await mkdtemp(join(tmpdir(), 'mediaops-installed-principal-'))
  let authenticated: Client | null = null
  try {
    authenticated = await installedClient(installRoot, {
      ...baseEnv,
      MEDIAOPS_DATA_DIR: principalData,
      MEDIAOPS_IDENTITY_MODE: 'host-principal',
      MEDIAOPS_TRUSTED_PRINCIPAL_ID: 'installed-check',
      MEDIAOPS_TRUSTED_PRINCIPAL_ISSUER: 'release-qa',
      MEDIAOPS_TRUSTED_PRINCIPAL_ROLES: 'author',
    })
    const capability = parseToolEnvelope(await authenticated.callTool({ name: 'mediaops.capabilities', arguments: {} }))
    checks.hostPrincipalIsVisible = capability.data?.governedCapabilities?.actorPrincipalId === 'installed-check'
      && capability.data?.governedCapabilities?.actorIdentityAssurance === 'host_principal'
    const saved = parseToolEnvelope(await authenticated.callTool({
      name: 'mediaops.content.save',
      arguments: { kind: 'brief', brandId: 'installed-principal', profileVersion: 'v1', stage: 'intake', title: '安装态身份检查', researchSubject: '安装态身份检查', bodyMarkdown: '', savedBy: 'spoofed' },
    }))
    checks.authorRoleCanWrite = saved.status === 'ok'
    const denied = parseToolEnvelope(await authenticated.callTool({
      name: 'mediaops.publish.package',
      arguments: { contentId: '00000000-0000-4000-8000-000000000001', approvalId: '00000000-0000-4000-8000-000000000002', packagedBy: 'spoofed' },
    }))
    checks.insufficientRoleIsDenied = denied.error?.code === 'AUTHORIZATION_DENIED'
    for (const [id, passed] of Object.entries(checks)) if (!passed) errors.push(`Installed identity check ${id} failed.`)
  } catch (error) {
    errors.push(`Authenticated installed MCP check failed: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    await authenticated?.close().catch(() => undefined)
  }
  return { checks, errors }
}

const installRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
if (process.argv[2] && resolve(process.argv[2]) !== installRoot) {
  throw new Error(`check-installed only certifies its own installation root (${installRoot}).`)
}
const packageVersion = await readPackageVersion(join(installRoot, 'package.json'))
const serverEntry = await resolveServerEntry(installRoot)
const dependencyVersions: Record<string, string> = {}
const dependencyErrors: string[] = []
if (!serverEntry.distributionEntry) {
  dependencyErrors.push('dist/server.js is missing: 0.4.1+ distributions must ship the prebuilt sidecar (run `bun run build`); fell back to src/server.ts for diagnostics only.')
}
for (const [name, expected] of Object.entries(EXPECTED)) {
  try {
    const actual = await readPackageVersion(join(installRoot, 'node_modules', ...name.split('/'), 'package.json'))
    dependencyVersions[name] = actual
    if (actual !== expected) dependencyErrors.push(`${name}: expected ${expected}, found ${actual}`)
  } catch (error) {
    dependencyErrors.push(`${name}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

const artifactRoot = await mkdtemp(join(tmpdir(), 'mediaops-installed-qa-'))
const fixture = await writeReleaseFixture(artifactRoot)
const qa = await runDeliveryQa(fixture.artifactRoot, fixture.htmlRelativePath)
const identity = await checkInstalledIdentity(installRoot)
const status = dependencyErrors.length === 0 && identity.errors.length === 0 && qa.status === 'passed' ? 'passed' : 'failed'
const result = {
  schemaVersion: 'mediaops-installed-check@1',
  status,
  installRoot,
  packageVersion,
  serverEntry,
  dependencyVersions,
  dependencyErrors,
  identity,
  artifactRoot,
  qa,
}

console.log(JSON.stringify(result, null, 2))
if (status === 'failed') process.exitCode = 1
