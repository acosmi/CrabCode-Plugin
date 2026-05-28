import { ok, type Envelope } from '../envelope.ts'

export const name = 'mediaops.policy_status'
export const description =
  'Report the current operating policy: publishing mode, comment mode, and default daily limits.'

export const inputSchema = {}

export async function handler(): Promise<Envelope> {
  return ok({
    publish: 'draft/package-only (real publish APIs are disabled until Gate B)',
    comments: 'suggest-only',
    dailyLimits: {
      drafts: 50,
      previews: 100,
      publishPackages: 20,
    },
  })
}
