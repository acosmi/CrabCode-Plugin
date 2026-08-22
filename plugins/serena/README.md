# Serena

> **MCP 安全暂停（2026-08-22）**：安全状态：本版本不发布可执行 MCP 配置；安装不会启动该服务或发起网络请求。 本文保留目标能力与后续接入资料，不代表当前版本已连接或可执行。

CrabCode integration with the [Serena](https://github.com/oraios/serena) MCP
server by Oraios. Serena layers LSP-driven semantic understanding on top of
the codebase.

## Connect

The plugin runs `uvx --from git+https://github.com/oraios/serena serena
start-mcp-server` on stdio. You need [uv](https://github.com/astral-sh/uv)
(`uvx`) installed; the first run will fetch Serena.

## What you can do

- Jump to definitions, references, and implementations across the codebase
- Inspect symbol shape and module-level structure
- Get refactoring suggestions grounded in language-server data
- Navigate large repositories more efficiently than text-grep alone

## Notes

This integration is community-maintained upstream. Consult the Serena
project for supported languages and configuration.
