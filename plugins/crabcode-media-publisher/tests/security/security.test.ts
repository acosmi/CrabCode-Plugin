import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { articlePreviewDocument } from "../../apps/publisher-app/src/article-preview.ts";
import { importHtmlDocument, renderArticleDocument } from "../../apps/publisher-app/src/editor-document.ts";
import { renderApp } from "../../apps/publisher-app/src/app.ts";

const pluginRoot = resolve(import.meta.dir, "../..");

describe("Hub front-end security boundary", () => {
  test("uses an opaque, privilege-free iframe sandbox", () => {
    const html = renderApp("/app/works/work-8F2C/edit");
    expect(html).toContain('sandbox=""');
    expect(html).toContain('referrerpolicy="no-referrer"');
    expect(html).not.toMatch(/allow-scripts|allow-same-origin/i);
  });

  test("uses a deny-by-default CSP inside article preview", () => {
    expect(articlePreviewDocument).toContain("default-src 'none'");
    expect(articlePreviewDocument.includes("script-src")).toBe(false);
    expect(articlePreviewDocument).toContain("form-action 'none'");
    expect(articlePreviewDocument).not.toMatch(/https?:\/\//i);
  });

  test("keeps imported HTML inert before it reaches the opaque preview", () => {
    const imported = importHtmlDocument('<h1>标题</h1><p>导语</p><script>alert(1)</script><img src="https://evil.invalid/x" onerror="alert(2)"><form action="https://evil.invalid"><input name="token"></form>', "hostile.html");
    const preview = renderArticleDocument(imported);
    expect(preview).toContain("default-src 'none'");
    expect(preview).not.toMatch(/evil\.invalid|<script|onerror|<form|<input/i);
  });

  test("server headers forbid framing and browser capabilities", async () => {
    const server = await readFile(resolve(pluginRoot, "scripts/serve-ui.ts"), "utf8");
    expect(server).toContain('"X-Frame-Options": "DENY"');
    expect(server.includes('"frame-ancestors \'none\'"')).toBe(false);
    expect(server).toContain("frame-ancestors 'none'");
    expect(server).toContain("frame-src 'self' blob:");
    expect(server).toContain("camera=(), microphone=(), geolocation=(), payment=(), usb=()");
    expect(server).not.toMatch(/Access-Control-Allow-Credentials/i);
  });

  test("uses revocable local Blob previews without granting frame privileges", async () => {
    const main = await readFile(resolve(pluginRoot, "apps/publisher-app/src/main.ts"), "utf8");
    expect(main).toContain("URL.createObjectURL");
    expect(main).toContain("URL.revokeObjectURL");
    expect(main).not.toMatch(/postMessage|allow-scripts|allow-same-origin|localStorage|sessionStorage/i);
  });

  test("keeps real publish controls disabled in the fixture", () => {
    const approval = renderApp("/app/batches/batch-20260718-04/review");
    expect(approval).toContain("真实批准已关闭");
    expect(approval).toMatch(/使用强身份批准[\s\S]*?<\/button>/);
    expect(approval).toContain("disabled aria-disabled=\"true\"");
  });
});
