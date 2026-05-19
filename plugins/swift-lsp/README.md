# swift-lsp

Swift language server (SourceKit-LSP) bridge for CrabCode, providing code intelligence for Swift projects.

This plugin is a CrabCode wrapper around the upstream SourceKit-LSP language server. It does **not** install the server for you. The TypeScript launcher at `src/lsp-wrapper.ts` spawns `sourcekit-lsp` over stdio with no shell interpolation, forwards lifecycle signals, and emits an install hint when the binary is missing.

## Supported Extensions

`.swift`

## Installation

### macOS (Xcode)

```bash
# Install Xcode from the App Store
```

### macOS (Homebrew)

```bash
brew install swift
```

### Linux

```bash
# Download and install from https://www.swift.org/download/
```

## Usage

After installing sourcekit-lsp, register this plugin with CrabCode. The runtime entry is declared in `.mcp.json` and starts the wrapper via `bun run src/lsp-wrapper.ts`. The wrapper proxies LSP traffic between the CrabCode host and the upstream server.

If `sourcekit-lsp` is missing from `PATH`, the wrapper exits with status 127 and prints an install hint to stderr.

## Upstream

- Project: [SourceKit-LSP](https://github.com/apple/sourcekit-lsp)
- License: Apache-2.0 WITH Runtime Library Exception

See [`docs/legal/THIRD_PARTY_NOTICES.md`](docs/legal/THIRD_PARTY_NOTICES.md) for full attribution.
