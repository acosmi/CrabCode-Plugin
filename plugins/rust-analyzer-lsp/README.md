# rust-analyzer-lsp

Rust language server (rust-analyzer) bridge for CrabCode, providing code intelligence and analysis.

This plugin is a CrabCode wrapper around the upstream rust-analyzer language server. It does **not** install the server for you. The TypeScript launcher at `src/lsp-wrapper.ts` spawns `rust-analyzer` over stdio with no shell interpolation, forwards lifecycle signals, and emits an install hint when the binary is missing.

## Supported Extensions

`.rs`

## Installation

### rustup (recommended)

```bash
rustup component add rust-analyzer
```

### macOS (Homebrew)

```bash
brew install rust-analyzer
```

### Debian / Ubuntu

```bash
sudo apt install rust-analyzer
```

### Arch Linux

```bash
sudo pacman -S rust-analyzer
```

### Manual

```bash
# Pre-built binaries: https://github.com/rust-lang/rust-analyzer/releases
```

## Usage

After installing rust-analyzer, register this plugin with CrabCode. The runtime entry is declared in `.mcp.json` and starts the wrapper via `bun run src/lsp-wrapper.ts`. The wrapper proxies LSP traffic between the CrabCode host and the upstream server.

If `rust-analyzer` is missing from `PATH`, the wrapper exits with status 127 and prints an install hint to stderr.

## Upstream

- Project: [rust-analyzer](https://github.com/rust-lang/rust-analyzer)
- License: MIT OR Apache-2.0

See [`docs/legal/THIRD_PARTY_NOTICES.md`](docs/legal/THIRD_PARTY_NOTICES.md) for full attribution.
