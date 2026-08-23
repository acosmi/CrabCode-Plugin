# iMessage

> **MCP 安全暂停（2026-08-22）**：本版本不发布可执行 MCP 配置；安装不会启动该服务或发起网络请求。如果曾安装旧版，请先升级插件并重启 CrabCode；仅重载插件不能证明旧 MCP 客户端或进程已退出。下文任何 Connect、`.mcp.json`、端点、launcher 或启动描述均仅是历史配置/未来恢复审查参考，不代表本版本会生成配置、连接、启动或提供相应工具。

Historical iMessage bridge design for macOS. A future runtime would need direct
Messages database and AppleScript access; the current package neither reads nor
sends messages.

> Window B (this plugin) provides only the wrapper scaffold. The TypeScript
> bridge server (`src/`) and the access-control skills are produced by the
> runtime migration window.

## macOS permissions

Historical runtime design required the following grants. The current inactive
package does not request them:

- **Full Disk Access** — required to read `~/Library/Messages/chat.db`.
  Grant this to the terminal (or IDE) that launches CrabCode under System
  Settings → Privacy & Security → Full Disk Access.
- **Automation / Apple Events** — required so the bridge can drive Messages
  via AppleScript. macOS prompts for this on first send.

Do not grant these permissions for this inactive plugin.

## Historical connection reference (inactive)

The removed `.mcp.json` historically invoked a Bun `start` script. The current
package has no executable entry and does not start the bridge; future runtime
work must pass a separate permissions, security, and release review.

## Access control

The historical design proposed an allowlist and local-only policy mutation.
Pairing and self-chat bypass behavior require separate future security review;
none is active in this version.

## Notes

This wrapper preserves historical design notes; it does not pin or ship a live launcher.
Refer to the bridge's own documentation for the full setup flow once the
runtime ships.
