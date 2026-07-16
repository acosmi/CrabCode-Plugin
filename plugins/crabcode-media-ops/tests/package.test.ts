import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PackageManifestSchema } from '../src/domain.ts'
import { listRecords } from '../src/storage.ts'
import { decideHandler, requestHandler } from '../src/tools/approval.ts'
import { handler as packageContent } from '../src/tools/package.ts'
import { createProfile, createReviewedContent, testPrincipal } from './helpers.ts'

describe('hash-bound publish packaging', () => {
  let dir: string
  let version: string
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mediaops-package-v2-'))
    process.env.MEDIAOPS_DATA_DIR = dir
    version = await createProfile('pack-brand')
  })
  afterEach(async () => rm(dir, { recursive: true, force: true }))

  async function pending() {
    const content = await createReviewedContent({ dir, brandId: 'pack-brand', profileVersion: version, deliveryMode: 'verified' })
    const approval = await requestHandler({ contentId: content.contentId, deliveryId: content.deliveryId, platform: 'wechat', summary: '发布此稿', checklist: ['事实与披露已确认'], requestedBy: '伪造请求人' }, testPrincipal('运营'))
    return { content, approvalId: (approval.data as any).approvalId }
  }

  test('missing and pending approvals cannot package', async () => {
    const { content, approvalId } = await pending()
    const missing = await packageContent({ contentId: content.contentId, approvalId: crypto.randomUUID(), packagedBy: '伪造发布人' }, testPrincipal('发布员'))
    expect(missing.error?.code).toBe('APPROVAL_REQUIRED')
    const wait = await packageContent({ contentId: content.contentId, approvalId, packagedBy: '伪造发布人' }, testPrincipal('发布员'))
    expect(wait.error?.code).toBe('APPROVAL_PENDING')
  })

  test('approved content packages with trace manifest and copied asset', async () => {
    const { content, approvalId } = await pending()
    await decideHandler({ approvalId, decision: 'approved', decidedBy: '伪造审批人', reason: '核对通过' }, testPrincipal('主编'))
    const env = await packageContent({ contentId: content.contentId, approvalId, packagedBy: '伪造发布人' }, testPrincipal('发布员'))
    expect(env.status).toBe('ok')
    expect((env.data as any).recoveryMode).toBe('new')
    expect((env.data as any).recovered).toBe(false)
    const path = (env.data as any).packagePath
    const manifest = JSON.parse(readFileSync(join(path, 'package-manifest.json'), 'utf8'))
    expect(PackageManifestSchema.safeParse(manifest).success).toBe(true)
    expect(PackageManifestSchema.safeParse({ ...manifest, unexpected: true }).success).toBe(false)
    expect(PackageManifestSchema.safeParse({ ...manifest, primaryArtifact: { ...manifest.primaryArtifact, format: 'markdown' } }).success).toBe(false)
    expect(manifest.contentHash).toBe(content.contentHash)
    expect(manifest.primaryArtifact.format).toBe('html')
    expect(manifest.backupArtifact.format).toBe('markdown')
    expect(existsSync(join(path, manifest.assets[0].relativePath))).toBe(true)
    expect(manifest.qaEvidence.status).toBe('passed')
    expect(existsSync(join(path, 'qa/summary.json'))).toBe(true)
    // Full Chromium screenshots only exist under MEDIAOPS_QA_MODE=full; static mode still packages summary evidence.
    if ((process.env.MEDIAOPS_QA_MODE ?? 'full') === 'full') {
      expect(existsSync(join(path, 'qa/screenshots/viewport-320-light.png'))).toBe(true)
    }
  })

  test('rejected approval cannot package', async () => {
    const { content, approvalId } = await pending()
    await decideHandler({ approvalId, decision: 'rejected', decidedBy: '伪造审批人', reason: '需改稿' }, testPrincipal('主编'))
    expect((await packageContent({ contentId: content.contentId, approvalId, packagedBy: '伪造发布人' }, testPrincipal('发布员'))).error?.code).toBe('APPROVAL_REJECTED')
  })

  test('tampering with an approved frozen artifact blocks packaging', async () => {
    const { content, approvalId } = await pending()
    await decideHandler({ approvalId, decision: 'approved', decidedBy: '伪造审批人', reason: '通过' }, testPrincipal('主编'))
    const approvalRecord = (await import('../src/tools/approval.ts')).getApproval
    const record = await approvalRecord(approvalId)
    const delivery = await (await import('../src/tools/delivery.ts')).getDeliveryManifest(record!.deliveryId)
    await Bun.write(join(delivery!.artifactRoot, delivery!.primaryArtifact.relativePath), 'tampered')
    expect((await packageContent({ contentId: content.contentId, approvalId, packagedBy: '伪造发布人' }, testPrincipal('发布员'))).error?.code).toBe('DELIVERY_INTEGRITY_FAILED')
  })

  test('packaging and revocation cannot both succeed for the same approval transition', async () => {
    const { content, approvalId } = await pending()
    await decideHandler({ approvalId, decision: 'approved', decidedBy: '伪造审批人', reason: '通过' }, testPrincipal('主编'))
    const [packaged, revoked] = await Promise.all([
      packageContent({ contentId: content.contentId, approvalId, packagedBy: '伪造发布人' }, testPrincipal('发布员')),
      decideHandler({ approvalId, decision: 'revoked', decidedBy: '伪造审批人', reason: '并发撤销' }, testPrincipal('风控主编')),
    ])
    expect([packaged, revoked].filter((outcome) => outcome.status === 'ok').length).toBe(1)
    if (packaged.status === 'ok') expect(revoked.error?.code).toBe('APPROVAL_BUSY')
    else expect(['APPROVAL_STALE', 'APPROVAL_REQUIRED', 'APPROVAL_CONFLICT']).toContain(packaged.error?.code ?? '')
  })

  test('a committed package is idempotent and terminal to later revocation', async () => {
    const { content, approvalId } = await pending()
    await decideHandler({ approvalId, decision: 'approved', decidedBy: '伪造审批人', reason: '通过' }, testPrincipal('主编'))
    const principal = testPrincipal('发布员')
    const first = await packageContent({ contentId: content.contentId, approvalId, packagedBy: '伪造发布人' }, principal)
    const second = await packageContent({ contentId: content.contentId, approvalId, packagedBy: '另一个伪造发布人' }, principal)
    expect(first.status).toBe('ok')
    expect(second.status).toBe('ok')
    expect((second.data as any).packageId).toBe((first.data as any).packageId)
    expect((second.data as any).packagePath).toBe((first.data as any).packagePath)
    expect((second.data as any).recoveryMode).toBe('idempotent')
    expect((second.data as any).recovered).toBe(true)
    expect(existsSync(join((first.data as any).packagePath, 'DO-NOT-PUBLISH.commit-pending'))).toBe(false)
    const revoked = await decideHandler({ approvalId, decision: 'revoked', decidedBy: '伪造审批人', reason: '事后撤回' }, testPrincipal('风控主编'))
    expect(revoked.error?.code).toBe('INVALID_APPROVAL_TRANSITION')
    expect((await listRecords('publish-history', { approvalId }))).toHaveLength(1)
    expect((await listRecords('audit-events', { event: 'publish.package.created', approvalId }))).toHaveLength(1)
  })

  test('storage failure leaves a marked package and retry completes one atomic commit', async () => {
    const { content, approvalId } = await pending()
    await decideHandler({ approvalId, decision: 'approved', decidedBy: '伪造审批人', reason: '通过' }, testPrincipal('主编'))
    const malformedHistory = join(dir, 'publish-history.jsonl')
    await writeFile(malformedHistory, '{malformed\n', 'utf8')
    const principal = testPrincipal('发布员')
    const failed = await packageContent({ contentId: content.contentId, approvalId, packagedBy: '伪造发布人' }, principal)
    expect(failed.status).toBe('action_required')
    expect((failed.data as any).code).toBe('PACKAGE_COMMIT_PENDING')
    expect((failed.data as any).state).toBe('preparing')
    expect((failed.data as any).samePrincipalRequired).toBe(true)
    expect((failed.data as any).retry.tool).toBe('mediaops.publish.package')
    const preparing = failed.data as any
    expect(existsSync((failed.data as any).markerPath)).toBe(true)
    expect((await listRecords('approvals', { approvalId })).at(-1)?.packageId).toBeUndefined()
    expect((await listRecords('audit-events', { event: 'publish.package.created', approvalId }))).toHaveLength(0)

    await rm(malformedHistory)
    const recovered = await packageContent({ contentId: content.contentId, approvalId, packagedBy: '伪造发布人' }, principal)
    expect(recovered.status).toBe('ok')
    expect((recovered.data as any).packageId).toBe(preparing.packageId)
    expect((recovered.data as any).recoveryMode).toBe('resumed')
    expect((recovered.data as any).recovered).toBe(true)
    expect(existsSync(join(preparing.finalRoot, 'DO-NOT-PUBLISH.commit-pending'))).toBe(false)
    expect((await listRecords('publish-history', { approvalId }))).toHaveLength(1)
    expect((await listRecords('audit-events', { event: 'publish.package.created', approvalId }))).toHaveLength(1)
    expect((await listRecords('package-operations', { approvalId })).at(-1)?.state).toBe('committed')
  })
})
