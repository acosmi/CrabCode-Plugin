# gopls-lsp

Go language server (gopls) bridge for CrabCode, providing code intelligence, refactoring, and analysis.

This plugin is a CrabCode wrapper around the upstream gopls language server. It does **not** install the server for you. The TypeScript launcher at `src/lsp-wrapper.ts` spawns `gopls` over stdio with no shell interpolation, forwards lifecycle signals, and emits an install hint when the binary is missing.

## Supported Extensions

`.go`

## Installation

### Go toolchain

```bash
go install golang.org/x/tools/gopls@latest
# Ensure $GOPATH/bin (or $HOME/go/bin) is on PATH
```

## Usage

After installing gopls, register this plugin with CrabCode. The runtime entry is declared in `.mcp.json` and starts the wrapper via `bun run src/lsp-wrapper.ts`. The wrapper proxies LSP traffic between the CrabCode host and the upstream server.

If `gopls` is missing from `PATH`, the wrapper exits with status 127 and prints an install hint to stderr.

## Upstream

- Project: [gopls](https://pkg.go.dev/golang.org/x/tools/gopls)
- License: BSD-3-Clause

See [`docs/legal/THIRD_PARTY_NOTICES.md`](docs/legal/THIRD_PARTY_NOTICES.md) for full attribution.
