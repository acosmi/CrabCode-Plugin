export type PrincipalAssurance = 'mcp_oauth' | 'host_principal' | 'local_editorial' | 'service_account'

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

/**
 * Deterministic machine operations that the server-owned service actor performs
 * in local-editorial mode (audit §7.5): originality scanning and delivery
 * rendering are pure computation over stored records, so attributing them to a
 * service identity keeps the single trusted human as the accountable author
 * without faking a second person. Human-judgment attestations (research
 * completion, reviews, approvals, profile confirmation) are never service work.
 */
const SERVICE_ACTOR_TOOLS = new Set(['mediaops.originality.scan', 'mediaops.delivery.render'])
const SERVICE_IMPORT_TOOL = 'mediaops.content.save'

const SERVICE_ACTOR: TrustedPrincipal = Object.freeze({
  principalId: 'service',
  actorKey: 'mediaops-server:service',
  displayName: 'MediaOps 服务执行体（确定性机器操作）',
  issuer: 'mediaops-server',
  roles: ['originality_scanner', 'renderer', 'author'],
  assurance: 'service_account',
})

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

function configuredIdentityMode(): 'host-principal' | 'local-editorial' | null {
  const mode = process.env.MEDIAOPS_IDENTITY_MODE
  return mode === 'host-principal' || mode === 'local-editorial' ? mode : null
}

function principalFromHost(): TrustedPrincipal | null {
  const mode = configuredIdentityMode()
  if (!mode) return null
  const principalId = cleanIdentifier(process.env.MEDIAOPS_TRUSTED_PRINCIPAL_ID, 'MEDIAOPS_TRUSTED_PRINCIPAL_ID')
  const issuer = cleanIdentifier(process.env.MEDIAOPS_TRUSTED_PRINCIPAL_ISSUER, 'MEDIAOPS_TRUSTED_PRINCIPAL_ISSUER')
  const displayName = (process.env.MEDIAOPS_TRUSTED_PRINCIPAL_NAME?.normalize('NFKC').trim() || principalId).slice(0, 300)
  const roles = normalizeRoles([process.env.MEDIAOPS_TRUSTED_PRINCIPAL_ROLES ?? ''])
  // Statically configured principals must enumerate their roles: a wildcard
  // grant would silently defeat every separation-of-duties check (audit §8.3).
  if (roles.includes('*') || roles.includes('mediaops:*')) {
    throw new IdentityError('AUTHENTICATION_REQUIRED', 'Wildcard roles are rejected for host/local configured principals; grant explicit mediaops roles instead.')
  }
  return {
    principalId,
    actorKey: `${issuer}:${principalId}`.slice(0, 300),
    displayName,
    issuer,
    roles,
    assurance: mode === 'local-editorial' ? 'local_editorial' : 'host_principal',
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
  const args = rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs)
    ? { ...(rawArgs as Record<string, unknown>) }
    : {}
  const serviceImportRequested = args.serviceImport === true
  delete args.serviceImport
  // OAuth subjects always take precedence; local-editorial routing only applies
  // to the env-configured single-human mode without a per-call trusted subject.
  const localEditorial = !context?.authInfo && configuredIdentityMode() === 'local-editorial'
  let principal: TrustedPrincipal | null
  if (localEditorial && (SERVICE_ACTOR_TOOLS.has(toolName) || (toolName === SERVICE_IMPORT_TOOL && serviceImportRequested))) {
    const human = resolveTrustedPrincipal(context)
    if (!human) {
      throw new IdentityError('AUTHENTICATION_REQUIRED', 'local-editorial mode requires the trusted local principal to be configured before service-actor operations run.')
    }
    if (toolName === SERVICE_IMPORT_TOOL && args.stage !== 'intake') {
      throw new IdentityError('AUTHORIZATION_DENIED', 'The service actor may only register mechanical intake imports; later stages need the accountable human principal.')
    }
    principal = SERVICE_ACTOR
  } else {
    if (serviceImportRequested) {
      throw new IdentityError('AUTHORIZATION_DENIED', 'serviceImport is only available for mediaops.content.save intake registration in MEDIAOPS_IDENTITY_MODE=local-editorial.')
    }
    principal = resolveTrustedPrincipal(context)
  }
  if (!principal) {
    throw new IdentityError(
      'AUTHENTICATION_REQUIRED',
      `${toolName} requires an MCP-authenticated subject or an explicitly configured host principal; caller-supplied names are not accepted as identity.`,
    )
  }
  if (!hasRole(principal, policy.role)) {
    throw new IdentityError('AUTHORIZATION_DENIED', `${principal.actorKey} lacks required role ${policy.role} for ${toolName}.`)
  }
  for (const field of policy.actorFields) args[field] = principal.actorKey
  bindNestedAccountability(toolName, args, principal.actorKey)
  return { args, principal }
}

/** Tools whose separation-of-duties check needs a second real human while the single local principal holds every human role. */
const SECOND_HUMAN_GATES = Object.freeze([
  'mediaops.originality.review',
  'mediaops.editorial.review',
  'mediaops.approval.decide',
  'mediaops.profile.confirm',
])

export type IdentityDescription = {
  mode: 'team_governed' | 'local_editorial' | 'host_principal' | 'required'
  assurance: PrincipalAssurance | 'required'
  authenticated: boolean
  principalId?: string
  roles: string[]
  serviceActor?: { actorKey: string; tools: string[]; intakeImport: string }
  secondHumanGates?: readonly string[]
}

/** Describe an already-resolved principal (shared by capabilities and doctor). */
export function describePrincipal(principal: TrustedPrincipal | null | undefined): IdentityDescription {
  if (!principal) return { mode: 'required', assurance: 'required', authenticated: false, roles: [] }
  const base = {
    assurance: principal.assurance,
    authenticated: true,
    principalId: principal.principalId,
    roles: principal.roles,
  }
  if (principal.assurance === 'local_editorial') {
    return {
      mode: 'local_editorial',
      ...base,
      serviceActor: { actorKey: SERVICE_ACTOR.actorKey, tools: [...SERVICE_ACTOR_TOOLS], intakeImport: `${SERVICE_IMPORT_TOOL} + serviceImport:true (stage=intake)` },
      secondHumanGates: SECOND_HUMAN_GATES,
    }
  }
  return { mode: principal.assurance === 'mcp_oauth' ? 'team_governed' : 'host_principal', ...base }
}

export function identityCapability(context?: ToolRequestContext): IdentityDescription {
  return describePrincipal(resolveTrustedPrincipal(context))
}

/** Role each governed pipeline tool demands, for readiness reporting. */
export function toolRolePolicies(): Array<{ tool: string; role: string }> {
  return Object.entries(POLICIES).map(([tool, policy]) => ({ tool, role: policy.role }))
}

export function serviceActorCovers(toolName: string): boolean {
  return SERVICE_ACTOR_TOOLS.has(toolName)
}

export function isSecondHumanGate(toolName: string): boolean {
  return SECOND_HUMAN_GATES.includes(toolName)
}

export function principalHasRole(principal: TrustedPrincipal, role: string): boolean {
  return hasRole(principal, role)
}
