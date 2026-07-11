import { describe, expect, test } from 'bun:test'
import {
  SIDECAR_ENVIRONMENT_MARKER,
  isAllowedSidecarEnvironmentName,
  sanitizeSidecarEnvironment,
  unexpectedCredentialEnvironmentNames,
  unexpectedSidecarEnvironmentNames,
} from '../src/environmentIsolation.ts'

describe('sidecar environment isolation', () => {
  test('rebuilds the environment from the allowlist and keeps only exact worker tokens', () => {
    const environment: Record<string, string | undefined> = {
      PATH: '/usr/bin',
      HOME: '/tmp/home',
      LC_MESSAGES: 'zh_CN.UTF-8',
      CRABCODE_PLUGIN_ROOT: '/plugin',
      CRABCODE_PLUGIN_UPSTREAM_CRED: 'opaque-secret',
      OPAQUE_VALUE: 'opaque-secret',
      CRABCODE_HTML_VIDEO_RENDER_MODE: 'remote',
      HTML_VIDEO_WORKER_TOKEN: 'worker-secret',
      VENDOR_API_KEY: 'vendor-secret',
      MODEL_PROVIDER_API_KEY: 'model-secret',
      AWS_ACCESS_KEY_ID: 'cloud-secret',
      AWS_SECRET_ACCESS_KEY: 'cloud-secret',
      CRABCODE_PLUGIN_VENDOR_API_KEY: 'must-not-bypass-prefix',
      CRABCODE_PLUGIN_MODEL_VENDOR_KEY: 'must-not-bypass-prefix',
      CRABCODE_PLUGIN_SESSION_TOKEN: 'must-not-bypass-prefix',
      NODE_OPTIONS: '--require=/tmp/host-code.js',
      HTTPS_PROXY: 'https://user:password@example.invalid',
      [SIDECAR_ENVIRONMENT_MARKER]: 'spoofed',
    }

    sanitizeSidecarEnvironment(environment)

    expect(environment).toEqual({
      PATH: '/usr/bin',
      HOME: '/tmp/home',
      LC_MESSAGES: 'zh_CN.UTF-8',
      CRABCODE_PLUGIN_ROOT: '/plugin',
      CRABCODE_HTML_VIDEO_RENDER_MODE: 'remote',
      HTML_VIDEO_WORKER_TOKEN: 'worker-secret',
      [SIDECAR_ENVIRONMENT_MARKER]: '1',
    })
    expect(unexpectedCredentialEnvironmentNames(environment)).toEqual([])
    expect(unexpectedSidecarEnvironmentNames(environment)).toEqual([])
  })

  test('credential exceptions are exact names, never arbitrary prefixes', () => {
    expect(isAllowedSidecarEnvironmentName('CRABCODE_HTML_VIDEO_PRODUCER_TOKEN')).toBe(true)
    expect(isAllowedSidecarEnvironmentName('HTML_VIDEO_WORKER_TOKEN')).toBe(true)
    expect(isAllowedSidecarEnvironmentName('HYPERFRAMES_BROWSER_PATH')).toBe(true)
    expect(isAllowedSidecarEnvironmentName('HYPERFRAMES_VENDOR_API_KEY')).toBe(false)
    expect(isAllowedSidecarEnvironmentName('CRABCODE_PLUGIN_MODEL_VENDOR_API_KEY')).toBe(false)
    expect(isAllowedSidecarEnvironmentName('CRABCODE_PLUGIN_MODEL_VENDOR_KEY')).toBe(false)
    expect(isAllowedSidecarEnvironmentName('CRABCODE_PLUGIN_UPSTREAM_CRED')).toBe(false)
    expect(isAllowedSidecarEnvironmentName('OPAQUE_VALUE')).toBe(false)
    expect(isAllowedSidecarEnvironmentName('SOME_OTHER_WORKER_TOKEN')).toBe(false)
  })
})
