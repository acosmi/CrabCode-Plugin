import { ok, type Envelope } from '../envelope.ts'
import { PLATFORMS } from '../platforms/registry.ts'
import { buildSources } from '../sources/index.ts'

export const name = 'mediaops.capabilities'
export const description =
  'Report what this media-ops server can do: enabled platforms, available trend sources, and which dangerous capabilities are disabled.'

export const inputSchema = {}

export async function handler(): Promise<Envelope> {
  const registry = buildSources()
  return ok({
    version: '0.1.0',
    phase: 'gate-a (skeleton + creation loop)',
    enabledPlatforms: PLATFORMS.map((p) => ({
      id: p.id,
      displayName: p.displayName,
      formats: p.formats,
      apiPublishGate: p.apiPublishGate,
    })),
    availableSources: Object.keys(registry.sources),
    dangerousCapabilities: {
      publish: false,
      autoComment: false,
    },
  }, registry.warnings)
}
