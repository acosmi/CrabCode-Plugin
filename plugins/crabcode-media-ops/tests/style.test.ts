import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getHandler as getProfile, historyHandler, saveHandler as saveProfile } from '../src/tools/profiles.ts'
import { confirmHandler, getFormHandler, proposeHandler, saveDraftHandler, submitHandler, templateHandler } from '../src/tools/style.ts'
import { registerHandler as registerReference } from '../src/tools/references.ts'

function formData(samples: any[] = []) {
  return {
    displayName: '创作者甲', creatorTypes: ['opinion-commentary'],
    positioning: { accountPositioning: '面向普通人的科技评论', domains: ['AI'], credentials: [], purposes: ['解释变化'], mainPlatforms: ['wechat'], cadence: 'weekly' },
    audience: { segments: ['普通职场人'], knowledgeLevel: '入门', painPoints: ['信息过载'], desiredOutcome: '形成自己的判断' },
    expression: { formality: 'medium', intimacy: 'medium', humor: 'low', sharpness: 'high', emotion: 'medium', technicalDensity: 'medium', personalNarrative: 'low', evidenceDensity: 'high', actionStrength: 'medium', personPreference: 'first' },
    structure: { openings: ['具体冲突'], argumentPatterns: ['事实-解释-判断'], endingActions: ['给出选择'] },
    language: { preferredWords: ['具体'], bannedWords: ['震惊'], bannedCliches: ['拥抱未来'], nonImitableExpressions: [], humanReviewTopics: ['金融建议'] },
    truthBoundaries: { supportedFirstPersonExperiences: [], forbiddenIdentityInferences: ['不得虚构亲测'], allowedStancePhrases: ['我认为'], evidenceRules: { personal_test: '必须有测试记录' }, commercialDisclosureRule: '有赞助必须披露' },
    samples,
    platformDifferences: { wechat: { tone: '完整论证', invariantFeatures: ['证据'], adaptableFeatures: ['标题'] } },
    changeRequests: {}, consent: { storeAbstractStyle: true, allowFutureSuggestions: true, confirmedBy: '创作者甲' },
  }
}

