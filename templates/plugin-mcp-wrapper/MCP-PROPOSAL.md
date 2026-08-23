# MCP integration proposal (non-executable)

The emergency MCP safe baseline does not allow this template to emit a
`.mcp.json`, manifest `mcpServers` value, MCPB path, remote URL, launcher
command, or environment-variable binding.

Record the intended integration for later security review:

| Field | Proposed value |
|---|---|
| Plugin | `__PLUGIN_NAME__` |
| Capability needed | Describe the user-visible capability |
| Provider or local runtime | Name and owner only; do not add an endpoint or command |
| Data classes | List data read, written, or transmitted |
| Authentication | Describe the desired identity and consent model |
| Distribution | Identify the pinned, prebuilt artifact that would be reviewed |
| Failure behavior | State the fail-closed behavior when unavailable |
| Evidence still required | Security review, provenance, local tests, and host lifecycle E2E |

This inventory is not a connection claim and must not be renamed or converted
to executable configuration until the repository-wide MCP release gate is
explicitly reopened.
