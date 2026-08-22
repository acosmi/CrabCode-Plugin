# GitLab

> **MCP 安全暂停（2026-08-22）**：安全状态：本版本不发布可执行 MCP 配置；安装不会启动该服务或发起网络请求。 本文保留目标能力与后续接入资料，不代表当前版本已连接或可执行。

CrabCode integration with the GitLab.com hosted MCP endpoint.

## Connect

The endpoint is `https://gitlab.com/api/v4/mcp`. GitLab will perform its own
authorization flow on first connection. Self-managed GitLab instances should
swap the URL in `.mcp.json` to their own `/api/v4/mcp` endpoint.

## What you can do

- Manage repositories and branches
- Review and merge merge requests
- Inspect and trigger CI/CD pipelines
- Manage issues, wikis, and epics

## Notes

This plugin only wires the GitLab MCP endpoint into CrabCode. CrabCode does
not own or maintain that server; authentication and rate limits follow
GitLab's policy.