describe('creator style intake and confirmation', () => {
  let dir: string
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mediaops-style-form-'))
    process.env.MEDIAOPS_DATA_DIR = dir
  })
  afterEach(async () => rm(dir, { recursive: true, force: true }))

  async function registeredStyleSample(): Promise<any> {
    const registered = await registerReference({
      role: 'user_owned_draft', rightsStatus: 'owned', allowedUses: ['rewrite', 'abstract_style_features', 'originality_comparison'],
      title: '自有旧文', rawText: '仅保存在参考集合中的自有样本文本。', doNotCopyFeatures: [], registeredBy: '创作者',
    })
    const reference = (registered.data as any).reference
    return { referenceId: reference.referenceId, role: reference.role, rightsStatus: reference.rightsStatus, allowedUses: reference.allowedUses, confidence: 'high' }
  }

  test('creates visible form, saves/restores draft and enforces brand scope', async () => {
    const template = await templateHandler({ brandId: 'creator-a', mode: 'quick' })
    expect(existsSync((template.data as any).previewPath)).toBe(true)
    const templateHtml = await readFile((template.data as any).previewPath, 'utf8')
    expect(templateHtml).toContain('sampleReferenceId')
    expect(templateHtml).not.toContain('sampleTitle')
    const draft = await saveDraftHandler({ brandId: 'creator-a', mode: 'quick', data: formData(), updatedBy: '创作者' })
    const formId = (draft.data as any).formId
    expect((await getFormHandler({ brandId: 'creator-a', formId })).status).toBe('ok')
    expect((await getFormHandler({ brandId: 'creator-b', formId })).error?.code).toBe('NOT_FOUND')
  })

  test('quick mode accepts the reduced field set and fills neutral defaults', async () => {
    const full = formData()
    const quick = {
      displayName: full.displayName,
      creatorTypes: full.creatorTypes,
      positioning: full.positioning,
      audience: full.audience,
      language: { bannedWords: ['震惊'] },
      truthBoundaries: full.truthBoundaries,
      consent: full.consent,
    }
    const draft = await saveDraftHandler({ brandId: 'creator-a', mode: 'quick', data: quick, updatedBy: '创作者' })
    expect((await submitHandler({ brandId: 'creator-a', formId: (draft.data as any).formId, submittedBy: '创作者' })).status).toBe('ok')
  })

  test('incremental template requires and prefills an existing profile version', async () => {
    expect((await templateHandler({ brandId: 'creator-a', mode: 'incremental' })).error?.code).toBe('PROFILE_REQUIRED')
    await saveProfile({ brand_id: 'creator-a', name: 'A', persona: { identity: '作者' }, voice: { tone: '克制' }, audience: { segments: ['读者'] }, columns: [], platforms: [{ platform: 'wechat' }], banned_words: [], compliance: { ai_label_text: 'AI 辅助' }, confirmedBy: '作者' })
    const template = await templateHandler({ brandId: 'creator-a', mode: 'incremental' })
    expect((template.data as any).prefill.baseProfileVersion).toBeTruthy()
  })

  test('form/corpus conflicts require explicit resolution before profile confirmation', async () => {
    const sample = await registeredStyleSample()
    const draft = await saveDraftHandler({ brandId: 'creator-a', mode: 'full', data: formData([sample]), updatedBy: '创作者' })
    const formId = (draft.data as any).formId
    expect((await submitHandler({ brandId: 'creator-a', formId, submittedBy: '创作者' })).status).toBe('ok')
    const proposal = await proposeHandler({ brandId: 'creator-a', formId, proposedBy: '风格编辑', corpus: { sources: [sample], features: { 'expression.sharpness': 'low', 'language.bannedWords': ['惊爆'] } } })
    const proposalId = (proposal.data as any).proposalId
    const conflicts = (proposal.data as any).conflicts
    expect((await confirmHandler({ brandId: 'creator-a', proposalId, confirmedBy: '创作者', resolutions: {} })).error?.code).toBe('STYLE_CONFLICT_CONFIRMATION_REQUIRED')
    const resolutions = Object.fromEntries(conflicts.map((conflict: any) => [conflict.id, conflict.field === 'language.bannedWords' ? 'corpus' : 'form']))
    const confirmed = await confirmHandler({ brandId: 'creator-a', proposalId, confirmedBy: '创作者', resolutions })
    expect(confirmed.status).toBe('ok')
    const profile = await getProfile({ brandId: 'creator-a' })
    expect((profile.data as any).source).toBe('confirmed-form')
    expect((profile.data as any).banned_words).toEqual(['惊爆'])
    expect((await historyHandler({ brandId: 'creator-a' })).data).toMatchObject({ count: 1 })
    expect((await getFormHandler({ brandId: 'creator-a', formId })).data).toMatchObject({ state: 'confirmed' })

    const nextDraft = await saveDraftHandler({ brandId: 'creator-a', mode: 'quick', data: formData(), updatedBy: '创作者' })
    const nextFormId = (nextDraft.data as any).formId
    await submitHandler({ brandId: 'creator-a', formId: nextFormId, submittedBy: '创作者' })
    const nextProposal = await proposeHandler({ brandId: 'creator-a', formId: nextFormId, proposedBy: '风格编辑' })
    await confirmHandler({ brandId: 'creator-a', proposalId: (nextProposal.data as any).proposalId, confirmedBy: '创作者', resolutions: {} })
    expect((await getFormHandler({ brandId: 'creator-a', formId })).data).toMatchObject({ state: 'superseded' })
    expect((await historyHandler({ brandId: 'creator-a' })).data).toMatchObject({ count: 2 })
  })

  test('full and incremental modes enforce their extra requirements', async () => {
    const { truthBoundaries: _missing, ...invalidFull } = formData()
    const full = await saveDraftHandler({ brandId: 'creator-a', mode: 'full', data: invalidFull, updatedBy: '创作者' })
    expect((await submitHandler({ brandId: 'creator-a', formId: (full.data as any).formId, submittedBy: '创作者' })).error?.code).toBe('INVALID_STYLE_FORM')
    const inc = await saveDraftHandler({ brandId: 'creator-a', mode: 'incremental', data: formData(), updatedBy: '创作者' })
    expect((await submitHandler({ brandId: 'creator-a', formId: (inc.data as any).formId, submittedBy: '创作者' })).error?.code).toBe('INVALID_STYLE_FORM')
  })

  test('the proposal author cannot confirm the same profile change even with both roles', async () => {
    const draft = await saveDraftHandler({ brandId: 'creator-a', mode: 'quick', data: formData(), updatedBy: '创作者' })
    const formId = (draft.data as any).formId
    await submitHandler({ brandId: 'creator-a', formId, submittedBy: '创作者' })
    const proposal = await proposeHandler({ brandId: 'creator-a', formId, proposedBy: '同一负责人' })
    const confirmed = await confirmHandler({ brandId: 'creator-a', proposalId: (proposal.data as any).proposalId, confirmedBy: '  同一负责人  ', resolutions: {} })
    expect(confirmed.error?.code).toBe('ROLE_SEPARATION_REQUIRED')
  })

  test('commits only one terminal profile when the same proposal is confirmed concurrently', async () => {
    const draft = await saveDraftHandler({ brandId: 'creator-a', mode: 'quick', data: formData(), updatedBy: '创作者' })
    const formId = (draft.data as any).formId
    await submitHandler({ brandId: 'creator-a', formId, submittedBy: '创作者' })
    const proposal = await proposeHandler({ brandId: 'creator-a', formId, proposedBy: '风格编辑' })
    const proposalId = (proposal.data as any).proposalId
    const results = await Promise.all([
      confirmHandler({ brandId: 'creator-a', proposalId, confirmedBy: '创作者甲', resolutions: {} }),
      confirmHandler({ brandId: 'creator-a', proposalId, confirmedBy: '创作者乙', resolutions: {} }),
    ])
    expect(results.filter((result) => result.status === 'ok')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'error')).toHaveLength(1)
    const failureCode = results.find((result) => result.status === 'error')?.error?.code ?? ''
    expect(['PROFILE_CONFIRM_CONFLICT', 'PROPOSAL_NOT_PENDING']).toContain(failureCode)
    expect((await historyHandler({ brandId: 'creator-a' })).data).toMatchObject({ count: 1 })
    expect((await getFormHandler({ brandId: 'creator-a', formId })).data).toMatchObject({ state: 'confirmed' })
  })
})
