import { join } from 'node:path'
import { mkdirSync } from 'node:fs'

export function pluginRoot(): string {
  return process.env.CRABCODE_PLUGIN_ROOT || process.cwd()
}

export function pluginData(): string {
  const d =
    process.env.CRABCODE_PLUGIN_DATA ||
    process.env.CRABCODE_HTML_VIDEO_DATA ||
    join(pluginRoot(), '.data')
  mkdirSync(d, { recursive: true })
  return d
}

export function browsersDir(): string {
  const d = join(pluginData(), 'browsers')
  mkdirSync(d, { recursive: true })
  return d
}

export function workDir(): string {
  const d = join(pluginData(), 'work')
  mkdirSync(d, { recursive: true })
  return d
}

export function outputsDir(): string {
  const d = join(pluginData(), 'outputs')
  mkdirSync(d, { recursive: true })
  return d
}
