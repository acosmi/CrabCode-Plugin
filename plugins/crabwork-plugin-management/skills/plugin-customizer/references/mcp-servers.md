# MCP Capability Inventory During Containment

This reference defines a documentation-only workflow. It does not discover,
install, connect, configure, or activate an MCP server.

## Hard Boundary

During the emergency MCP safe baseline:

- do not call registry search or connector-installation actions for the purpose
  of wiring a plugin;
- do not create or edit `.mcp.json`;
- do not add manifest `mcpServers`, JSON paths, MCPB paths, or MCPB URLs;
- do not emit an endpoint, launcher command, package coordinate, headers, or
  environment-variable binding;
- do not state that a proposal is available, installed, connected, or tested.

The only permitted artifact is a Markdown inventory marked
`blocked / non-executable / not connected`.

## Category-to-Keywords Mapping

| Category | Search Keywords |
|----------|-----------------|
| `project-management` | `["asana", "jira", "linear", "monday", "tasks"]` |
| `software-coding` | `["github", "gitlab", "bitbucket", "code"]` |
| `chat` | `["slack", "teams", "discord"]` |
| `documents` | `["google docs", "notion", "confluence"]` |
| `calendar` | `["google calendar", "calendar"]` |
| `email` | `["gmail", "outlook", "email"]` |
| `design-graphics` | `["figma", "sketch", "design"]` |
| `analytics-bi` | `["datadog", "grafana", "analytics"]` |
| `crm` | `["salesforce", "hubspot", "crm"]` |
| `wiki-knowledge-base` | `["notion", "confluence", "outline", "wiki"]` |
| `data-warehouse` | `["bigquery", "snowflake", "redshift"]` |
| `conversation-intelligence` | `["gong", "chorus", "call recording"]` |

## Proposal Workflow

1. Identify the user-visible capability, not a server implementation.
2. Record the provider name if the user already supplied it. Do not discover or
   guess an endpoint.
3. Record data read/write classes, expected identity, consent, and approval
   boundaries.
4. Record the desired failure behavior when the capability is unavailable.
5. Mark runtime, endpoint, artifact, and activation `not selected`.
6. List evidence required before any future executable proposal can be reviewed:
   provenance, exact-version distribution, security controls, local tests,
   host activation policy, upgrade/restart behavior, and rollback.
7. Use `../examples/mcp-integration-proposal.md`; keep status `blocked`.

The resulting inventory is useful input to a later review but cannot be copied
into a plugin manifest or renamed into an MCP configuration.
