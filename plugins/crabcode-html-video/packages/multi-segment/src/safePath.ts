import { basename, join, resolve, sep } from 'node:path'

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
  const base = basename(raw.replace(/\\/g, '/'))
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
