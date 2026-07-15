import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { decideHandler, getHandler, requestHandler } from '../src/tools/approval.ts'
import { handler as packageContent } from '../src/tools/package.ts'
import { createProfile, createReviewedContent } from './helpers.ts'

describe('approval state machine', () => {
  let dir: string
  let version: string
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mediaops-approval-'))
    process.env.MEDIAOPS_DATA_DIR = dir
    version = await createProfile('approval-brand')
  })
  afterEach(async () => rm(dir, { recursive: true, force: true }))

  test('supports approve then revoke and blocks revoked packages', async () => {
    const content = await createReviewedContent({ dir, brandId: 'approval-brand', profileVersion: version })
    const requested = await requestHandler({ contentId: content.contentId, deliveryId: content.deliveryId, platform: 'wechat', summary: '待批', checklist: ['复核'], requestedBy: '运营' })
    const approvalId = (requested.data as any).approvalId
    expect((await decideHandler({ approvalId, decision: 'approved', decidedBy: '主编', reason: '通过' })).status).toBe('ok')
    expect((await decideHandler({ approvalId, decision: 'revoked', decidedBy: '主编', reason: '发现新风险' })).status).toBe('ok')
    expect(((await getHandler({ approvalId })).data as any).state).toBe('revoked')
    expect((await packageContent({ contentId: content.contentId, approvalId, packagedBy: '发布员' })).error?.code).toBe('APPROVAL_REQUIRED')
  })

  test('approval target platform must equal the stored content platform', async () => {
    const content = await createReviewedContent({ dir, brandId: 'approval-brand', profileVersion: version, platform: 'wechat' })
    expect((await requestHandler({ contentId: content.contentId, deliveryId: content.deliveryId, platform: 'xhs', summary: '错平台', checklist: ['复核'], requestedBy: '运营' })).error?.code).toBe('PACKAGE_INPUT_MISMATCH')
  })

  test('role separation cannot be bypassed with Unicode width, case or whitespace variants', async () => {
    const content = await createReviewedContent({ dir, brandId: 'approval-brand', profileVersion: version })
    const requested = await requestHandler({ contentId: content.contentId, deliveryId: content.deliveryId, platform: 'wechat', summary: '待批', checklist: ['复核'], requestedBy: 'Editor A' })
    const approvalId = (requested.data as any).approvalId
    const decision = await decideHandler({ approvalId, decision: 'approved', decidedBy: '  ｅＤＩＴＯＲ   a  ', reason: '尝试绕过' })
    expect(decision.error?.code).toBe('ROLE_SEPARATION_REQUIRED')
  })
})
