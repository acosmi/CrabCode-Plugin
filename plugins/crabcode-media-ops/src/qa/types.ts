export type QaStatus = 'passed' | 'failed'

export type QaArtifactRef = {
  relativePath: string
  absolutePath: string
  mediaType: string
  byteSize: number
  sha256: string
}

export type QaCheckResult = {
  id: string
  status: QaStatus
  detail: string
  evidence?: string[]
}

export type QaToolVersions = {
  java: string | null
  vnuPackage: string
  vnuRuntime: string | null
  playwright: string
  chromium: string | null
  axe: string
}

export type DeliveryQaResult = {
  schemaVersion: 'mediaops-delivery-qa-result@1'
  status: QaStatus
  artifactRoot: string
  html: QaArtifactRef
  tools: QaToolVersions
  checks: QaCheckResult[]
  reports: {
    nu: QaArtifactRef
    browser: QaArtifactRef
    summary: QaArtifactRef
  }
  evidence: QaArtifactRef[]
  errors: string[]
}
