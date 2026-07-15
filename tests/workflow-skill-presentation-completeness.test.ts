import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'

const root = resolve(import.meta.dir, '..')
const EXPECTED_WORKFLOW_SKILLS = 316
const EXPECTED_INVOCATION_SET_SHA256 = '8fdfcd6fdd39d7fa952c6d0f554ed675429597869cac28f9239269588228ab33'
// Updated for the audited crabcopyright-cn v0.3.0 workflow-content migration
// and the CrabFin workbook capability-routing correction; the 316 invocation
// identities remain unchanged and are pinned independently.
const EXPECTED_MODEL_CONTENT_SHA256 = 'da69c588a97718e75d5e9dee4f5bd500e96c00b3aa26533fb47b212dbc3a103c'
const HAN = /[\u3400-\u9fff]/u

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function frontmatterScalar(text: string, key: string): string {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const value = text.match(new RegExp(`^${escaped}:\\s*(.+)$`, 'm'))?.[1]?.trim() ?? ''
  if (value.startsWith('"') && value.endsWith('"')) return JSON.parse(value) as string
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1).replace(/''/g, "'")
  return value
}

function stableModelContent(text: string): string {
  return text
    .split(/(?<=\n)/)
    .filter((line) => !/^name:/.test(line) && !/^short-description:/.test(line))
    .join('')
}

describe('official workflow skill presentation completeness', () => {
  test('keeps all 316 invocation identities and model-facing contents stable while localizing cards', () => {
    const marketplace = JSON.parse(
      readFileSync(join(root, '.crabcode-plugin', 'marketplace.json'), 'utf8'),
    ) as {
      metadata: { version: string }
      plugins: Array<{ name: string; source: string; version: string; tier?: string }>
    }
    const workflows = marketplace.plugins.filter((entry) => entry.tier === 'workflow')
    const invocationKeys: string[] = []
    const modelContentHashes: string[] = []

    for (const entry of workflows) {
      const pluginRoot = resolve(root, entry.source)
      const manifest = JSON.parse(
        readFileSync(join(pluginRoot, '.crabcode-plugin', 'plugin.json'), 'utf8'),
      ) as { version: string; skills?: string[] }
      expect(entry.version).toBe(manifest.version)

      for (const relativeSkillPath of manifest.skills ?? []) {
        const invocationName = basename(relativeSkillPath.replace(/[\\/]+$/, ''))
        const invocationKey = `${entry.name}:${invocationName}`
        // Canonicalize to LF so the content fingerprint is byte-identical on every
        // platform. Windows checkouts are CRLF under autocrlf while CI/Linux is LF;
        // hashing raw bytes would otherwise diverge by platform.
        const text = readFileSync(join(pluginRoot, relativeSkillPath, 'SKILL.md'), 'utf8').replace(
          /\r\n?/g,
          '\n',
        )
        const displayName = frontmatterScalar(text, 'name')
        const shortDescription = frontmatterScalar(text, 'short-description')
        const shortLength = Array.from(shortDescription).length

        expect(displayName, invocationKey).toMatch(HAN)
        expect(shortDescription, invocationKey).toMatch(HAN)
        expect(shortLength, invocationKey).toBeGreaterThanOrEqual(18)
        expect(shortLength, invocationKey).toBeLessThanOrEqual(72)

        invocationKeys.push(invocationKey)
        modelContentHashes.push(`${invocationKey}:${sha256(stableModelContent(text))}`)
      }
    }

    invocationKeys.sort()
    modelContentHashes.sort()
    expect(invocationKeys).toHaveLength(EXPECTED_WORKFLOW_SKILLS)
    expect(new Set(invocationKeys).size).toBe(EXPECTED_WORKFLOW_SKILLS)
    expect(sha256(JSON.stringify(invocationKeys))).toBe(EXPECTED_INVOCATION_SET_SHA256)
    expect(sha256(JSON.stringify(modelContentHashes))).toBe(EXPECTED_MODEL_CONTENT_SHA256)
    expect(marketplace.metadata.version).toBe('0.4.3')

    const mediaEntry = workflows.find((entry) => entry.name === 'crabcode-media-ops')
    expect(mediaEntry).toBeDefined()
    const mediaRoot = resolve(root, mediaEntry!.source)
    const mediaManifest = JSON.parse(
      readFileSync(join(mediaRoot, '.crabcode-plugin', 'plugin.json'), 'utf8'),
    ) as { version: string }
    const mediaPackage = JSON.parse(readFileSync(join(mediaRoot, 'package.json'), 'utf8')) as {
      version: string
    }
    expect(mediaPackage.version).toBe(mediaManifest.version)
    expect(mediaEntry!.version).toBe(mediaManifest.version)
  })
})
