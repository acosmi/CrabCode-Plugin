import { toMdast } from "hast-util-to-mdast";
import { toText } from "hast-util-to-text";
import type { Element, Root } from "hast";
import type { Root as MarkdownRoot } from "mdast";
import rehypeParse from "rehype-parse";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import remarkStringify from "remark-stringify";
import { unified } from "unified";

export const MAX_IMPORT_BYTES = 256 * 1024;
export const MAX_EDITOR_BODY_CHARACTERS = 256 * 1024;
export const MAX_DOCUMENT_WORK_UNITS = 300_000;
export const MAX_DOCUMENT_STRUCTURAL_MARKERS = 8_192;
export const MAX_DOCUMENT_LINE_BREAKS = 4_096;
export const MAX_TITLE_CHARACTERS = 64;
export const MAX_SUMMARY_CHARACTERS = 160;

const STRUCTURAL_WORK_WEIGHT = 24;
const STRUCTURAL_CHARACTERS = new Set([
  "\t", "\n", "\r", "&", "*", "_", "[", "]", "(", ")", "{", "}", "<", ">", "#", "|", "~", "`", "\\", "-", "+", ".", "!", ":", "=", ";"
]);

export type ImportFormat = "fixture" | "markdown" | "html";

export type EditorDraft = Readonly<{
  title: string;
  summary: string;
  bodyMarkdown: string;
  sourceFormat: ImportFormat;
  sourceName: string;
  authorName: string;
  sourceCount: number;
  disclosure: string;
  verificationStatus: "fixed_fixture" | "pending_review";
}>;

export type EditorArtifacts = Readonly<{
  html: string;
  markdown: string;
}>;

const pendingImportMetadata = Object.freeze({
  authorName: "待补充",
  sourceCount: 0,
  disclosure: "导入文稿尚未完成作者、事实来源与 AI 辅助使用情况复核。",
  verificationStatus: "pending_review" as const
});

const invalidatedFixtureMetadata = Object.freeze({
  authorName: "待复核",
  sourceCount: 0,
  disclosure: "文稿已修改；作者、事实来源与 AI 辅助使用情况需重新复核。",
  verificationStatus: "pending_review" as const
});

export const canonicalEditorDraft: EditorDraft = Object.freeze({
  title: "多平台分发，不该只是把同一篇文章复制八遍",
  summary: "真正可靠的“一键发布”，不是减少一次点击，而是让每个平台收到适合它、又能追溯到同一事实源的内容。",
  bodyMarkdown: `内容团队很容易把“自动化”理解成复制：同一篇长文，换个标题，依次贴进公众号、微博、头条和百家号。表面上省了时间，实际却把平台差异、账号风险和结果核验都推给了最后一次点击。

## 一个事实源，多个真正独立的发布项

Hub 先冻结内容 revision，再为“平台账号 + 内容类型”生成独立变体。普通微博与微博长博文不是同一个任务；头条文章和微头条也不能只靠截断字符来区分。

> 一键的含义，是一次批准多个已预览的独立发布项，而不是跳过预览与审批。

## 成功必须有远端证据

按钮被点击，只能证明自动化走到了某一步。只有平台返回 ID、公开 URL、草稿回读或审核状态能够被核验时，界面才把结果标记为对应状态。结果未知时，系统先对账，而不是盲目重发。`,
  sourceFormat: "fixture",
  sourceName: "content-rev-017",
  authorName: "傅**",
  sourceCount: 8,
  disclosure: "本文由 AI 辅助整理结构；事实核验、观点判断和最终编辑由作者完成。",
  verificationStatus: "fixed_fixture"
});

const previewSchema = {
  ...defaultSchema,
  tagNames: defaultSchema.tagNames?.filter((tag) => !["a", "img"].includes(tag)),
  attributes: {
    ...defaultSchema.attributes,
    "*": []
  }
};

const importSchema = {
  ...defaultSchema,
  tagNames: Array.from(new Set([...(defaultSchema.tagNames ?? []), "html", "body", "main", "article", "caption"]))
    .filter((tag) => ![
      "audio", "canvas", "embed", "form", "iframe", "input", "link", "meta", "object", "script", "style", "svg", "video"
    ].includes(tag)),
  attributes: {
    "*": [],
    a: ["href"],
    img: ["alt"],
    ol: ["start"],
    th: ["align", "colSpan", "rowSpan"],
    td: ["align", "colSpan", "rowSpan"]
  },
  protocols: { href: ["http", "https"] },
  strip: Array.from(new Set([
    ...(defaultSchema.strip ?? []),
    "audio", "canvas", "embed", "form", "iframe", "input", "link", "meta", "noscript", "object", "script", "style", "svg", "template", "video"
  ]))
};

const markdownProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: false })
  .use(rehypeSanitize, previewSchema)
  .use(rehypeStringify);

const htmlImportProcessor = unified()
  .use(rehypeParse, { fragment: true })
  .use(rehypeSanitize, importSchema);

const markdownBackupProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkStringify, { bullet: "-", fences: true });

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeLine(value: string): string {
  return value.replace(/[\t\n\r ]+/g, " ").trim();
}

function clipLine(value: string, maximum: number): string {
  const clipped = normalizeLine(value).slice(0, maximum);
  return /[\uD800-\uDBFF]$/.test(clipped) ? clipped.slice(0, -1) : clipped;
}

function normalizeDocument(value: string): string {
  return value.replace(/^\uFEFF/, "").replaceAll("\r\n", "\n").replaceAll("\r", "\n").trim();
}

type MutableMarkdownNode = {
  type: string;
  children?: MutableMarkdownNode[];
  value?: string;
  url?: string;
  alt?: string | null;
  depth?: number;
};

function markdownNodeText(nodes: MutableMarkdownNode[]): string {
  return nodes.map((node) => node.value ?? markdownNodeText(node.children ?? [])).join("");
}

function safeWebUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function sanitizeMarkdownChildren(children: MutableMarkdownNode[]): MutableMarkdownNode[] {
  const result: MutableMarkdownNode[] = [];
  for (const node of children) {
    if (["html", "definition", "imageReference"].includes(node.type)) continue;
    if (node.type === "image") {
      const alt = normalizeLine(node.alt ?? "");
      if (alt) result.push({ type: "text", value: `［图片：${alt}］` });
      continue;
    }

    const safeChildren = sanitizeMarkdownChildren(node.children ?? []);
    if (node.type === "link" || node.type === "linkReference") {
      result.push(...safeChildren);
      const url = node.type === "link" ? safeWebUrl(node.url) : null;
      if (url && normalizeLine(markdownNodeText(safeChildren)) !== url) {
        result.push(
          { type: "text", value: " （" },
          { type: "inlineCode", value: url },
          { type: "text", value: "）" }
        );
      }
      continue;
    }

    if (node.children) node.children = safeChildren;
    result.push(node);
  }
  return result;
}

function sanitizeMarkdownTree(tree: MarkdownRoot): MarkdownRoot {
  const mutable = tree as unknown as MutableMarkdownNode;
  mutable.children = sanitizeMarkdownChildren(mutable.children ?? []);
  return tree;
}

function stringifySafeMarkdownTree(tree: MarkdownRoot): string {
  return normalizeDocument(String(markdownBackupProcessor.stringify(sanitizeMarkdownTree(tree))));
}

function sanitizeMarkdownSource(markdown: string): string {
  const tree = markdownBackupProcessor.parse(normalizeDocument(markdown)) as MarkdownRoot;
  return stringifySafeMarkdownTree(tree);
}

function removeFirstMarkdownNode(tree: MarkdownRoot, predicate: (node: MutableMarkdownNode) => boolean): void {
  const root = tree as unknown as MutableMarkdownNode;
  const visit = (parent: MutableMarkdownNode): boolean => {
    const children = parent.children ?? [];
    const directIndex = children.findIndex(predicate);
    if (directIndex >= 0) {
      children.splice(directIndex, 1);
      return true;
    }
    return children.some((child) => visit(child));
  };
  visit(root);
}

function normalizeBodyHeadingLevels(tree: MarkdownRoot): void {
  const visit = (node: MutableMarkdownNode): void => {
    if (node.type === "heading" && node.depth === 1) node.depth = 2;
    for (const child of node.children ?? []) visit(child);
  };
  visit(tree as unknown as MutableMarkdownNode);
}

type MutableHastNode = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: MutableHastNode[];
};

