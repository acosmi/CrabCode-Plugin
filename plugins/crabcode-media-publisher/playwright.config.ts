import { defineConfig } from "@playwright/test";

const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "**/*.pw.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: "list",
  outputDir: "test-results/playwright",
  snapshotPathTemplate: "{testDir}/snapshots/chrome-150-macos/{arg}{ext}",
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
    baseURL: "http://127.0.0.1:4197",
    browserName: "chromium",
    headless: true,
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    deviceScaleFactor: 1,
    colorScheme: "light",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: { executablePath: chromePath }
  },
  webServer: {
    command: "CRABPUBLISH_UI_PORT=4197 bun run preview",
    url: "http://127.0.0.1:4197/app",
    timeout: 30_000,
    reuseExistingServer: false
  }
});
