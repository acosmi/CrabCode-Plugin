# Playwright

> **MCP 安全暂停（2026-08-22）**：本版本不发布可执行 MCP 配置；安装不会启动该服务或发起网络请求。如果曾安装旧版，请先升级插件并重启 CrabCode；仅重载插件不能证明旧 MCP 客户端或进程已退出。下文任何 Connect、`.mcp.json`、端点、launcher 或启动描述均仅是历史配置/未来恢复审查参考，不代表本版本会生成配置、连接、启动或提供相应工具。

Historical Playwright MCP integration metadata. The current package provides no
browser MCP tools and starts no browser.

## Historical connection reference (inactive)

The removed configuration used the floating `@playwright/mcp@latest` launcher
and could install browser binaries. It is incident history only; do not run it.

## Historical target capabilities (not available)

- Navigate to URLs and inspect page DOM and accessibility tree
- Fill forms, click elements, and capture screenshots
- Run scripted browser flows for end-to-end test creation
- Diagnose flaky tests by reproducing user steps

## Notes

The MCP server controls a real browser. Treat any URL it opens as you would
in a normal session — only navigate to sites you trust.
