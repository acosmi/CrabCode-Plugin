# Asana

> **MCP 安全暂停（2026-08-22）**：本版本不发布可执行 MCP 配置；安装不会启动该服务或发起网络请求。如果曾安装旧版，请先升级插件并重启 CrabCode；仅重载插件不能证明旧 MCP 客户端或进程已退出。下文任何 Connect、`.mcp.json`、端点、launcher 或启动描述均仅是历史配置/未来恢复审查参考，不代表本版本会生成配置、连接、启动或提供相应工具。

Historical Asana MCP integration metadata. The current package provides no
Asana tools or connection.

## Historical connection reference (inactive)

The removed `.mcp.json` pointed at the legacy Asana SSE endpoint. This endpoint
is retained only as incident history; do not copy it or attempt sign-in from
this plugin.

## Historical target capabilities (not available)

- List, search, and filter tasks across workspaces
- Create and update tasks, including assignees, due dates, and custom fields
- Read and update project metadata
- Cross-reference Asana work with files you are editing

## Notes

Future restoration would require provider and host E2E, security review, and a
new approved release. The current plugin does not wire an Asana server.
