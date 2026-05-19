# kotlin-lsp

Kotlin language server bridge for CrabCode, providing code intelligence, refactoring, and analysis.

This plugin is a CrabCode wrapper around the upstream kotlin-lsp language server. It does **not** install the server for you. The TypeScript launcher at `src/lsp-wrapper.ts` spawns `kotlin-lsp` over stdio with no shell interpolation, forwards lifecycle signals, and emits an install hint when the binary is missing.

## Supported Extensions

`.kt`, `.kts`

## Installation

### macOS (Homebrew)

```bash
brew install JetBrains/utils/kotlin-lsp
```

## Usage

After installing kotlin-lsp, register this plugin with CrabCode. The runtime entry is declared in `.mcp.json` and starts the wrapper via `bun run src/lsp-wrapper.ts`. The wrapper proxies LSP traffic between the CrabCode host and the upstream server.

If `kotlin-lsp` is missing from `PATH`, the wrapper exits with status 127 and prints an install hint to stderr.

## Upstream

- Project: [kotlin-lsp](https://github.com/Kotlin/kotlin-lsp)
- License: Apache-2.0

See [`docs/legal/THIRD_PARTY_NOTICES.md`](docs/legal/THIRD_PARTY_NOTICES.md) for full attribution.
