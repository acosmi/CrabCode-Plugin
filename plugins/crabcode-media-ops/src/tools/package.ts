import { z } from 'zod'
import { ok, err, type Envelope } from '../envelope.ts'
import { dataDir, ensureDir, appendRecord, storageWarnings } from '../storage.ts'
import { getPlatform, platformIds } from '../platforms/registry.ts'
import { renderDocument, toPlainText } from '../markdown.ts'
import { DEFAULT_AI_LABEL } from './readiness.ts'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

export const name = 'mediaops.publish.package'
export const description =
  'Build a local publish package directory (manifest + article files + copy checklist) for manual publishing. Refuses to package AI-assisted content missing its disclosure label (compliance D-10). Zero credentials; real publish APIs are gated to Gate B.'

export const inputSchema = {
  platform: z.string(),
  title: z.string(),
  bodyMarkdown: z.string(),
  bodyHtml: z.string().optional(),
  summary: z.string().optional(),
  assets: z.array(z.string()).optional().describe('Local file paths of assets (images) to reference in the manifest.'),
  approvalId: z.string().optional(),
  // Compliance (D-10): defense-in-depth — packaging is independently refused when
  // the AI-assist disclosure label is absent, even if readiness.inspect was skipped.
  aiAssisted: z.boolean().optional(),
  aiLabelText: z.string().optional(),
}

type Args = {
  platform: string
  title: string
  bodyMarkdown: string
  bodyHtml?: string
  summary?: string
  assets?: string[]
  approvalId?: string
  aiAssisted?: boolean
  aiLabelText?: string
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function handler(args: Args): Promise<Envelope> {
  const platform = getPlatform(args.platform)
  if (!platform) {
    return err('unknown_platform', `unknown platform '${args.platform}'. Known: ${platformIds().join(', ')}`)
  }

  // Compliance (D-10): refuse to package AI-assisted content that lacks its
  // explicit disclosure label. This is independent of readiness.inspect so the
  // legal requirement holds even if the caller skipped the readiness step.
  if (args.aiAssisted !== false) {
    const label = (args.aiLabelText ?? DEFAULT_AI_LABEL).trim()
    if (label.length === 0 || !args.bodyMarkdown.includes(label)) {
      return err(
        'ai_label_missing',
        `Refusing to package: AI-assist disclosure label "${label || DEFAULT_AI_LABEL}" is missing from the body. Compliance (D-10) requires an explicit AI-assist label before publishing; add it (do not remove, fake, or hide it), or pass aiAssisted:false only for fully human-authored content.`,
      )
    }
  }

  const warnings = storageWarnings()
  const id = randomUUID()
  const dirName = `${platform.id}-${dateStamp()}-${id}`
  const pkgDir = join(dataDir(), 'publish-packages', dirName)
  await ensureDir(pkgDir)

  const html = args.bodyHtml ?? renderDocument(args.title, args.bodyMarkdown)
  const summary = args.summary ?? toPlainText(args.bodyMarkdown).slice(0, 280)

  const manifest = {
    id,
    platform: platform.id,
    platformDisplayName: platform.displayName,
    title: args.title,
    summary,
    assets: args.assets ?? [],
    approvalId: args.approvalId ?? null,
    apiPublishGate: platform.apiPublishGate,
    publishMode: 'package-only (manual copy; real publish API requires Gate B credentials)',
    createdAt: new Date().toISOString(),
    files: ['manifest.json', 'article.md', 'article.html', 'title.txt', 'summary.txt', 'copy-checklist.md'],
  }

  const checklist = [
    `# Copy checklist — ${platform.displayName}`,
    '',
    `- [ ] Title within ${platform.limits.titleMax} chars`,
    platform.limits.coverRequired ? '- [ ] Cover image attached' : '- [ ] Cover image (optional) reviewed',
    `- [ ] Body within ${platform.limits.bodyMaxChars} chars`,
    `- [ ] At most ${platform.limits.imageMaxCount} images`,
    '- [ ] Human approval recorded',
    '- [ ] Final manual publish performed on the platform',
    '',
  ].join('\n')

  await writeFile(join(pkgDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')
  await writeFile(join(pkgDir, 'article.md'), args.bodyMarkdown, 'utf8')
  await writeFile(join(pkgDir, 'article.html'), html, 'utf8')
  await writeFile(join(pkgDir, 'title.txt'), args.title, 'utf8')
  await writeFile(join(pkgDir, 'summary.txt'), summary, 'utf8')
  await writeFile(join(pkgDir, 'copy-checklist.md'), checklist, 'utf8')

  await appendRecord('publish-history', {
    id,
    platform: platform.id,
    title: args.title,
    packagePath: pkgDir,
    approvalId: args.approvalId ?? null,
    mode: 'package-only',
  })

  return ok(
    {
      id,
      packagePath: pkgDir,
      platform: platform.id,
      files: manifest.files,
      publishMode: manifest.publishMode,
    },
    warnings,
  )
}
