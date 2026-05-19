# Asana

CrabCode integration with the Asana MCP server. Create tasks, search projects,
update assignments, and track progress from the same surface you use for code.

## Connect

The bundled `.mcp.json` points at `https://mcp.asana.com/sse`. Sign in through
Asana when the MCP client prompts. No additional environment variables are
required at the plugin level.

## What you can do

- List, search, and filter tasks across workspaces
- Create and update tasks, including assignees, due dates, and custom fields
- Read and update project metadata
- Cross-reference Asana work with files you are editing

## Notes

This plugin only wires the Asana MCP server into CrabCode. Tool availability,
rate limits, and authentication scope are governed by Asana.
