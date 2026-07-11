export interface ToolContext {
  signal?: AbortSignal
}

export function boundedWallTimeoutMs(
  envName: string,
  fallback: number,
  maximum = 30 * 60_000,
): number {
  const configured = Number(process.env[envName] || '')
  if (!Number.isFinite(configured) || configured <= 0) return fallback
  return Math.min(Math.floor(configured), maximum)
}

export function renderCancellation(
  parent: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal; dispose: () => void } {
  const controller = new AbortController()
  const abortFromParent = () => controller.abort(parent?.reason ?? new Error('render cancelled by caller'))
  if (parent?.aborted) abortFromParent()
  else parent?.addEventListener('abort', abortFromParent, { once: true })

  const timer = setTimeout(
    () => controller.abort(new Error(`render wall timeout after ${timeoutMs}ms`)),
    timeoutMs,
  )
  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timer)
      parent?.removeEventListener('abort', abortFromParent)
    },
  }
}
