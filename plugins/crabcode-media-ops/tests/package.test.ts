import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { decideHandler, requestHandler } from '../src/tools/approval.ts'
import { handler as packageContent } from '../src/tools/package.ts'
import { createProfile, createReviewedContent } from './helpers.ts'

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
    const content = await createReviewedContent({ dir, brandId: 'pack-brand', profileVersion: version })
    const approval = await requestHandler({ contentId: content.contentId, deliveryId: content.deliveryId, platform: 'wechat', summary: '发布此稿', checklist: ['事实与披露已确认'], requestedBy: '运营' })
    return { content, approvalId: (approval.data as any).approvalId }
  }

  test('missing and pending approvals cannot package', async () => {
    const { content, approvalId } = await pending()
    const missing = await packageContent({ contentId: content.contentId, approvalId: crypto.randomUUID(), packagedBy: '运营' })
    expect(missing.error?.code).toBe('APPROVAL_REQUIRED')
    const wait = await packageContent({ contentId: content.contentId, approvalId, packagedBy: '运营' })
    expect(wait.error?.code).toBe('APPROVAL_PENDING')
  })

  test('approved content packages with trace manifest and copied asset', async () => {
    const { content, approvalId } = await pending()
    await decideHandler({ approvalId, decision: 'approved', decidedBy: '主编', reason: '核对通过' })
    const env = await packageContent({ contentId: content.contentId, approvalId, packagedBy: '发布员' })
    expect(env.status).toBe('ok')
    const path = (env.data as any).packagePath
    const manifest = JSON.parse(readFileSync(join(path, 'package-manifest.json'), 'utf8'))
    expect(manifest.contentHash).toBe(content.contentHash)
    expect(manifest.primaryArtifact.format).toBe('html')
    expect(manifest.backupArtifact.format).toBe('markdown')
    expect(existsSync(join(path, manifest.assets[0].relativePath))).toBe(true)
  })

  test('rejected approval cannot package', async () => {
    const { content, approvalId } = await pending()
    await decideHandler({ approvalId, decision: 'rejected', decidedBy: '主编', reason: '需改稿' })
    expect((await packageContent({ contentId: content.contentId, approvalId, packagedBy: '发布员' })).error?.code).toBe('APPROVAL_REJECTED')
  })

  test('tampering with an approved frozen artifact blocks packaging', async () => {
    const { content, approvalId } = await pending()
    await decideHandler({ approvalId, decision: 'approved', decidedBy: '主编', reason: '通过' })
    const approvalRecord = (await import('../src/tools/approval.ts')).getApproval
    const record = await approvalRecord(approvalId)
    const delivery = await (await import('../src/tools/delivery.ts')).getDeliveryManifest(record!.deliveryId)
    await Bun.write(join(delivery!.artifactRoot, delivery!.primaryArtifact.relativePath), 'tampered')
    expect((await packageContent({ contentId: content.contentId, approvalId, packagedBy: '发布员' })).error?.code).toBe('DELIVERY_INTEGRITY_FAILED')
  })
})
