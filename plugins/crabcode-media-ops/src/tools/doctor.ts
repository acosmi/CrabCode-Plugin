import { ok, type Envelope } from '../envelope.ts'
import { PLATFORMS } from '../platforms/registry.ts'
import { resolveDataDir, ensureDir } from '../storage.ts'
import { writeFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'

export const name = 'mediaops.doctor'
export const description =
  'Read-only diagnostics: data directory writability, per-platform credential readiness, and runtime info. Reports honestly; nothing is faked.'

export const inputSchema = {}

export async function handler(): Promise<Envelope> {
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
        bunVersion: typeof Bun !== 'undefined' ? Bun.version : 'unknown',
        platform: process.platform,
      },
      dataDir: {
        path: dir,
        usedFallback,
        writable: dataDirWritable,
      },
      platforms,
      summary: 'Gate A: deterministic I/O only. No platform credentials configured; real publish APIs are disabled.',
    },
    warnings,
  )
}
