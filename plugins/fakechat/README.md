# Fakechat

> **MCP 安全暂停（2026-08-22）**：安全状态：本版本不发布可执行 MCP 配置；安装不会启动该服务或发起网络请求。 本文保留目标能力与后续接入资料，不代表当前版本已连接或可执行。

Localhost chat surface for exercising CrabCode's bridge notification flow.
No third-party service, no tokens, no access control — strictly a test
harness.

> Window B (this plugin) provides only the wrapper scaffold. The TypeScript
> server (`src/`) is produced by the runtime migration window.

## Connect

`.mcp.json` invokes `bun run --cwd ${CRABCODE_PLUGIN_ROOT} --shell=bun
--silent start`. The runtime migration window supplies the `start` script
in `package.json`.

## What it provides

- A localhost-only web chat surface
- Inbound messages relayed to CrabCode for the test session
- Outbound CrabCode responses rendered back into the page

## Notes

Do not expose the fakechat surface beyond `127.0.0.1`. It deliberately has
no auth and is intended for local development only.
