export type Envelope =
  | { success: true; status?: string; data?: unknown; message?: string }
  | { success: false; status: 'error'; error: { code: string; message: string; details?: unknown } }

export function toToolResult(env: Envelope): {
  content: Array<{ type: 'text'; text: string }>
  structuredContent: Record<string, unknown>
  isError?: boolean
} {
  return {
    content: [{ type: 'text', text: JSON.stringify(env, null, 2) }],
    structuredContent: env as unknown as Record<string, unknown>,
    isError: env.success ? undefined : true,
  }
}

export function ok(data?: unknown, message?: string): Envelope {
  return { success: true, status: 'ok', data, message }
}

export function fail(code: string, message: string, details?: unknown): Envelope {
  return { success: false, status: 'error', error: { code, message, details } }
}
