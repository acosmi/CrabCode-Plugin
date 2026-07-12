import { ok, type Envelope } from '../envelope.ts'
import { PLATFORMS } from '../platforms/registry.ts'
import { buildSources } from '../sources/index.ts'
import { VERSION } from '../domain.ts'

export const name = 'mediaops.capabilities'
export const description =
  'Report what this media-ops server can do: enabled platforms, available trend sources, and which dangerous capabilities are disabled.'

export const inputSchema = {}

export async function handler(): Promise<Envelope> {
  const registry = buildSources()
  return ok({
    version: VERSION,
    phase: 'gate-a (governed editorial workflow + hard publish gate)',
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
    governedCapabilities: {
      contentManifest: true,
      factCheckRequired: true,
      originalityReviewRequired: true,
      approvalStateMachine: true,
      approvalHashBinding: true,
      creatorStyleForms: ['quick', 'full', 'incremental'],
      profileVersioning: true,
      platformRuleProvenance: true,
    },
  }, registry.warnings)
}
