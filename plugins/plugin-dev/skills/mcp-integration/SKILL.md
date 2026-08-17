---
name: 插件 MCP 集成
short-description: 在 CrabCode 插件中配置并接入外部 MCP 服务与工具
description: This skill should be used when the user asks to "add MCP server", "integrate MCP", "configure MCP in plugin", "use .mcp.json", "set up Model Context Protocol", "connect external service", mentions "${CRABCODE_PLUGIN_ROOT} with MCP", or discusses MCP server types (SSE, stdio, HTTP, WebSocket). Provides comprehensive guidance for integrating Model Context Protocol servers into CrabCode plugins for external tool and service integration.
version: 0.1.0
---

# MCP Integration for CrabCode plugins

## Overview

Model Context Protocol (MCP) enables CrabCode plugins to integrate with external services and APIs by providing structured tool access. Use MCP integration to expose external service capabilities as tools within CrabCode.

**Key capabilities:**
- Connect to external services (databases, APIs, file systems)
- Provide 10+ related tools from a single service
- Handle OAuth and complex authentication flows
- Bundle MCP servers with plugins for automatic setup

## MCP Server Configuration Methods

Plugins can bundle MCP servers in two ways:

### Method 1: Dedicated .mcp.json (Recommended)

Create `.mcp.json` at plugin root:

```json
{
  "database-tools": {
    "command": "${CRABCODE_PLUGIN_ROOT}/servers/db-server",
    "args": ["--config", "${CRABCODE_PLUGIN_ROOT}/config.json"],
    "env": {
      "DB_URL": "${DB_URL}"
    }
  }
}
```

**Benefits:**
- Clear separation of concerns
- Easier to maintain
- Better for multiple servers

### Method 2: Inline in plugin.json

Add `mcpServers` field to plugin.json:

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "mcpServers": {
    "plugin-api": {
      "command": "${CRABCODE_PLUGIN_ROOT}/servers/api-server",
      "args": ["--port", "8080"]
    }
  }
}
```

**Benefits:**
- Single configuration file
- Good for simple single-server plugins

## MCP Server Types

### stdio (Local Process)

Execute local MCP servers as child processes. Best for local tools and custom servers.

**Configuration:**
```json
{
  "filesystem": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/allowed/path"],
    "env": {
      "LOG_LEVEL": "debug"
    }
  }
}
```

**Use cases:**
- File system access
- Local database connections
- Custom MCP servers
- NPM-packaged MCP servers

**Process management:**
- CrabCode spawns and manages the process
- Communicates via stdin/stdout
- Terminates when CrabCode exits

### SSE (Server-Sent Events)

Connect to hosted MCP servers with OAuth support. Best for cloud services.

**Configuration:**
```json
{
  "asana": {
    "type": "sse",
    "url": "https://mcp.asana.com/sse"
  }
}
```

**Use cases:**
- Official hosted MCP servers (Asana, GitHub, etc.)
- Cloud services with MCP endpoints
- OAuth-based authentication
- No local installation needed

**Authentication:**
- OAuth flows handled automatically
- User prompted on first use
- Tokens managed by CrabCode

### HTTP (REST API)

Connect to RESTful MCP servers with token authentication.

**Configuration:**
```json
{
  "api-service": {
    "type": "http",
    "url": "https://api.example.com/mcp",
    "headers": {
      "Authorization": "Bearer ${API_TOKEN}",
      "X-Custom-Header": "value"
    }
  }
}
```

**Use cases:**
- REST API-based MCP servers
- Token-based authentication
- Custom API backends
- Stateless interactions

### WebSocket (Real-time)

Connect to WebSocket MCP servers for real-time bidirectional communication.

**Configuration:**
```json
{
  "realtime-service": {
    "type": "ws",
    "url": "wss://mcp.example.com/ws",
    "headers": {
      "Authorization": "Bearer ${TOKEN}"
    }
  }
}
```

**Use cases:**
- Real-time data streaming
- Persistent connections
- Push notifications from server
- Low-latency requirements

## Environment Variable Expansion

All MCP configurations support environment variable substitution:

**${CRABCODE_PLUGIN_ROOT}** - Plugin directory (always use for portability):
```json
{
  "command": "${CRABCODE_PLUGIN_ROOT}/servers/my-server"
}
```

**User environment variables** - From user's shell:
```json
{
  "env": {
    "API_KEY": "${MY_API_KEY}",
    "DATABASE_URL": "${DB_URL}"
  }
}
```

**Best practice:** Document all required environment variables in plugin README.

## MCP Tool Naming

When MCP servers provide tools, they're automatically prefixed:

**Format:** `mcp__<server-namespace>__<tool-name>`

For a **plugin-provided** server the namespace is not the plugin name. It is
`p_` followed by a hash of the server's internal runtime identity:

```
mcp__p_<24-hex-digest>__<tool-name>
```

**You cannot derive this by hand, and you should not try.** Run `/mcp` and
copy the tool names it prints. That is the only supported way to learn them —
a hand-assembled name like `mcp__plugin_asana_asana__create_task` matches <!-- doc-facts-allow: fictional-mcp-namespace -->
nothing and fails silently at allowlist time, because an entry that never
matches simply never grants anything.

### Using MCP Tools in Commands

Pre-allow specific MCP tools in command frontmatter, pasting the exact names
from `/mcp`:

```markdown
---
allowed-tools: [
  "mcp__p_1f4c9a2be70d5836a1b4c7e2__create_task",
  "mcp__p_1f4c9a2be70d5836a1b4c7e2__search_tasks"
]
---
```

**Wildcard (use sparingly):**
```markdown
---
allowed-tools: ["mcp__p_1f4c9a2be70d5836a1b4c7e2__*"]
---
```

The digest above is illustrative — yours will differ. Because the namespace is
derived rather than authored, prefer the wildcard form when you genuinely want
every tool from one server, and re-check the names with `/mcp` after renaming
a server.

**Best practice:** Pre-allow specific tools, not wildcards, for security.

## Lifecycle Management

**Automatic startup:**
- Enabling the plugin registers its MCP servers; the host manages their
  connections from there
- Connections are cached and re-established as needed, so a dropped connection
  does not require user action
- `/reload-plugins` picks up plugin MCP configuration changes in place — it
  reports how many plugin MCP servers it loaded

Do not design around a particular connect *moment*. Whether a given server is
dialled eagerly or on first use is a host scheduling detail; treat `/mcp` as
the source of truth for what is connected right now. Write servers that
tolerate being started at any point, and tools that work on first invocation.

**Lifecycle:**
1. Plugin loads
2. MCP configuration parsed
3. Server process started (stdio) or connection established (SSE/HTTP/WS)
4. Tools discovered and registered
5. Tools exposed under a generated `mcp__…__…` name (see "Tool Naming")

**Viewing servers:**
Use `/mcp` command to see all servers including plugin-provided ones.

## Authentication Patterns

### OAuth (SSE/HTTP)

OAuth handled automatically by CrabCode:

```json
{
  "type": "sse",
  "url": "https://mcp.example.com/sse"
}
```

User authenticates in browser on first use. No additional configuration needed.

### Token-Based (Headers)

Static or environment variable tokens:

```json
{
  "type": "http",
  "url": "https://api.example.com",
  "headers": {
    "Authorization": "Bearer ${API_TOKEN}"
  }
}
```

Document required environment variables in README.

### Environment Variables (stdio)

Pass configuration to MCP server:

```json
{
  "command": "python",
  "args": ["-m", "my_mcp_server"],
  "env": {
    "DATABASE_URL": "${DB_URL}",
    "API_KEY": "${API_KEY}",
    "LOG_LEVEL": "info"
  }
}
```

## Integration Patterns

### Pattern 1: Simple Tool Wrapper

Commands use MCP tools with user interaction:

```markdown
# Command: create-item.md
---
allowed-tools: ["mcp__p_1f4c9a2be70d5836a1b4c7e2__create_item"]   # exact name from /mcp
---

