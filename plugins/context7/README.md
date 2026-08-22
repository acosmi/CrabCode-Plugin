# Context7

> **MCP 安全暂停（2026-08-22）**：安全状态：本版本不发布可执行 MCP 配置；安装不会启动该服务或发起网络请求。 本文保留目标能力与后续接入资料，不代表当前版本已连接或可执行。

CrabCode integration with the Upstash Context7 MCP server. Fetch
version-specific library docs and code examples on demand without leaving
your editor.

## Connect

The plugin runs `npx -y @upstash/context7-mcp` on stdio. Node.js and an
installable `npx` are the only host requirements.

## What you can do

- Look up a library by name and pull current documentation
- Pin documentation to a specific version
- Pull representative code snippets from upstream sources
- Use the docs as additional context for code generation and review

## Notes

Documentation freshness depends on Context7's index; CrabCode does not cache
or mutate Context7 state.
