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

export type PlatformDescriptor = {
  id: 'wechat' | 'xhs' | 'toutiao'
  displayName: string
  formats: PlatformFormat[]
  limits: PlatformLimits
  requiredCredentials: string[]
  /** Marks that the real publish API is not implemented until Gate B. */
  apiPublishGate: 'gate-b'
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
  },
]

export function getPlatform(id: string): PlatformDescriptor | undefined {
  return PLATFORMS.find((p) => p.id === id)
}

export function platformIds(): string[] {
  return PLATFORMS.map((p) => p.id)
}
