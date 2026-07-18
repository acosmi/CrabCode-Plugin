import { ok, type Envelope } from '../envelope.ts'
import { PLATFORMS } from '../platforms/registry.ts'
import { resolveDataDir, ensureDir } from '../storage.ts'
import { VERSION } from '../domain.ts'
import { describePrincipal, isSecondHumanGate, principalHasRole, serviceActorCovers, toolRolePolicies, type TrustedPrincipal } from '../identity.ts'
import { existsSync } from 'node:fs'
import { writeFile, unlink, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'mediaops.doctor'
export const description =
  'Read-only diagnostics: runtime/distribution info, data directory writability, identity readiness, heavy delivery-QA dependency probes, per-stage callability with blocking stop codes, and per-platform credential readiness. Reports honestly; nothing is faked.'

export const inputSchema = {}

type DependencyProbe = { installed: boolean; version: string | null; detail?: string }

async function probePackage(specifier: string): Promise<DependencyProbe> {
  try {
    const resolved = import.meta.resolve(`${specifier}/package.json`)
    const parsed = JSON.parse(await readFile(fileURLToPath(resolved), 'utf8')) as { version?: unknown }
    return { installed: true, version: typeof parsed.version === 'string' ? parsed.version : null }
  } catch (error) {
    return { installed: false, version: null, detail: error instanceof Error ? error.message.slice(0, 200) : String(error) }
  }
}

export async function handler(_args: Record<string, never> = {}, principal?: TrustedPrincipal): Promise<Envelope> {
  const warnings: string[] = []
  const { dir, usedFallback } = resolveDataDir()

  let dataDirWritable = false
  try {
    await ensureDir(dir)
    const probe = join(dir, '.mediaops-write-probe')
    await writeFile(probe, 'ok', 'utf8')
    await unlink(probe)
    dataDirWritable = true
  } catch (e) {
    warnings.push(`data dir not writable: ${e instanceof Error ? e.message : String(e)}`)
  }
  if (usedFallback) {
    warnings.push('MEDIAOPS_DATA_DIR not set; using a temporary fallback directory (non-durable).')
  }

  const entryPath = fileURLToPath(import.meta.url)
  const runningFromDistribution = /[\\/]dist[\\/]server\.js$/.test(entryPath)
  // Dev entry sits at src/tools/doctor.ts (plugin root is ../../..); the bundle
  // entry IS dist/server.js itself.
  const distributionPresent = runningFromDistribution || existsSync(join(entryPath, '..', '..', '..', 'dist', 'server.js'))

  const [playwright, axe, vnu] = await Promise.all([
    probePackage('@playwright/test'),
    probePackage('@axe-core/playwright'),
    probePackage('vnu-jar'),
  ])
  const javaOnPath = Boolean(Bun.which('java'))
  const fullQaReady = playwright.installed && axe.installed && vnu.installed && javaOnPath
  const qaReadiness = {
    staticMode: 'always available (MEDIAOPS_QA_MODE=static): byte/security checks with static evidence',
    fullMode: fullQaReady
      ? 'ready: Nu + Playwright/Chromium + axe automated QA can run'
      : 'DEPENDENCY_NOT_READY: install @playwright/test, @axe-core/playwright, vnu-jar and a Java runtime to run full delivery QA',
    dependencies: {
      '@playwright/test': playwright,
      '@axe-core/playwright': axe,
      'vnu-jar': vnu,
      java: { installed: javaOnPath, version: null, detail: javaOnPath ? undefined : 'no `java` on PATH (required by the Nu HTML checker)' },
    },
  }

  const identity = describePrincipal(principal ?? null)
  const stages = toolRolePolicies().map(({ tool, role }) => {
    const serviceCovered = identity.mode === 'local_editorial' && serviceActorCovers(tool)
    const secondHuman = identity.mode === 'local_editorial' && isSecondHumanGate(tool)
    const heavyQa = tool === 'mediaops.delivery.verify'
    let readiness: 'callable' | 'callable_static_qa' | 'service_actor' | 'pending_second_human' | 'blocked'
    let blockedBy: string | undefined
    let hint: string | undefined
    if (!identity.authenticated) {
      readiness = 'blocked'
      blockedBy = 'AUTHENTICATION_REQUIRED'
      hint = 'Configure MCP OAuth (team-governed) or MEDIAOPS_IDENTITY_MODE=host-principal/local-editorial with MEDIAOPS_TRUSTED_PRINCIPAL_* env.'
    } else if (serviceCovered) {
      readiness = 'service_actor'
      hint = 'Deterministic machine operation: executes as mediaops-server:service with service_account assurance.'
    } else if (secondHuman) {
      readiness = 'pending_second_human'
      blockedBy = 'ROLE_SEPARATION_REQUIRED'
      hint = 'local-editorial keeps this gate pending until a second real principal (team-governed) decides; do not impersonate one.'
    } else if (principal && !principalHasRole(principal, role)) {
      readiness = 'blocked'
      blockedBy = 'ROLE_REQUIRED'
      hint = `Grant role ${role} to the trusted principal.`
    } else if (heavyQa && !fullQaReady) {
      readiness = 'callable_static_qa'
      hint = 'Full browser/validator QA is DEPENDENCY_NOT_READY; static-mode evidence remains available.'
    } else {
      readiness = 'callable'
    }
    return { tool, role, readiness, ...(blockedBy ? { blockedBy } : {}), ...(hint ? { hint } : {}) }
  })

  const platforms = PLATFORMS.map((p) => ({
    id: p.id,
    displayName: p.displayName,
    requiredCredentials: p.requiredCredentials,
    // Gate A ships zero user credentials by design.
    credentialReadiness: 'not-configured (requires Gate B credentials)' as const,
    apiPublishGate: p.apiPublishGate,
  }))

  return ok(
    {
      runtime: {
        serverVersion: VERSION,
        bunVersion: typeof Bun !== 'undefined' ? Bun.version : 'unknown',
        platform: process.platform,
        entryPath,
        runningFromDistribution,
        distributionPresent,
      },
      dataDir: {
        path: dir,
        usedFallback,
        writable: dataDirWritable,
      },
      identity,
      qaReadiness,
      stages,
      platforms,
      summary: 'Gate A: deterministic I/O only. No platform credentials configured; real publish APIs are disabled.',
    },
    warnings,
  )
}
