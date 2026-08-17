import { describe, expect, test } from 'bun:test'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { PINNED_CHROME_VERSION, resolveBrowserPath } from './browser.ts'

// The stub has to be spawnable as argv[0]; a shebang script is the cheapest way
// to get that, which is why the source-specific cases are POSIX-only. The
// invariant case at the end runs everywhere, against whatever the machine has.
const posixTest = test.skipIf(process.platform === 'win32')

const RESOLUTION_ENV = [
  'HYPERFRAMES_BROWSER_PATH',
  'PRODUCER_HEADLESS_SHELL_PATH',
  'PUPPETEER_EXECUTABLE_PATH',
  'CHROME_PATH',
  'CRABCODE_PLUGIN_DATA',
  'PATH',
]

/** Resolve against only what the case sets up, never the developer's real browser. */
function withResolutionEnv<T>(overrides: Record<string, string>, run: () => T): T {
  const saved = RESOLUTION_ENV.map((key) => [key, process.env[key]] as const)
  try {
    for (const key of RESOLUTION_ENV) delete process.env[key]
    Object.assign(process.env, overrides)
    return run()
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

function writeChromeStub(path: string): string {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `#!/bin/sh\necho "Chromium ${PINNED_CHROME_VERSION}"\n`, { mode: 0o755 })
  chmodSync(path, 0o755)
  return path
}

interface ResolutionCase {
  source: 'env' | 'cache' | 'system'
  setUp: (root: string) => { overrides: Record<string, string>; cacheDir: string }
}

const CASES: ResolutionCase[] = [
  {
    source: 'env',
    setUp: (root) => ({
      overrides: { HYPERFRAMES_BROWSER_PATH: writeChromeStub(join(root, 'chrome')) },
      cacheDir: join(root, 'absent'),
    }),
  },
  {
    source: 'cache',
    setUp: (root) => {
      writeChromeStub(join(root, 'cache', PINNED_CHROME_VERSION, 'chrome-headless-shell'))
      return { overrides: {}, cacheDir: join(root, 'cache') }
    },
  },
  {
    source: 'system',
    setUp: (root) => {
      writeChromeStub(join(root, 'bin', 'google-chrome'))
      return { overrides: { PATH: join(root, 'bin') }, cacheDir: join(root, 'absent') }
    },
  },
]

describe('browser resolution', () => {
  // doctor reports the browser version line from this probe rather than spawning
  // `chrome --version` a second time, so every source that can return a path has
  // to carry the probe that qualified it.
  for (const { source, setUp } of CASES) {
    posixTest(`a ${source}-resolved browser carries the probe that qualified it`, () => {
      const root = mkdtempSync(join(tmpdir(), 'crab-browser-resolve-'))
      try {
        const { overrides, cacheDir } = setUp(root)
        const resolved = withResolutionEnv(overrides, () => resolveBrowserPath(cacheDir))

        expect(resolved.source).toBe(source)
        expect(resolved.path).toBeTruthy()
        expect(resolved.probe).toEqual({ ok: true, versionLine: `Chromium ${PINNED_CHROME_VERSION}` })
      } finally {
        rmSync(root, { recursive: true, force: true })
      }
    })
  }

  test('a resolved path is never returned without its probe', () => {
    const root = mkdtempSync(join(tmpdir(), 'crab-browser-invariant-'))
    try {
      const resolved = resolveBrowserPath(root)
      if (resolved.path) {
        expect(resolved.probe?.ok).toBe(true)
        expect(typeof resolved.probe?.versionLine).toBe('string')
      } else {
        expect(resolved.probe).toBeNull()
      }
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