Steps:
1. Gather item details from user
2. Use mcp__p_1f4c9a2be70d5836a1b4c7e2__create_item
3. Confirm creation
```

**Use for:** Adding validation or preprocessing before MCP calls.

### Pattern 2: Autonomous Agent

Agents use MCP tools autonomously:

```markdown
# Agent: data-analyzer.md

Analysis Process:
1. Query data via mcp__p_1f4c9a2be70d5836a1b4c7e2__query
2. Process and analyze results
3. Generate insights report
```

**Use for:** Multi-step MCP workflows without user interaction.

### Pattern 3: Multi-Server Plugin

Integrate multiple MCP servers:

```json
{
  "issue-tracker": {
    "type": "sse",
    "url": "https://mcp.example.com/issues/sse"
  },
  "docs-service": {
    "type": "sse",
    "url": "https://mcp.example.com/docs/sse"
  }
}
```

Use each vendor's documented endpoint in place of the placeholders above.

**Use for:** Workflows spanning multiple services.

## Security Best Practices

### Use HTTPS/WSS

Always use secure connections:

```json
✅ "url": "https://mcp.example.com/sse"
❌ "url": "http://mcp.example.com/sse"
```

### Token Management

**DO:**
- ✅ Use environment variables for tokens
- ✅ Document required env vars in README
- ✅ Let OAuth flow handle authentication

**DON'T:**
- ❌ Hardcode tokens in configuration
- ❌ Commit tokens to git
- ❌ Share tokens in documentation

### Permission Scoping

Pre-allow only necessary MCP tools:

```markdown
✅ allowed-tools: [
  "mcp__p_1f4c9a2be70d5836a1b4c7e2__read_data",
  "mcp__p_1f4c9a2be70d5836a1b4c7e2__create_item"
]