function preserveTableCaptions(root: Root): void {
  const visit = (parent: MutableHastNode): void => {
    const nextChildren: MutableHastNode[] = [];
    for (const child of parent.children ?? []) {
      if (child.type === "element" && child.tagName === "table") {
        const caption = child.children?.find((candidate) => candidate.type === "element" && candidate.tagName === "caption");
        if (caption) {
          const captionText = normalizeLine(toText(caption as unknown as Element));
          if (child.children) child.children = child.children.filter((candidate) => candidate !== caption);
          if (captionText) {
            nextChildren.push({
              type: "element",
              tagName: "p",
              properties: {},
              children: [{ type: "text", value: `表题：${captionText}` }]
            });
          }
        }
      }
      visit(child);
      nextChildren.push(child);
    }
    parent.children = nextChildren;
  };
  visit(root as unknown as MutableHastNode);
}

function findFirstMarkdownNode(tree: MarkdownRoot, predicate: (node: MutableMarkdownNode) => boolean): MutableMarkdownNode | null {
  const visit = (parent: MutableMarkdownNode): MutableMarkdownNode | null => {
    for (const child of parent.children ?? []) {
      if (predicate(child)) return child;
      const nested = visit(child);
      if (nested) return nested;
    }
    return null;
  };
  return visit(tree as unknown as MutableMarkdownNode);
}

