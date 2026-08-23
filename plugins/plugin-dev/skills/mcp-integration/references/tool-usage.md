# MCP Tool-Usage Risk Inventory

No MCP tool is available merely because a capability is proposed. This
reference must not invent namespaces, tool names, allowlists, or calls.

## Proposal Fields

- desired user-visible operation;
- read or mutation classification;
- data and privilege boundary;
- input validation and output redaction needs;
- confirmation and approval requirements;
- idempotency, retry, timeout, and rate-limit behavior;
- audit evidence and deterministic failure codes;
- safe manual fallback using user-provided data, if one exists.

## Fail-Closed Guidance

Skills and commands must treat the capability as unavailable and stop with a
clear blocked state. They must not fabricate a successful tool result, silently
substitute an unreviewed integration, or pre-authorize an unknown tool family.

Future implementation evidence must bind discovered runtime tool identities to
the exact reviewed server artifact and host activation generation. Until then,
the proposal remains `blocked / non-executable / not connected / not tested`.
