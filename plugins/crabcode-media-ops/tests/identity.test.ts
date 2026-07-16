import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { IdentityError, authorizeToolCall } from '../src/identity.ts'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

function oauthContext(roles: string[]) {
  return {
    authInfo: {
      scopes: roles,
      expiresAt: Math.floor(Date.now() / 1000) + 300,
      extra: { sub: 'reviewer-42', iss: 'https://identity.example', name: '可信复核员' },
    },
  }
}

function parseToolResult(result: any): any {
  const block = result.content.find((item: any) => item.type === 'text') as { text: string } | undefined
  if (!block) throw new Error('tool result has no text envelope')
  return JSON.parse(block.text)
}

async function stdioClient(env: Record<string, string>): Promise<{ client: Client; transport: StdioClientTransport }> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve('src/server.ts')],
    cwd: resolve('.'),
    env,
    stderr: 'pipe',
  })
  const client = new Client({ name: 'identity-integration-test', version: '1.0.0' })
  await client.connect(transport)
  return { client, transport }
}

describe('trusted MCP/host identity binding', () => {
  test('rejects caller names without trusted request identity', () => {
    expect(() => authorizeToolCall('mediaops.approval.decide', { decidedBy: 'self-asserted' })).toThrow(IdentityError)
    try {
      authorizeToolCall('mediaops.approval.decide', { decidedBy: 'self-asserted' })
    } catch (error) {
      expect((error as IdentityError).code).toBe('AUTHENTICATION_REQUIRED')
    }
  })

  test('overwrites all accountable fields and enforces roles from authInfo', () => {
    const bound = authorizeToolCall('mediaops.editorial.review', {
      completedBy: 'spoofed',
      legalReview: { reviewedBy: 'spoofed' },
      aiDisclosure: { confirmedBy: 'spoofed' },
      waivers: [{ claimId: 'c1', by: 'spoofed', reason: 'test' }],
    }, oauthContext(['mediaops:editorial_reviewer']))
    const args = bound.args as any
    expect(bound.principal?.actorKey).toBe('https://identity.example:reviewer-42')
    expect(args.completedBy).toBe(bound.principal?.actorKey)
    expect(args.legalReview.reviewedBy).toBe(bound.principal?.actorKey)
    expect(args.aiDisclosure.confirmedBy).toBe(bound.principal?.actorKey)
    expect(args.waivers[0].by).toBe(bound.principal?.actorKey)
    expect(() => authorizeToolCall('mediaops.publish.package', { packagedBy: 'spoofed' }, oauthContext(['author']))).toThrow('lacks required role publisher')
  })

  test('stdio server fails closed without identity and exposes configured host principal', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'mediaops-identity-mcp-'))
    temporaryDirectories.push(dataDir)
    const baseEnv = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
    delete baseEnv.MEDIAOPS_IDENTITY_MODE
    delete baseEnv.MEDIAOPS_TRUSTED_PRINCIPAL_ID
    delete baseEnv.MEDIAOPS_TRUSTED_PRINCIPAL_ISSUER
    delete baseEnv.MEDIAOPS_TRUSTED_PRINCIPAL_ROLES
    const anonymous = await stdioClient({ ...baseEnv, MEDIAOPS_DATA_DIR: dataDir })
    try {
      const rejected = parseToolResult(await anonymous.client.callTool({
        name: 'mediaops.content.save',
        arguments: { kind: 'brief', brandId: 'identity-brand', profileVersion: 'v1', stage: 'intake', title: '身份测试', researchSubject: '身份测试', bodyMarkdown: '', savedBy: 'spoofed' },
      }))
      expect(rejected.error.code).toBe('AUTHENTICATION_REQUIRED')
    } finally {
      await anonymous.client.close()
    }

    const authenticated = await stdioClient({
      ...baseEnv,
      MEDIAOPS_DATA_DIR: dataDir,
      MEDIAOPS_IDENTITY_MODE: 'host-principal',
      MEDIAOPS_TRUSTED_PRINCIPAL_ID: 'desktop-user',
      MEDIAOPS_TRUSTED_PRINCIPAL_ISSUER: 'crabcode-host',
      MEDIAOPS_TRUSTED_PRINCIPAL_ROLES: 'author',
    })
    try {
      const capability = parseToolResult(await authenticated.client.callTool({ name: 'mediaops.capabilities', arguments: {} }))
      expect(capability.data.governedCapabilities.authenticatedActorIdentity).toBe(true)
      expect(capability.data.governedCapabilities.actorPrincipalId).toBe('desktop-user')
      const saved = parseToolResult(await authenticated.client.callTool({
        name: 'mediaops.content.save',
        arguments: { kind: 'brief', brandId: 'identity-brand', profileVersion: 'v1', stage: 'intake', title: '身份测试', researchSubject: '身份测试', bodyMarkdown: '', savedBy: 'spoofed' },
      }))
      expect(saved.status).toBe('ok')
      const content = parseToolResult(await authenticated.client.callTool({ name: 'mediaops.content.get', arguments: { contentId: saved.data.contentId } }))
      expect(content.data.savedBy).toBe('crabcode-host:desktop-user')
    } finally {
      await authenticated.client.close()
    }
  })
})
