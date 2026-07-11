import { afterEach, describe, expect, test } from 'bun:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
let client: Client | undefined

afterEach(async () => {
  await client?.close().catch(() => {})
  client = undefined
})

async function connect(extraEnvironment: Record<string, string> = {}): Promise<Client> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--no-env-file', '--cwd', pluginRoot, resolve(pluginRoot, 'dist/bootstrap.js')],
    cwd: pluginRoot,
    env: {
      ...process.env,
      CRABCODE_PLUGIN_ROOT: pluginRoot,
      CRABCODE_PLUGIN_DATA: resolve(tmpdir(), 'crabcode-html-video-mcp-tests'),
      ...extraEnvironment,
    } as Record<string, string>,
    stderr: 'pipe',
  })
  client = new Client({ name: 'crabcode-html-video-test', version: '1.0.0' })
  await client.connect(transport)
  return client
}

describe('MCP stdio contract', () => {
  test('initialize, list tools, and call a read-only tool', async () => {
    const connected = await connect()
    const listed = await connected.listTools()
    const byName = new Map(listed.tools.map((tool) => [tool.name, tool]))

    expect([...byName.keys()].sort()).toEqual(
      ['doctor', 'lintFrame', 'previewFrame', 'renderFrames', 'validateGraph'].sort(),
    )
    expect(byName.get('renderFrames')?.annotations?.destructiveHint).toBe(true)
    expect(byName.get('renderFrames')?.annotations?.title).toBe('Render HTML Video')
    expect(byName.get('renderFrames')?.annotations?.openWorldHint).toBe(true)
    expect(byName.get('lintFrame')?.annotations?.readOnlyHint).toBe(true)
    expect(byName.get('lintFrame')?.annotations?.title).toBe('Lint Video Frame')
    expect(byName.get('renderFrames')?.inputSchema.required).toContain('confirmed')

    const result = await connected.callTool({
      name: 'validateGraph',
      arguments: {
        graph: {
          schemaVersion: 1,
          intent: 'promo',
          nodes: [{ id: 'intro', kind: 'text', text: 'hello', durationSec: 1 }],
          edges: [],
        },
      },
    })
    expect(result.isError).not.toBe(true)
    expect((result.structuredContent as { success?: boolean } | undefined)?.success).toBe(true)
  })

  test('SDK rejects invalid confirmed type before the handler', async () => {
    const connected = await connect()
    const result = await connected.callTool({
      name: 'renderFrames',
      arguments: {
        segments: [{ id: 'intro', html: '<div>hello</div>', durationSec: 1 }],
        confirmed: 'yes',
      },
    })
    expect(result.isError).toBe(true)
    expect(JSON.stringify(result.content)).toContain('Input validation error')
  })

  test('security bootstrap removes inherited provider credentials before server import', async () => {
    const connected = await connect({
      VENDOR_API_KEY: 'must-not-enter-sidecar',
      MODEL_PROVIDER_API_KEY: 'must-not-enter-sidecar',
      AWS_ACCESS_KEY_ID: 'must-not-enter-sidecar',
      AWS_SECRET_ACCESS_KEY: 'must-not-enter-sidecar',
      CRABCODE_PLUGIN_VENDOR_API_KEY: 'prefix-must-not-bypass-credential-denylist',
      CRABCODE_PLUGIN_UPSTREAM_CRED: 'opaque-name-must-not-bypass-allowlist',
      OPAQUE_VALUE: 'opaque-name-must-not-bypass-allowlist',
      CRABCODE_HTML_VIDEO_RENDER_MODE: 'remote',
      HTML_VIDEO_WORKER_TOKEN: 'allowed-render-worker-secret',
    })
    const result = await connected.callTool({ name: 'doctor', arguments: {} })
    const details = (
      result.structuredContent as {
        error?: {
          details?: {
            environmentIsolation?: {
              sanitized?: boolean
              unexpectedCredentialNames?: string[]
              unexpectedEnvironmentNames?: string[]
            }
            producer?: { authConfigured?: boolean }
          }
        }
      }
    ).error?.details

    expect(details?.environmentIsolation).toEqual({
      sanitized: true,
      unexpectedCredentialNames: [],
      unexpectedEnvironmentNames: [],
    })
    // A render-worker bearer is the sole credential exception and is reported
    // only as configured/not-configured; its value is never returned.
    expect(details?.producer?.authConfigured).toBe(true)
    expect(JSON.stringify(result.structuredContent)).not.toContain('must-not-enter-sidecar')
    expect(JSON.stringify(result.structuredContent)).not.toContain('opaque-name-must-not-bypass-allowlist')
    expect(JSON.stringify(result.structuredContent)).not.toContain('allowed-render-worker-secret')
  })
})
