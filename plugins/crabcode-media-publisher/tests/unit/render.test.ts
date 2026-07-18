import { describe, expect, test } from "bun:test";
import { renderApp } from "../../apps/publisher-app/src/app.ts";
import { escapeHtml } from "../../apps/publisher-app/src/components.ts";
import { routes } from "../../apps/publisher-app/src/routes.ts";
import { articlePreviewDocument, articlePreviewMarkdown } from "../../apps/publisher-app/src/article-preview.ts";

describe("Hub deterministic renderer", () => {
  test("renders every declared route without leaking remote assets", () => {
    for (const [path, route] of Object.entries(routes)) {
      const html = renderApp(path);
      expect(html).toContain(`<main id="main-content"`);
      expect(html).toContain(`data-page-title="${route.title}`);
      expect(html).not.toMatch(/https?:\/\//i);
      expect(html).not.toMatch(/allow-scripts|allow-same-origin/i);
    }
  });

  test("escapes all HTML metacharacters", () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')">&`)).toBe("&lt;img src=x onerror=&quot;alert(&#039;x&#039;)&quot;&gt;&amp;");
  });

  test("renders byte-identically across repeated calls", () => {
    const first = renderApp("/app/batches/batch-20260718-04");
    for (let index = 0; index < 100; index += 1) expect(renderApp("/app/batches/batch-20260718-04")).toBe(first);
  });

  test("fails closed on an unknown route", () => {
    const html = renderApp("/app/not-real");
    expect(html).toContain("页面不存在");
    expect(html).not.toContain("立即发布所有");
  });

  test("keeps the default HTML and Markdown backup on the same visible fixture", () => {
    for (const text of [
      "多平台分发，不该只是把同一篇文章复制八遍",
      "一个事实源，多个真正独立的发布项",
      "成功必须有远端证据",
      "AI 辅助整理"
    ]) {
      expect(articlePreviewDocument).toContain(text);
      expect(articlePreviewMarkdown).toContain(text);
    }
    expect(articlePreviewDocument).toContain("HTML 是默认阅读交付，Markdown 为同一草稿派生的安全备份");
    expect(articlePreviewMarkdown).toContain("HTML 是默认阅读交付，Markdown 为同一草稿派生的安全备份");
  });
});
