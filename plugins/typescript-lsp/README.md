# typescript-lsp

TypeScript/JavaScript language server bridge for CrabCode, providing code intelligence, go-to-definition, find references, and error checking.

This plugin is a CrabCode wrapper around the upstream typescript-language-server language server. It does **not** install the server for you. The TypeScript launcher at `src/lsp-wrapper.ts` spawns `typescript-language-server` over stdio with no shell interpolation, forwards lifecycle signals, and emits an install hint when the binary is missing.

## Supported Extensions

`.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.cts`, `.mjs`, `.cjs`

## Installation

### npm

```bash
npm install -g typescript-language-server typescript
```

### yarn

```bash
yarn global add typescript-language-server typescript
```

## Usage

After installing typescript-language-server, register this plugin with CrabCode. The runtime entry is declared in `.mcp.json` and starts the wrapper via `bun run src/lsp-wrapper.ts`. The wrapper proxies LSP traffic between the CrabCode host and the upstream server.

If `typescript-language-server` is missing from `PATH`, the wrapper exits with status 127 and prints an install hint to stderr.

## Upstream

- Project: [typescript-language-server](https://github.com/typescript-language-server/typescript-language-server)
- License: Apache-2.0

See [`docs/legal/THIRD_PARTY_NOTICES.md`](docs/legal/THIRD_PARTY_NOTICES.md) for full attribution.