❌ allowed-tools: ["mcp__p_1f4c9a2be70d5836a1b4c7e2__*"]
```

## Error Handling

### Connection Failures

Handle MCP server unavailability:
- Provide fallback behavior in commands
- Inform user of connection issues
- Check server URL and configuration

### Tool Call Errors

Handle failed MCP operations:
- Validate inputs before calling MCP tools
- Provide clear error messages
- Check rate limiting and quotas

### Configuration Errors

Validate MCP configuration:
- Test server connectivity during development
- Validate JSON syntax
- Check required environment variables

## Performance Considerations

### Connection Reuse

The host does not dial every configured server up front, and connections are
memoized once established:

- Not every server is connected at startup
- Connections are reused across tool calls rather than reopened per call
- A closed connection is re-established on the next invocation

The practical consequence for a server author: your process may be started
well before or well after the session begins, and it may be asked for tools
immediately on connect. Do not assume a warm-up window.

### Batching

Batch similar requests when possible:

```
# Good: Single query with filters
tasks = search_tasks(project="X", assignee="me", limit=50)

# Avoid: Many individual queries
for id in task_ids:
    task = get_task(id)
```

## Testing MCP Integration

### Local Testing

1. Configure MCP server in `.mcp.json`
2. Install plugin locally (`.crabcode-plugin/`)
3. Run `/mcp` to verify server appears
4. Test tool calls in commands
5. Check `crabcode --debug` logs for connection issues

### Validation Checklist

- [ ] MCP configuration is valid JSON
- [ ] Server URL is correct and accessible
- [ ] Required environment variables documented
- [ ] Tools appear in `/mcp` output
- [ ] Authentication works (OAuth or tokens)
- [ ] Tool calls succeed from commands
- [ ] Error cases handled gracefully

## Debugging

### Enable Debug Logging

```bash
crabcode --debug
```

Look for:
- MCP server connection attempts
- Tool discovery logs
- Authentication flows
- Tool call errors

### Common Issues

**Server not connecting:**
- Check URL is correct
- Verify server is running (stdio)
- Check network connectivity
- Review authentication configuration

**Tools not available:**
- Verify server connected successfully
- Check tool names match exactly
- Run `/mcp` to see available tools
- Restart CrabCode after config changes

**Authentication failing:**
- Clear cached auth tokens
- Re-authenticate
- Check token scopes and permissions
- Verify environment variables set

## Quick Reference

### MCP Server Types

| Type | Transport | Best For | Auth |
|------|-----------|----------|------|
| stdio | Process | Local tools, custom servers | Env vars |
| SSE | HTTP | Hosted services, cloud APIs | OAuth |
| HTTP | REST | API backends, token auth | Tokens |
| ws | WebSocket | Real-time, streaming | Tokens |

### Configuration Checklist

- [ ] `type` specified for non-stdio servers (`sse`/`http`/`ws`). It may be
      omitted for stdio, which is the default — that is why the stdio examples
      above carry no `type` field
- [ ] Type-specific fields complete (`command` for stdio, `url` otherwise)
- [ ] Authentication configured
- [ ] Environment variables documented
- [ ] HTTPS/WSS used (not HTTP/WS)
- [ ] ${CRABCODE_PLUGIN_ROOT} used for paths

### Best Practices

**DO:**
- ✅ Use ${CRABCODE_PLUGIN_ROOT} for portable paths
- ✅ Document required environment variables
- ✅ Use secure connections (HTTPS/WSS)
- ✅ Pre-allow specific MCP tools in commands
- ✅ Test MCP integration before publishing
- ✅ Handle connection and tool errors gracefully

**DON'T:**
- ❌ Hardcode absolute paths
- ❌ Commit credentials to git
- ❌ Use HTTP instead of HTTPS
- ❌ Pre-allow all tools with wildcards
- ❌ Skip error handling
- ❌ Forget to document setup

## Additional Resources

### Reference Files

For detailed information, consult:

- **`references/server-types.md`** - Deep dive on each server type
- **`references/authentication.md`** - Authentication patterns and OAuth
- **`references/tool-usage.md`** - Using MCP tools in commands and agents

### Example Configurations

Working examples in `examples/`:

- **`stdio-server.json`** - Local stdio MCP server
- **`sse-server.json`** - Hosted SSE server with OAuth
- **`http-server.json`** - REST API with token auth

### External Resources

- **Official MCP Docs**: https://modelcontextprotocol.io/
- **MCP SDK**: @modelcontextprotocol/sdk
- **Testing**: Use `crabcode --debug` and `/mcp` command

## Implementation Workflow

To add MCP integration to a plugin:

1. Choose MCP server type (stdio, SSE, HTTP, ws)
2. Create `.mcp.json` at plugin root with configuration
3. Use ${CRABCODE_PLUGIN_ROOT} for all file references
4. Document required environment variables in README
5. Test locally with `/mcp` command
6. Pre-allow MCP tools in relevant commands
7. Handle authentication (OAuth or tokens)
8. Test error cases (connection failures, auth errors)
9. Document MCP integration in plugin README

Focus on stdio for custom/local servers, SSE for hosted services with OAuth.
