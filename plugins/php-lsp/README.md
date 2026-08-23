# php-lsp

> **MCP 安全暂停（2026-08-22）**：本版本不发布可执行 MCP 配置；安装不会启动该服务或发起网络请求。如果曾安装旧版，请先升级插件并重启 CrabCode；仅重载插件不能证明旧 MCP 客户端或进程已退出。下文任何 Connect、`.mcp.json`、端点、launcher 或启动描述均仅是历史配置/未来恢复审查参考，不代表本版本会生成配置、连接、启动或提供相应工具。

PHP language server (Intelephense) bridge for CrabCode, providing code intelligence and diagnostics.

This plugin is a CrabCode wrapper around the upstream Intelephense language server. It does **not** install the server for you. The TypeScript launcher at `src/lsp-wrapper.ts` spawns `intelephense` over stdio with no shell interpolation, forwards lifecycle signals, and emits an install hint when the binary is missing.

## Supported Extensions

`.php`

## Installation

### npm

```bash
npm install -g intelephense
```

### yarn

```bash
yarn global add intelephense
```

## Usage

Historical reference only: the removed `.mcp.json` started this wrapper via `bun run src/lsp-wrapper.ts` and proxied LSP traffic. The current version does not register or start the wrapper; installing the upstream binary does not reactivate it.

If `intelephense` is missing from `PATH`, the wrapper exits with status 127 and prints an install hint to stderr.

## Upstream

- Project: [Intelephense](https://intelephense.com/)
- License: MIT (free tier)

See [`docs/legal/THIRD_PARTY_NOTICES.md`](docs/legal/THIRD_PARTY_NOTICES.md) for full attribution.
