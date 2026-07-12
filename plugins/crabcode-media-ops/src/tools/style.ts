import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import { BrandIdSchema, stableHash } from '../domain.ts'
import { err, ok, type Envelope } from '../envelope.ts'
import { appendRecord, dataDir, ensureDir, listRecords, storageWarnings, type StoredRecord } from '../storage.ts'
import { loadProfile, saveProfileVersion, type BrandProfileInput } from './profiles.ts'

export const CREATOR_TYPES = [
  'opinion-commentary',
  'knowledge-explainer',
  'news-policy-analysis',
  'tutorial-method',
  'product-review',
  'investigative-watchdog',
  'industry-observer',
  'brand-founder',
  'lifestyle-growth',
  'storytelling',
  'interview-editor',
  'custom',
] as const

const level = z.enum(['low', 'medium', 'high'])
const StyleFormDataSchema = z.object({
  displayName: z.string().min(1),
  creatorTypes: z.array(z.enum(CREATOR_TYPES)).min(1),
  customCreatorType: z.string().optional(),
  positioning: z.object({
    accountPositioning: z.string().min(1),
    domains: z.array(z.string()).default([]),
    credentials: z.array(z.string()).default([]),
    purposes: z.array(z.string()).default([]),
    mainPlatforms: z.array(z.enum(['wechat', 'xhs', 'toutiao'])).min(1),
    cadence: z.string().optional(),
  }),
  audience: z.object({
    segments: z.array(z.string()).min(1),
    knowledgeLevel: z.string().min(1),
    painPoints: z.array(z.string()).default([]),
    readingContext: z.string().optional(),
    desiredOutcome: z.string().min(1),
  }),
  expression: z.object({
    formality: level,
    intimacy: level,
    humor: level,
    sharpness: level,
    emotion: level,
    technicalDensity: level,
    personalNarrative: level,
    evidenceDensity: level,
    actionStrength: level,
    personPreference: z.enum(['first', 'second', 'third', 'mixed']),
    punctuationNotes: z.string().optional(),
  }),
  structure: z.object({
    openings: z.array(z.string()).default([]),
    argumentPatterns: z.array(z.string()).default([]),
    headingPreference: z.string().optional(),
    counterargumentStyle: z.string().optional(),
    endingActions: z.array(z.string()).default([]),
    typicalLength: z.string().optional(),
    mobileParagraphLength: z.string().optional(),
  }),
  language: z.object({
    preferredWords: z.array(z.string()).default([]),
    bannedWords: z.array(z.string()).default([]),
    bannedCliches: z.array(z.string()).default([]),
    nonImitableExpressions: z.array(z.string()).default([]),
    humanReviewTopics: z.array(z.string()).default([]),
  }),
  truthBoundaries: z.object({
    supportedFirstPersonExperiences: z.array(z.string()).default([]),
    forbiddenIdentityInferences: z.array(z.string()).min(1),
    allowedStancePhrases: z.array(z.string()).default([]),
    evidenceRules: z.record(z.string()),
    commercialDisclosureRule: z.string().min(1),
  }),
  samples: z
    .array(
      z.object({
        title: z.string().min(1),
        url: z.string().url().optional(),
        fileRef: z.string().optional(),
        liked: z.array(z.string()).default([]),
        disliked: z.array(z.string()).default([]),
        allowedLearning: z.array(z.string()).default([]),
        rightsStatus: z.enum(['owned', 'authorized', 'public-abstract-only']),
        date: z.string().optional(),
        confidence: level,
      }),
    )
    .default([]),
  platformDifferences: z.record(
    z.object({
      tone: z.string().optional(),
      title: z.string().optional(),
      paragraph: z.string().optional(),
      emoji: z.string().optional(),
      tags: z.string().optional(),
      images: z.string().optional(),
      invariantFeatures: z.array(z.string()).default([]),
      adaptableFeatures: z.array(z.string()).default([]),
    }),
  ),
  baseProfileVersion: z.string().optional(),
  changeRequests: z.record(z.unknown()).default({}),
  consent: z.object({
    storeAbstractStyle: z.literal(true),
    allowFutureSuggestions: z.boolean(),
    confirmedBy: z.string().min(1),
  }),
})

