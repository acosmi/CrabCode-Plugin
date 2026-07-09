import { describe, expect, test } from 'bun:test'
import { validate, topoSort, totalDurationSec, type ContentGraph } from './index.ts'

describe('content-graph', () => {
  test('validates and topo-sorts sequence graph', () => {
    const g: ContentGraph = {
      schemaVersion: 1,
      intent: 'explainer',
      nodes: [
        { id: 'a', kind: 'text', text: 'A', durationSec: 2 },
        { id: 'b', kind: 'text', text: 'B', durationSec: 3 },
      ],
      edges: [{ from: 'a', to: 'b', kind: 'sequence' }],
    }
    expect(validate(g).ok).toBe(true)
    expect(topoSort(g)).toEqual(['a', 'b'])
    expect(totalDurationSec(g)).toBe(5)
  })

  test('detects dependency cycle', () => {
    const g: ContentGraph = {
      schemaVersion: 1,
      intent: 'other',
      nodes: [
        { id: 'a', kind: 'text', text: 'A' },
        { id: 'b', kind: 'text', text: 'B' },
      ],
      edges: [
        { from: 'a', to: 'b', kind: 'dependency' },
        { from: 'b', to: 'a', kind: 'dependency' },
      ],
    }
    const r = validate(g)
    expect(r.ok).toBe(false)
    expect(r.errors.some((e) => e.code === 'cycle')).toBe(true)
  })

  test('contrast edges do not block sort', () => {
    const g: ContentGraph = {
      schemaVersion: 1,
      intent: 'comparison',
      nodes: [
        { id: 'a', kind: 'text', text: 'A' },
        { id: 'b', kind: 'text', text: 'B' },
      ],
      edges: [{ from: 'a', to: 'b', kind: 'contrast' }],
    }
    expect(validate(g).ok).toBe(true)
    expect(topoSort(g).length).toBe(2)
  })
})
