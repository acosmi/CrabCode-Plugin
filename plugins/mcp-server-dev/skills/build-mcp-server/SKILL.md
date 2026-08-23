---
name: MCP 服务设计
short-description: 为未来 MCP 服务整理能力边界、威胁模型与发布证据提案
description: This skill should be used when the user asks to build, design, scaffold, deploy, authenticate, or distribute an MCP server, choose between remote/local/MCPB delivery, define MCP tools, or connect a server to CrabCode. During the emergency MCP safe baseline it produces only a blocked, non-executable capability, threat, and evidence proposal; it never writes server/config code, deploys, packages, installs, connects, or activates MCP.
version: 0.1.0
---

# MCP Server Capability Proposal

## Emergency Boundary

This skill is proposal-only. Do not create server code, schemas, manifests,
plugin MCP declarations, external JSON, MCPB/DXT packages, endpoints, commands,
dependencies, credentials, deployment files, connection steps, or tool
allowlists. Do not run a server, tunnel, login, deployment, package, or test
connection. Never claim that the proposal is implemented or compatible.

Output status must remain:

`blocked / non-executable / not deployed / not connected / not tested`

## Workflow

1. Record the user-visible outcome, users, owner, and read/mutation boundary.
2. Inventory data classes, privileges, retention, audit, consent, scopes, rate
   limits, failure isolation, and destructive-operation approvals.
3. Compare runtime families only as risk categories: local child process, remote
   stream transport, or packaged local runtime. Keep the selection `undecided`.
4. Describe desired operations in plain language. Do not create tool names,
   JSON schemas, prompts, resources, or executable handlers.
5. Define fail-closed behavior and any safe fallback using user-provided data.
6. List missing evidence: immutable provenance, threat review, host activation
   policy, provider auth E2E, isolated protocol tests, upgrade plus CrabCode
   restart, deterministic release, rollback, and public-byte verification.
7. Save only a Markdown proposal and route UI/package-specific risk questions
   to the sibling proposal skills when relevant.

## Completion Rule

A complete result is a reviewable blocked inventory. Executable implementation
requires a future task that explicitly replaces the repository emergency MCP
baseline; ordinary plugin-development authority is insufficient.

See `references/review-checklist.md` for the evidence fields.
