import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { articlePreviewDocument } from "../../apps/publisher-app/src/article-preview.ts";

const routes = [
  "/app",
  "/app/works",
  "/app/works/work-8F2C/edit",
  "/app/works/work-8F2C/variants",
  "/app/batches/new",
  "/app/batches/batch-20260718-04/review",
  "/app/batches/batch-20260718-04",
  "/app/accounts",
  "/app/audit",
  "/app/settings/edge",
  "/app/qa/edge-cases"
] as const;

async function open(page: Page, route: string, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  const response = await page.goto(route, { waitUntil: "load" });
  expect(response?.status()).toBe(200);
  await page.evaluate(async () => {
    await document.fonts.ready;
    document.documentElement.dataset.visualReady = "true";
  });
  await expect(page.locator("main")).toBeVisible();
  const articlePreview = page.locator("#article-preview");
  if (await articlePreview.count()) {
    await expect(articlePreview.contentFrame().locator("article")).toBeVisible();
  }
}

function contrastRatio(foreground: readonly number[], background: readonly number[]): number {
  const luminance = (rgb: readonly number[]): number => {
    const channels = rgb.map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0);
  };
  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (light + 0.05) / (dark + 0.05);
}

test.beforeEach(async ({ page, browser }) => {
  expect(browser.version()).toBe("150.0.7871.116");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1") return route.abort("blockedbyclient");
    return route.continue();
  });
});

test("all primary routes pass axe WCAG 2.2 AA", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const route of routes) {
    await open(page, route, 1440, 900);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations, `${route}: ${JSON.stringify(results.violations, null, 2)}`).toEqual([]);
    if (route.endsWith("/edit")) {
      const colors = await page.locator("#editor-body").evaluate((element) => {
        const style = getComputedStyle(element);
        return { foreground: style.color, background: style.backgroundColor };
      });
      expect(colors).toEqual({ foreground: "rgb(15, 23, 42)", background: "rgb(248, 250, 252)" });
      expect(contrastRatio([15, 23, 42], [248, 250, 252])).toBeGreaterThanOrEqual(4.5);
    }
    const actionableIncomplete = results.incomplete.filter((result) => {
      if (result.id === "frame-tested") return false; // opaque iframe is checked independently below
      if (route.endsWith("/edit") && result.id === "color-contrast") {
        return !result.nodes.every((node) => node.target.flat().includes("#editor-body")
          && node.any.some((check) => check.data && typeof check.data === "object"
            && "messageKey" in check.data && check.data.messageKey === "elmPartiallyObscured"));
      }
      return true;
    });
    expect(actionableIncomplete, `${route} incomplete: ${JSON.stringify(actionableIncomplete, null, 2)}`).toEqual([]);
  }
});

test("isolated article preview independently passes axe", async ({ page }) => {
  await page.setContent(articlePreviewDocument, { waitUntil: "load" });
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  expect(results.incomplete, JSON.stringify(results.incomplete, null, 2)).toEqual([]);
});

test("editor embeds the styled canonical HTML artifact in an opaque local frame", async ({ page }) => {
  await open(page, "/app/works/work-8F2C/edit", 390, 844);
  const preview = page.locator("#article-preview");
  await expect(preview).toHaveAttribute("sandbox", "");
  await expect(preview).toHaveAttribute("referrerpolicy", "no-referrer");
  await expect(preview).toHaveAttribute("src", "/article-preview.html");
  const frame = preview.contentFrame();
  await expect(frame.getByRole("heading", { level: 1 })).toHaveText("多平台分发，不该只是把同一篇文章复制八遍");
  const presentation = await frame.locator("body").evaluate((body) => {
    const heading = document.querySelector("h1");
    return {
      bodyBackground: getComputedStyle(body).backgroundColor,
      bodyColor: getComputedStyle(body).color,
      headingColor: heading ? getComputedStyle(heading).color : "missing"
    };
  });
  expect(presentation).toEqual({
    bodyBackground: "rgb(255, 255, 255)",
    bodyColor: "rgb(15, 23, 42)",
    headingColor: "rgb(15, 23, 42)"
  });
  await expect(preview).toHaveScreenshot("article-preview-frame-390.png");
});

