# Telegram

> **MCP 安全暂停（2026-08-22）**：本版本不发布可执行 MCP 配置；安装不会启动该服务或发起网络请求。如果曾安装旧版，请先升级插件并重启 CrabCode；仅重载插件不能证明旧 MCP 客户端或进程已退出。下文任何 Connect、`.mcp.json`、端点、launcher 或启动描述均仅是历史配置/未来恢复审查参考，不代表本版本会生成配置、连接、启动或提供相应工具。

Historical Telegram messaging-bridge design. A future reviewed runtime would
accept approved inbound senders and relay outbound responses; the current
package starts no bridge.

> Window B (this plugin) provides only the wrapper scaffold. The TypeScript
> bridge server (`src/`) and the access-control skills (`skills/access`,
> `skills/configure`) are produced by the runtime migration window.

## Historical connection reference (inactive)

The removed `.mcp.json` historically invoked a Bun `start` script. The current
package has no executable entry, does not start the bridge, and does not need a
bot token; future runtime work requires a separate security and release review.

## Access control

The historical design required pairing or an allowlist and local-only access
mutations. These are future review requirements, not current runtime behavior.

## Notes

This wrapper preserves historical design notes; it does not pin or ship a live launcher.
Refer to the bridge's own documentation for token setup, pairing flow, and
policy choices once the runtime ships.
