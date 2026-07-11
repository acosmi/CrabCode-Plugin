import { validate, topoSort, totalDurationSec, type ContentGraph } from '@crabcode/content-graph'
import { ok, fail, type Envelope } from '../envelope.ts'
import { validateGraphInputSchema, validationMessage } from '../contracts.ts'

export const name = 'validateGraph'
export const description =
  'Validate a content-graph (storyboard IR): node ids, edges, dependency cycles; return topo-sorted play order and total duration.'

export const inputSchema = validateGraphInputSchema
export const annotations = {
  title: 'Validate Video Content Graph',
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
}

export async function handler(raw: unknown): Promise<Envelope> {
  const parsed = inputSchema.safeParse(raw)
  if (!parsed.success) return fail('invalid_args', validationMessage(parsed.error))
  const graph = parsed.data.graph as ContentGraph
  const result = validate(graph)
  if (!result.ok) {
    return fail('validation_failed', 'content-graph validation failed', result)
  }
  try {
    const order = topoSort(graph)
    const durationSec = totalDurationSec(graph)
    return ok({ ...result, order, durationSec })
  } catch (e) {
    return fail('topo_failed', e instanceof Error ? e.message : String(e))
  }
}
