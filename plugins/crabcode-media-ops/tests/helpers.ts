import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getHandler as getProfile, saveHandler as saveProfile } from '../src/tools/profiles.ts'
import { saveHandler as saveContent } from '../src/tools/content.ts'

export const DISCLOSURE = '本文包含 AI 辅助创作内容'

export async function createProfile(brandId: string, bannedWords: string[] = []): Promise<string> {
  const saved = await saveProfile({
    brand_id: brandId,
    name: `${brandId} display`,
    persona: { identity: '可信观点媒体' },
    voice: { tone: '清晰克制' },
    audience: { segments: ['普通读者'] },
    columns: [{ name: '观点' }],
    platforms: [{ platform: 'wechat' }, { platform: 'xhs' }, { platform: 'toutiao' }],
    banned_words: bannedWords,
    compliance: { ai_label_text: DISCLOSURE },
    confirmedBy: '测试确认人',
  })
  return (saved.data as { profileVersion: string }).profileVersion
}

export async function createReviewedContent(args: {
  dir: string
  brandId: string
  profileVersion: string
  platform?: 'wechat' | 'xhs' | 'toutiao'
  title?: string
  body?: string
  claims?: any[]
  waivers?: any[]
  noVerifiableClaimsReason?: string
  disclosure?: any
}): Promise<{ contentId: string; revisionId: string; contentHash: string; assetPath: string }> {
  const assetPath = join(args.dir, `cover-${Math.random().toString(16).slice(2)}.png`)
  await writeFile(assetPath, 'fake-png', 'utf8')
  const result = await saveContent({
    kind: 'variant',
    brandId: args.brandId,
    profileVersion: args.profileVersion,
    stage: 'reviewed',
    platform: args.platform ?? 'wechat',
    title: args.title ?? '一个经过审校的标题',
    bodyMarkdown: args.body ?? `这是经过审校的正文。\n\n${DISCLOSURE}`,
    citations: [],
    assets: [{ path: assetPath, role: 'cover', rightsStatus: 'owned' }],
    review: {
      status: 'completed',
      completedBy: '事实核查员',
      completedAt: new Date().toISOString(),
      claims: args.claims ?? [],
      noVerifiableClaimsReason: args.noVerifiableClaimsReason ?? '该测试稿没有外部可验证事实主张',
      waivers: args.waivers ?? [],
    },
    originalityReview: {
      status: 'completed',
      reviewedBy: '原创审核员',
      reviewedAt: new Date().toISOString(),
      conclusion: 'publishable',
      notes: [],
    },
    legalReview: {
      status: 'not_required',
      reviewedBy: '内容编辑',
      reviewedAt: new Date().toISOString(),
      riskLevel: 'low',
      notes: [],
    },
    aiDisclosure: args.disclosure ?? {
      aiAssisted: true,
      methods: ['body-label'],
      bodyLabelText: DISCLOSURE,
      confirmedBy: '发布确认人',
      ruleVersion: 'cac-2025',
    },
    savedBy: '测试编辑',
  })
  return { ...(result.data as { contentId: string; revisionId: string; contentHash: string }), assetPath }
}
