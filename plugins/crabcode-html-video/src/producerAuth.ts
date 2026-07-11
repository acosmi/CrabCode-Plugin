/**
 * Render-worker authentication is deliberately separate from model/provider
 * credentials. Never return or log the configured token itself.
 */
export function producerTokenConfigured(): boolean {
  return Boolean(resolveProducerToken())
}

export function producerRequestHeaders(): Record<string, string> | undefined {
  const token = resolveProducerToken()
  return token ? { authorization: `Bearer ${token}` } : undefined
}

function resolveProducerToken(): string {
  return (
    process.env.CRABCODE_HTML_VIDEO_PRODUCER_TOKEN ||
    process.env.CRABCODE_HTML_VIDEO_WORKER_TOKEN ||
    process.env.HTML_VIDEO_WORKER_TOKEN ||
    ''
  ).trim()
}
