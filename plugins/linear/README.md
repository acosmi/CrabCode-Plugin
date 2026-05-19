# Linear

CrabCode integration with Linear's hosted MCP endpoint.

## Connect

The endpoint is `https://mcp.linear.app/mcp`. Linear performs its own OAuth
flow when the MCP client first connects. No environment variable is needed
at the plugin level.

## What you can do

- Create, update, and search issues across teams
- Manage projects, cycles, and roadmap items
- Update issue states, labels, and assignees
- Inspect comments and activity

## Notes

This plugin only wires the Linear MCP endpoint into CrabCode. CrabCode does
not own or maintain that server; authentication and rate limits follow
Linear's policy.
