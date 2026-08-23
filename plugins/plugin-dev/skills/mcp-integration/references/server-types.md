# MCP Runtime Risk Inventory

This reference is non-executable. It helps identify evidence for a future
review; it does not select a transport or provide configuration.

| Runtime family | Principal risks to record | Evidence required before selection |
|---|---|---|
| Local child process | artifact provenance, subprocess privileges, filesystem/network reach, environment leakage, lifecycle eviction | exact bundled artifact, ordinary-file/realpath checks, isolated initialize/tools tests, restart and rollback E2E |
| Remote stream transport | endpoint ownership, TLS, authorization-resource binding, consent, token storage, cross-provider differences | provider metadata and auth E2E, issuer/resource/PKCE checks, scoped credentials, revocation and failure tests |
| Legacy event-stream transport | protocol obsolescence, endpoint drift, reconnect behavior, ambiguous auth compatibility | explicit provider support and migration review; otherwise reject |
| MCPB/DXT package | archive provenance, extraction safety, remote download, mutable cache, user configuration and activation | immutable signed package, extraction/path tests, cache binding, explicit activation and rollback evidence |

## Proposal Questions

- What user outcome needs an external runtime at all?
- Can the workflow remain tool-independent or accept user-provided data?
- Which data and privileges would cross the boundary?
- What is the fail-closed behavior when the runtime is absent?
- Which exact evidence is missing for host, provider, distribution, upgrade,
  restart, and rollback behavior?

Keep the runtime family `not selected` in the proposal. Do not emit commands,
packages, URLs, arguments, environment variables, or server maps.
