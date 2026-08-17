import { defineConfig } from "@playwright/test";

const defaultMacChromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const chromePath = process.env.CRABPUBLISH_CHROME_PATH
  ?? (process.platform === "darwin" ? defaultMacChromePath : undefined);
const snapshotPlatform = process.env.CRABPUBLISH_SNAPSHOT_PLATFORM ?? "chrome-150-macos";
const testPort = Number.parseInt(process.env.CRABPUBLISH_TEST_PORT ?? "4197", 10);
if (!Number.isInteger(testPort) || testPort < 1024 || testPort > 65535) {
  throw new Error("CRABPUBLISH_TEST_PORT must be an integer between 1024 and 65535");
}
const baseURL = `http://127.0.0.1:${testPort}`;

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "**/*.pw.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: "list",
  outputDir: "test-results/playwright",
  snapshotPathTemplate: `{testDir}/snapshots/${snapshotPlatform}/{arg}{ext}`,
  expect: {
    timeout: 15_000,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      scale: "css",
      threshold: 0.1,
      maxDiffPixelRatio: 0.002
    }
  },
  use: {
    baseURL,
    browserName: "chromium",
    headless: true,
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    deviceScaleFactor: 1,
    colorScheme: "light",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: chromePath ? { executablePath: chromePath } : {}
  },
  webServer: {
    command: "bun run preview",
    url: `${baseURL}/app`,
    env: { CRABPUBLISH_UI_PORT: String(testPort) },
    timeout: 30_000,
    reuseExistingServer: false
  }
});
