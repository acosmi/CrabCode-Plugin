import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { saveHandler as saveContent, getLatestContent } from '../src/tools/content.ts'
import { getPlatform } from '../src/platforms/registry.ts'
import { handler, inspectContent } from '../src/tools/readiness.ts'
import { createProfile, createReviewedContent } from './helpers.ts'

describe('complete Media Gate', () => {
  let dir: string
  let version: string
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mediaops-readiness-v2-'))
    process.env.MEDIAOPS_DATA_DIR = dir
    version = await createProfile('tech-daily')
  })
  afterEach(async () => rm(dir, { recursive: true, force: true }))

  test('passes only a fully evidenced and delivery-verified revision', async () => {
    const content = await createReviewedContent({ deliveryMode: 'verified', dir, brandId: 'tech-daily', profileVersion: version })
    const env = await handler({ contentId: content.contentId })
    expect(env.status).toBe('ok')
    expect((env.data as any).ready).toBe(true)
    expect((env.data as any).primaryArtifact.format).toBe('html')
    expect((env.data as any).backupArtifact.format).toBe('markdown')
  })

  test('intake cannot self-report or bypass research/review/delivery gates', async () => {
    const intake = await saveContent({ kind: 'draft', brandId: 'tech-daily', profileVersion: version, researchSubject: '选题', stage: 'intake', platform: 'wechat', title: '草稿', bodyMarkdown: '', savedBy: '作者' })
    const env = await handler({ contentId: (intake.data as any).contentId })
    const codes = (env.data as any).issues.map((issue: any) => issue.code)
    expect(codes).toContain('EDITORIAL_REVIEW_REQUIRED')
    expect(codes).toContain('RESEARCH_EVIDENCE_REQUIRED')
    expect(codes).toContain('DELIVERY_VERIFICATION_REQUIRED')
  })

  test('confirmed platform-native disclosure is valid without fixed body sentence', async () => {
    const content = await createReviewedContent({ deliveryMode: 'verified', dir, brandId: 'tech-daily', profileVersion: version, body: '纯正文', disclosure: { aiAssisted: true, methods: ['platform-native'], platformNativeConfirmed: true, confirmedBy: '事实核查员' } })
    expect((await handler({ contentId: content.contentId })).status).toBe('ok')
  })

  // RC-24: a static run is a draft aid, not an approval-grade record. The gate
  // decides on the evidence's own declared grade, never on the ambient QA mode.
  test('static QA evidence cannot push a revision through the Media Gate', async () => {
    const previous = process.env.MEDIAOPS_QA_MODE
    process.env.MEDIAOPS_QA_MODE = 'static'
    try {
      const fixture = await createReviewedContent({ deliveryMode: 'verified-static', dir, brandId: 'tech-daily', profileVersion: version })
      const env = await handler({ contentId: fixture.contentId })
      expect(env.status).toBe('action_required')
      expect((env.data as any).ready).toBe(false)
      const issues = (env.data as any).issues as Array<{ code: string; severity: string; message: string }>
      const blocker = issues.find((issue) => issue.code === 'DELIVERY_QA_LEVEL_INSUFFICIENT')
      expect(blocker?.severity).toBe('error')
      expect(blocker?.message).toContain('static')
      // Positive control: nothing else is wrong with this revision, so the code
      // cannot be appearing for some unrelated reason.
      expect(issues.filter((issue) => issue.severity === 'error').map((issue) => issue.code)).toEqual(['DELIVERY_QA_LEVEL_INSUFFICIENT'])
    } finally {
      if (previous === undefined) delete process.env.MEDIAOPS_QA_MODE
      else process.env.MEDIAOPS_QA_MODE = previous
    }
  })

  // Records written before 0.4.4 carry no `mode`. "It does not say" is not
  // "it was full": an absent grade must block exactly like a static one.
  test('legacy evidence without a recorded mode is insufficient, not full', async () => {
    const fixture = await createReviewedContent({ deliveryMode: 'verified', dir, brandId: 'tech-daily', profileVersion: version })
    // Positive control: this revision is ready before the grade is stripped.
    expect((await handler({ contentId: fixture.contentId })).status).toBe('ok')

    const { getDeliveryManifest, deliveryHashPayload } = await import('../src/tools/delivery.ts')
    const { DeliveryManifestSchema, stableHash } = await import('../src/domain.ts')
    const { appendRecord } = await import('../src/storage.ts')
    const manifest = await getDeliveryManifest(fixture.deliveryId)
    const { renderManifestHash: _current, qaEvidence, ...rest } = manifest!
    const { mode: _mode, ...legacyEvidence } = qaEvidence!
    const withoutHash = { ...rest, qaEvidence: legacyEvidence }
    const legacy = DeliveryManifestSchema.parse({ ...withoutHash, renderManifestHash: stableHash(deliveryHashPayload(withoutHash)) })
    await writeFile(join(legacy.artifactRoot, 'delivery-manifest.json'), JSON.stringify(legacy, null, 2) + '\n', 'utf8')
    await appendRecord('delivery-manifests', { id: randomUUID(), ...legacy })

    const issues = ((await handler({ contentId: fixture.contentId })).data as any).issues as Array<{ code: string; message: string }>
    const blocker = issues.find((issue) => issue.code === 'DELIVERY_QA_LEVEL_INSUFFICIENT')
    expect(blocker).toBeDefined()
    expect(blocker?.message).toContain('legacy-unknown')
  })

  test('stale platform rules are detected with an internal deterministic audit clock', async () => {
    const fixture = await createReviewedContent({ deliveryMode: 'verified', dir, brandId: 'tech-daily', profileVersion: version })
    const content = await getLatestContent(fixture.contentId)
    const issues = await inspectContent(content!, getPlatform('wechat')!, new Date('2030-01-01T00:00:00.000Z'))
    expect(issues.some((issue) => issue.code === 'PLATFORM_RULES_STALE')).toBe(true)
  })
})
