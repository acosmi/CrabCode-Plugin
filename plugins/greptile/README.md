# Greptile

> **MCP 安全暂停（2026-08-22）**：本版本不发布可执行 MCP 配置；安装不会启动该服务或发起网络请求。如果曾安装旧版，请先升级插件并重启 CrabCode；仅重载插件不能证明旧 MCP 客户端或进程已退出。下文任何 Connect、`.mcp.json`、端点、launcher 或启动描述均仅是历史配置/未来恢复审查参考，不代表本版本会生成配置、连接、启动或提供相应工具。

[Greptile](https://greptile.com) is an AI code review agent for GitHub and
GitLab. This file preserves historical integration metadata; the current
plugin does not connect CrabCode to Greptile.

## Historical connection reference (inactive)

The removed configuration used an API key over remote HTTP. This is incident
history only; do not create or export a key for this plugin.

## Historical target capabilities (not available)

- List, search, and inspect pull requests and merge requests
- Trigger a Greptile review on a pull request
- Read review comments, search past comments, and respond inline
- Inspect and create organization-level custom-context patterns

## Notes

Future restoration would require provider/host E2E, retention review, scoped
authentication, and an approved release. No endpoint is wired in this version.
