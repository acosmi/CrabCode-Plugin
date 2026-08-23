import { describe, expect, test } from 'bun:test'
import {
  matchesRequiredChromiumVersion,
  requiredChromiumVersion,
} from '../src/qa/delivery-qa.ts'

describe('delivery QA Chromium platform contract', () => {
  test('pins the exact product version reported by each supported platform', () => {
    expect(requiredChromiumVersion('darwin')).toBe('149.0.7827.55')
    expect(requiredChromiumVersion('linux')).toBe('149.0.7827.0')
  })

  test('rejects a wrong patch and every unreviewed platform', () => {
    expect(matchesRequiredChromiumVersion('149.0.7827.0', 'darwin')).toBe(false)
    expect(matchesRequiredChromiumVersion('149.0.7827.55', 'linux')).toBe(false)
    expect(() => requiredChromiumVersion('win32')).toThrow(
      'qa_infrastructure_failed: unsupported Chromium QA platform win32',
    )
  })
})
