---
name: 插件 MCP 集成
short-description: 为未来 CrabCode 插件 MCP 接入整理非可执行能力提案
description: This skill should be used when the user asks to add or integrate an MCP server, configure MCP in a plugin, connect an external service, use a local MCP runtime, or discuss MCP transport and authentication. During the emergency safe baseline it produces only a blocked, non-executable capability and evidence proposal; it never creates, edits, packages, installs, connects, or activates executable MCP configuration.
version: 0.1.0
---

# MCP Integration Proposal for CrabCode Plugins

## Emergency Containment Boundary

This skill is proposal-only. It must not:

- create, edit, copy, rename, or package `.mcp.json`;
- add manifest or marketplace `mcpServers`;
- reference external JSON, local/remote MCPB, or DXT packages;
- choose or emit an endpoint, launcher command, package coordinate, arguments,
  headers, environment bindings, secrets, or tool allowlist;
- search for a connection endpoint, install a connector, start a process,
  initiate authentication, or run a connectivity test;
- claim that a capability is installed, connected, activated, available, or
  provider-compatible.

Output only a Markdown proposal marked:

`blocked / non-executable / not connected / not tested`

## Workflow

### 1. Capture the User Outcome

Describe the user-visible outcome without selecting a server implementation.
Record who needs the capability, the owning team, and whether the workflow is
read-only or mutating.

### 2. Inventory the Security Boundary

Record:

- data classes read, written, or transmitted;
- filesystem, browser, network, or account access that would be required;
- desired user/service identity, consent, scopes, and approval separation;
- retention, audit, rate-limit, and failure-isolation expectations;
- fail-closed behavior when the capability is unavailable.

Do not infer a provider contract or turn these requirements into runtime fields.

### 3. List Evidence Required Before Reopening

At minimum require:

- source and artifact provenance with an exact immutable version;
- threat model and security review;
- host loader/activation policy and negative tests;
- provider-specific authentication and redirect E2E where applicable;
- local initialize/tool-discovery tests in an isolated fixture;
- generation-1/generation-2 upgrade plus CrabCode restart verification;
- deterministic release, rollback, and post-publish byte verification;
- an explicit decision replacing the repository emergency safe baseline.

Unknown evidence stays `missing`; it is never converted into an assumption.

### 4. Produce the Proposal

Use `examples/mcp-integration-proposal.md`. Keep runtime, transport, provider
endpoint, command, package, secrets, tool names, and activation unset. Link the
relevant risk inventories only when they help explain missing evidence:

- `references/server-types.md`
- `references/authentication.md`
- `references/tool-usage.md`

## Completion Rule

A complete result is a reviewable blocked inventory, not a working connection.
If the user asks to implement it, explain that executable MCP authoring remains
outside this skill's current authority and preserve the proposal for a future
approved release task.
