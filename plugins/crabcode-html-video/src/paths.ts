import { delimiter, join, resolve, sep } from 'node:path'
import { chmodSync, mkdirSync, realpathSync, statSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { resolveSafeOutputPath } from '@crabcode/multi-segment'

function privateDir(path: string): string {
  mkdirSync(path, { recursive: true, mode: 0o700 })
  try {
    chmodSync(path, 0o700)
  } catch {
    // Best effort on filesystems that do not expose POSIX modes.
  }
  return path
}

export function pluginRoot(): string {
  return process.env.CRABCODE_PLUGIN_ROOT || process.cwd()
}

export function pluginData(): string {
  const d =
    process.env.CRABCODE_PLUGIN_DATA ||
    process.env.CRABCODE_HTML_VIDEO_DATA ||
    join(pluginRoot(), '.data')
  return privateDir(d)
}

export function browsersDir(): string {
  const d = join(pluginData(), 'browsers')
  return privateDir(d)
}

export function workDir(): string {
  const d = join(pluginData(), 'work')
  return privateDir(d)
}

export function outputsDir(): string {
  const d = join(pluginData(), 'outputs')
  return privateDir(d)
}

export function inputsDir(): string {
  return privateDir(join(pluginData(), 'inputs'))
}

export function safeOutputPath(name?: string): string {
  return resolveSafeOutputPath(outputsDir(), name || `video-${randomUUID()}.mp4`)
}

export function safeWorkFile(name: string, extension: 'html' | 'mp4'): string {
  return resolveSafeOutputPath(workDir(), `${name}.${extension}`, {
    pattern: new RegExp(`^[A-Za-z0-9][A-Za-z0-9._-]*\\.${extension}$`, 'i'),
  })
}

export function allowedAudioRoots(): string[] {
  const configured = (process.env.CRABCODE_HTML_VIDEO_AUDIO_ROOTS || '')
    .split(delimiter)
    .map((root) => root.trim())
    .filter(Boolean)
  return [inputsDir(), ...configured]
}

export function resolveAllowedAudioPath(filePath: string): string {
  const actual = realpathSync(filePath)
  const stat = statSync(actual)
  if (!stat.isFile()) throw new Error('audioPath must reference a regular file')
  if (stat.size > 100 * 1024 * 1024) throw new Error('audioPath exceeds the 100 MiB safety limit')
  for (const candidate of allowedAudioRoots()) {
    let root: string
    try {
      root = realpathSync(candidate)
    } catch {
      root = resolve(candidate)
    }
    const prefix = root.endsWith(sep) ? root : root + sep
    if (actual.startsWith(prefix)) return actual
  }
  throw new Error('audioPath is outside the configured media roots')
}
