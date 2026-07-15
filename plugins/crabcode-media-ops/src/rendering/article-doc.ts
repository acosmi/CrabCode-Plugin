import type { Root } from 'mdast'
import { unified } from 'unified'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkStringify from 'remark-stringify'
import {
  AiDisclosureSchema,
  ArticleDocSchema,
  ArticleNodeSchema,
  stableHash,
  isSafeLinkUrl,
  type ArticleDoc,
  type ArticleNode,
  type Asset,
} from '../domain.ts'
import type { z } from 'zod'

export class ArticleDocError extends Error {
  constructor(readonly code: string, message: string) {
    super(message)
    this.name = 'ArticleDocError'
  }
}

const parser = unified().use(remarkParse).use(remarkGfm)
const stringifier = unified().use(remarkStringify, {
  bullet: '-',
  fences: true,
  listItemIndent: 'one',
  rule: '-',
  ruleRepetition: 3,
})
  .use(remarkGfm)

export function normalizeMarkdown(value: string): string {
  return value.normalize('NFC').replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').trim()
}

/**
 * Hash every editor-controlled semantic that can reach the reader, while
 * excluding disclosures that are deterministically added by the subsequent
 * editorial-review promotion itself. This prevents a caller from changing a
 * summary, citation or image caption after originality/editorial review.
 */
export function editorialSubjectHash(doc: ArticleDoc): string {
  return stableHash({
    title: doc.title,
    summary: doc.summary ?? null,
    body: doc.body,
    citations: doc.citations,
    assets: doc.assets.map((asset) => ({
      assetId: asset.assetId,
      role: asset.role,
      rightsStatus: asset.rightsStatus,
      alt: asset.alt ?? null,
      caption: asset.caption ?? null,
      sourceUrl: asset.sourceUrl ?? null,
      width: asset.width ?? null,
      height: asset.height ?? null,
      mediaType: asset.mediaType,
    })),
  })
}

function assetForUrl(url: string, assets: Asset[]): Asset | undefined {
  if (url.startsWith('asset:')) return assets.find((asset) => `asset:${asset.assetId}` === url)
  return assets.find((asset) => asset.path === url)
}