const QuickFormSchema = z.object({
  displayName: z.string().min(1),
  creatorTypes: z.array(z.enum(CREATOR_TYPES)).min(1),
  customCreatorType: z.string().optional(),
  positioning: z.object({
    accountPositioning: z.string().min(1),
    domains: z.array(z.string()).default([]),
    credentials: z.array(z.string()).default([]),
    purposes: z.array(z.string()).default([]),
    mainPlatforms: z.array(z.enum(['wechat', 'xhs', 'toutiao'])).min(1),
    cadence: z.string().optional(),
  }),
  audience: z.object({
    segments: z.array(z.string()).min(1),
    knowledgeLevel: z.string().default('未说明'),
    painPoints: z.array(z.string()).default([]),
    readingContext: z.string().optional(),
    desiredOutcome: z.string().min(1),
  }),
  expression: StyleFormDataSchema.shape.expression.partial().default({}),
  language: StyleFormDataSchema.shape.language.partial().default({}),
  truthBoundaries: z.object({
    supportedFirstPersonExperiences: z.array(z.string()).default([]),
    forbiddenIdentityInferences: z.array(z.string()).min(1),
    allowedStancePhrases: z.array(z.string()).default([]),
    evidenceRules: z.record(z.string()).default({}),
    commercialDisclosureRule: z.string().min(1),
  }),
  samples: StyleFormDataSchema.shape.samples.default([]),
  consent: StyleFormDataSchema.shape.consent,
})

export type StyleFormData = z.infer<typeof StyleFormDataSchema>
type FormMode = 'quick' | 'full' | 'incremental'
type FormState = 'draft' | 'submitted' | 'confirmed' | 'superseded'

type StoredForm = StoredRecord & {
  formId: string
  brandId: string
  mode: FormMode
  state: FormState
  data: Partial<StyleFormData>
  updatedBy: string
  submittedAt?: string
}

function latest<T extends StoredRecord>(records: StoredRecord[]): T | null {
  return (records.length ? records[records.length - 1] : null) as T | null
}

async function getLatestForm(brandId: string, formId: string): Promise<StoredForm | null> {
  return latest<StoredForm>(await listRecords('style-forms', { brandId, formId }))
}