function escapeMarkdownPlainText(value: string): string {
  return normalizeLine(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replace(/([\\`*_[\]{}()#+.!|~\-])/g, "\\$1");
}

function sourceEvidenceLabel(draft: EditorDraft): string {
  return draft.verificationStatus === "fixed_fixture"
    ? `${draft.sourceCount} 个固定夹具来源`
    : "来源待补充与核验";
}

function disclosureStatusLabel(draft: EditorDraft): string {
  return draft.verificationStatus === "fixed_fixture" ? "AI 辅助整理已披露" : "AI 辅助披露待复核";
}

function sourceLabel(draft: EditorDraft): string {
  if (draft.sourceFormat === "markdown") return "Markdown 本地导入";
  if (draft.sourceFormat === "html") return "HTML 本地导入";
  return draft.verificationStatus === "fixed_fixture" ? "内容基础稿 · rev-017" : "内容基础稿 · 本页草稿";
}

export function estimateDocumentWorkUnits(source: string): number {
  let units = source.length;
  let structuralMarkers = 0;
  let lineBreaks = 0;
  for (const character of source) {
    if (character === "\n" || character === "\r") lineBreaks += 1;
    if (STRUCTURAL_CHARACTERS.has(character)) {
      structuralMarkers += 1;
      units += STRUCTURAL_WORK_WEIGHT;
    }
    if (units > MAX_DOCUMENT_WORK_UNITS
      || structuralMarkers > MAX_DOCUMENT_STRUCTURAL_MARKERS
      || lineBreaks > MAX_DOCUMENT_LINE_BREAKS) return MAX_DOCUMENT_WORK_UNITS + 1;
  }
  return units;
}

export function isDocumentWithinRealtimeBudget(source: string): boolean {
  return source.length <= MAX_EDITOR_BODY_CHARACTERS
    && estimateDocumentWorkUnits(source) <= MAX_DOCUMENT_WORK_UNITS;
}

function assertDocumentWithinRealtimeBudget(source: string): void {
  if (!isDocumentWithinRealtimeBudget(source)) {
    throw new RangeError("Document exceeds the synchronous editor work budget");
  }
}

export function invalidateDraftVerification(draft: EditorDraft): EditorDraft {
  if (draft.verificationStatus === "pending_review") return draft;
  return Object.freeze({ ...draft, ...invalidatedFixtureMetadata });
}

export function renderMarkdownFragment(markdown: string): string {
  return String(markdownProcessor.processSync(sanitizeMarkdownSource(markdown)));
}

function renderArticleMarkdownFromSafeBody(draft: EditorDraft, body: string): string {
  const title = escapeMarkdownPlainText(draft.title || "未命名内容");
  const summary = escapeMarkdownPlainText(draft.summary);
  const authorName = escapeMarkdownPlainText(draft.authorName);
  const sourceEvidence = escapeMarkdownPlainText(sourceEvidenceLabel(draft));
  const disclosureStatus = escapeMarkdownPlainText(disclosureStatusLabel(draft));
  const disclosure = escapeMarkdownPlainText(draft.disclosure);
  return `# ${title}\n\n${summary}\n\n作者：${authorName}\n来源：${sourceEvidence}\n披露：${disclosureStatus}\n\n${body}\n\n**信息披露：** ${disclosure} HTML 是默认阅读交付，Markdown 为同一草稿派生的安全备份。\n`;
}

export function renderArticleMarkdown(draft: EditorDraft): string {
  return renderArticleMarkdownFromSafeBody(draft, sanitizeMarkdownSource(draft.bodyMarkdown));
}

function renderArticleDocumentFromSafeBody(draft: EditorDraft, safeBodyMarkdown: string): string {
  const title = normalizeLine(draft.title) || "未命名内容";
  const summary = normalizeLine(draft.summary);
  const body = String(markdownProcessor.processSync(safeBodyMarkdown));
  const sourceEvidence = sourceEvidenceLabel(draft);
  const disclosureStatus = disclosureStatusLabel(draft);
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
    <meta name="color-scheme" content="light">
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light; background: #fff; }
      * { box-sizing: border-box; }
      html, body { margin: 0; min-height: 100%; background: #fff !important; color: #0f172a; }
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif; }
      article { width: min(704px, calc(100% - 40px)); margin: 0 auto; padding: 52px 0 72px; background: #fff; }
      .eyebrow { margin: 0 0 16px; color: #1769e0; font-size: 13px; font-weight: 650; letter-spacing: .08em; }
      h1 { margin: 0 0 18px; font-size: clamp(27px, 4vw, 36px); line-height: 1.24; letter-spacing: -.025em; }
      .dek { margin: 0 0 28px; color: #475569; font-size: 18px; line-height: 1.7; }
      .meta { display: flex; flex-wrap: wrap; gap: 8px 16px; margin: 0 0 26px; padding: 14px 16px; border-radius: 12px; background: #f8fafc; color: #475569; font-size: 13px; }
      h2, h3 { margin: 2em 0 .7em; line-height: 1.42; letter-spacing: -.015em; }
      h2 { font-size: 24px; }
      h3 { font-size: 20px; }
      p, li { font-size: 17px; line-height: 1.76; }
      p { margin: 1.05em 0; }
      ul, ol { padding-left: 1.4em; }
      blockquote { margin: 1.6em 0; padding: 16px 20px; border-radius: 12px; background: #eff6ff; color: #334155; }
      blockquote p { margin: 0; }
      pre { overflow: auto; border-radius: 10px; background: #0f172a; color: #f8fafc; padding: 16px; }
      code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      table { width: 100%; border-collapse: collapse; font-size: 15px; }
      th, td { padding: 9px 10px; text-align: left; border-bottom: 1px solid #e2e8f0; }
      .note { margin-top: 32px; padding: 18px 20px; border-radius: 12px; background: #f8fafc; font-size: 14px; line-height: 1.65; }
      @media (max-width: 520px) { article { width: calc(100% - 32px); padding-top: 32px; } p, li { font-size: 16px; } }
      @media print { article { width: 100%; padding: 0; } h1, h2, h3 { break-after: avoid; } }
    </style>
  </head>
  <body>
    <article>
      <p class="eyebrow">${escapeHtml(sourceLabel(draft))}</p>
      <h1>${escapeHtml(title)}</h1>
      <p class="dek">${escapeHtml(summary)}</p>
      <div class="meta"><span>作者：${escapeHtml(draft.authorName)}</span><span>${escapeHtml(sourceEvidence)}</span><span>${escapeHtml(disclosureStatus)}</span></div>
      ${body}
      <div class="note"><strong>信息披露：</strong>${escapeHtml(draft.disclosure)} HTML 是默认阅读交付，Markdown 为同一草稿派生的安全备份。</div>
    </article>
  </body>
</html>`;
}

export function renderArticleDocument(draft: EditorDraft): string {
  return renderArticleDocumentFromSafeBody(draft, sanitizeMarkdownSource(draft.bodyMarkdown));
}

export function renderEditorArtifacts(draft: EditorDraft): EditorArtifacts {
  const safeBodyMarkdown = sanitizeMarkdownSource(draft.bodyMarkdown);
  return Object.freeze({
    html: renderArticleDocumentFromSafeBody(draft, safeBodyMarkdown),
    markdown: renderArticleMarkdownFromSafeBody(draft, safeBodyMarkdown)
  });
}

function findElement(root: Root | Element, tagName: string): Element | null {
  for (const child of root.children) {
    if (child.type !== "element") continue;
    if (child.tagName === tagName) return child;
    const nested = findElement(child, tagName);
    if (nested) return nested;
  }
  return null;
}

function elementText(element: Element | null): string {
  return element ? normalizeLine(toText(element)) : "";
}

function fileStem(fileName: string): string {
  return normalizeLine(fileName.replace(/\.(?:md|markdown|html?|htm)$/i, "")) || "导入文稿";
}

export function importMarkdownDocument(raw: string, fileName: string): EditorDraft {
  assertDocumentWithinRealtimeBudget(raw);
  const markdownTree = sanitizeMarkdownTree(markdownBackupProcessor.parse(normalizeDocument(raw)) as MarkdownRoot);
  const heading = findFirstMarkdownNode(markdownTree, (node) => node.type === "heading" && node.depth === 1);
  const title = clipLine(heading ? markdownNodeText(heading.children ?? []) : fileStem(fileName), MAX_TITLE_CHARACTERS);
  if (heading) removeFirstMarkdownNode(markdownTree, (node) => node === heading);
  const paragraph = findFirstMarkdownNode(markdownTree, (node) => node.type === "paragraph");
  const summary = clipLine(
    paragraph ? markdownNodeText(paragraph.children ?? []) : "从本地 Markdown 导入，等待编辑者补充导语。",
    MAX_SUMMARY_CHARACTERS
  );
  if (paragraph) removeFirstMarkdownNode(markdownTree, (node) => node === paragraph);
  normalizeBodyHeadingLevels(markdownTree);
  const bodyMarkdown = stringifySafeMarkdownTree(markdownTree) || escapeMarkdownPlainText(summary);
  return Object.freeze({
    title,
    summary,
    bodyMarkdown,
    sourceFormat: "markdown",
    sourceName: fileName,
    ...pendingImportMetadata
  });
}

export function importHtmlDocument(raw: string, fileName: string): EditorDraft {
  assertDocumentWithinRealtimeBudget(raw);
  const parsed = unified().use(rehypeParse, { fragment: true }).parse(normalizeDocument(raw)) as Root;
  const sanitizedDocument = htmlImportProcessor.runSync(parsed) as Root;
  const mainElement = findElement(sanitizedDocument, "main");
  const rawContentRoot = mainElement
    ? findElement(mainElement, "article") ?? mainElement
    : findElement(sanitizedDocument, "article") ?? findElement(sanitizedDocument, "body");
  const contentRoot: Root = {
    type: "root",
    children: rawContentRoot?.children ?? sanitizedDocument.children
  };
  preserveTableCaptions(contentRoot);
  const titleElement = findElement(contentRoot, "h1");
  const summaryElement = findElement(contentRoot, "p");
  const title = clipLine(elementText(titleElement) || fileStem(fileName), MAX_TITLE_CHARACTERS);
  const summaryText = elementText(summaryElement) || "从本地 HTML 导入，等待编辑者补充导语。";
  const summary = clipLine(summaryText, MAX_SUMMARY_CHARACTERS);
  const markdownTree = toMdast(contentRoot) as MarkdownRoot;
  if (titleElement) removeFirstMarkdownNode(markdownTree, (node) => node.type === "heading" && node.depth === 1);
  if (summaryElement) removeFirstMarkdownNode(markdownTree, (node) => node.type === "paragraph");
  normalizeBodyHeadingLevels(markdownTree);
  const bodyMarkdown = stringifySafeMarkdownTree(markdownTree) || escapeMarkdownPlainText(summary);
  return Object.freeze({
    title,
    summary,
    bodyMarkdown,
    sourceFormat: "html",
    sourceName: fileName,
    ...pendingImportMetadata
  });
}

export function detectImportFormat(fileName: string, mimeType = ""): "markdown" | "html" | null {
  const lowerName = fileName.toLowerCase();
  const lowerType = mimeType.toLowerCase();
  const extensionFormat = lowerName.endsWith(".md") || lowerName.endsWith(".markdown")
    ? "markdown"
    : lowerName.endsWith(".html") || lowerName.endsWith(".htm")
      ? "html"
      : null;
  if (!extensionFormat) return null;
  const declaredFormat = lowerType === "text/markdown" ? "markdown" : lowerType === "text/html" ? "html" : null;
  return declaredFormat && declaredFormat !== extensionFormat ? null : extensionFormat;
}

export function importEditorDocument(raw: string, fileName: string, format: "markdown" | "html"): EditorDraft {
  return format === "markdown" ? importMarkdownDocument(raw, fileName) : importHtmlDocument(raw, fileName);
}
