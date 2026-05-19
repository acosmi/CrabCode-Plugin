# jdtls-lsp

Java language server (Eclipse JDT.LS) bridge for CrabCode, providing code intelligence and refactoring.

This plugin is a CrabCode wrapper around the upstream Eclipse JDT Language Server language server. It does **not** install the server for you. The TypeScript launcher at `src/lsp-wrapper.ts` spawns `jdtls` over stdio with no shell interpolation, forwards lifecycle signals, and emits an install hint when the binary is missing.

## Supported Extensions

`.java`

## Installation

### macOS (Homebrew)

```bash
brew install jdtls
```

### Arch Linux (AUR)

```bash
yay -S jdtls
```

### Manual

```bash
# 1. Download https://download.eclipse.org/jdtls/snapshots/
# 2. Extract to ~/.local/share/jdtls
# 3. Create a 'jdtls' wrapper script on PATH
```

## Requirements

- Java 17 or later (JDK, not just JRE).

## Usage

After installing jdtls, register this plugin with CrabCode. The runtime entry is declared in `.mcp.json` and starts the wrapper via `bun run src/lsp-wrapper.ts`. The wrapper proxies LSP traffic between the CrabCode host and the upstream server.

If `jdtls` is missing from `PATH`, the wrapper exits with status 127 and prints an install hint to stderr.

## Upstream

- Project: [Eclipse JDT Language Server](https://github.com/eclipse-jdtls/eclipse.jdt.ls)
- License: EPL-2.0

See [`docs/legal/THIRD_PARTY_NOTICES.md`](docs/legal/THIRD_PARTY_NOTICES.md) for full attribution.
