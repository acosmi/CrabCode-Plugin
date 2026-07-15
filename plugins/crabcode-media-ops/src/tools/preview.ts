import { join } from 'node:path'
import { z } from 'zod'
import { err, ok, type Envelope } from '../envelope.ts'
import { bodyPlainText } from '../rendering/article-doc.ts'
import { storageWarnings } from '../storage.ts'
import { getLatestContent } from './content.ts'
import { getLatestVerifiedDelivery, verifyDeliveryBytes } from './delivery.ts'

export const name = 'mediaops.preview.create'
export const description =
  'Return the exact verified HTML-primary delivery candidate for preview. It never rerenders or creates an approval-divergent preview.'

export const inputSchema = {
  contentId: z.string().uuid(),
  platform: z.enum(['wechat', 'xhs', 'toutiao']).optional(),
}

type Args = { contentId: string; platform?: 'wechat' | 'xhs' | 'toutiao' }

export async function handler(args: Args): Promise<Envelope> {
  const content = await getLatestContent(args.contentId)
  if (!content) return err('NOT_FOUND', `No content ${args.contentId}.`)
  if (!('schemaVersion' in content) || content.schemaVersion !== 2) return err('SCHEMA_UPGRADE_REQUIRED', 'Legacy content has no verified HTML delivery candidate.')
  if (args.platform && content.platform && args.platform !== content.platform) return err('PACKAGE_INPUT_MISMATCH', `Content targets ${content.platform}, not ${args.platform}.`)
  const delivery = await getLatestVerifiedDelivery(content.contentId, content.revisionId)
  if (!delivery || delivery.contentHash !== content.contentHash || delivery.articleDocHash !== content.articleDocHash) {
    return err('DELIVERY_VERIFICATION_REQUIRED', 'Render and verify the exact reviewed revision before preview.')
  }
  try {
    await verifyDeliveryBytes(delivery)
  } catch (error) {
    return err('DELIVERY_INTEGRITY_FAILED', error instanceof Error ? error.message : String(error))
  }
  const plain = bodyPlainText(content.articleDoc)
  const summary = content.summary ?? (plain.length > 280 ? `${plain.slice(0, 280)}…` : plain)
  return ok({
    id: delivery.deliveryId,
    path: join(delivery.artifactRoot, delivery.primaryArtifact.relativePath),
    format: 'html',
    role: 'primary',
    backupPath: join(delivery.artifactRoot, delivery.backupArtifact.relativePath),
    backupFormat: 'markdown',
    summary,
    contentId: content.contentId,
    revisionId: content.revisionId,
    contentHash: content.contentHash,
    articleDocHash: content.articleDocHash,
    renderManifestHash: delivery.renderManifestHash,
    primaryArtifactHash: delivery.primaryArtifact.artifactHash,
    platform: args.platform ?? content.platform ?? null,
  }, storageWarnings())
}
