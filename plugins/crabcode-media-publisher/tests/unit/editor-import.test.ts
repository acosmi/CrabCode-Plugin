import { describe, expect, test } from "bun:test";
import { applyEditorFormat } from "../../apps/publisher-app/src/editor-actions.ts";
import {
  canonicalEditorDraft,
  detectImportFormat,
  importHtmlDocument,
  importMarkdownDocument,
  MAX_IMPORT_BYTES,
  renderArticleDocument,
  renderArticleMarkdown,
  renderEditorArtifacts,
  renderMarkdownFragment
} from "../../apps/publisher-app/src/editor-document.ts";

describe("local editor document pipeline", () => {
  test("derives deterministic HTML and Markdown from one draft", () => {
    const first = renderEditorArtifacts(canonicalEditorDraft);
    for (let index = 0; index < 100; index += 1) expect(renderEditorArtifacts(canonicalEditorDraft)).toEqual(first);
    expect(first.html).toContain(canonicalEditorDraft.title);
    expect(first.html).toContain(canonicalEditorDraft.summary);
    expect(first.markdown).toContain(canonicalEditorDraft.title);
    expect(first.markdown).toContain(canonicalEditorDraft.summary);
    expect(first.html).toContain("一个事实源，多个真正独立的发布项");
    expect(first.markdown).toContain("一个事实源，多个真正独立的发布项");
  });

  test("drops raw HTML, remote images and active links from Markdown preview", () => {
    const hostile = `# 标题\n\n<script>alert(1)</script>\n<img src="https://evil.invalid/a.png" onerror="alert(2)">\n[外链](javascript:alert(3))\n![远程图](https://evil.invalid/b.png)\n\n**安全正文**`;
    const fragment = renderMarkdownFragment(hostile);
    const imported = importMarkdownDocument(hostile, "hostile.md");
    const artifacts = renderEditorArtifacts(imported);
    expect(fragment).toContain("安全正文");
    expect(fragment).not.toMatch(/script|onerror|javascript:|evil\.invalid|<img|<a\b/i);
    expect(`${artifacts.html}\n${artifacts.markdown}`).not.toMatch(/script|onerror|javascript:|evil\.invalid|<img|<a\b/i);
    expect(imported.verificationStatus).toBe("pending_review");
    expect(artifacts.html).toContain("来源待补充与核验");
    expect(artifacts.html).not.toContain("作者：傅**");
  });

  test("imports Markdown into title, summary and body fields", () => {
    const draft = importMarkdownDocument("# 导入标题\n\n这是导语。\n\n## 第一节\n\n正文 **重点**。", "brief.md");
    expect(draft).toEqual({
      title: "导入标题",
      summary: "这是导语。",
      bodyMarkdown: "## 第一节\n\n正文 **重点**。",
      sourceFormat: "markdown",
      sourceName: "brief.md",
      authorName: "待补充",
      sourceCount: 0,
      disclosure: "导入文稿尚未完成作者、事实来源与 AI 辅助使用情况复核。",
      verificationStatus: "pending_review"
    });
    expect(renderArticleDocument(draft)).toContain("<h2>第一节</h2>");
    expect(renderArticleMarkdown(draft)).toContain("# 导入标题");
  });

  test("sanitizes HTML before extracting an editable Markdown body", () => {
    const draft = importHtmlDocument(`<!doctype html><html><head><title>备用标题</title><script>alert(1)</script></head><body><nav><p>导航噪声</p></nav><article><h1>安全标题</h1><p class="dek" onclick="steal()">安全导语<style>样式词</style></p><h2>结构标题</h2><p>正文 <strong>重点</strong><img src="https://evil.invalid/p.png" onerror="steal()"></p><iframe src="https://evil.invalid">框架词</iframe><ol><li>第一项</li></ol><h4>四级标题</h4><p>字面 **不是加粗** 与 [链接语法](javascript:alert(1))</p><table><thead><tr><th>列</th></tr></thead><tbody><tr><td>值</td></tr></tbody></table></article></body></html>`, "source.html");
    expect(draft.title).toBe("安全标题");
    expect(draft.summary).toBe("安全导语");
    expect(draft.bodyMarkdown).toContain("## 结构标题");
    expect(draft.bodyMarkdown).toContain("**重点**");
    expect(draft.bodyMarkdown).toContain("1. 第一项");
    expect(draft.bodyMarkdown).toContain("#### 四级标题");
    expect(draft.bodyMarkdown).toContain("\\*\\*不是加粗\\*\\*");
    expect(draft.bodyMarkdown).toMatch(/\|\s*列\s*\|[\s\S]*\|\s*-+\s*\|/);
    expect(draft.bodyMarkdown).not.toContain("导航噪声");
    expect(`${draft.summary}\n${draft.bodyMarkdown}`).not.toMatch(/样式词|框架词/);
    const wrapped = importHtmlDocument(`<noscript><main><article><h1>伪标题</h1><p>伪导语</p></article></main></noscript><article><h1>真实标题</h1><p>真实导语</p></article>`, "wrapped.html");
    expect(wrapped.title).toBe("真实标题");
    expect(wrapped.summary).toBe("真实导语");
    expect(importHtmlDocument(`<h1>${"标".repeat(80)}</h1><p>${"导".repeat(200)}</p>`, "long.html").title).toHaveLength(64);
    expect(importHtmlDocument(`<h1>${"标".repeat(80)}</h1><p>${"导".repeat(200)}</p>`, "long.html").summary).toHaveLength(160);
    const artifacts = renderEditorArtifacts(draft);
    expect(`${artifacts.html}\n${artifacts.markdown}`).not.toMatch(/onclick|onerror|iframe|evil\.invalid|<script/i);
  });

  test("recognizes only the supported local document formats", () => {
    expect(detectImportFormat("draft.md")).toBe("markdown");
    expect(detectImportFormat("draft.markdown")).toBe("markdown");
    expect(detectImportFormat("draft.html")).toBe("html");
    expect(detectImportFormat("draft.htm")).toBe("html");
    expect(detectImportFormat("draft.txt")).toBeNull();
    expect(detectImportFormat("draft.md", "text/html")).toBeNull();
    expect(detectImportFormat("draft.exe", "text/markdown")).toBeNull();
    expect(MAX_IMPORT_BYTES).toBe(256 * 1024);
  });
});

describe("Markdown toolbar transformations", () => {
  test("formats a selected range as bold", () => {
    expect(applyEditorFormat("这里是重点内容", 3, 5, "bold")).toEqual({
      value: "这里是**重点**内容",
      selectionStart: 5,
      selectionEnd: 7
    });
  });

  test("formats complete lines as headings, quotes and lists", () => {
    expect(applyEditorFormat("第一行\n第二行", 0, 7, "heading-2").value).toBe("## 第一行\n## 第二行");
    expect(applyEditorFormat("观点", 0, 2, "quote").value).toBe("> 观点");
    expect(applyEditorFormat("事项", 0, 2, "bullet-list").value).toBe("- 事项");
  });
});