function cleanNode(raw: any, assets: Asset[]): ArticleNode {
  if (!raw || typeof raw !== 'object' || typeof raw.type !== 'string') {
    throw new ArticleDocError('ARTICLE_STRUCTURE_INVALID', 'Markdown produced an invalid syntax node.')
  }
  if (raw.type === 'html') {
    throw new ArticleDocError('DELIVERY_SECURITY_BLOCKED', 'Raw HTML is not accepted in article Markdown.')
  }
  if (raw.type === 'heading' && raw.depth === 1) {
    throw new ArticleDocError('ARTICLE_HEADING_H1_FORBIDDEN', 'The article title is the only H1; body Markdown must begin at H2.')
  }
  if (raw.type === 'heading' && (raw.depth < 2 || raw.depth > 4)) {
    throw new ArticleDocError('ARTICLE_HEADING_LEVEL_INVALID', 'Body headings must use H2 through H4.')
  }

  const node: ArticleNode = { type: raw.type }
  for (const key of ['value', 'depth', 'title', 'alt', 'lang', 'meta', 'ordered', 'start', 'spread', 'checked', 'align', 'identifier', 'label'] as const) {
    if (raw[key] !== undefined) (node as any)[key] = raw[key]
  }
  if (raw.type === 'link') {
    if (typeof raw.url !== 'string' || !isSafeLinkUrl(raw.url)) {
      throw new ArticleDocError('DELIVERY_SECURITY_BLOCKED', `Unsafe link URL '${String(raw.url)}'.`)
    }
    node.url = raw.url
  }
  if (raw.type === 'image') {
    if (typeof raw.url !== 'string') throw new ArticleDocError('DELIVERY_SECURITY_BLOCKED', 'Image URL is missing.')
    const asset = assetForUrl(raw.url, assets)
    if (!asset) {
      throw new ArticleDocError('DELIVERY_SECURITY_BLOCKED', `Image '${raw.url}' is not a registered local asset.`)
    }
    const alt = typeof raw.alt === 'string' && raw.alt.trim() ? raw.alt.trim() : asset.alt?.trim()
    if (!alt) throw new ArticleDocError('DELIVERY_SEMANTICS_INVALID', `Image asset ${asset.assetId} needs meaningful alt text.`)
    node.url = `asset:${asset.assetId}`
    node.alt = alt
  }
  if (Array.isArray(raw.children)) node.children = raw.children.map((child: unknown) => cleanNode(child, assets))
  const parsed = ArticleNodeSchema.safeParse(node)
  if (!parsed.success) {
    throw new ArticleDocError('ARTICLE_STRUCTURE_INVALID', parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '))
  }
  return parsed.data
}

function validateHeadingOrder(root: Root): void {
  const depths: number[] = []
  const visit = (node: any): void => {
    if (node?.type === 'heading' && typeof node.depth === 'number') depths.push(node.depth)
    if (Array.isArray(node?.children)) node.children.forEach(visit)
  }
  visit(root)
  if (!depths.length) return
  // Let cleanNode emit the more specific "body H1 forbidden" error.
  if (depths.includes(1)) return
  if (depths[0] !== 2) throw new ArticleDocError('ARTICLE_HEADING_LEVEL_INVALID', 'The first body heading must be H2.')
  for (let index = 1; index < depths.length; index++) {
    if (depths[index] > depths[index - 1] + 1) {
      throw new ArticleDocError('ARTICLE_HEADING_LEVEL_INVALID', `Heading level jumps from H${depths[index - 1]} to H${depths[index]}.`)
    }
  }
}

export function buildArticleDoc(args: {
  title: string
  bodyMarkdown: string
  language?: string
  summary?: string
  citations?: ArticleDoc['citations']
  assets?: Asset[]
  aiDisclosure?: z.infer<typeof AiDisclosureSchema>
}): { articleDoc: ArticleDoc; articleDocHash: string; originalitySubjectHash: string } {
  const normalized = normalizeMarkdown(args.bodyMarkdown)
  const parsed = parser.parse(normalized) as Root
  validateHeadingOrder(parsed)
  const assets = args.assets ?? []
  const body = cleanNode(parsed, assets)
  const disclosures: string[] = []
  if (args.aiDisclosure?.aiAssisted) {
    if (args.aiDisclosure.bodyLabelText) disclosures.push(args.aiDisclosure.bodyLabelText)
    else disclosures.push('本文在创作或编辑过程中使用了 AI 辅助，并已由具名人员复核。')
  }
  const normalizedTitle = args.title.normalize('NFC').replace(/\r\n?/g, '\n').trim()
  if (!normalizedTitle || /[\n\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(normalizedTitle)) {
    throw new ArticleDocError('ARTICLE_TITLE_INVALID', 'Article title must be one non-empty line without control characters.')
  }
  const normalizedSummary = args.summary?.normalize('NFC').replace(/\r\n?/g, '\n').trim()
  const articleDoc = ArticleDocSchema.parse({
    schemaVersion: 'article-doc@1',
    language: args.language ?? 'zh-CN',
    title: normalizedTitle,
    ...(normalizedSummary ? { summary: normalizedSummary } : {}),
    body,
    citations: args.citations ?? [],
    assets: assets.map(({ path: _path, registeredAt: _registeredAt, ...asset }) => asset),
    disclosures,
  })
  return {
    articleDoc,
    articleDocHash: stableHash(articleDoc),
    originalitySubjectHash: editorialSubjectHash(articleDoc),
  }
}

function cloneNode(node: ArticleNode, assetMap: Map<string, string>): ArticleNode {
  const copy: ArticleNode = { ...node }
  if (node.type === 'image' && node.url?.startsWith('asset:')) {
    const mapped = assetMap.get(node.url.slice('asset:'.length))
    if (!mapped) throw new ArticleDocError('ASSET_MISSING', `No packaged asset mapping for ${node.url}.`)
    copy.url = mapped
  }
  if (node.children) copy.children = node.children.map((child) => cloneNode(child, assetMap))
  return copy
}

export function markdownFromArticleDoc(doc: ArticleDoc, assetMap: Map<string, string>): string {
  const body = cloneNode(doc.body, assetMap)
  const assetsByPath = new Map(doc.assets.map((asset) => [assetMap.get(asset.assetId), asset]))
  const annotateImages = (node: ArticleNode): void => {
    if (node.type === 'image' && node.url) {
      const asset = assetsByPath.get(node.url)
      if (asset?.caption) node.title = asset.caption
    }
    node.children?.forEach(annotateImages)
  }
  annotateImages(body)
  const insertVisibleCaptions = (node: ArticleNode): void => {
    if (!node.children) return
    const expanded: ArticleNode[] = []
    for (const child of node.children) {
      insertVisibleCaptions(child)
      expanded.push(child)
      if (child.type !== 'paragraph' || child.children?.length !== 1 || child.children[0].type !== 'image' || !child.children[0].url) continue
      const asset = assetsByPath.get(child.children[0].url)
      if (!asset?.caption && !asset?.sourceUrl) continue
      const captionChildren: ArticleNode[] = []
      if (asset.caption) captionChildren.push({ type: 'text', value: `图注：${asset.caption}` })
      if (asset.sourceUrl) {
        if (captionChildren.length) captionChildren.push({ type: 'text', value: '｜' })
        captionChildren.push({ type: 'link', url: asset.sourceUrl, children: [{ type: 'text', value: '图片来源' }] })
      }
      expanded.push({ type: 'paragraph', children: [{ type: 'emphasis', children: captionChildren }] })
    }
    node.children = expanded
  }
  insertVisibleCaptions(body)
  const titleNode: ArticleNode = { type: 'heading', depth: 1 as any, children: [{ type: 'text', value: doc.title }] }
  const children: ArticleNode[] = [titleNode]
  if (doc.summary) children.push({ type: 'paragraph', children: [{ type: 'emphasis', children: [{ type: 'text', value: doc.summary }] }] })
  children.push(...(body.children ?? []))
  if (doc.citations.length) {
    children.push({ type: 'heading', depth: 2, children: [{ type: 'text', value: '信息来源' }] })
    children.push({
      type: 'list',
      ordered: true,
      start: 1,
      spread: false,
      children: doc.citations.map((citation) => ({
        type: 'listItem',
        spread: false,
        children: [{
          type: 'paragraph',
          children: [
            { type: 'link', url: citation.url, children: [{ type: 'text', value: citation.title }] },
            ...([citation.publisher, citation.publishedAt?.slice(0, 10)].filter(Boolean).length
              ? [{ type: 'text' as const, value: `｜${[citation.publisher, citation.publishedAt?.slice(0, 10)].filter(Boolean).join('｜')}` }]
              : []),
          ],
        }],
      })),
    })
  }
  if (doc.disclosures.length) {
    children.push({ type: 'heading', depth: 2, children: [{ type: 'text', value: '披露说明' }] })
    for (const disclosure of doc.disclosures) children.push({ type: 'paragraph', children: [{ type: 'text', value: disclosure }] })
  }
  const root = { type: 'root', children } as unknown as Root
  return String(stringifier.stringify(root)).replace(/\r\n?/g, '\n').trimEnd() + '\n'
}

export function bodyPlainText(doc: ArticleDoc): string {
  const values: string[] = []
  const visit = (node: ArticleNode): void => {
    if (node.value) values.push(node.value)
    if (node.alt) values.push(node.alt)
    node.children?.forEach(visit)
  }
  visit(doc.body)
  return values.join(' ').replace(/\s+/g, ' ').trim()
}
