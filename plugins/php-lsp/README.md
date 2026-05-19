# php-lsp

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

After installing intelephense, register this plugin with CrabCode. The runtime entry is declared in `.mcp.json` and starts the wrapper via `bun run src/lsp-wrapper.ts`. The wrapper proxies LSP traffic between the CrabCode host and the upstream server.

If `intelephense` is missing from `PATH`, the wrapper exits with status 127 and prints an install hint to stderr.

## Upstream

- Project: [Intelephense](https://intelephense.com/)
- License: MIT (free tier)

See [`docs/legal/THIRD_PARTY_NOTICES.md`](docs/legal/THIRD_PARTY_NOTICES.md) for full attribution.
