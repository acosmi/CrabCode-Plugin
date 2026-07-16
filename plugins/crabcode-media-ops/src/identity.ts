export type PrincipalAssurance = 'mcp_oauth' | 'host_principal'

export type TrustedPrincipal = {
  principalId: string
  actorKey: string
  displayName: string
  issuer: string
  roles: string[]
  assurance: PrincipalAssurance
}

export type ToolRequestContext = {
  authInfo?: {
    clientId?: string
    scopes?: string[]
    expiresAt?: number
    extra?: Record<string, unknown>
  }
}

type ToolIdentityPolicy = {
  role: string
  actorFields: string[]
}

export class IdentityError extends Error {
  readonly code: 'AUTHENTICATION_REQUIRED' | 'AUTHORIZATION_DENIED'

  constructor(code: IdentityError['code'], message: string) {
    super(message)
    this.name = 'IdentityError'
    this.code = code
  }
}

const POLICIES: Record<string, ToolIdentityPolicy> = {
  'mediaops.content.save': { role: 'author', actorFields: ['savedBy'] },
  'mediaops.reference.register': { role: 'reference_curator', actorFields: ['registeredBy'] },
  'mediaops.research.capture': { role: 'researcher', actorFields: ['capturedBy'] },
  'mediaops.research.complete': { role: 'fact_checker', actorFields: ['completedBy'] },
  'mediaops.originality.scan': { role: 'originality_scanner', actorFields: ['createdBy'] },
  'mediaops.originality.review': { role: 'originality_reviewer', actorFields: ['reviewedBy'] },
  'mediaops.editorial.review': { role: 'editorial_reviewer', actorFields: ['completedBy'] },
  'mediaops.delivery.render': { role: 'renderer', actorFields: ['generatedBy'] },
  'mediaops.delivery.verify': { role: 'delivery_reviewer', actorFields: ['verifiedBy'] },
  'mediaops.profile.save': { role: 'profile_editor', actorFields: ['confirmedBy'] },
  'mediaops.profile.rollback': { role: 'profile_editor', actorFields: ['confirmedBy'] },
  'mediaops.style.form.template': { role: 'profile_editor', actorFields: [] },
  'mediaops.style.form.save_draft': { role: 'profile_editor', actorFields: ['updatedBy'] },
  'mediaops.style.form.submit': { role: 'profile_editor', actorFields: ['submittedBy'] },
  'mediaops.profile.propose': { role: 'profile_editor', actorFields: ['proposedBy'] },
  'mediaops.profile.confirm': { role: 'profile_approver', actorFields: ['confirmedBy'] },
  'mediaops.approval.request': { role: 'approval_requester', actorFields: ['requestedBy'] },
  'mediaops.approval.decide': { role: 'approver', actorFields: ['decidedBy'] },
  'mediaops.publish.package': { role: 'publisher', actorFields: ['packagedBy'] },
}

function cleanIdentifier(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new IdentityError('AUTHENTICATION_REQUIRED', `${label} is missing from the trusted identity context.`)
  const cleaned = value.normalize('NFKC').trim()
  if (!cleaned || cleaned.length > 180 || /[\u0000-\u001f\u007f]/u.test(cleaned)) {
    throw new IdentityError('AUTHENTICATION_REQUIRED', `${label} is invalid in the trusted identity context.`)
  }
  return cleaned
}

function normalizeRoles(values: unknown[]): string[] {
  return [...new Set(values.flatMap((value) => typeof value === 'string' ? value.split(',') : [])
    .map((value) => value.normalize('NFKC').trim().toLowerCase())
    .filter(Boolean))]
}

function principalFromMcp(context?: ToolRequestContext): TrustedPrincipal | null {
  const auth = context?.authInfo
  if (!auth) return null
  if (auth.expiresAt !== undefined && (!Number.isFinite(auth.expiresAt) || auth.expiresAt <= Date.now() / 1000)) {
    throw new IdentityError('AUTHENTICATION_REQUIRED', 'The MCP access token is expired or has an invalid expiry.')
  }
  const extra = auth.extra ?? {}
  const principalId = cleanIdentifier(extra.sub ?? extra.subject, 'authInfo.extra.sub')
  const issuer = cleanIdentifier(extra.iss ?? extra.issuer ?? 'mcp-oauth', 'authInfo issuer')
  const displayName = typeof extra.name === 'string' && extra.name.trim() ? extra.name.normalize('NFKC').trim() : principalId
  const extraRoles = Array.isArray(extra.roles) ? extra.roles : []
  const roles = normalizeRoles([...(auth.scopes ?? []), ...extraRoles])
  return {
    principalId,
    actorKey: `${issuer}:${principalId}`.slice(0, 300),
    displayName: displayName.slice(0, 300),
    issuer,
    roles,
    assurance: 'mcp_oauth',
  }
}