function validateForMode(mode: FormMode, data: unknown): { success: true; data: StyleFormData } | { success: false; message: string } {
  if (mode === 'quick') {
    const complete = StyleFormDataSchema.safeParse(data)
    if (complete.success) return { success: true, data: complete.data }
    const quick = QuickFormSchema.safeParse(data)
    if (!quick.success) return { success: false, message: quick.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') }
    const expression = {
      formality: 'medium', intimacy: 'medium', humor: 'medium', sharpness: 'medium', emotion: 'medium',
      technicalDensity: 'medium', personalNarrative: 'medium', evidenceDensity: 'medium', actionStrength: 'medium',
      personPreference: 'mixed', ...quick.data.expression,
    }
    const language = {
      preferredWords: [], bannedWords: [], bannedCliches: [], nonImitableExpressions: [], humanReviewTopics: [], ...quick.data.language,
    }
    const normalized = StyleFormDataSchema.safeParse({
      ...quick.data,
      expression,
      language,
      structure: { openings: [], argumentPatterns: [], endingActions: [] },
      platformDifferences: {},
      changeRequests: {},
    })
    if (!normalized.success) return { success: false, message: normalized.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') }
    return { success: true, data: normalized.data }
  }
  const parsed = StyleFormDataSchema.safeParse(data)
  if (!parsed.success) return { success: false, message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') }
  if (mode === 'incremental' && (!parsed.data.baseProfileVersion || Object.keys(parsed.data.changeRequests).length === 0)) {
    return { success: false, message: 'Incremental mode requires baseProfileVersion and at least one changeRequests field.' }
  }
  return { success: true, data: parsed.data }
}

function htmlFor(mode: FormMode, brandId: string, baseProfileVersion?: string): string {
  const typeOptions = CREATOR_TYPES.map((type) => `<label><input type="checkbox" name="creatorTypes" value="${type}"> ${type}</label>`).join('')
  const levels = (name: string, label: string) => `<label>${label}<select name="${name}"><option value="low">低</option><option value="medium" selected>中</option><option value="high">高</option></select></label>`
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>创作者风格采集表</title><style>body{font:16px/1.6 system-ui;max-width:900px;margin:32px auto;padding:0 20px;color:#18202a}fieldset{border:1px solid #d7dde5;border-radius:12px;margin:18px 0;padding:18px}label{display:block;margin:10px 0}input,textarea,select{box-sizing:border-box;width:100%;padding:9px;border:1px solid #b8c1cc;border-radius:8px}input[type=checkbox]{width:auto}button{background:#6f42c1;color:white;border:0;border-radius:9px;padding:11px 18px}.hint{color:#596675}.types{columns:2}.types label{break-inside:avoid}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}</style></head><body><h1>创作者风格采集表</h1><p class="hint">品牌：${brandId}　模式：${mode}。页面导出的 data 可直接保存为表单草稿；正式 profile 仍需冲突比对和创作者确认。</p><form id="style"><input type="hidden" name="baseProfileVersion" value="${baseProfileVersion ?? ''}"><fieldset><legend>基本定位</legend><label>展示名<input name="displayName" required></label><label>账号定位<textarea name="accountPositioning" required></textarea></label><div class="types">${typeOptions}</div><label>专业领域（逗号分隔）<input name="domains"></label><label>真实资质（逗号分隔，没有可留空）<input name="credentials"></label><label>主要平台（wechat,xhs,toutiao）<input name="mainPlatforms" value="wechat" required></label></fieldset><fieldset><legend>目标读者</legend><label>核心读者（逗号分隔）<input name="segments" required></label><label>读者知识水平<input name="knowledgeLevel" required></label><label>读者痛点（逗号分隔）<input name="painPoints"></label><label>希望读者看完产生什么变化<textarea name="desiredOutcome" required></textarea></label></fieldset><fieldset><legend>表达维度</legend><div class="grid">${levels('formality','正式度')}${levels('intimacy','亲密度')}${levels('humor','幽默度')}${levels('sharpness','锐度')}${levels('emotion','情绪强度')}${levels('technicalDensity','技术密度')}${levels('personalNarrative','个人叙事')}${levels('evidenceDensity','证据密度')}${levels('actionStrength','行动建议')}</div><label>人称<select name="personPreference"><option value="first">第一人称</option><option value="second">第二人称</option><option value="third">第三人称</option><option value="mixed" selected>混合</option></select></label></fieldset><fieldset><legend>结构与语言</legend><label>常用开场（每行一项）<textarea name="openings"></textarea></label><label>论证结构（每行一项）<textarea name="argumentPatterns"></textarea></label><label>标题/小标题偏好<textarea name="headingPreference"></textarea></label><label>喜欢的词（逗号分隔）<input name="preferredWords"></label><label>禁用词（逗号分隔）<input name="bannedWords"></label><label>禁用套话（每行一项）<textarea name="bannedCliches"></textarea></label></fieldset><fieldset><legend>真实性与权利边界</legend><label>有材料支持的第一人称经历（每行一项）<textarea name="supportedExperiences"></textarea></label><label>不得推断的身份/经历（每行一项）<textarea name="forbiddenIdentityInferences" required></textarea></label><label>亲测、访谈、业内消息等证据规则<textarea name="evidenceRules" required></textarea></label><label>商业合作披露规则<textarea name="commercialDisclosureRule" required></textarea></label><label>代表样本标题<input name="sampleTitle"></label><label>样本链接（可选）<input name="sampleUrl" type="url"></label><label>样本权利<select name="sampleRights"><option value="owned">自有</option><option value="authorized">已授权</option><option value="public-abstract-only">公开文章，仅抽象分析</option></select></label></fieldset><fieldset><legend>平台差异与增量更新</legend><label>微信公众号差异<textarea name="wechatDifference"></textarea></label><label>小红书差异<textarea name="xhsDifference"></textarea></label><label>今日头条差异<textarea name="toutiaoDifference"></textarea></label><label>本次希望改变的项目（增量模式必填）<textarea name="changeRequests"></textarea></label></fieldset><fieldset><legend>确认</legend><label>确认人<input name="confirmedBy" required></label><label><input type="checkbox" name="storeAbstractStyle" required> 同意保存抽象风格信息（不保存外部样本全文）</label><label><input type="checkbox" name="allowFutureSuggestions"> 允许以后根据新作品提出更新建议</label></fieldset><button type="submit">导出可保存的 JSON 草稿</button></form><script>const list=v=>String(v||'').split(/[，,\n]/).map(x=>x.trim()).filter(Boolean);const val=(f,n)=>String(f.get(n)||'').trim();document.querySelector('#style').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.target);const sampleTitle=val(f,'sampleTitle');const diff=(n)=>{const tone=val(f,n);return tone?{tone,invariantFeatures:[],adaptableFeatures:[]}:undefined};const data={displayName:val(f,'displayName'),creatorTypes:f.getAll('creatorTypes'),positioning:{accountPositioning:val(f,'accountPositioning'),domains:list(f.get('domains')),credentials:list(f.get('credentials')),purposes:[],mainPlatforms:list(f.get('mainPlatforms'))},audience:{segments:list(f.get('segments')),knowledgeLevel:val(f,'knowledgeLevel'),painPoints:list(f.get('painPoints')),desiredOutcome:val(f,'desiredOutcome')},expression:{formality:val(f,'formality'),intimacy:val(f,'intimacy'),humor:val(f,'humor'),sharpness:val(f,'sharpness'),emotion:val(f,'emotion'),technicalDensity:val(f,'technicalDensity'),personalNarrative:val(f,'personalNarrative'),evidenceDensity:val(f,'evidenceDensity'),actionStrength:val(f,'actionStrength'),personPreference:val(f,'personPreference')},structure:{openings:list(f.get('openings')),argumentPatterns:list(f.get('argumentPatterns')),headingPreference:val(f,'headingPreference'),endingActions:[]},language:{preferredWords:list(f.get('preferredWords')),bannedWords:list(f.get('bannedWords')),bannedCliches:list(f.get('bannedCliches')),nonImitableExpressions:[],humanReviewTopics:[]},truthBoundaries:{supportedFirstPersonExperiences:list(f.get('supportedExperiences')),forbiddenIdentityInferences:list(f.get('forbiddenIdentityInferences')),allowedStancePhrases:[],evidenceRules:{general:val(f,'evidenceRules')},commercialDisclosureRule:val(f,'commercialDisclosureRule')},samples:sampleTitle?[{title:sampleTitle,url:val(f,'sampleUrl')||undefined,liked:[],disliked:[],allowedLearning:[],rightsStatus:val(f,'sampleRights'),confidence:'medium'}]:[],platformDifferences:Object.fromEntries([['wechat',diff('wechatDifference')],['xhs',diff('xhsDifference')],['toutiao',diff('toutiaoDifference')]].filter(([,v])=>v)),baseProfileVersion:val(f,'baseProfileVersion')||undefined,changeRequests:val(f,'changeRequests')?{notes:val(f,'changeRequests')}:{},consent:{storeAbstractStyle:true,allowFutureSuggestions:f.has('allowFutureSuggestions'),confirmedBy:val(f,'confirmedBy')}};const out={brandId:${JSON.stringify(brandId)},mode:${JSON.stringify(mode)},data};const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:'application/json'}));a.download='creator-style-${brandId}-${mode}.json';a.click()})</script></body></html>`
}

export const templateName = 'mediaops.style.form.template'
export const templateDescription = 'Create a local, non-technical creator-style form preview and return its structured field contract.'
export const templateInputSchema = { brandId: BrandIdSchema, mode: z.enum(['quick', 'full', 'incremental']) }

export async function templateHandler(args: { brandId: string; mode: FormMode }): Promise<Envelope> {
  const currentProfile = args.mode === 'incremental' ? await loadProfile(args.brandId) : null
  if (args.mode === 'incremental' && !currentProfile) return err('PROFILE_REQUIRED', 'Incremental mode requires an existing confirmed profile.')
  const dir = join(dataDir(), 'style-forms', args.brandId, 'templates')
  await ensureDir(dir)
  const path = join(dir, `${args.mode}.html`)
  await writeFile(path, htmlFor(args.mode, args.brandId, currentProfile?.profile_version), 'utf8')
  return ok({
    brandId: args.brandId,
    mode: args.mode,
    previewPath: path,
    schemaPath: 'media-core/schemas/creator-style-form.schema.json',
    creatorTypes: CREATOR_TYPES,
    fieldGroups: ['positioning', 'audience', 'expression', 'structure', 'language', 'truthBoundaries', 'samples', 'platformDifferences', 'consent'],
    states: ['draft', 'submitted', 'confirmed', 'superseded'],
    prefill: currentProfile ? { baseProfileVersion: currentProfile.profile_version, profile: currentProfile } : null,
  }, storageWarnings())
}

export const saveDraftName = 'mediaops.style.form.save_draft'
export const saveDraftDescription = 'Create or append a brand-scoped creator-style form draft without changing the formal profile.'
export const saveDraftInputSchema = {
  brandId: BrandIdSchema,
  formId: z.string().uuid().optional(),
  mode: z.enum(['quick', 'full', 'incremental']),
  data: z.record(z.unknown()),
  updatedBy: z.string().min(1),
}

export async function saveDraftHandler(args: { brandId: string; formId?: string; mode: FormMode; data: Record<string, unknown>; updatedBy: string }): Promise<Envelope> {
  const formId = args.formId ?? randomUUID()
  const previous = await getLatestForm(args.brandId, formId)
  if (previous && previous.state !== 'draft') return err('FORM_NOT_EDITABLE', `Form ${formId} is ${previous.state}; create a new draft.`)
  if (previous && previous.mode !== args.mode) return err('FORM_MODE_MISMATCH', `Form ${formId} was created in ${previous.mode} mode.`)
  await appendRecord('style-forms', { formId, brandId: args.brandId, mode: args.mode, state: 'draft', data: args.data, updatedBy: args.updatedBy })
  return ok({ formId, brandId: args.brandId, mode: args.mode, state: 'draft' }, storageWarnings())
}

export const submitName = 'mediaops.style.form.submit'
export const submitDescription = 'Validate and submit a draft creator-style form for proposal; submission still cannot overwrite a profile.'
export const submitInputSchema = { brandId: BrandIdSchema, formId: z.string().uuid(), submittedBy: z.string().min(1) }

export async function submitHandler(args: { brandId: string; formId: string; submittedBy: string }): Promise<Envelope> {
  const form = await getLatestForm(args.brandId, args.formId)
  if (!form) return err('NOT_FOUND', `No form ${args.formId} in brand ${args.brandId}.`)
  if (form.state !== 'draft') return err('INVALID_FORM_STATE', `Form ${args.formId} is ${form.state}.`)
  const validation = validateForMode(form.mode, form.data)
  if (!validation.success) return err('INVALID_STYLE_FORM', validation.message)
  const submittedAt = new Date().toISOString()
  await appendRecord('style-forms', { formId: form.formId, brandId: form.brandId, mode: form.mode, state: 'submitted', data: validation.data, updatedBy: args.submittedBy, submittedAt })
  return ok({ formId: form.formId, brandId: form.brandId, state: 'submitted', submittedAt }, storageWarnings())
}

export const getFormName = 'mediaops.style.form.get'
export const getFormDescription = 'Get the latest state of one creator-style form, scoped by brandId.'
export const getFormInputSchema = { brandId: BrandIdSchema, formId: z.string().uuid() }

export async function getFormHandler(args: { brandId: string; formId: string }): Promise<Envelope> {
  const form = await getLatestForm(args.brandId, args.formId)
  return form ? ok(form, storageWarnings()) : err('NOT_FOUND', `No form ${args.formId} in brand ${args.brandId}.`)
}

const CorpusSchema = z.object({
  sources: z.array(z.object({ title: z.string(), url: z.string().url().optional(), rightsStatus: z.enum(['owned', 'authorized', 'public-abstract-only']) })).default([]),
  features: z.record(z.union([z.string(), z.array(z.string())])).default({}),
})

function flatten(value: unknown, prefix = '', out: Record<string, unknown> = {}): Record<string, unknown> {
  if (Array.isArray(value) || value === null || typeof value !== 'object') {
    if (prefix) out[prefix] = value
    return out
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    flatten(child, prefix ? `${prefix}.${key}` : key, out)
  }
  return out
}

function formFeatures(data: StyleFormData): Record<string, unknown> {
  return flatten({
    creatorTypes: data.creatorTypes,
    positioning: data.positioning,
    audience: data.audience,
    expression: data.expression,
    structure: data.structure,
    language: data.language,
    truthBoundaries: data.truthBoundaries,
    platformDifferences: data.platformDifferences,
  })
}

function setByPath(target: Record<string, any>, path: string, value: unknown): void {
  const parts = path.split('.')
  let cursor = target
  for (const part of parts.slice(0, -1)) {
    if (!cursor[part] || typeof cursor[part] !== 'object') cursor[part] = {}
    cursor = cursor[part]
  }
  cursor[parts[parts.length - 1]] = value
}

export const proposeName = 'mediaops.profile.propose'
export const proposeDescription = 'Compare a submitted form with abstract corpus observations and create a conflict-explicit profile proposal.'
export const proposeInputSchema = { brandId: BrandIdSchema, formId: z.string().uuid(), corpus: CorpusSchema.optional(), proposedBy: z.string().min(1) }

export async function proposeHandler(args: { brandId: string; formId: string; corpus?: z.input<typeof CorpusSchema>; proposedBy: string }): Promise<Envelope> {
  const form = await getLatestForm(args.brandId, args.formId)
  if (!form || form.state !== 'submitted') return err('FORM_NOT_SUBMITTED', 'A submitted form in the same brand scope is required.')
  const data = StyleFormDataSchema.parse(form.data)
  const corpus = CorpusSchema.parse(args.corpus ?? {})
  const preferences = formFeatures(data)
  const conflicts = Object.entries(corpus.features)
    .filter(([field, observed]) => field in preferences && stableHash(preferences[field]) !== stableHash(observed))
    .map(([field, observed]) => ({ id: stableHash([field, observed]).slice(0, 16), field, formValue: preferences[field], corpusValue: observed }))
  const proposalId = randomUUID()
  await appendRecord('profile-proposals', { proposalId, brandId: args.brandId, formId: args.formId, state: 'pending', formData: data, corpus, conflicts, proposedBy: args.proposedBy })
  return ok({ proposalId, brandId: args.brandId, formId: args.formId, conflicts, requiresConfirmation: true }, storageWarnings())
}

async function getProposal(brandId: string, proposalId: string): Promise<(StoredRecord & Record<string, any>) | null> {
  return latest(await listRecords('profile-proposals', { brandId, proposalId })) as (StoredRecord & Record<string, any>) | null
}

export const confirmName = 'mediaops.profile.confirm'
export const confirmDescription = 'Resolve every form/corpus conflict and confirm a new immutable brand profile version.'
export const confirmInputSchema = { brandId: BrandIdSchema, proposalId: z.string().uuid(), confirmedBy: z.string().min(1), resolutions: z.record(z.enum(['form', 'corpus'])) }

export async function confirmHandler(args: { brandId: string; proposalId: string; confirmedBy: string; resolutions: Record<string, 'form' | 'corpus'> }): Promise<Envelope> {
  const proposal = await getProposal(args.brandId, args.proposalId)
  if (!proposal || proposal.state !== 'pending') return err('PROPOSAL_NOT_PENDING', 'A pending proposal in the same brand scope is required.')
  const unresolved = (proposal.conflicts as any[]).filter((conflict) => !args.resolutions[conflict.id])
  if (unresolved.length) return err('STYLE_CONFLICT_CONFIRMATION_REQUIRED', `Resolve conflicts: ${unresolved.map((item) => item.id).join(', ')}.`)
  const data = StyleFormDataSchema.parse(proposal.formData)
  const resolvedData = structuredClone(data) as StyleFormData
  for (const conflict of proposal.conflicts as any[]) {
    if (args.resolutions[conflict.id] === 'corpus') setByPath(resolvedData as unknown as Record<string, any>, conflict.field, conflict.corpusValue)
  }
  const chosenFeatures = formFeatures(resolvedData)
  if (resolvedData.baseProfileVersion && !(await loadProfile(args.brandId, resolvedData.baseProfileVersion))) {
    return err('PROFILE_REQUIRED', `Base profile ${args.brandId}@${resolvedData.baseProfileVersion} does not exist.`)
  }
  const profileInput: BrandProfileInput = {
    brand_id: args.brandId,
    name: resolvedData.displayName,
    persona: { identity: resolvedData.positioning.accountPositioning, domain: resolvedData.positioning.domains, stance: resolvedData.creatorTypes.join(', ') },
    voice: { tone: `${chosenFeatures['expression.formality']}/${chosenFeatures['expression.sharpness']}`, person: String(chosenFeatures['expression.personPreference']), formality: String(chosenFeatures['expression.formality']) },
    audience: { segments: resolvedData.audience.segments, pain_points: resolvedData.audience.painPoints, reading_context: resolvedData.audience.readingContext },
    columns: [{ name: '默认栏目', cadence: resolvedData.positioning.cadence }],
    platforms: resolvedData.positioning.mainPlatforms.map((platform) => ({ platform })),
    banned_words: resolvedData.language.bannedWords,
    style_refs: resolvedData.samples.map(({ title, url, rightsStatus, confidence, date }) => ({ title, url, rightsStatus, confidence, date })),
    style: { creatorTypes: resolvedData.creatorTypes, expression: resolvedData.expression, structure: resolvedData.structure, language: resolvedData.language, truthBoundaries: resolvedData.truthBoundaries, platformDifferences: resolvedData.platformDifferences, chosenFeatures },
    compliance: { ai_label_text: '本文包含 AI 辅助创作内容', avoid_domains: resolvedData.language.humanReviewTopics },
    confirmedBy: args.confirmedBy,
    source: 'confirmed-form',
    sourceFormId: proposal.formId,
  }
  const profile = await saveProfileVersion(profileInput)
  await appendRecord('profile-proposals', { proposalId: args.proposalId, brandId: args.brandId, formId: proposal.formId, state: 'confirmed', profileVersion: profile.profile_version, confirmedBy: args.confirmedBy, resolutions: args.resolutions })
  const allBrandForms = await listRecords('style-forms', { brandId: args.brandId })
  const currentByForm = new Map<string, StoredForm>()
  for (const event of allBrandForms) currentByForm.set(String(event.formId), event as StoredForm)
  for (const previous of currentByForm.values()) {
    if (previous.formId !== proposal.formId && previous.state === 'confirmed') {
      await appendRecord('style-forms', { formId: previous.formId, brandId: previous.brandId, mode: previous.mode, state: 'superseded', data: previous.data, updatedBy: args.confirmedBy, supersededByProfileVersion: profile.profile_version })
    }
  }
  const form = await getLatestForm(args.brandId, proposal.formId)
  if (form) await appendRecord('style-forms', { formId: form.formId, brandId: form.brandId, mode: form.mode, state: 'confirmed', data: form.data, updatedBy: args.confirmedBy, profileVersion: profile.profile_version })
  return ok({ brandId: args.brandId, profileVersion: profile.profile_version, proposalId: args.proposalId, formId: proposal.formId }, storageWarnings())
}

export function styleFormSchema(): object {
  return { $id: 'creator-style-form', modes: ['quick', 'full', 'incremental'], creatorTypes: CREATOR_TYPES }
}
