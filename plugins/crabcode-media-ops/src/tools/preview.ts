import { z } from 'zod'
import { ok, type Envelope } from '../envelope.ts'
import { dataDir, ensureDir, storageWarnings } from '../storage.ts'
import { renderDocument, toPlainText } from '../markdown.ts'
import { getPlatform } from '../platforms/registry.ts'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

export const name = 'mediaops.preview.create'
export const description =
  'Render a title + Markdown body into a self-contained HTML preview file and return its path plus a plain-text summary.'

export const inputSchema = {
  title: z.string(),
  bodyMarkdown: z.string(),
  platform: z.string().optional().describe('Optional platform id for context (wechat/xhs/toutiao).'),
}

type Args = { title: string; bodyMarkdown: string; platform?: string }

export async function handler(args: Args): Promise<Envelope> {
  const warnings = storageWarnings()
  if (args.platform && !getPlatform(args.platform)) {
    warnings.push(`unknown platform '${args.platform}'; rendering generic preview.`)
  }

  const previewsDir = join(dataDir(), 'previews')
  await ensureDir(previewsDir)
  const id = randomUUID()
  const html = renderDocument(args.title, args.bodyMarkdown)
  const path = join(previewsDir, `${id}.html`)
  await writeFile(path, html, 'utf8')

  const plain = toPlainText(args.bodyMarkdown)
  const summary = plain.length > 280 ? plain.slice(0, 280) + '…' : plain

  return ok({ id, path, summary }, warnings)
}
