import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  testMatch: '**/*.pw.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // The full fail-closed delivery QA test drives Nu (JVM) + Chromium + axe end to
  // end; its wall time swings with runner load (observed 14.6s / 23.4s / 30.4s) and
  // once hit 30.4s — past Playwright's 30s default, a pure timeout, not an assertion
  // failure (the same work gets 180s under `test:qa`). 120s leaves ample headroom;
  // fast golden-screenshot tests finish in <2s regardless.
  timeout: 120_000,
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
  outputDir: 'test-results/playwright',
  snapshotPathTemplate: `{testDir}/__screenshots__/${process.platform}/{arg}{ext}`,
  expect: {
    timeout: 15_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      threshold: 0,
      maxDiffPixels: 0,
    },
  },
  use: {
    browserName: 'chromium',
    headless: true,
    locale: 'zh-CN',
    timezoneId: 'UTC',
    deviceScaleFactor: 1,
    colorScheme: 'light',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
