import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { articlePreviewDocument } from "../../apps/publisher-app/src/article-preview.ts";
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

  test("server headers forbid framing and browser capabilities", async () => {
    const server = await readFile(resolve(pluginRoot, "scripts/serve-ui.ts"), "utf8");
    expect(server).toContain('"X-Frame-Options": "DENY"');
    expect(server.includes('"frame-ancestors \'none\'"')).toBe(false);
    expect(server).toContain("frame-ancestors 'none'");
    expect(server).toContain("camera=(), microphone=(), geolocation=(), payment=(), usb=()");
    expect(server).not.toMatch(/Access-Control-Allow-Credentials/i);
  });

  test("keeps real publish controls disabled in the fixture", () => {
    const approval = renderApp("/app/batches/batch-20260718-04/review");
    expect(approval).toContain("真实批准已关闭");
    expect(approval).toMatch(/使用强身份批准[\s\S]*?<\/button>/);
    expect(approval).toContain("disabled aria-disabled=\"true\"");
  });
});
