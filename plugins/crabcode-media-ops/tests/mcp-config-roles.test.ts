import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isSecondHumanGate, toolRolePolicies } from '../src/identity.ts'

/**
 * The role list the host injects is a literal in `.mcp.json`, and identity.ts is
 * where roles are actually defined. A literal that drifts from the definition
 * fails in exactly the way that is hardest to see: a governed tool starts
 * answering AUTHORIZATION_DENIED with no configuration having changed.
 *
 * So the expected list is derived here from the exported policy table rather
 * than transcribed: every role some governed tool demands, minus the roles that
 * only second-real-human gates demand. Those gates stay pending by design in
 * local-editorial mode, and granting their roles to the single local principal
 * would suggest a separation of duties that does not exist.
 */
const config = JSON.parse(readFileSync(join(import.meta.dir, '..', '.mcp.json'), 'utf8'))
const env: Record<string, string> = config.mcpServers.mediaops.env

function rolesInFirstAppearanceOrder(): string[] {
  const order: string[] = []
  const onlyRequiredByGates = new Map<string, boolean>()
  for (const { tool, role } of toolRolePolicies()) {
    if (!order.includes(role)) order.push(role)
    const gate = isSecondHumanGate(tool)
    onlyRequiredByGates.set(role, (onlyRequiredByGates.get(role) ?? true) && gate)
  }
  return order.filter((role) => onlyRequiredByGates.get(role) === false)
}

describe('.mcp.json injected roles', () => {
  test('the literal equals the roles derived from identity.ts', () => {
    expect(env.MEDIAOPS_TRUSTED_PRINCIPAL_ROLES).toBe(rolesInFirstAppearanceOrder().join(','))
  })

  test('second-human-gate-only roles are withheld and the ordinary pipeline roles are granted', () => {
    const granted = new Set(env.MEDIAOPS_TRUSTED_PRINCIPAL_ROLES.split(','))
    // Positive control: the derivation is not vacuous — it drops exactly the
    // roles no non-gate tool asks for, and keeps the ones the pipeline needs.
    for (const role of ['originality_reviewer', 'editorial_reviewer', 'approver', 'profile_approver']) {
      expect(granted.has(role), role).toBe(false)
    }
    for (const role of ['author', 'reference_curator', 'researcher', 'fact_checker', 'publisher']) {
      expect(granted.has(role), role).toBe(true)
    }
    for (const { tool, role } of toolRolePolicies()) {
      if (!isSecondHumanGate(tool)) expect(granted.has(role), `${tool} needs ${role}`).toBe(true)
    }
  })

  test('the injected identity is local-editorial and never a wildcard grant', () => {
    expect(env.MEDIAOPS_IDENTITY_MODE).toBe('local-editorial')
    expect(env.MEDIAOPS_TRUSTED_PRINCIPAL_ISSUER).toBe('crabcode-local-editorial')
    const granted = env.MEDIAOPS_TRUSTED_PRINCIPAL_ROLES.split(',')
    expect(granted).not.toContain('*')
    expect(granted).not.toContain('mediaops:*')
    // The principal itself comes from host user_config, never from a literal.
    expect(env.MEDIAOPS_TRUSTED_PRINCIPAL_ID).toBe('${user_config.principal_id}')
    expect(env.MEDIAOPS_TRUSTED_PRINCIPAL_NAME).toBe('${user_config.principal_name}')
  })
})
