# Linear

> **MCP 安全暂停（2026-08-22）**：安全状态：本版本不发布可执行 MCP 配置；安装不会启动该服务或发起网络请求。 本文保留目标能力与后续接入资料，不代表当前版本已连接或可执行。

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
