import tokens from '../../themes/editorial-white/tokens.json' with { type: 'json' }

export const THEME_ID = `${tokens.id}@${tokens.version}`
export const TEMPLATE_ID = 'article-semantic@2'
export const STYLE_POLICY_VERSION = 'editorial-white@1'
export const SANITIZATION_POLICY_VERSION = 'mediaops-html-safe@2'
export const RENDERER_VERSION = 'mediaops-unified@2'

export const EDITORIAL_WHITE_CSS = `
:root { color-scheme: light; background: ${tokens.pageBackground}; }
html, body, main, article, header, footer, section, .article-body { background: ${tokens.pageBackground}; }
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
body {
  margin: 0;
  color: ${tokens.textPrimary};
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
  font-size: ${tokens.bodyFontSize};
  line-height: ${tokens.bodyLineHeight};
  line-break: strict;
  word-break: normal;
  overflow-wrap: break-word;
}
.article-shell { width: 100%; min-height: 100vh; padding: 48px 24px 64px; }
.media-article { width: min(100%, ${tokens.contentMaxWidth}); margin: 0 auto; }
.article-header { margin: 0 0 48px; padding: 0 0 24px; border-bottom: 1px solid ${tokens.borderStrong}; }
h1 { margin: 0; color: ${tokens.textPrimary}; font-size: ${tokens.titleFontSize}; line-height: 1.25; font-weight: 700; letter-spacing: -0.02em; }
.article-deck { margin: 16px 0 0; color: ${tokens.textSecondary}; font-size: 18px; line-height: 1.7; }
.article-body > :first-child { margin-top: 0; }
.article-body p { margin: 0 0 ${tokens.paragraphGap}; }
h2 { margin: 48px 0 20px; padding-left: 12px; border-left: 4px solid ${tokens.accent}; color: ${tokens.textPrimary}; font-size: ${tokens.heading2FontSize}; line-height: 1.4; font-weight: 700; }
h3 { margin: 36px 0 16px; color: ${tokens.textPrimary}; font-size: ${tokens.heading3FontSize}; line-height: 1.5; font-weight: 650; }
h4 { margin: 28px 0 12px; font-size: 18px; line-height: 1.55; }
a { color: ${tokens.link}; text-decoration: underline; text-underline-offset: 0.18em; overflow-wrap: anywhere; }
a:focus-visible { outline: 3px solid ${tokens.accent}; outline-offset: 3px; }
strong { font-weight: 700; }
blockquote { margin: 28px 0; padding: 4px 0 4px 20px; border-left: 4px solid ${tokens.accent}; color: ${tokens.textPrimary}; background: ${tokens.surfaceBackground}; }
blockquote > :last-child { margin-bottom: 0; }
ul, ol { margin: 0 0 24px; padding-left: 1.5em; }
li + li { margin-top: 8px; }
pre, code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; }
code { padding: 0.12em 0.32em; border: 1px solid #D0D5DD; border-radius: 4px; background: ${tokens.surfaceBackground}; font-size: 0.92em; }
pre { max-width: 100%; margin: 28px 0; padding: 16px; overflow-x: auto; border: 1px solid ${tokens.borderStrong}; border-radius: 8px; background: ${tokens.surfaceBackground}; line-height: 1.65; }
pre code { padding: 0; border: 0; }
.table-scroll { max-width: 100%; margin: 28px 0; overflow-x: auto; }
.table-scroll:focus-visible { outline: 3px solid ${tokens.accent}; outline-offset: 3px; }
table { width: 100%; border-collapse: collapse; font-size: 15px; }
th, td { padding: 10px 12px; border: 1px solid ${tokens.borderStrong}; text-align: left; vertical-align: top; }
th { font-weight: 700; background: ${tokens.surfaceBackground}; }
figure { margin: 32px 0; }
figure img { display: block; max-width: 100%; height: auto; margin: 0 auto; }
figcaption { margin-top: 10px; color: ${tokens.textSecondary}; font-size: 14px; line-height: 1.6; text-align: center; }
hr { margin: 48px 0; border: 0; border-top: 1px solid ${tokens.borderStrong}; }
.article-footer { margin-top: 56px; padding-top: 24px; border-top: 1px solid ${tokens.borderStrong}; }
.article-footer h2 { margin-top: 0; font-size: 20px; }
.article-footer, .article-footer p, .article-footer li { color: ${tokens.textSecondary}; font-size: 14px; line-height: 1.7; }
@media (max-width: 600px) {
  body { font-size: ${tokens.mobileBodyFontSize}; line-height: ${tokens.mobileBodyLineHeight}; }
  .article-shell { padding: 28px 20px 48px; }
  .article-header { margin-bottom: 36px; }
  h1 { font-size: ${tokens.mobileTitleFontSize}; }
  h2 { margin-top: 40px; font-size: ${tokens.mobileHeading2FontSize}; }
  h3 { font-size: 19px; }
}
@media print {
  @page { margin: 18mm; }
  html, body, main, article, header, footer, section, .article-body { background: #FFFFFF !important; }
  .article-shell { min-height: 0; padding: 0; }
  .media-article { width: 100%; max-width: none; }
  h1, h2, h3, h4 { break-after: avoid-page; }
  figure, blockquote, pre, table { break-inside: avoid-page; }
  a { color: ${tokens.textPrimary}; text-decoration: underline; }
}
`.trim()

export const WECHAT_STYLES = {
  article: `background:#FFFFFF;color:${tokens.textPrimary};font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;font-size:16px;line-height:1.8;`,
  h1: `margin:0 0 24px;color:${tokens.textPrimary};font-size:28px;line-height:1.3;font-weight:700;`,
  h2: `margin:40px 0 18px;padding-left:10px;border-left:4px solid ${tokens.accent};color:${tokens.textPrimary};font-size:22px;line-height:1.45;font-weight:700;`,
  h3: `margin:30px 0 14px;color:${tokens.textPrimary};font-size:19px;line-height:1.5;font-weight:700;`,
  p: `margin:0 0 1.2em;color:${tokens.textPrimary};font-size:16px;line-height:1.8;`,
  a: `color:${tokens.link};text-decoration:underline;`,
  blockquote: `margin:24px 0;padding:4px 0 4px 18px;border-left:4px solid ${tokens.accent};background:#FFFFFF;color:${tokens.textPrimary};`,
  list: `margin:0 0 22px;padding-left:1.5em;`,
  figure: `margin:28px 0;`,
  img: `display:block;max-width:100%;height:auto;margin:0 auto;`,
  figcaption: `margin-top:8px;color:${tokens.textSecondary};font-size:14px;line-height:1.6;text-align:center;`,
  tableWrap: `max-width:100%;margin:24px 0;overflow-x:auto;`,
  table: `width:100%;border-collapse:collapse;font-size:14px;`,
  cell: `padding:8px 10px;border:1px solid ${tokens.borderStrong};text-align:left;vertical-align:top;`,
  pre: `max-width:100%;margin:24px 0;padding:14px;overflow-x:auto;border:1px solid ${tokens.borderStrong};border-radius:6px;background:#FFFFFF;line-height:1.65;`,
  code: `font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;overflow-wrap:anywhere;`,
  hr: `margin:36px 0;border:0;border-top:1px solid ${tokens.borderStrong};`,
  li: `margin-top:6px;`,
  footer: `margin-top:48px;padding-top:20px;border-top:1px solid ${tokens.borderStrong};background:#FFFFFF;color:${tokens.textSecondary};font-size:14px;line-height:1.7;`,
} as const
