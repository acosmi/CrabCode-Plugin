import { ok, type Envelope } from '../envelope.ts'
import { PLATFORMS } from '../platforms/registry.ts'
import { buildSources, describeSourceRegions } from '../sources/index.ts'
import { VERSION } from '../domain.ts'
import { describePrincipal, type TrustedPrincipal } from '../identity.ts'
import { RENDER_CONTRACT } from '../rendering/renderer.ts'

/** Stop codes every media-ops orchestration must honor (PRACTICE preflight contract). */
const STOP_CODES = Object.freeze([
  'MCP_INACTIVE',
  'MCP_START_FAILED',
  'MCP_TOOL_UNDISCOVERABLE',
  'AUTHENTICATION_REQUIRED',
  'ROLE_REQUIRED',
  'DEPENDENCY_NOT_READY',
  'GATE_NOT_EXECUTED',
])

export const name = 'mediaops.capabilities'
export const description =
  'Report what this media-ops server can do: enabled platforms, available trend sources, and which dangerous capabilities are disabled.'

export const inputSchema = {}

/**
 * What the server is allowed to say about Chinese hot topics.
 *
 * With no `region: 'cn'` source registered, a trend result is a global-only
 * result. Returning that list with no further comment reads as Chinese coverage
 * and is the exact misunderstanding §8.2 asks us to prevent, so the absence is
 * reported as a fact rather than left to be inferred from a list of names.
 */
export const CHINESE_HOT_SOURCES_UNCONFIGURED_NOTE =
  '未配置：中文平台接入需有授权的来源、用户自备数据或研究代理（WebSearch/WebFetch）；本服务不抓取无官方 API 的平台。'

export async function handler(_args: Record<string, never> = {}, principal?: TrustedPrincipal): Promise<Envelope> {
  const registry = buildSources()
  const regions = describeSourceRegions(registry.sources)
  const identity = describePrincipal(principal ?? null)
  return ok({
    version: VERSION,
    phase: 'gate-a (governed editorial workflow + hard publish gate)',
    identity,
    stopCodes: STOP_CODES,
    preflight: 'Call this tool first, check identity.mode/roles, then mediaops.doctor for stage readiness and heavy-QA dependency probes before orchestrating.',
    enabledPlatforms: PLATFORMS.map((p) => ({
      id: p.id,
      displayName: p.displayName,
      formats: p.formats,
      apiPublishGate: p.apiPublishGate,
    })),
    availableSources: Object.keys(registry.sources),
    chineseHotSources: {
      configured: regions.cnConfigured,
      sources: regions.cn,
      note: regions.cnConfigured ? `已配置：${regions.cn.join(', ')}` : CHINESE_HOT_SOURCES_UNCONFIGURED_NOTE,
    },
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
      unapprovedDraftExport: 'mediaops.delivery.export_draft — releaseStatus=unapproved, qaLevel=none, stored apart from delivery-manifests',
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
