import { ok, type Envelope } from '../envelope.ts'
import { PLATFORMS } from '../platforms/registry.ts'
import { buildSources } from '../sources/index.ts'
import { VERSION } from '../domain.ts'
import { RENDER_CONTRACT } from '../rendering/renderer.ts'

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
      strictStageProgression: ['intake', 'researched', 'drafted', 'reviewed'],
      protectedReferenceRegistry: true,
      serverGeneratedEvidenceCapture: true,
      searchExecutionEvidence: 'caller-recorded; captured pages are server-generated',
      sourceIndependenceChecks: ['distinct-final-host', 'declared-origin-publisher', 'same-page-dedup', 'exact-snapshot-dedup'],
      factCheckRequired: true,
      originalityReviewRequired: true,
      deterministicOriginalityEvidence: true,
      roleSeparatedNamedAttestations: true,
      authenticatedActorIdentity: false,
      defaultDeliveryFormat: 'html',
      backupFormat: 'markdown',
      deliveryCandidateFreeze: true,
      deliveryByteVerification: true,
      automaticBrowserVisualVerification: false,
      namedVisualReviewAttestation: true,
      renderContract: RENDER_CONTRACT,
      approvalStateMachine: true,
      approvalHashBinding: ['content', 'articleDoc', 'deliveryManifest', 'primaryHtml', 'backupMarkdown', 'channelArtifacts'],
      creatorStyleForms: ['quick', 'full', 'incremental'],
      profileVersioning: true,
      platformRuleProvenance: true,
    },
  }, registry.warnings)
}
