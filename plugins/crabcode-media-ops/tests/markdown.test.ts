import { test, expect, describe } from 'bun:test'
import { renderMarkdown, renderDocument, toPlainText } from '../src/markdown.ts'

describe('markdown renderer', () => {
  test('renders headings and paragraphs', () => {
    const html = renderMarkdown('# Title\n\nA paragraph.')
    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('<p>A paragraph.</p>')
  })

  test('renders bold, italic, inline code', () => {
    const html = renderMarkdown('This is **bold** and *italic* and `code`.')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>italic</em>')
    expect(html).toContain('<code>code</code>')
  })

  test('renders unordered and ordered lists', () => {
    expect(renderMarkdown('- one\n- two')).toContain('<ul><li>one</li><li>two</li></ul>')
    expect(renderMarkdown('1. first\n2. second')).toContain('<ol><li>first</li><li>second</li></ol>')
  })

  test('renders links and images', () => {
    const html = renderMarkdown('[label](https://example.com) ![alt](https://img/x.png)')
    expect(html).toContain('<a href="https://example.com">label</a>')
    expect(html).toContain('<img alt="alt" src="https://img/x.png">')
  })

  test('escapes raw HTML in text', () => {
    const html = renderMarkdown('a <script>bad</script> b')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  test('renderDocument is self-contained with inline style', () => {
    const doc = renderDocument('My Post', '# Hi\n\nBody.')
    expect(doc).toContain('<!doctype html>')
    expect(doc).toContain('<style>')
    expect(doc).toContain('<title>My Post</title>')
    expect(doc).not.toContain('http://') // no external stylesheet/script
  })

  test('toPlainText strips markdown syntax', () => {
    const plain = toPlainText('# Heading\n\n- **bold** item\n[link](http://x)')
    expect(plain).toContain('Heading')
    expect(plain).toContain('bold item')
    expect(plain).toContain('link')
    expect(plain).not.toContain('#')
    expect(plain).not.toContain('**')
  })
})
