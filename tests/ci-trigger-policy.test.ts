import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dir, '..')

function topLevelTriggerLines(workflow: string): string[] {
  const lines = workflow.replace(/\r\n?/g, '\n').split('\n')
  const start = lines.indexOf('on:')
  expect(start).toBeGreaterThanOrEqual(0)

  const triggerLines: string[] = []
  for (const line of lines.slice(start + 1)) {
    if (line !== '' && !line.startsWith(' ') && !line.startsWith('\t')) break
    if (line.trim() !== '' && !line.trimStart().startsWith('#')) {
      triggerLines.push(line.trim())
    }
  }
  return triggerLines
}

describe('manual CI trigger policy', () => {
  test('keeps repository CI API-dispatched and free of automatic events', () => {
    const workflow = readFileSync(join(root, '.github', 'workflows', 'ci.yml'), 'utf8')
    expect(topLevelTriggerLines(workflow)).toEqual(['workflow_dispatch: {}'])
    expect(workflow).toContain(
      'POST /repos/acosmi/CrabCode-Plugin/actions/workflows/ci.yml/dispatches',
    )
  })

  test('keeps the mirror audit compatible with manually dispatched CI runs', () => {
    const workflow = readFileSync(
      join(root, '.github', 'workflows', 'notify-mirror.yml'),
      'utf8',
    )
    expect(workflow).toContain(
      'actions/workflows/ci.yml/runs?branch=main&event=workflow_dispatch&per_page=100',
    )
    expect(workflow).not.toContain('actions/workflows/ci.yml/runs?branch=main&event=push')
    expect(workflow).not.toContain('FRESHNESS_SLO_SECONDS')
    expect(workflow).not.toContain('publication-grace-')
    expect(workflow).toContain('dispatch_guard:')
    expect(workflow).toContain('needs: dispatch_guard')
    expect(workflow).toContain('Fail closed instead of reporting a skipped-success audit')
    expect(workflow).toContain('DISPATCH_SHA: ${{ github.sha }}')
    expect(workflow).toContain('git/ref/heads/main')
    expect(workflow).toContain('main advanced without exact CI')
    expect(workflow).toContain('refs/heads/main:refs/remotes/origin/main')
    expect(workflow).toContain('origin/main advanced to ${FINAL_MAIN} during mirror audit')
    expect(workflow).toContain('build-deterministic-mirror-archive.py')
    expect(workflow).toContain('--existing-archive "${WORK}/${SHA}.zip"')
  })

  test('binds mirror publication to exact manual CI and immutable archive bytes', () => {
    const workflow = readFileSync(
      join(root, '.github', 'workflows', 'publish-safe-to-cn-mirror.yml'),
      'utf8',
    )
    expect(workflow).toContain('ci_run_id:')
    expect(workflow).toContain('expected_sha:')
    expect(workflow).toContain('validate-mirror-release-gate.py')
    expect(workflow).toContain('mcp-remediation-tested-${EXPECTED_SHA}')
    expect(workflow).toContain('validate-local-test-attestation.py')
    expect(workflow).toContain('must be an annotated tag')
    expect(workflow).toContain('validate-retired-publisher.py')
    expect(workflow).toContain('refs/heads/main:refs/remotes/origin/main')
    expect(workflow).toContain('--existing-archive "${WORK}/${SHA}.zip"')
    expect(workflow).toContain('merge-base --is-ancestor')
    expect(workflow).toContain('does not byte-match the canonical local archive')
    expect(workflow).not.toContain('zip -ry')
    expect(workflow).toContain('dispatch_guard:')
    expect(workflow).toContain('needs: dispatch_guard')
    expect(workflow).toContain('skipped-success release')

    const immutableReady = workflow.indexOf('immutable ${SHA}.zip + checksum are publicly ready')
    const pointerSwitch = workflow.indexOf('latest 指针已切换')
    const projectionUpload = workflow.indexOf('non-authoritative marketplace projection uploaded')
    expect(immutableReady).toBeGreaterThanOrEqual(0)
    expect(pointerSwitch).toBeGreaterThan(immutableReady)
    expect(projectionUpload).toBeGreaterThan(pointerSwitch)
    expect(workflow).toContain('现有 rrsync/static-file 合同不提供多文件 transaction')
  })

  test('runs actionlint over both workflow filename suffixes', () => {
    const workflow = readFileSync(join(root, '.github', 'workflows', 'ci.yml'), 'utf8')
    expect(workflow).toContain("-name '*.yml' -o -name '*.yaml'")
  })

  test('keeps the declared Python 3.9 PDF cell dependency-resolvable', () => {
    const workflow = readFileSync(join(root, '.github', 'workflows', 'ci.yml'), 'utf8')
    expect(workflow).toContain('3.9) PDFPLUMBER_VERSION=0.11.7')
    expect(workflow).toContain('3.13) PDFPLUMBER_VERSION=0.11.9')
    expect(workflow).toContain('"pdfplumber==${PDFPLUMBER_VERSION}"')
  })
})
