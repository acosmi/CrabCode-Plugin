#!/usr/bin/env bun
/**
 * crabcode-html-video MCP server for CrabCode.
 *
 * This process never calls the model and never holds a model/provider API key.
 * dist/bootstrap.js removes the host environment before this bundle is loaded;
 * the only admitted secret is an explicitly named render-worker token.
 * Storyboard + frame HTML are produced by the host agent via SKILL.md — this
 * server only validates, lints, previews, and renders.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js'
import type { z } from 'zod/v4'
import { join } from 'node:path'

import { toToolResult, type Envelope } from './envelope.ts'
import * as validateGraph from './tools/validateGraph.ts'
import * as lintFrame from './tools/lintFrame.ts'
import * as renderFrames from './tools/renderFrames.ts'
import * as doctor from './tools/doctor.ts'
import * as previewFrame from './tools/previewFrame.ts'
import { pluginRoot } from './paths.ts'
import type { ToolContext } from './cancellation.ts'

// This integrity root is part of the signed/bundled plugin, never a project or
// caller override. bootstrap.ts already set the same trusted path before this
// bundle was imported; keep this assignment as a defense-in-depth invariant.
process.env.PRODUCER_HYPERFRAME_MANIFEST_PATH = join(pluginRoot(), 'dist', 'hyperframe.manifest.json')

const server = new McpServer({ name: 'html-video', version: '0.1.0' })

function register<T extends z.ZodTypeAny>(
  name: string,
  description: string,
  inputSchema: T,
  handler: (args: z.infer<T>, context?: ToolContext) => Promise<Envelope>,
  annotations: ToolAnnotations,
): void {
  server.registerTool(
    name,
    { description, inputSchema, annotations },
    (async (args: z.infer<T>, extra: { signal?: AbortSignal }) => {
      try {
        const env = await handler((args ?? {}) as z.infer<T>, { signal: extra.signal })
        return toToolResult(env)
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        return toToolResult({
          success: false,
          status: 'error',
          error: { code: 'internal', message },
        })
      }
    }) as any,
  )
}

register(
  validateGraph.name,
  validateGraph.description,
  validateGraph.inputSchema,
  validateGraph.handler,
  validateGraph.annotations,
)
register(lintFrame.name, lintFrame.description, lintFrame.inputSchema, lintFrame.handler, lintFrame.annotations)
register(
  renderFrames.name,
  renderFrames.description,
  renderFrames.inputSchema,
  renderFrames.handler,
  renderFrames.annotations,
)
register(doctor.name, doctor.description, doctor.inputSchema, doctor.handler, doctor.annotations)
register(
  previewFrame.name,
  previewFrame.description,
  previewFrame.inputSchema,
  previewFrame.handler,
  previewFrame.annotations,
)

await server.connect(new StdioServerTransport())
process.stderr.write('html-video: MCP server ready\n')
