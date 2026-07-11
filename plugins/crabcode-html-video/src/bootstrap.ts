#!/usr/bin/env bun
/**
 * Security bootstrap. Do not add MCP, renderer, or other third-party imports.
 * The full server bundle is loaded only after the inherited environment is
 * reduced to the explicit allowlist.
 */

import { fileURLToPath } from 'node:url'
import { sanitizeSidecarEnvironment } from './environmentIsolation.ts'

sanitizeSidecarEnvironment(process.env)

// This path is supplied by the signed plugin itself, never inherited from the
// host. Set it before the producer bundle is evaluated.
process.env.PRODUCER_HYPERFRAME_MANIFEST_PATH = fileURLToPath(
  new URL('./hyperframe.manifest.json', import.meta.url),
)

const serverUrl = new URL('./server.js', import.meta.url)
await import(serverUrl.href)
