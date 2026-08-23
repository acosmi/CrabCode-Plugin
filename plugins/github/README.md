# GitHub

> **MCP 安全暂停（2026-08-22）**：本版本不发布可执行 MCP 配置；安装不会启动该服务或发起网络请求。如果曾安装旧版，请先升级插件并重启 CrabCode；仅重载插件不能证明旧 MCP 客户端或进程已退出。下文任何 Connect、`.mcp.json`、端点、launcher 或启动描述均仅是历史配置/未来恢复审查参考，不代表本版本会生成配置、连接、启动或提供相应工具。

Historical GitHub MCP integration metadata. The current package provides no
GitHub MCP tools or connection.

## Historical connection reference (inactive)

The removed configuration passed a personal access token to a remote HTTP
transport. This is incident history only; do not export a token for this plugin.

## Historical target capabilities (not available)

- Create and update issues
- Open, review, and merge pull requests
- Search code and repositories
- Read and update repository metadata

## Notes

Future restoration would require provider/host E2E, scoped authentication, and
an approved release. The current plugin does not wire a GitHub endpoint.
