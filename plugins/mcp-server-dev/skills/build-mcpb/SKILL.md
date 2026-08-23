---
name: MCPB 本地运行时提案
short-description: 为未来本地 MCP 运行时整理 blocked 打包、安全与供应链证据
description: This skill should be used when the user asks to package or distribute a local MCP server, make an MCPB/DXT, bundle a runtime, access local files or desktop apps, or create an installable local MCP capability. During the emergency safe baseline it produces only a blocked, non-executable local-runtime and supply-chain proposal; it never creates a manifest/archive, bundles/signs/installs a package, emits launch configuration, or connects a server.
version: 0.1.0
---

# Local MCP Runtime Packaging Proposal

## Emergency Boundary

Do not create an MCPB/DXT archive, package manifest, entry point, command,
arguments, environment bindings, user-configuration schema, runtime bundle,
signature, installer, or drag-and-drop instructions. Do not download or vendor
dependencies and do not test an installation.

Status remains:

`blocked / non-executable / not packaged / not signed / not installed / not tested`

## Proposal Workflow

1. Explain why the capability must run locally instead of accepting
   user-provided data or using a future reviewed remote service.
2. Inventory filesystem, desktop-app, localhost, device, network, subprocess,
   and OS permissions.
3. Record data boundaries, destructive operations, confirmation, path
   canonicalization, symlink handling, sandboxing, and secret storage needs.
4. Record runtime/dependency provenance, immutable versions, licenses,
   vulnerability review, archive extraction rules, signature trust, cache
   binding, and rollback needs.
5. Define fail-closed behavior for missing configuration, incompatible hosts,
   failed verification, and upgrade/restart transitions.
6. List the local install/E2E and deterministic release evidence required before
   packaging could ever be authorized.

Output only `references/local-package-risk-inventory.md`; leave manifest,
runtime, launcher, artifact, and installation fields unset.
