#!/usr/bin/env bun
import { fileURLToPath } from 'node:url'
import { sanitizeSidecarEnvironment } from './environmentIsolation.ts'

// Keep validation/repair invocations under the same zero-provider-key boundary
// as the MCP entrypoint. The dependency-heavy doctor module is loaded only
// after the environment sweep.
sanitizeSidecarEnvironment(process.env)
process.env.PRODUCER_HYPERFRAME_MANIFEST_PATH = fileURLToPath(
  new URL('../dist/hyperframe.manifest.json', import.meta.url),
)
const { handler } = await import('./tools/doctor.ts')

const install = process.argv.includes('--install')
const checkOnly = process.argv.includes('--check-only')
const result = await handler({ install: install && !checkOnly, useMirror: true })
console.log(JSON.stringify(result, null, 2))
process.exit(result.success ? 0 : 1)
