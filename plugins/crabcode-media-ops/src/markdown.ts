/**
 * Minimal, zero-dependency Markdown -> HTML renderer.
 *
 * Intentionally tiny: handles headings, paragraphs, unordered/ordered lists,
 * bold, italic, inline code, links and images. Everything is HTML-escaped first
 * so user/agent content cannot inject markup. This is for self-contained local
 * previews, not a full CommonMark implementation.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Inline rendering: images, links, bold, italic, inline code. Input is raw md. */
function renderInline(text: string): string {
  let out = escapeHtml(text)
  // Images: ![alt](url)
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt: string, url: string) => {
    return `<img alt="${alt}" src="${url}">`
  })
  // Links: [text](url)
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) => {
    return `<a href="${url}">${label}</a>`
  })
  // Inline code: `code`
  out = out.replace(/`([^`]+)`/g, (_m, code: string) => `<code>${code}</code>`)
  // Bold: **text**
  out = out.replace(/\*\*([^*]+)\*\*/g, (_m, b: string) => `<strong>${b}</strong>`)
  // Italic: *text* (avoid matching the inner of bold by running after bold)
  out = out.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, (_m, pre: string, i: string) => `${pre}<em>${i}</em>`)
  return out
}

export function renderMarkdown(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let i = 0
  let para: string[] = []

  const flushPara = () => {
    if (para.length) {
      html.push(`<p>${renderInline(para.join(' '))}</p>`)
      para = []
    }
  }

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      flushPara()
      i++
      continue
    }

    // Heading
    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed)
    if (heading) {
      flushPara()
      const level = heading[1].length
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`)
      i++
      continue
    }

    // Unordered list
    if (/^[-*+]\s+/.test(trimmed)) {
      flushPara()
      const items: string[] = []
      while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
        items.push(`<li>${renderInline(lines[i].trim().replace(/^[-*+]\s+/, ''))}</li>`)
        i++
      }
      html.push(`<ul>${items.join('')}</ul>`)
      continue
    }

    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      flushPara()
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(`<li>${renderInline(lines[i].trim().replace(/^\d+\.\s+/, ''))}</li>`)
        i++
      }
      html.push(`<ol>${items.join('')}</ol>`)
      continue
    }

    para.push(trimmed)
    i++
  }
  flushPara()
  return html.join('\n')
}

const STYLE = `
  body { font-family: -apple-system, system-ui, sans-serif; max-width: 720px; margin: 2em auto; padding: 0 1em; line-height: 1.6; color: #1a1a1a; }
  h1, h2, h3, h4, h5, h6 { line-height: 1.25; }
  img { max-width: 100%; height: auto; }
  code { background: #f2f2f2; padding: 0.1em 0.3em; border-radius: 3px; font-family: ui-monospace, monospace; }
  a { color: #0a66c2; }
`

/** Wrap rendered body fragments into a self-contained HTML document. */
export function renderDocument(title: string, bodyMarkdown: string): string {
  const safeTitle = escapeHtml(title)
  const body = renderMarkdown(bodyMarkdown)
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle}</title>
<style>${STYLE}</style>
</head>
<body>
<h1>${safeTitle}</h1>
${body}
</body>
</html>
`
}

/** Strip markdown syntax to a plain-text summary. */
export function toPlainText(md: string): string {
  return md
    .replace(/\r\n/g, '\n')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n')
}
