/**
 * Unified return envelope for every mediaops tool.
 *
 * Every tool resolves to an Envelope so the agent gets a stable, machine-readable
 * shape regardless of success/failure. MCP tools serialize the envelope as JSON
 * into a single text content block.
 */

export type EnvelopeStatus = 'ok' | 'action_required' | 'blocked' | 'error'

export type Envelope<T = unknown> = {
  success: boolean
  status: EnvelopeStatus
  data?: T
  error?: { code: string; message: string }
  warnings?: string[]
}

export function ok<T>(data: T, warnings?: string[]): Envelope<T> {
  const env: Envelope<T> = { success: true, status: 'ok', data }
  if (warnings && warnings.length) env.warnings = warnings
  return env
}

export function actionRequired<T>(data: T, warnings?: string[]): Envelope<T> {
  const env: Envelope<T> = { success: true, status: 'action_required', data }
  if (warnings && warnings.length) env.warnings = warnings
  return env
}

export function blocked<T>(data: T, warnings?: string[]): Envelope<T> {
  const env: Envelope<T> = { success: false, status: 'blocked', data }
  if (warnings && warnings.length) env.warnings = warnings
  return env
}

export function err(code: string, message: string, warnings?: string[]): Envelope<never> {
  const env: Envelope<never> = { success: false, status: 'error', error: { code, message } }
  if (warnings && warnings.length) env.warnings = warnings
  return env
}

/** Wrap an envelope into the MCP tool result shape. */
export function toToolResult(envelope: Envelope): {
  content: { type: 'text'; text: string }[]
} {
  return { content: [{ type: 'text', text: JSON.stringify(envelope) }] }
}
