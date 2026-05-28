#!/usr/bin/env bun
/**
 * Media operations MCP server for CrabCode.
 *
 * This process never calls the model and never holds any API key. CrabCode only
 * injects CRABCODE_PLUGIN_ROOT / CRABCODE_PLUGIN_DATA and does not support MCP
 * sampling. Every "creation" step (briefs, drafts, humanizing, variants) is done
 * by the main agent via SKILL.md — this server only performs deterministic I/O,
 * computation, storage, and packaging.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { toToolResult, type Envelope } from './envelope.ts'

import * as capabilities from './tools/capabilities.ts'
import * as doctor from './tools/doctor.ts'
import * as policy from './tools/policy.ts'
import * as trends from './tools/trends.ts'
import * as content from './tools/content.ts'
import * as preview from './tools/preview.ts'
import * as readiness from './tools/readiness.ts'
import * as approval from './tools/approval.ts'
import * as packageTool from './tools/package.ts'
import * as history from './tools/history.ts'

const server = new McpServer({ name: 'mediaops', version: '0.1.0' })

/** Register a tool whose handler returns an Envelope, wiring it to the MCP result shape. */
function register(
  name: string,
  description: string,
  inputSchema: Record<string, unknown>,
  handler: (args: any) => Promise<Envelope>,
): void {
  server.registerTool(
    name,
    { description, inputSchema: inputSchema as any },
    async (args: any) => {
      try {
        const env = await handler(args ?? {})
        return toToolResult(env)
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        return toToolResult({ success: false, status: 'error', error: { code: 'internal', message } })
      }
    },
  )
}

register(capabilities.name, capabilities.description, capabilities.inputSchema, capabilities.handler)
register(doctor.name, doctor.description, doctor.inputSchema, doctor.handler)
register(policy.name, policy.description, policy.inputSchema, policy.handler)

register(trends.searchName, trends.searchDescription, trends.searchInputSchema, trends.searchHandler)
register(trends.clusterName, trends.clusterDescription, trends.clusterInputSchema, trends.clusterHandler)

register(content.saveName, content.saveDescription, content.saveInputSchema, content.saveHandler)
register(content.getName, content.getDescription, content.getInputSchema, content.getHandler)
register(content.listName, content.listDescription, content.listInputSchema, content.listHandler)

register(preview.name, preview.description, preview.inputSchema, preview.handler)
register(readiness.name, readiness.description, readiness.inputSchema, readiness.handler)

register(approval.requestName, approval.requestDescription, approval.requestInputSchema, approval.requestHandler)
register(approval.listName, approval.listDescription, approval.listInputSchema, approval.listHandler)

register(packageTool.name, packageTool.description, packageTool.inputSchema, packageTool.handler)
register(history.name, history.description, history.inputSchema, history.handler)

await server.connect(new StdioServerTransport())

process.stderr.write('mediaops: MCP server ready (gate-a)\n')
