import type { Element, Root as HastRoot, Text } from 'hast'
import type { Root as MdastRoot } from 'mdast'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import type { ArticleDoc, ArticleNode, Asset } from '../domain.ts'
import { isSafeLinkUrl, stableHash } from '../domain.ts'
import { ArticleDocError, markdownFromArticleDoc } from './article-doc.ts'
import {
  EDITORIAL_WHITE_CSS,
  RENDERER_VERSION,
  SANITIZATION_POLICY_VERSION,
  STYLE_POLICY_VERSION,
  TEMPLATE_ID,
  THEME_ID,
  WECHAT_STYLES,
} from './theme.ts'

export type RenderedArticle = {
  html: string
  markdown: string
  wechatHtml: string
  semanticHash: string
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function assertPackageRelativePath(value: string): void {
  if (!value || value.startsWith('/') || value.includes('\\') || value.includes('?') || value.includes('#') || value.includes(':')) {
    throw new ArticleDocError('DELIVERY_SECURITY_BLOCKED', `Asset path '${value}' is not a package-relative path.`)
  }
  const segments = value.split('/')
  if (segments.some((segment) => !segment || segment === '.' || segment === '..') || !/^[A-Za-z0-9._/-]+$/.test(value)) {
    throw new ArticleDocError('DELIVERY_SECURITY_BLOCKED', `Asset path '${value}' is not a canonical package-relative path.`)
  }
}

function validateAssetMap(doc: ArticleDoc, assetMap: Map<string, string>): void {
  const expected = new Set(doc.assets.map((asset) => asset.assetId))
  if (assetMap.size !== expected.size) throw new ArticleDocError('ASSET_MISSING', 'Every ArticleDoc asset must have exactly one frozen package path.')
  const paths = new Set<string>()
  for (const [assetId, path] of assetMap) {
    if (!expected.has(assetId)) throw new ArticleDocError('DELIVERY_SECURITY_BLOCKED', `Unknown asset mapping ${assetId}.`)
    assertPackageRelativePath(path)
    if (paths.has(path)) throw new ArticleDocError('DELIVERY_SECURITY_BLOCKED', `Multiple assets map to '${path}'.`)
    paths.add(path)
  }
}

function cloneNode(node: ArticleNode, assetMap: Map<string, string>): ArticleNode {
  const copy: ArticleNode = { ...node }
  if (node.type === 'image' && node.url?.startsWith('asset:')) {
    const relativePath = assetMap.get(node.url.slice('asset:'.length))
    if (!relativePath) throw new ArticleDocError('ASSET_MISSING', `No rendered asset for ${node.url}.`)
    copy.url = relativePath
  }
  if (node.children) copy.children = node.children.map((child) => cloneNode(child, assetMap))
  return copy
}

function textContent(node: any): string {
  if (node?.type === 'text' && typeof node.value === 'string') return node.value
  return Array.isArray(node?.children) ? node.children.map(textContent).join('') : ''
}

function transformGeneratedHast(tree: HastRoot, doc: ArticleDoc, assetMap: Map<string, string>): void {
  const assetsByRelative = new Map<string, ArticleDoc['assets'][number]>()
  for (const asset of doc.assets) {
    const relative = assetMap.get(asset.assetId)
    if (relative) assetsByRelative.set(relative, asset)
  }
  const headingCounts = new Map<string, number>()

  const visitChildren = (parent: any): void => {
    if (!Array.isArray(parent.children)) return
    for (let index = 0; index < parent.children.length; index++) {
      const node = parent.children[index]
      if (!node || node.type !== 'element') continue
      const element = node as Element
      element.properties ??= {}
      if (element.tagName === 'a') {
        const href = String(element.properties.href ?? '')
        if (!isSafeLinkUrl(href)) throw new ArticleDocError('DELIVERY_SECURITY_BLOCKED', `Unsafe rendered link '${href}'.`)
        element.properties.rel = ['noopener', 'noreferrer']
      }
      if (/^h[2-4]$/.test(element.tagName) && !element.properties.id) {
        const seed = textContent(element).normalize('NFC') || 'section'
        const digest = stableHash(seed).slice(0, 10)
        const count = (headingCounts.get(digest) ?? 0) + 1
        headingCounts.set(digest, count)
        element.properties.id = `section-${digest}${count > 1 ? `-${count}` : ''}`
      }
      if (element.tagName === 'img') {
        const src = String(element.properties.src ?? '')
        const asset = assetsByRelative.get(src)
        if (!asset) throw new ArticleDocError('DELIVERY_SECURITY_BLOCKED', `Rendered image '${src}' is not a frozen asset.`)
        element.properties.loading = 'lazy'
        element.properties.decoding = 'async'
        if (asset.width) element.properties.width = asset.width
        if (asset.height) element.properties.height = asset.height
        if (!String(element.properties.alt ?? '').trim()) throw new ArticleDocError('DELIVERY_SEMANTICS_INVALID', `Image ${asset.assetId} has empty alt text.`)
      }
      visitChildren(element)
      if (element.tagName === 'p' && element.children.length === 1) {
        const image = element.children[0]
        if (image?.type === 'element' && image.tagName === 'img') {
          const src = String(image.properties?.src ?? '')
          const asset = assetsByRelative.get(src)
          const caption = asset?.caption
          const sourceUrl = asset?.sourceUrl
          const captionChildren: Array<Element | Text> = []
          if (caption) captionChildren.push({ type: 'text', value: caption })
          if (sourceUrl) {
            if (captionChildren.length) captionChildren.push({ type: 'text', value: '｜' })
            captionChildren.push({
              type: 'element',
              tagName: 'a',
              properties: { href: sourceUrl, rel: ['noopener', 'noreferrer'] },
              children: [{ type: 'text', value: '图片来源' }],
            })
          }
          parent.children[index] = {
            type: 'element',
            tagName: 'figure',
            properties: {},
            children: captionChildren.length ? [
              image,
              { type: 'element', tagName: 'figcaption', properties: {}, children: captionChildren },
            ] : [image],
          }
        }
      } else if (element.tagName === 'table') {
        parent.children[index] = {
          type: 'element',
          tagName: 'div',
          properties: { className: ['table-scroll'], role: 'region', tabIndex: 0, ariaLabel: '可横向滚动的数据表' },
          children: [element],
        }
      }
    }
  }
  visitChildren(tree)
}

const SANITIZE_SCHEMA = {
  ...defaultSchema,
  tagNames: [
    'a', 'p', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'strong', 'em', 'del',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'br', 'sup', 'section', 'div', 'figure', 'figcaption', 'img', 'input',
  ],
  attributes: {
    '*': ['id'],
    a: ['href', 'title', 'rel', 'ariaDescribedBy', 'ariaLabel', 'dataFootnoteRef', 'dataFootnoteBackref'],
    code: [['className', /^language-[A-Za-z0-9_-]+$/]],
    div: [['className', 'table-scroll'], 'role', 'tabIndex', 'ariaLabel'],
    img: ['src', 'alt', 'title', 'loading', 'decoding', 'width', 'height'],
    input: ['type', 'checked', 'disabled'],
    li: [['className', 'task-list-item']],
    ol: ['start'],
    section: [['className', 'footnotes'], 'dataFootnotes'],
    sup: ['ariaHidden'],
    th: ['align'],
    td: ['align'],
    ul: [['className', 'contains-task-list']],
  },
  protocols: {
    href: ['http', 'https', 'mailto'],
  },
  clobber: [],
  clobberPrefix: 'media-',
} as const

export function renderArticleBody(doc: ArticleDoc, assetMap = new Map<string, string>()): string {
  const root = cloneNode(doc.body, assetMap) as MdastRoot
  const processor = unified()
    .use(remarkRehype, { allowDangerousHtml: false, clobberPrefix: 'media-', footnoteLabel: '脚注' })
    .use(() => (tree: HastRoot) => transformGeneratedHast(tree, doc, assetMap))
    .use(rehypeSanitize, SANITIZE_SCHEMA as any)
    .use(rehypeStringify)
  const hast = processor.runSync(root)
  return String(processor.stringify(hast)).trim()
}

function renderSources(doc: ArticleDoc): string {
  if (!doc.citations.length) return ''
  const items = doc.citations.map((citation) => {
    const metadata: string[] = []
    if (citation.publisher) metadata.push(`<cite>${escapeHtml(citation.publisher)}</cite>`)
    if (citation.publishedAt) metadata.push(`<time datetime="${escapeHtml(citation.publishedAt)}">${escapeHtml(citation.publishedAt.slice(0, 10))}</time>`)
    return `<li><a href="${escapeHtml(citation.url)}" rel="noopener noreferrer">${escapeHtml(citation.title)}</a>${metadata.length ? `<span>｜${metadata.join('｜')}</span>` : ''}</li>`
  }).join('\n')
  return `<section class="article-sources" aria-labelledby="sources-title">
<h2 id="sources-title">信息来源</h2>
<ol>${items}</ol>
</section>`
}

function renderDisclosures(doc: ArticleDoc): string {
  if (!doc.disclosures.length) return ''
  return `<section class="article-disclosures" aria-labelledby="disclosures-title">
<h2 id="disclosures-title">披露说明</h2>
${doc.disclosures.map((item) => `<p>${escapeHtml(item)}</p>`).join('\n')}
</section>`
}

export function assertSafeHtml(html: string): void {
  const lower = html.toLowerCase()
  const forbidden = ['<script', '<iframe', '<object', '<embed', '<form', '<svg', '<math', '<base', '<link']
  const hit = forbidden.find((token) => lower.includes(token))
  if (hit) throw new ArticleDocError('DELIVERY_SECURITY_BLOCKED', `Generated HTML contains forbidden token '${hit}'.`)
  if (/\son[a-z]+\s*=/i.test(html)) throw new ArticleDocError('DELIVERY_SECURITY_BLOCKED', 'Generated HTML contains an event-handler attribute.')
  if (/\s(?:src|srcset)\s*=\s*["']?\s*(?:https?:|data:|file:|\/\/|\/|\.\.\/)/i.test(html)) {
    throw new ArticleDocError('DELIVERY_SECURITY_BLOCKED', 'Generated HTML contains a non-package image source.')
  }
  if (/\s(?:href|src)\s*=\s*["']?\s*(?:javascript:|vbscript:|data:text\/html)/i.test(html)) {
    throw new ArticleDocError('DELIVERY_SECURITY_BLOCKED', 'Generated HTML contains an active-content URL.')
  }
}

export function renderWebDocument(args: {
  doc: ArticleDoc
  contentId?: string
  revisionId?: string
  articleDocHash?: string
  assetMap?: Map<string, string>
}): string {
  validateAssetMap(args.doc, args.assetMap ?? new Map<string, string>())
  const assetMap = args.assetMap ?? new Map<string, string>()
  const body = renderArticleBody(args.doc, assetMap)
  const footer = [renderSources(args.doc), renderDisclosures(args.doc)].filter(Boolean).join('\n')
  const docHash = stableHash(args.doc)
  if (args.articleDocHash && args.articleDocHash !== docHash) {
    throw new ArticleDocError('ARTICLE_DOC_HASH_MISMATCH', 'The supplied articleDocHash does not match the canonical ArticleDoc.')
  }
  const html = `<!doctype html>
<html lang="${escapeHtml(args.doc.language)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'">
<title>${escapeHtml(args.doc.title)}</title>
<style>${EDITORIAL_WHITE_CSS}</style>
</head>
<body>
<main class="article-shell">
<article class="media-article" data-content-id="${escapeHtml(args.contentId ?? '')}" data-revision-id="${escapeHtml(args.revisionId ?? '')}" data-article-doc-hash="${escapeHtml(docHash)}" data-renderer="${escapeHtml(RENDERER_VERSION)}" data-theme="${escapeHtml(THEME_ID)}">
<header class="article-header">
<h1>${escapeHtml(args.doc.title)}</h1>
${args.doc.summary ? `<p class="article-deck">${escapeHtml(args.doc.summary)}</p>` : ''}
</header>
<div class="article-body">${body}</div>
${footer ? `<footer class="article-footer">${footer}</footer>` : ''}
</article>
</main>
</body>
</html>
`
  assertSafeHtml(html)
  return html
}

function addInlineStyle(html: string, tag: string, style: string): string {
  const pattern = new RegExp(`<${tag}(?=[\\s>])([^>]*)>`, 'g')
  return html.replace(pattern, (_match, attrs: string) => `<${tag}${attrs} style="${escapeHtml(style)}">`)
}

export function renderWechatFragment(doc: ArticleDoc, assetMap: Map<string, string>): string {
  validateAssetMap(doc, assetMap)
  let body = renderArticleBody(doc, assetMap)
  for (const [tag, style] of [
    ['h2', WECHAT_STYLES.h2], ['h3', WECHAT_STYLES.h3], ['h4', WECHAT_STYLES.h3], ['p', WECHAT_STYLES.p],
    ['a', WECHAT_STYLES.a], ['blockquote', WECHAT_STYLES.blockquote], ['ul', WECHAT_STYLES.list], ['ol', WECHAT_STYLES.list],
    ['figure', WECHAT_STYLES.figure], ['img', WECHAT_STYLES.img], ['figcaption', WECHAT_STYLES.figcaption],
    ['div', WECHAT_STYLES.tableWrap], ['table', WECHAT_STYLES.table], ['th', WECHAT_STYLES.cell], ['td', WECHAT_STYLES.cell],
    ['pre', WECHAT_STYLES.pre], ['code', WECHAT_STYLES.code], ['hr', WECHAT_STYLES.hr], ['li', WECHAT_STYLES.li],
  ] as const) body = addInlineStyle(body, tag, style)
  let footerContent = `${renderSources(doc)}${renderDisclosures(doc)}`
  for (const [tag, style] of [
    ['h2', WECHAT_STYLES.h2], ['p', WECHAT_STYLES.p], ['a', WECHAT_STYLES.a], ['ol', WECHAT_STYLES.list], ['li', WECHAT_STYLES.li],
  ] as const) footerContent = addInlineStyle(footerContent, tag, style)
  const html = `<article data-render-profile="wechat-richtext@1" style="${escapeHtml(WECHAT_STYLES.article)}">
<h1 style="${escapeHtml(WECHAT_STYLES.h1)}">${escapeHtml(doc.title)}</h1>
${doc.summary ? `<p style="${escapeHtml(WECHAT_STYLES.p)}"><strong>${escapeHtml(doc.summary)}</strong></p>` : ''}
${body}
${footerContent ? `<footer style="${escapeHtml(WECHAT_STYLES.footer)}">${footerContent}</footer>` : ''}
</article>`
  assertSafeHtml(html)
  return html
}

export function renderArticle(doc: ArticleDoc, assetMap: Map<string, string>, trace: { contentId?: string; revisionId?: string; articleDocHash?: string } = {}): RenderedArticle {
  validateAssetMap(doc, assetMap)
  const html = renderWebDocument({ doc, assetMap, ...trace })
  const markdown = markdownFromArticleDoc(doc, assetMap)
  const wechatHtml = renderWechatFragment(doc, assetMap)
  return {
    html,
    markdown,
    wechatHtml,
    semanticHash: stableHash(doc),
  }
}

export const RENDER_CONTRACT = {
  rendererVersion: RENDERER_VERSION,
  templateId: TEMPLATE_ID,
  templateVersion: TEMPLATE_ID,
  stylePolicyVersion: STYLE_POLICY_VERSION,
  sanitizationPolicyVersion: SANITIZATION_POLICY_VERSION,
  themeId: THEME_ID,
  implementationHash: stableHash({
    webCss: EDITORIAL_WHITE_CSS,
    wechatStyles: WECHAT_STYLES,
    sanitizePolicy: JSON.stringify(SANITIZE_SCHEMA, (_key, value) => value instanceof RegExp ? { source: value.source, flags: value.flags } : value),
  }),
  profiles: ['web@1', 'wechat-richtext@1', 'markdown-backup@1'],
} as const
