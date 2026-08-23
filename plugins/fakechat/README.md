# Fakechat

> **MCP 安全暂停（2026-08-22）**：本版本不发布可执行 MCP 配置；安装不会启动该服务或发起网络请求。如果曾安装旧版，请先升级插件并重启 CrabCode；仅重载插件不能证明旧 MCP 客户端或进程已退出。下文任何 Connect、`.mcp.json`、端点、launcher 或启动描述均仅是历史配置/未来恢复审查参考，不代表本版本会生成配置、连接、启动或提供相应工具。

Historical localhost chat-harness design for exercising bridge notifications.
The current package does not start or expose a chat surface.

> Window B (this plugin) provides only the wrapper scaffold. The TypeScript
> server (`src/`) is produced by the runtime migration window.

## Historical connection reference (inactive)

The removed `.mcp.json` historically invoked a Bun `start` script. The current
package has no executable entry and does not start the test surface; future
runtime work must pass a separate security and release review.

## Historical target behavior (not available)

- A localhost-only web chat surface
- Inbound messages relayed to CrabCode for the test session
- Outbound CrabCode responses rendered back into the page

## Notes

Do not expose the fakechat surface beyond `127.0.0.1`. It deliberately has
no auth and is intended for local development only.