test("loopback server enforces headers, methods and Host allowlist", async ({ request }) => {
  const deepLink = await request.get("/app/works/work-8F2C/edit");
  expect(deepLink.status()).toBe(200);
  expect(deepLink.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(deepLink.headers()["x-frame-options"]).toBe("DENY");
  expect(deepLink.headers()["referrer-policy"]).toBe("no-referrer");

  const preview = await request.get("/article-preview.html");
  expect(preview.status()).toBe(200);
  expect(preview.headers()["content-security-policy"]).toContain("default-src 'none'");
  expect(preview.headers()["content-security-policy"]).toContain("frame-ancestors 'self'");
  expect(preview.headers()["x-frame-options"]).toBe("SAMEORIGIN");

  const mutation = await request.post("/app");
  expect(mutation.status()).toBe(405);

  const rebound = await request.get("/app", { headers: { Host: "attacker.invalid" } });
  expect(rebound.status()).toBe(421);
  expect(await rebound.text()).toBe("Misdirected Request");
});

test("keyboard navigation, local save status and mobile menu work", async ({ page }) => {
  await open(page, "/app/works/work-8F2C/edit", 820, 1180);
  await page.locator("#editor-summary").fill("会话内真实保存检查");
  await page.getByRole("button", { name: "保存本页草稿" }).click();
  await expect(page.locator("#save-state")).toContainText("本页会话草稿已保存");
  await page.getByRole("link", { name: "冻结并生成变体" }).click();
  await page.goBack();
  await expect(page.locator("#editor-summary")).toHaveValue("会话内真实保存检查");
  await expect(page.locator("#save-state")).toContainText("本页会话草稿已恢复");
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus-visible")).toBeVisible();
  await open(page, "/app", 320, 568);
  const menu = page.getByRole("button", { name: "打开主导航" });
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#sidebar")).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator("#sidebar a").first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toBeFocused();
  await expect(page.locator("#sidebar")).toHaveAttribute("aria-hidden", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

const goldens = [
  { name: "dashboard-1440", route: "/app", width: 1440, height: 900 },
  { name: "dashboard-820", route: "/app", width: 820, height: 1180 },
  { name: "dashboard-320", route: "/app", width: 320, height: 568 },
  { name: "editor-1440", route: "/app/works/work-8F2C/edit", width: 1440, height: 900 },
  { name: "editor-820", route: "/app/works/work-8F2C/edit", width: 820, height: 1180 },
  { name: "editor-390", route: "/app/works/work-8F2C/edit", width: 390, height: 844 },
  { name: "variants-blocked-1440", route: "/app/works/work-8F2C/variants", width: 1440, height: 900 },
  { name: "variants-blocked-820", route: "/app/works/work-8F2C/variants", width: 820, height: 1180 },
  { name: "variants-blocked-390", route: "/app/works/work-8F2C/variants", width: 390, height: 844 },
  { name: "batch-new-1440", route: "/app/batches/new", width: 1440, height: 900 },
  { name: "batch-new-390", route: "/app/batches/new", width: 390, height: 844 },
  { name: "approval-stale-1440", route: "/app/batches/batch-20260718-04/review", width: 1440, height: 900 },
  { name: "approval-stale-820", route: "/app/batches/batch-20260718-04/review", width: 820, height: 1180 },
  { name: "approval-stale-390", route: "/app/batches/batch-20260718-04/review", width: 390, height: 844 },
  { name: "batch-partial-1440", route: "/app/batches/batch-20260718-04", width: 1440, height: 900 },
  { name: "batch-partial-820", route: "/app/batches/batch-20260718-04", width: 820, height: 1180 },
  { name: "batch-partial-390", route: "/app/batches/batch-20260718-04", width: 390, height: 844 },
  { name: "accounts-1440", route: "/app/accounts", width: 1440, height: 900 },
  { name: "accounts-820", route: "/app/accounts", width: 820, height: 1180 },
  { name: "accounts-390", route: "/app/accounts", width: 390, height: 844 },
  { name: "edge-offline-1440", route: "/app/settings/edge", width: 1440, height: 900 },
  { name: "edge-offline-820", route: "/app/settings/edge", width: 820, height: 1180 },
  { name: "edge-offline-390", route: "/app/settings/edge", width: 390, height: 844 },
  { name: "audit-redacted-1440", route: "/app/audit", width: 1440, height: 900 },
  { name: "audit-redacted-820", route: "/app/audit", width: 820, height: 1180 },
  { name: "audit-redacted-390", route: "/app/audit", width: 390, height: 844 },
  { name: "edge-cases-1440", route: "/app/qa/edge-cases", width: 1440, height: 900 },
  { name: "edge-cases-390", route: "/app/qa/edge-cases", width: 390, height: 844 }
] as const;

for (const golden of goldens) {
  test(`visual ${golden.name}`, async ({ page }) => {
    await open(page, golden.route, golden.width, golden.height);
    await expect(page).toHaveScreenshot(`${golden.name}.png`, { fullPage: true });
  });
}

test("visual article-print-a4", async ({ page }) => {
  await page.setViewportSize({ width: 794, height: 1123 });
  await page.emulateMedia({ media: "print", colorScheme: "light", reducedMotion: "reduce" });
  await page.setContent(articlePreviewDocument, { waitUntil: "load" });
  await expect(page).toHaveScreenshot("article-print-a4.png", { fullPage: true });
});

test("all routes reflow without root horizontal overflow at 820 and 320 CSS pixels", async ({ page }) => {
  test.setTimeout(60_000);
  for (const width of [820, 320]) {
    for (const route of routes) {
      await open(page, route, width, 900);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${route} at ${width}px`).toBe(true);
    }
  }
});

test("white theme remains white under dark preference and 200/400% equivalent reflow", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  for (const width of [640, 320]) {
    await open(page, "/app/works/work-8F2C/edit", width, 900);
    const palette = await page.evaluate(() => ({
      html: getComputedStyle(document.documentElement).backgroundColor,
      body: getComputedStyle(document.body).backgroundColor,
      main: getComputedStyle(document.querySelector<HTMLElement>("main")!).backgroundColor,
      canvas: getComputedStyle(document.querySelector<HTMLElement>(".editor-canvas")!).backgroundColor,
      iframe: getComputedStyle(document.querySelector<HTMLIFrameElement>("iframe")!).backgroundColor,
      sidebar: getComputedStyle(document.querySelector<HTMLElement>(".sidebar")!).backgroundColor,
      inspector: getComputedStyle(document.querySelector<HTMLElement>(".inspector")!).backgroundColor,
      secondaryButtonBorder: getComputedStyle(document.querySelector<HTMLElement>(".button-secondary")!).borderTopWidth,
      controlBorderWidth: getComputedStyle(document.querySelector<HTMLElement>("#editor-summary")!).borderTopWidth,
      controlBorderColor: getComputedStyle(document.querySelector<HTMLElement>("#editor-summary")!).borderTopColor
    }));
    expect(palette).toEqual({
      html: "rgb(255, 255, 255)",
      body: "rgb(255, 255, 255)",
      main: "rgb(255, 255, 255)",
      canvas: "rgb(255, 255, 255)",
      iframe: "rgb(255, 255, 255)",
      sidebar: "rgb(245, 247, 250)",
      inspector: "rgb(248, 250, 252)",
      secondaryButtonBorder: "0px",
      controlBorderWidth: "1px",
      controlBorderColor: "rgb(135, 149, 168)"
    });
    expect(contrastRatio([135, 149, 168], [255, 255, 255])).toBeGreaterThanOrEqual(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
});

test("forced colors restores essential boundaries for the borderless visual theme", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await open(page, "/app/works/work-8F2C/edit", 390, 844);
  const boundaries = await page.evaluate(() => [".mobile-menu", "#editor-summary", "#article-preview"]
    .map((selector) => {
      const style = getComputedStyle(document.querySelector<HTMLElement>(selector)!);
      return { selector, width: style.borderTopWidth, style: style.borderTopStyle };
    }));
  expect(boundaries).toEqual([
    { selector: ".mobile-menu", width: "1px", style: "solid" },
    { selector: "#editor-summary", width: "1px", style: "solid" },
    { selector: "#article-preview", width: "1px", style: "solid" }
  ]);
  await page.locator("#editor-summary").focus();
  const focus = await page.locator("#editor-summary").evaluate((element) => {
    const style = getComputedStyle(element);
    return { style: style.outlineStyle, width: style.outlineWidth };
  });
  expect(focus).toEqual({ style: "solid", width: "3px" });

  await open(page, "/app/qa/edge-cases", 1440, 900);
  const highRiskBoundaries = await page.evaluate(() => [".fail-closed-card", ".edge-state-card"]
    .map((selector) => {
      const style = getComputedStyle(document.querySelector<HTMLElement>(selector)!);
      return { selector, width: style.borderTopWidth, style: style.borderTopStyle };
    }));
  expect(highRiskBoundaries).toEqual([
    { selector: ".fail-closed-card", width: "1px", style: "solid" },
    { selector: ".edge-state-card", width: "1px", style: "solid" }
  ]);

  await open(page, "/app/batches/batch-20260718-04", 390, 844);
  const resultBoundaries = await page.evaluate(() => [".result-summary div", ".result-table tr"]
    .map((selector) => {
      const style = getComputedStyle(document.querySelector<HTMLElement>(selector)!);
      return { selector, width: style.borderTopWidth, style: style.borderTopStyle };
    }));
  expect(resultBoundaries).toEqual([
    { selector: ".result-summary div", width: "1px", style: "solid" },
    { selector: ".result-table tr", width: "1px", style: "solid" }
  ]);
});
