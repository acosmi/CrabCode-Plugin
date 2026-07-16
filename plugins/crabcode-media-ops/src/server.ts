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
import * as references from './tools/references.ts'
import * as researchCapture from './tools/research-capture.ts'
import * as research from './tools/research.ts'
import * as originality from './tools/originality.ts'
import * as editorialReview from './tools/editorial-review.ts'
import * as delivery from './tools/delivery.ts'
import * as profiles from './tools/profiles.ts'
import * as preview from './tools/preview.ts'
import * as readiness from './tools/readiness.ts'
import * as approval from './tools/approval.ts'
import * as packageTool from './tools/package.ts'
import * as history from './tools/history.ts'
import * as style from './tools/style.ts'
import * as platformRules from './tools/platform-rules.ts'
import { VERSION } from './domain.ts'
import { IdentityError, authorizeToolCall, type ToolRequestContext, type TrustedPrincipal } from './identity.ts'
import { StorageConflictError, StorageCorruptionError, StorageLeaseError } from './storage.ts'

const server = new McpServer({ name: 'mediaops', version: VERSION })

/** Register a tool whose handler returns an Envelope, wiring it to the MCP result shape. */
function register(
  name: string,
  description: string,
  inputSchema: Record<string, unknown>,
  handler: (args: any, principal?: TrustedPrincipal) => Promise<Envelope>,
): void {
  server.registerTool(
    name,
    { description, inputSchema: inputSchema as any },
    async (args: any, extra: ToolRequestContext) => {
      try {
        const authorized = authorizeToolCall(name, args ?? {}, extra)
        const env = await handler(authorized.args, authorized.principal ?? undefined)
        return toToolResult(env)
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        const code = e instanceof StorageCorruptionError || e instanceof StorageConflictError || e instanceof StorageLeaseError || e instanceof IdentityError
          ? e.code
          : 'INTERNAL_ERROR'
        return toToolResult({ success: false, status: 'error', error: { code, message } })
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

register(references.registerName, references.registerDescription, references.registerInputSchema, references.registerHandler)
register(references.getName, references.getDescription, references.getInputSchema, references.getHandler)
register(researchCapture.name, researchCapture.description, researchCapture.inputSchema, researchCapture.handler)
register(research.name, research.description, research.inputSchema, research.handler)
register(research.getName, research.getDescription, research.getInputSchema, research.getHandler)
register(originality.scanName, originality.scanDescription, originality.scanInputSchema, originality.scanHandler)
register(originality.reviewName, originality.reviewDescription, originality.reviewInputSchema, originality.reviewHandler)
register(editorialReview.name, editorialReview.description, editorialReview.inputSchema, editorialReview.handler)
register(delivery.renderName, delivery.renderDescription, delivery.renderInputSchema, delivery.renderHandler)
register(delivery.verifyName, delivery.verifyDescription, delivery.verifyInputSchema, delivery.verifyHandler)

register(profiles.saveName, profiles.saveDescription, profiles.saveInputSchema, profiles.saveHandler)
register(profiles.getName, profiles.getDescription, profiles.getInputSchema, profiles.getHandler)
register(profiles.listName, profiles.listDescription, profiles.listInputSchema, profiles.listHandler)
register(profiles.historyName, profiles.historyDescription, profiles.historyInputSchema, profiles.historyHandler)
register(profiles.rollbackName, profiles.rollbackDescription, profiles.rollbackInputSchema, profiles.rollbackHandler)

register(style.templateName, style.templateDescription, style.templateInputSchema, style.templateHandler)
register(style.saveDraftName, style.saveDraftDescription, style.saveDraftInputSchema, style.saveDraftHandler)
register(style.submitName, style.submitDescription, style.submitInputSchema, style.submitHandler)
register(style.getFormName, style.getFormDescription, style.getFormInputSchema, style.getFormHandler)
register(style.proposeName, style.proposeDescription, style.proposeInputSchema, style.proposeHandler)
register(style.confirmName, style.confirmDescription, style.confirmInputSchema, style.confirmHandler)

register(preview.name, preview.description, preview.inputSchema, preview.handler)
register(readiness.name, readiness.description, readiness.inputSchema, readiness.handler)

register(approval.requestName, approval.requestDescription, approval.requestInputSchema, approval.requestHandler)
register(approval.decideName, approval.decideDescription, approval.decideInputSchema, approval.decideHandler)
register(approval.getName, approval.getDescription, approval.getInputSchema, approval.getHandler)
register(approval.listName, approval.listDescription, approval.listInputSchema, approval.listHandler)

register(packageTool.name, packageTool.description, packageTool.inputSchema, packageTool.handler)
register(history.name, history.description, history.inputSchema, history.handler)
register(platformRules.name, platformRules.description, platformRules.inputSchema, platformRules.handler)

await server.connect(new StdioServerTransport())

process.stderr.write('mediaops: MCP server ready (gate-a)\n')
