import { basename, join, resolve, sep } from 'node:path'
import { closeSync, existsSync, mkdirSync, openSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

/**
 * Resolve a user-supplied filename under `rootDir`, rejecting path traversal.
 * Only basename is kept; must match safe pattern (default: *.mp4).
 */
export function resolveSafeOutputPath(
  rootDir: string,
  name: string,
  opts?: { pattern?: RegExp; defaultName?: string },
): string {
  const pattern = opts?.pattern ?? /^[a-zA-Z0-9._-]+\.mp4$/i
  const raw = (name || opts?.defaultName || `out-${Date.now()}.mp4`).trim()
  const normalized = raw.replace(/\\/g, '/')
  const base = basename(normalized)
  if (base !== normalized) throw new Error(`output name must be a basename: ${JSON.stringify(name)}`)
  if (!pattern.test(base)) {
    throw new Error(`unsafe output name rejected: ${JSON.stringify(name)}`)
  }
  const root = resolve(rootDir)
  const full = resolve(join(root, base))
  const prefix = root.endsWith(sep) ? root : root + sep
  if (full !== root && !full.startsWith(prefix)) {
    throw new Error(`path escapes root: ${full}`)
  }
  return full
}

/** Allow only absolute paths that stay under an allowlist of roots. */
export function assertPathUnderRoots(filePath: string, roots: string[]): string {
  const abs = resolve(filePath)
  for (const r of roots) {
    const root = resolve(r)
    const prefix = root.endsWith(sep) ? root : root + sep
    if (abs === root || abs.startsWith(prefix)) return abs
  }
  throw new Error(`path not under allowed roots: ${filePath}`)
}

export interface OutputReservation {
  lockPath: string
  release: () => void
}

/** Atomically serialize writers targeting the same output path. */
export function reserveOutputFile(filePath: string): OutputReservation {
  mkdirSync(dirname(filePath), { recursive: true })
  const lockPath = `${filePath}.lock`
  let fd: number
  try {
    fd = openSync(lockPath, 'wx', 0o600)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error(`output path is already reserved: ${filePath}`)
    }
    throw error
  }

  try {
    writeFileSync(fd, JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }))
    if (existsSync(filePath)) throw new Error(`output path already exists: ${filePath}`)
  } catch (error) {
    closeSync(fd)
    unlinkSync(lockPath)
    throw error
  }

  let released = false
  return {
    lockPath,
    release: () => {
      if (released) return
      released = true
      try {
        closeSync(fd)
      } finally {
        try {
          unlinkSync(lockPath)
        } catch {
          // Best-effort cleanup; a stale lock is safer than concurrent overwrite.
        }
      }
    },
  }
}
