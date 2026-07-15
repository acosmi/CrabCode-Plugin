import { describe, expect, test } from 'bun:test'
import { renderDocument, renderMarkdown, toPlainText } from '../src/markdown.ts'
import { buildArticleDoc } from '../src/rendering/article-doc.ts'
import { renderArticle } from '../src/rendering/renderer.ts'

describe('governed ArticleDoc renderer', () => {
  test('keeps the title as the only H1 and renders H2 paragraphs', () => {
    const html = renderMarkdown('## 分析\n\nA paragraph.')
    expect(html).toContain('<h2')
    expect(html).toContain('分析</h2>')
    expect(html).toContain('<p>A paragraph.</p>')
    expect(() => renderMarkdown('# Body title')).toThrow('only H1')
  })

  test('renders emphasis, code, lists and safe links', () => {
    const html = renderMarkdown('This is **bold** and *italic* and `code`.\n\n- one\n- two\n\n[官网](https://example.com)')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>italic</em>')
    expect(html).toContain('<code>code</code>')
    expect(html).toContain('<ul>')
    expect(html).toContain('href="https://example.com"')
  })

  test('rejects raw HTML, active links, remote images and heading jumps', () => {
    expect(() => renderMarkdown('a <script>bad</script> b')).toThrow('Raw HTML')
    expect(() => renderMarkdown('[bad](javascript:alert(1))')).toThrow('Unsafe link')
    expect(() => renderMarkdown('![alt](https://img.example/x.png)')).toThrow('not a registered local asset')
    expect(() => renderMarkdown('#### skipped')).toThrow('first body heading must be H2')
  })

  test('full document is deterministic, self-contained, white and exactly one H1', () => {
    const outputs = new Set(Array.from({ length: 100 }, () => renderDocument('My Post', '## Hi\n\n正文讨论 CSS `url()` 与 `javascript:` 文本。')))
    expect(outputs.size).toBe(1)
    const first = [...outputs][0]
    expect((first.match(/<h1(?:\s|>)/g) ?? []).length).toBe(1)
    expect(first).toContain('<!doctype html>')
    expect(first).toContain('background: #FFFFFF')
    expect(first).not.toContain('<script')
  })

  test('rejects hash injection and package-path escape', () => {
    const { articleDoc } = buildArticleDoc({
      title: '安全测试',
      bodyMarkdown: '![替代文本](cover.png)',
      assets: [{ assetId: crypto.randomUUID(), path: 'cover.png', role: 'cover', rightsStatus: 'owned', alt: '替代文本', sha256: 'a'.repeat(64), byteSize: 1, mediaType: 'image/png', registeredAt: new Date().toISOString() }],
    })
    const assetId = articleDoc.assets[0].assetId
    expect(() => renderArticle(articleDoc, new Map([[assetId, '../outside.png']]))).toThrow('package-relative')
    expect(() => renderArticle(articleDoc, new Map([[assetId, 'assets/cover.png']]), { articleDocHash: '\"><style>bad</style>' })).toThrow('does not match')
  })

  test('preserves visible image captions and source attribution in HTML and Markdown backup', () => {
    const assetId = crypto.randomUUID()
    const { articleDoc } = buildArticleDoc({
      title: '图注测试',
      bodyMarkdown: '![有意义的替代文本](cover.png)',
      assets: [{
        assetId, path: 'cover.png', role: 'cover', rightsStatus: 'licensed', alt: '有意义的替代文本',
        caption: '实验装置的正面视图', sourceUrl: 'https://images.example.org/source', sha256: 'b'.repeat(64),
        byteSize: 12, mediaType: 'image/png', registeredAt: new Date().toISOString(),
      }],
    })
    const rendered = renderArticle(articleDoc, new Map([[assetId, 'assets/cover.png']]))
    expect(rendered.html).toContain('<figcaption>实验装置的正面视图｜<a href="https://images.example.org/source" rel="noopener noreferrer">图片来源</a></figcaption>')
    expect(rendered.markdown).toContain('*图注：实验装置的正面视图｜[图片来源](https://images.example.org/source)*')
  })

  test('keeps task state, footnote targets and trusted WeChat inline styles intact', () => {
    const { articleDoc } = buildArticleDoc({
      title: '结构测试',
      bodyMarkdown: '## 清单\n\n- [x] 已完成\n- [ ] 待完成\n\n脚注引用[^1]。\n\n[^1]: 可核验的脚注内容。\n\n```ts\nconst ok = true\n```\n\n| 项目 | 状态 |\n| --- | --- |\n| A | 好 |',
      citations: [{ url: 'https://example.com/source', title: '资料来源', publisher: '示例机构' }],
      aiDisclosure: { aiAssisted: true, methods: ['body-label'], bodyLabelText: '本文包含 AI 辅助创作内容' },
    })
    const rendered = renderArticle(articleDoc, new Map())
    expect(rendered.html).toContain('type="checkbox" checked disabled')
    expect(rendered.html).toContain('type="checkbox" disabled')
    for (const href of [...rendered.html.matchAll(/href="#([^"]+)"/g)].map((match) => match[1])) {
      expect(rendered.html).toContain(`id="${href}"`)
    }
    for (const describedBy of [...rendered.html.matchAll(/aria-describedby="([^"]+)"/g)].map((match) => match[1])) {
      expect(rendered.html).toContain(`id="${describedBy}"`)
    }
    expect(rendered.wechatHtml).not.toContain('<pre style="margin:0 0 1.2em')
    expect(rendered.wechatHtml).toContain('<table style="width:100%;border-collapse:collapse')
    expect(rendered.wechatHtml).toContain('<h2 id="sources-title" style=')
    expect(rendered.wechatHtml.match(/^<article data-render-profile="wechat-richtext@1" style="[^"]*">/)).not.toBeNull()
  })

  test('plain text extraction strips Markdown syntax', () => {
    const plain = toPlainText('## Heading\n\n- **bold** item\n\n[link](http://example.com)')
    expect(plain).toContain('Heading')
    expect(plain).toContain('bold item')
    expect(plain).toContain('link')
    expect(plain).not.toContain('**')
  })
})
