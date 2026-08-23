# MCP Authentication Risk Inventory

This reference is proposal-only. It does not initiate login, choose an endpoint,
bind a credential, or claim that a host/provider combination is compatible.

## Record the Intended Identity Boundary

- human user, workload identity, or local single-user principal;
- issuer and audience/resource binding;
- minimum scopes and step-up requirements;
- consent display and redirect-host risk;
- credential storage, rotation, revocation, and logout;
- separation between requester, approver, and executor;
- audit events and retention.

## Future Evidence Gate

Remote authorization remains blocked until provider-specific E2E proves the
current authorization contract, including issuer validation, resource binding,
S256 PKCE support, exact redirect behavior, scope enforcement, token refresh,
revocation, and negative cases. Local runtimes must prove that secrets are not
inherited or persisted beyond the reviewed boundary.

The proposal must leave authentication implementation, endpoints, client
metadata, headers, environment bindings, and secrets unset. Mark every unproven
item `missing` rather than describing it as automatic.
