import { ok, type Envelope } from '../envelope.ts'
import { PLATFORMS } from '../platforms/registry.ts'
import { buildSources } from '../sources/index.ts'
import { VERSION } from '../domain.ts'
import type { TrustedPrincipal } from '../identity.ts'
import { RENDER_CONTRACT } from '../rendering/renderer.ts'

export const name = 'mediaops.capabilities'
export const description =
  'Report what this media-ops server can do: enabled platforms, available trend sources, and which dangerous capabilities are disabled.'

export const inputSchema = {}

export async function handler(_args: Record<string, never> = {}, principal?: TrustedPrincipal): Promise<Envelope> {
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
      hashVerifiedResearchBundleRecovery: 'mediaops.research.get',
      searchExecutionEvidence: 'caller-recorded; captured pages are server-generated',
      sourceIndependenceChecks: ['organization-host', 'accountable-publisher', 'same-page-dedup', 'exact-snapshot-dedup', 'near-duplicate-clustering'],
      sourceClassifications: 'derived from accountable snapshot-bound assessments; direct sourceTier/isPrimary input is rejected',
      factCheckRequired: true,
      deterministicArticleStatementLedger: true,
      originalityReviewRequired: true,
      deterministicOriginalityEvidence: true,
      authenticatedRoleSeparatedAttestations: true,
      authenticatedActorIdentity: Boolean(principal),
      actorIdentityAssurance: principal?.assurance ?? 'required',
      actorPrincipalId: principal?.principalId,
      actorRoles: principal?.roles ?? [],
      defaultDeliveryFormat: 'html',
      backupFormat: 'markdown',
      deliveryCandidateFreeze: true,
      deliveryByteVerification: true,
      automaticBrowserVisualVerification: true,
      automaticHtmlValidation: 'Nu Html Checker 26.7.15',
      automaticAccessibilityVerification: 'axe-core 4.12.1 automated rules plus manual review',
      fixedBrowserEvidence: 'Playwright 1.61.1 / Chromium 149.0.7827.55',
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
