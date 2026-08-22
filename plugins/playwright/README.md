# Playwright

> **MCP 安全暂停（2026-08-22）**：安全状态：本版本不发布可执行 MCP 配置；安装不会启动该服务或发起网络请求。 本文保留目标能力与后续接入资料，不代表当前版本已连接或可执行。

CrabCode integration with Microsoft's Playwright MCP server. Drive a browser
from CrabCode for end-to-end test authoring, page inspection, and automated
screenshots.

## Connect

The plugin runs `npx @playwright/mcp@latest` on stdio. Node.js and `npx` are
the only host requirements; Playwright will install browser binaries on
first run.

## What you can do

- Navigate to URLs and inspect page DOM and accessibility tree
- Fill forms, click elements, and capture screenshots
- Run scripted browser flows for end-to-end test creation
- Diagnose flaky tests by reproducing user steps

## Notes

The MCP server controls a real browser. Treat any URL it opens as you would
in a normal session — only navigate to sites you trust.
