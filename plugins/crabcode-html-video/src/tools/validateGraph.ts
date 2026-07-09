import { validate, topoSort, totalDurationSec, type ContentGraph } from '@crabcode/content-graph'
import { ok, fail, type Envelope } from '../envelope.ts'

export const name = 'validateGraph'
export const description =
  'Validate a content-graph (storyboard IR): node ids, edges, dependency cycles; return topo-sorted play order and total duration.'

export const inputSchema = {
  type: 'object',
  properties: {
    graph: {
      type: 'object',
      description: 'ContentGraph JSON (schemaVersion:1, intent, nodes, edges)',
    },
  },
  required: ['graph'],
}

export async function handler(args: { graph?: ContentGraph }): Promise<Envelope> {
  if (!args?.graph || typeof args.graph !== 'object') {
    return fail('invalid_args', 'graph object is required')
  }
  const result = validate(args.graph)
  if (!result.ok) {
    return fail('validation_failed', 'content-graph validation failed', result)
  }
  try {
    const order = topoSort(args.graph)
    const durationSec = totalDurationSec(args.graph)
    return ok({ ...result, order, durationSec })
  } catch (e) {
    return fail('topo_failed', e instanceof Error ? e.message : String(e))
  }
}