function principalFromHost(): TrustedPrincipal | null {
  if (process.env.MEDIAOPS_IDENTITY_MODE !== 'host-principal') return null
  const principalId = cleanIdentifier(process.env.MEDIAOPS_TRUSTED_PRINCIPAL_ID, 'MEDIAOPS_TRUSTED_PRINCIPAL_ID')
  const issuer = cleanIdentifier(process.env.MEDIAOPS_TRUSTED_PRINCIPAL_ISSUER, 'MEDIAOPS_TRUSTED_PRINCIPAL_ISSUER')
  const displayName = (process.env.MEDIAOPS_TRUSTED_PRINCIPAL_NAME?.normalize('NFKC').trim() || principalId).slice(0, 300)
  const roles = normalizeRoles([process.env.MEDIAOPS_TRUSTED_PRINCIPAL_ROLES ?? ''])
  return {
    principalId,
    actorKey: `${issuer}:${principalId}`.slice(0, 300),
    displayName,
    issuer,
    roles,
    assurance: 'host_principal',
  }
}

export function resolveTrustedPrincipal(context?: ToolRequestContext): TrustedPrincipal | null {
  return principalFromMcp(context) ?? principalFromHost()
}

function hasRole(principal: TrustedPrincipal, role: string): boolean {
  const accepted = new Set([
    '*',
    role,
    `mediaops:${role}`,
    'mediaops:*',
  ])
  return principal.roles.some((item) => accepted.has(item))
}

function bindNestedAccountability(toolName: string, args: Record<string, unknown>, actorKey: string): void {
  if (toolName !== 'mediaops.editorial.review') return
  const legal = args.legalReview
  if (legal && typeof legal === 'object' && !Array.isArray(legal)) {
    args.legalReview = { ...(legal as Record<string, unknown>), reviewedBy: actorKey }
  }
  const disclosure = args.aiDisclosure
  if (disclosure && typeof disclosure === 'object' && !Array.isArray(disclosure)) {
    args.aiDisclosure = { ...(disclosure as Record<string, unknown>), confirmedBy: actorKey }
  }
  if (Array.isArray(args.waivers)) {
    args.waivers = args.waivers.map((waiver) => waiver && typeof waiver === 'object' && !Array.isArray(waiver)
      ? { ...(waiver as Record<string, unknown>), by: actorKey }
      : waiver)
  }
}

export function authorizeToolCall(
  toolName: string,
  rawArgs: unknown,
  context?: ToolRequestContext,
): { args: unknown; principal: TrustedPrincipal | null } {
  const policy = POLICIES[toolName]
  if (!policy) return { args: rawArgs, principal: resolveTrustedPrincipal(context) }
  const principal = resolveTrustedPrincipal(context)
  if (!principal) {
    throw new IdentityError(
      'AUTHENTICATION_REQUIRED',
      `${toolName} requires an MCP-authenticated subject or an explicitly configured host principal; caller-supplied names are not accepted as identity.`,
    )
  }
  if (!hasRole(principal, policy.role)) {
    throw new IdentityError('AUTHORIZATION_DENIED', `${principal.actorKey} lacks required role ${policy.role} for ${toolName}.`)
  }
  const args = rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs)
    ? { ...(rawArgs as Record<string, unknown>) }
    : {}
  for (const field of policy.actorFields) args[field] = principal.actorKey
  bindNestedAccountability(toolName, args, principal.actorKey)
  return { args, principal }
}

export function identityCapability(context?: ToolRequestContext): {
  mode: 'mcp_oauth' | 'host_principal' | 'required'
  authenticated: boolean
  principalId?: string
  roles: string[]
} {
  const principal = resolveTrustedPrincipal(context)
  return principal ? {
    mode: principal.assurance,
    authenticated: true,
    principalId: principal.principalId,
    roles: principal.roles,
  } : { mode: 'required', authenticated: false, roles: [] }
}
