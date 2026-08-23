# Firebase

> **MCP 安全暂停（2026-08-22）**：本版本不发布可执行 MCP 配置；安装不会启动该服务或发起网络请求。如果曾安装旧版，请先升级插件并重启 CrabCode；仅重载插件不能证明旧 MCP 客户端或进程已退出。下文任何 Connect、`.mcp.json`、端点、launcher 或启动描述均仅是历史配置/未来恢复审查参考，不代表本版本会生成配置、连接、启动或提供相应工具。

Historical Firebase MCP integration metadata. The current package provides no
Firebase tools or connection.

## Historical connection reference (inactive)

The removed configuration used the floating `firebase-tools@latest` launcher.
It is incident history only; do not run the launcher or perform plugin-directed
login from this version.

## Historical target capabilities (not available)

- Inspect and edit Firestore documents
- Inspect Authentication users
- Trigger and inspect Cloud Functions
- Review hosting and storage configuration

## Notes

Operations execute against whatever project is currently selected with
`firebase use`. Treat production projects accordingly.
