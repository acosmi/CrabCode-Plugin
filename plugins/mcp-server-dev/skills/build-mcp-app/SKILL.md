---
name: MCP 交互应用设计
short-description: 为未来 MCP 交互界面整理 blocked 体验、安全与宿主证据提案
description: This skill should be used when the user wants an MCP app, widget, form, picker, dashboard, confirmation dialog, visual preview, or other interactive UI associated with a proposed MCP capability. During the emergency safe baseline it produces only a blocked, non-executable UI risk and evidence proposal; it never writes widget/server code, loads an SDK/CDN, packages, installs, connects, or tests an MCP app.
version: 0.1.0
---

# MCP Interactive-UI Proposal

## Emergency Boundary

Do not emit HTML, JavaScript, component code, UI-resource metadata, server maps,
endpoints, package coordinates, build commands, host messages, connection
instructions, or installable artifacts. Do not open a tunnel or connector.

Status remains:

`blocked / non-executable / not connected / not rendered / not tested`

## Proposal Workflow

1. State why text or native elicitation would be insufficient.
2. Describe the single user task, states, accessibility needs, and cancellation
   behavior without choosing a framework or SDK.
3. Inventory data entering/leaving the frame, sensitive fields, host actions,
   link/navigation needs, storage, and destructive confirmations.
4. Record iframe/sandbox, origin, CSP, injection, payload-size, abuse, replay,
   and denial-of-service risks.
5. Define fail-closed behavior when UI capability or host support is absent.
6. List missing host/provider compatibility, security, accessibility, protocol,
   packaging, upgrade/restart, release, and rollback evidence.

Output only the Markdown inventory in `references/ui-risk-inventory.md`. A UI
mockup may describe layout in prose, but must not contain runnable code or a
connection path.
