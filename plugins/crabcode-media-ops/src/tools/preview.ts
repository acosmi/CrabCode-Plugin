import { z } from 'zod'
import { err, ok, type Envelope } from '../envelope.ts'
import { dataDir, ensureDir, storageWarnings } from '../storage.ts'
import { renderDocument, toPlainText } from '../markdown.ts'
import { getPlatform } from '../platforms/registry.ts'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { getLatestContent } from './content.ts'

export const name = 'mediaops.preview.create'
export const description =
  'Render the latest stored content revision into a self-contained HTML preview with trace fields.'

export const inputSchema = {
  contentId: z.string().uuid(),
  platform: z.enum(['wechat', 'xhs', 'toutiao']).optional(),
}

type Args = { contentId: string; platform?: 'wechat' | 'xhs' | 'toutiao' }

export async function handler(args: Args): Promise<Envelope> {
  const warnings = storageWarnings()
  const content = await getLatestContent(args.contentId)
  if (!content) return err('NOT_FOUND', `No content ${args.contentId}.`)
  if (args.platform && content.platform && args.platform !== content.platform) return err('PACKAGE_INPUT_MISMATCH', `Content targets ${content.platform}, not ${args.platform}.`)
  if (args.platform && !getPlatform(args.platform)) return err('UNKNOWN_PLATFORM', `Unknown platform ${args.platform}.`)

  const previewsDir = join(dataDir(), 'previews')
  await ensureDir(previewsDir)
  const id = randomUUID()
  const html = renderDocument(content.title, content.bodyMarkdown)
  const path = join(previewsDir, `${id}.html`)
  await writeFile(path, html, 'utf8')

  const plain = toPlainText(content.bodyMarkdown)
  const summary = plain.length > 280 ? plain.slice(0, 280) + '…' : plain

  return ok({ id, path, summary, contentId: content.contentId, revisionId: content.revisionId, contentHash: content.contentHash, platform: args.platform ?? content.platform ?? null }, warnings)
}
