#!/usr/bin/env bun
/**
 * crabcode-html-video MCP server for CrabCode.
 *
 * This process never calls the model and never holds any API key. CrabCode only
 * injects CRABCODE_PLUGIN_ROOT / CRABCODE_PLUGIN_DATA. Storyboard + frame HTML
 * are produced by the host agent via SKILL.md — this server only validates,
 * lints, previews, and renders.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { toToolResult, type Envelope } from './envelope.ts'
import * as validateGraph from './tools/validateGraph.ts'
import * as lintFrame from './tools/lintFrame.ts'
import * as renderFrames from './tools/renderFrames.ts'
import * as doctor from './tools/doctor.ts'
import * as previewFrame from './tools/previewFrame.ts'

const server = new McpServer({ name: 'html-video', version: '0.1.0' })

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
        return toToolResult({
          success: false,
          status: 'error',
          error: { code: 'internal', message },
        })
      }
    },
  )
}

register(validateGraph.name, validateGraph.description, validateGraph.inputSchema, validateGraph.handler)
register(lintFrame.name, lintFrame.description, lintFrame.inputSchema, lintFrame.handler)
register(renderFrames.name, renderFrames.description, renderFrames.inputSchema, renderFrames.handler)
register(doctor.name, doctor.description, doctor.inputSchema, doctor.handler)
register(previewFrame.name, previewFrame.description, previewFrame.inputSchema, previewFrame.handler)

await server.connect(new StdioServerTransport())
process.stderr.write('html-video: MCP server ready\n')
