# GitLab

> **MCP 安全暂停（2026-08-22）**：本版本不发布可执行 MCP 配置；安装不会启动该服务或发起网络请求。如果曾安装旧版，请先升级插件并重启 CrabCode；仅重载插件不能证明旧 MCP 客户端或进程已退出。下文任何 Connect、`.mcp.json`、端点、launcher 或启动描述均仅是历史配置/未来恢复审查参考，不代表本版本会生成配置、连接、启动或提供相应工具。

Historical GitLab MCP integration metadata. The current package provides no
GitLab MCP tools or connection.

## Historical connection reference (inactive)

The removed configuration referenced GitLab's hosted endpoint. It is retained
only as incident history; do not copy it or create a replacement `.mcp.json`.

## Historical target capabilities (not available)

- Manage repositories and branches
- Review and merge merge requests
- Inspect and trigger CI/CD pipelines
- Manage issues, wikis, and epics

## Notes

Future restoration would require provider/host E2E and an approved release.
The current plugin does not wire a GitLab endpoint.
