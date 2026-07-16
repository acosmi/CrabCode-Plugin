import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { runDeliveryQa } from '../../src/qa/delivery-qa.ts'
import { writeReleaseFixture } from '../../src/qa/release-fixture.ts'
import type { QaArtifactRef } from '../../src/qa/types.ts'

async function verifyArtifact(ref: QaArtifactRef): Promise<void> {
  const bytes = await readFile(ref.absolutePath)
  expect(bytes.byteLength).toBe(ref.byteSize)
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(ref.sha256)
}

test('runs the full fail-closed delivery QA and returns verifiable evidence', async () => {
  const artifactRoot = await mkdtemp(join(tmpdir(), 'mediaops-delivery-qa-'))
  try {
    const fixture = await writeReleaseFixture(artifactRoot)
    const result = await runDeliveryQa(fixture.artifactRoot, fixture.htmlRelativePath)
    expect(result.status, result.errors.join('\n')).toBe('passed')
    expect(result.tools.playwright).toBe('1.61.1')
    expect(result.tools.axe).toBe('4.12.1')
    expect(result.tools.vnuPackage).toBe('26.7.15')
    expect(result.tools.vnuRuntime).toContain('26.7.15')
    expect(result.tools.chromium).toBeTruthy()
    expect(result.evidence.length).toBeGreaterThanOrEqual(13)
    expect(result.checks.every((check) => check.status === 'passed')).toBe(true)

    for (const ref of [result.html, result.reports.nu, result.reports.browser, result.reports.summary, ...result.evidence]) {
      await verifyArtifact(ref)
      expect(ref.relativePath.startsWith('qa/') || ref.relativePath === 'article.html').toBe(true)
    }

    const browserReport = JSON.parse(await readFile(result.reports.browser.absolutePath, 'utf8')) as {
      viewportRuns: Array<{ width: number; colorScheme: string }>
      printRuns: Array<{ format: string; inspection: { passed: boolean; pageCount: number; mediaBoxes: unknown[] } }>
      stressRuns: Array<{ id: string }>
    }
    expect(browserReport.viewportRuns.map((run) => `${run.width}-${run.colorScheme}`).sort()).toEqual([
      '1440-dark', '1440-light', '320-dark', '320-light', '375-dark', '375-light', '768-dark', '768-light',
    ])
    expect(browserReport.printRuns.map((run) => run.format)).toEqual(['A4', 'Letter'])
    expect(browserReport.printRuns.every((run) => run.inspection.passed && run.inspection.pageCount > 0 && run.inspection.mediaBoxes.length === run.inspection.pageCount)).toBe(true)
    expect(browserReport.stressRuns.map((run) => run.id)).toEqual(['wcag-text-spacing', 'text-200-percent'])
    expect(result.checks.find((check) => check.id === 'html-unchanged-during-qa')?.status).toBe('passed')
  } finally {
    await rm(artifactRoot, { recursive: true, force: true })
  }
})

test('records explicit failed reports when Java and Chromium are unavailable', async () => {
  const artifactRoot = await mkdtemp(join(tmpdir(), 'mediaops-delivery-qa-missing-tools-'))
  const previousJava = process.env.MEDIAOPS_QA_JAVA
  const previousChromium = process.env.MEDIAOPS_QA_CHROMIUM_EXECUTABLE
  process.env.MEDIAOPS_QA_JAVA = '/definitely-missing/mediaops-java'
  process.env.MEDIAOPS_QA_CHROMIUM_EXECUTABLE = '/definitely-missing/mediaops-chromium'
  try {
    const fixture = await writeReleaseFixture(artifactRoot)
    const result = await runDeliveryQa(fixture.artifactRoot, fixture.htmlRelativePath)
    expect(result.status).toBe('failed')
    expect(result.tools.java).toBeNull()
    expect(result.tools.chromium).toBeNull()
    expect(result.errors.join('\n')).toContain('Java executable unavailable')
    // Chromium launch/connect failures are classified as infrastructure, not content defects.
    expect(result.errors.join('\n')).toMatch(/qa_infrastructure_failed|Playwright Chromium QA could not complete/)
    await verifyArtifact(result.reports.nu)
    await verifyArtifact(result.reports.browser)
    await verifyArtifact(result.reports.summary)
  } finally {
    if (previousJava === undefined) delete process.env.MEDIAOPS_QA_JAVA
    else process.env.MEDIAOPS_QA_JAVA = previousJava
    if (previousChromium === undefined) delete process.env.MEDIAOPS_QA_CHROMIUM_EXECUTABLE
    else process.env.MEDIAOPS_QA_CHROMIUM_EXECUTABLE = previousChromium
    await rm(artifactRoot, { recursive: true, force: true })
  }
})
