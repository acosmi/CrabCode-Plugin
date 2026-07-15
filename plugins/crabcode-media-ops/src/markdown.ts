/** Compatibility facade over the governed ArticleDoc renderer. */

import { buildArticleDoc, bodyPlainText } from './rendering/article-doc.ts'
import { renderArticleBody, renderWebDocument } from './rendering/renderer.ts'

export function renderMarkdown(markdown: string): string {
  const { articleDoc } = buildArticleDoc({ title: 'Untitled', bodyMarkdown: markdown })
  return renderArticleBody(articleDoc)
}

export function renderDocument(title: string, bodyMarkdown: string, language = 'zh-CN'): string {
  const { articleDoc, articleDocHash } = buildArticleDoc({ title, bodyMarkdown, language })
  return renderWebDocument({ doc: articleDoc, articleDocHash })
}

export function toPlainText(markdown: string): string {
  const { articleDoc } = buildArticleDoc({ title: 'Untitled', bodyMarkdown: markdown })
  return bodyPlainText(articleDoc)
}
