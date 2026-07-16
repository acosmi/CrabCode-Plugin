import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { decideHandler, getHandler, requestHandler } from '../src/tools/approval.ts'
import { handler as packageContent } from '../src/tools/package.ts'
import { createProfile, createReviewedContent, testPrincipal } from './helpers.ts'

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
    const content = await createReviewedContent({ deliveryMode: 'verified', dir, brandId: 'approval-brand', profileVersion: version })
    const requested = await requestHandler({ contentId: content.contentId, deliveryId: content.deliveryId, platform: 'wechat', summary: '待批', checklist: ['复核'], requestedBy: '伪造请求人' }, testPrincipal('运营'))
    const approvalId = (requested.data as any).approvalId
    expect((await decideHandler({ approvalId, decision: 'approved', decidedBy: '伪造审批人', reason: '通过' }, testPrincipal('主编'))).status).toBe('ok')
    expect((await decideHandler({ approvalId, decision: 'revoked', decidedBy: '伪造审批人', reason: '发现新风险' }, testPrincipal('主编'))).status).toBe('ok')
    const publicApproval = (await getHandler({ approvalId })).data as any
    expect(publicApproval.state).toBe('revoked')
    expect(publicApproval.recordHash).toBeUndefined()
    expect(publicApproval.previousRecordHash).toBeUndefined()
    expect((await packageContent({ contentId: content.contentId, approvalId, packagedBy: '伪造发布人' }, testPrincipal('发布员'))).error?.code).toBe('APPROVAL_REQUIRED')
  })

  test('approval target platform must equal the stored content platform', async () => {
    const content = await createReviewedContent({ deliveryMode: 'verified', dir, brandId: 'approval-brand', profileVersion: version, platform: 'wechat' })
    expect((await requestHandler({ contentId: content.contentId, deliveryId: content.deliveryId, platform: 'xhs', summary: '错平台', checklist: ['复核'], requestedBy: '伪造请求人' }, testPrincipal('运营'))).error?.code).toBe('PACKAGE_INPUT_MISMATCH')
  })

  test('role separation cannot be bypassed with Unicode width, case or whitespace variants', async () => {
    const content = await createReviewedContent({ deliveryMode: 'verified', dir, brandId: 'approval-brand', profileVersion: version })
    const requested = await requestHandler({ contentId: content.contentId, deliveryId: content.deliveryId, platform: 'wechat', summary: '待批', checklist: ['复核'], requestedBy: '伪造请求人' }, testPrincipal('Editor A'))
    const approvalId = (requested.data as any).approvalId
    const decision = await decideHandler({ approvalId, decision: 'approved', decidedBy: '伪造审批人', reason: '尝试绕过' }, testPrincipal('  ｅＤＩＴＯＲ   a  '))
    expect(decision.error?.code).toBe('ROLE_SEPARATION_REQUIRED')
  })

  test('concurrent approve and reject have exactly one durable winner', async () => {
    const content = await createReviewedContent({ deliveryMode: 'verified', dir, brandId: 'approval-brand', profileVersion: version })
    const requested = await requestHandler(
      { contentId: content.contentId, deliveryId: content.deliveryId, platform: 'wechat', summary: '并发决策', checklist: ['复核'], requestedBy: '伪造请求人' },
      testPrincipal('运营'),
    )
    const approvalId = (requested.data as any).approvalId
    const outcomes = await Promise.all([
      decideHandler({ approvalId, decision: 'approved', decidedBy: '伪造审批人', reason: '并发批准' }, testPrincipal('主编甲')),
      decideHandler({ approvalId, decision: 'rejected', decidedBy: '伪造审批人', reason: '并发拒绝' }, testPrincipal('主编乙')),
    ])
    expect(outcomes.filter((outcome) => outcome.status === 'ok')).toHaveLength(1)
    expect(outcomes.filter((outcome) => outcome.error?.code === 'APPROVAL_CONFLICT')).toHaveLength(1)
    const durable = (await getHandler({ approvalId })).data as any
    expect(['approved', 'rejected']).toContain(durable.state)
    expect(durable.transitionVersion).toBe(2)
  })
})
