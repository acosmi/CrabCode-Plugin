/**
 * Platform descriptors. Pure data + validation rules — no API calls, no
 * credentials embedded. Real publishing APIs are gated behind Gate B until
 * platform credentials are configured.
 *
 * Limits reflect documented platform constraints (article / image-note posts).
 */

export type PlatformFormat = 'article' | 'image_note'

export type PlatformLimits = {
  titleMax: number
  digestMax: number
  bodyMaxChars: number
  imageMaxCount: number
  coverRequired: boolean
}

export type PlatformRule = {
  id: string
  scope: string
  ruleType: 'hard-limit' | 'platform-dynamic' | 'editorial-guidance'
  sourceUrl: string
  verifiedAt: string
  maxAgeDays: number
  note: string
}

export type PlatformDescriptor = {
  id: 'wechat' | 'xhs' | 'toutiao'
  displayName: string
  formats: PlatformFormat[]
  limits: PlatformLimits
  requiredCredentials: string[]
  /** Marks that the real publish API is not implemented until Gate B. */
  apiPublishGate: 'gate-b'
  ruleVersion: string
  rules: PlatformRule[]
}

export const PLATFORMS: PlatformDescriptor[] = [
  {
    id: 'wechat',
    displayName: 'WeChat Official Account',
    formats: ['article', 'image_note'],
    limits: {
      titleMax: 32,
      digestMax: 128,
      bodyMaxChars: 20000,
      imageMaxCount: 20,
      coverRequired: true,
    },
    requiredCredentials: ['wechat_app_id', 'wechat_app_secret'],
    apiPublishGate: 'gate-b',
    ruleVersion: 'wechat-2026-07-12',
    rules: [
      {
        id: 'wechat-composer-limits',
        scope: 'title, digest, body and cover fields in the official account composer',
        ruleType: 'platform-dynamic',
        sourceUrl: 'https://mp.weixin.qq.com/',
        verifiedAt: '2026-07-12T00:00:00.000Z',
        maxAgeDays: 180,
        note: 'Recheck the live official-account composer on publication day; numeric limits can change.',
      },
      {
        id: 'wechat-editorial-review',
        scope: 'topic selection, editing, publication, promotion and comments',
        ruleType: 'hard-limit',
        sourceUrl: 'https://www.cac.gov.cn/2021-01/22/c_1612887880656609.htm',
        verifiedAt: '2026-07-12T00:00:00.000Z',
        maxAgeDays: 365,
        note: 'Public-account operators must maintain whole-process content review.',
      },
    ],
  },
  {
    id: 'xhs',
    displayName: 'Xiaohongshu',
    formats: ['image_note'],
    limits: {
      titleMax: 20,
      digestMax: 0,
      bodyMaxChars: 1000,
      imageMaxCount: 18,
      coverRequired: true,
    },
    requiredCredentials: ['xhs_access_token'],
    apiPublishGate: 'gate-b',
    ruleVersion: 'xhs-2026-07-12',
    rules: [
      {
        id: 'xhs-editorial-limits',
        scope: 'image-note title, body and image planning',
        ruleType: 'editorial-guidance',
        sourceUrl: 'https://school.xiaohongshu.com/en/index.html',
        verifiedAt: '2026-07-12T00:00:00.000Z',
        maxAgeDays: 90,
        note: 'Numbers are conservative editor guidance, not represented as immutable official hard limits.',
      },
    ],
  },
  {
    id: 'toutiao',
    displayName: 'Toutiao',
    formats: ['article', 'image_note'],
    limits: {
      titleMax: 30,
      digestMax: 0,
      bodyMaxChars: 20000,
      imageMaxCount: 20,
      coverRequired: false,
    },
    requiredCredentials: ['toutiao_access_token'],
    apiPublishGate: 'gate-b',
    ruleVersion: 'toutiao-2026-07-12',
    rules: [
      {
        id: 'toutiao-editorial-limits',
        scope: 'article title, body and image planning',
        ruleType: 'editorial-guidance',
        sourceUrl: 'https://mp.toutiao.com/',
        verifiedAt: '2026-07-12T00:00:00.000Z',
        maxAgeDays: 90,
        note: 'Numbers are conservative editor guidance; verify the current creator console before publication.',
      },
    ],
  },
]

export function getPlatform(id: string): PlatformDescriptor | undefined {
  return PLATFORMS.find((p) => p.id === id)
}

export function platformIds(): string[] {
  return PLATFORMS.map((p) => p.id)
}
