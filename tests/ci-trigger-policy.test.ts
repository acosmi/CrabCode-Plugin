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
    expect(workflow).toContain('actions/workflows/ci.yml/runs?branch=main&per_page=100')
    expect(workflow).not.toContain('actions/workflows/ci.yml/runs?branch=main&event=push')
  })
})
