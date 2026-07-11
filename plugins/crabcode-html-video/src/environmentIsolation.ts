/**
 * Environment boundary for the HTML-video MCP sidecar.
 *
 * The host may hold model/provider credentials. The renderer must never inherit
 * them. Keep this module dependency-free: it is bundled into the tiny bootstrap
 * and runs before the MCP/renderer bundle is imported.
 */

const RUNTIME_ENVIRONMENT_NAMES = [
  'PATH',
  'HOME',
  'TMPDIR',
  'TMP',
  'TEMP',
  'USER',
  'LOGNAME',
  'LANG',
  'LANGUAGE',
  'LC_ALL',
  'LC_CTYPE',
  'LC_ADDRESS',
  'LC_COLLATE',
  'LC_IDENTIFICATION',
  'LC_MEASUREMENT',
  'LC_MESSAGES',
  'LC_MONETARY',
  'LC_NAME',
  'LC_NUMERIC',
  'LC_PAPER',
  'LC_TELEPHONE',
  'LC_TIME',
  'TZ',
  'TERM',
  'COLORTERM',
  'NO_COLOR',
  'FORCE_COLOR',
  'SYSTEMROOT',
  'WINDIR',
  'COMSPEC',
  'PATHEXT',
  'USERPROFILE',
  'LOCALAPPDATA',
  'XDG_CACHE_HOME',
  'XDG_CONFIG_HOME',
  'XDG_RUNTIME_DIR',
  'SSL_CERT_FILE',
  'SSL_CERT_DIR',
  'NODE_EXTRA_CA_CERTS',
] as const

const HTML_VIDEO_CONFIGURATION_NAMES = [
  'CRABCODE_PLUGIN_ROOT',
  'CRABCODE_PLUGIN_DATA',
  'CRABCODE_HTML_VIDEO_DATA',
  'CRABCODE_HTML_VIDEO_AUDIO_ROOTS',
  'CRABCODE_HTML_VIDEO_MAX_CONCURRENT_RENDERS',
  'CRABCODE_HTML_VIDEO_PREVIEW_TIMEOUT_MS',
  'CRABCODE_HTML_VIDEO_WALL_TIMEOUT_MS',
  'CRABCODE_HTML_VIDEO_RENDER_MODE',
  'CRABCODE_HTML_VIDEO_PRODUCER_URL',
  'CRABCODE_CHROME_MIRROR',
  'CRABCODE_FFMPEG_PATH',
  'CRABCODE_FFPROBE_PATH',
  'HYPERFRAMES_BROWSER_PATH',
  'HYPERFRAMES_FFMPEG_PATH',
  'HYPERFRAMES_FFPROBE_PATH',
  'HYPERFRAMES_FONT_CACHE_DIR',
  'HYPERFRAMES_DEBUG_GPU_PROBE',
  'PRODUCER_HEADLESS_SHELL_PATH',
  'PRODUCER_BEGINFRAME_PROBE_TIMEOUT_MS',
  'PRODUCER_DEBUG_SEEK_DIAGNOSTICS',
  'PRODUCER_DISABLE_HEALTH_WORKER',
  'PRODUCER_EXPERIMENTAL_FAST_CAPTURE',
  'PRODUCER_MAX_CONCURRENT_RENDERS',
  'PRODUCER_OUTPUT_ARTIFACT_TTL_MS',
  'PRODUCER_RENDER_SEEK_STEP',
  'PRODUCER_RUNTIME_RENDER_SEEK_MODE',
  'PRODUCER_RUNTIME_RENDER_SEEK_OFFSET_FRACTION',
  'PUPPETEER_EXECUTABLE_PATH',
  'CHROME_PATH',
  'FFMPEG_PATH',
  'FFPROBE_PATH',
] as const

/** These are the only secrets deliberately admitted into the renderer. */
export const WORKER_TOKEN_ENVIRONMENT_NAMES = [
  'CRABCODE_HTML_VIDEO_PRODUCER_TOKEN',
  'CRABCODE_HTML_VIDEO_WORKER_TOKEN',
  'HTML_VIDEO_WORKER_TOKEN',
] as const

export const SIDECAR_ENVIRONMENT_MARKER = 'CRABCODE_HTML_VIDEO_ENV_SANITIZED'

const exactAllowedNames = new Set<string>([
  ...RUNTIME_ENVIRONMENT_NAMES,
  ...HTML_VIDEO_CONFIGURATION_NAMES,
  ...WORKER_TOKEN_ENVIRONMENT_NAMES,
])
const exactWorkerTokenNames = new Set<string>(WORKER_TOKEN_ENVIRONMENT_NAMES)

// Defense in depth for status reporting. The actual admission decision below
// is an exact allowlist, so even an opaque credential alias is removed.
const CREDENTIAL_SHAPED_NAME =
  /(?:^|_)(?:API_?KEY|ACCESS_?KEY(?:_ID)?|KEY(?:_ID)?|SECRET(?:_?ACCESS)?(?:_?KEY)?|PRIVATE_?KEY|CLIENT_?SECRET|PASSWORD|PASSWD|AUTH_?TOKEN|SESSION_?TOKEN|BEARER|CREDENTIALS?)(?:$|_)/i

export type EnvironmentRecord = Record<string, string | undefined>

export function isCredentialShapedEnvironmentName(name: string): boolean {
  return CREDENTIAL_SHAPED_NAME.test(name) || /(?:^|_)TOKEN(?:$|_)/i.test(name)
}

export function isAllowedSidecarEnvironmentName(name: string): boolean {
  if (exactWorkerTokenNames.has(name)) return true
  if (isCredentialShapedEnvironmentName(name)) return false
  return exactAllowedNames.has(name)
}

/**
 * Rebuild process.env in place so Bun/Node keep their special environment
 * object while every non-allowlisted inherited entry is removed.
 */
export function sanitizeSidecarEnvironment(environment: EnvironmentRecord): void {
  const allowedEntries = Object.entries(environment).filter(
    ([name, value]) => value !== undefined && isAllowedSidecarEnvironmentName(name),
  ) as Array<[string, string]>

  for (const name of Object.keys(environment)) delete environment[name]
  for (const [name, value] of allowedEntries) environment[name] = value

  // Never trust an inherited marker; it is recreated only after the sweep.
  environment[SIDECAR_ENVIRONMENT_MARKER] = '1'
}

export function unexpectedCredentialEnvironmentNames(
  environment: EnvironmentRecord = process.env,
): string[] {
  return Object.keys(environment)
    .filter(
      (name) =>
        isCredentialShapedEnvironmentName(name) && !exactWorkerTokenNames.has(name),
    )
    .sort()
}

export function unexpectedSidecarEnvironmentNames(
  environment: EnvironmentRecord = process.env,
): string[] {
  return Object.keys(environment)
    .filter(
      (name) =>
        name !== SIDECAR_ENVIRONMENT_MARKER &&
        name !== 'PRODUCER_HYPERFRAME_MANIFEST_PATH' &&
        !isAllowedSidecarEnvironmentName(name),
    )
    .sort()
}

export function sidecarEnvironmentIsolationStatus(
  environment: EnvironmentRecord = process.env,
): {
  sanitized: boolean
  unexpectedCredentialNames: string[]
  unexpectedEnvironmentNames: string[]
} {
  return {
    sanitized: environment[SIDECAR_ENVIRONMENT_MARKER] === '1',
    unexpectedCredentialNames: unexpectedCredentialEnvironmentNames(environment),
    unexpectedEnvironmentNames: unexpectedSidecarEnvironmentNames(environment),
  }
}
