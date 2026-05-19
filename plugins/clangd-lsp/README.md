# clangd-lsp

C/C++ language server (clangd) bridge for CrabCode, providing code intelligence, diagnostics, and formatting.

This plugin is a CrabCode wrapper around the upstream clangd language server. It does **not** install the server for you. The TypeScript launcher at `src/lsp-wrapper.ts` spawns `clangd` over stdio with no shell interpolation, forwards lifecycle signals, and emits an install hint when the binary is missing.

## Supported Extensions

`.c`, `.h`, `.cpp`, `.cc`, `.cxx`, `.hpp`, `.hxx`, `.C`, `.H`

## Installation

### macOS (Homebrew)

```bash
brew install llvm
# Add to PATH: export PATH="/opt/homebrew/opt/llvm/bin:$PATH"
```

### Debian / Ubuntu

```bash
sudo apt install clangd
```

### Fedora

```bash
sudo dnf install clang-tools-extra
```

### Arch Linux

```bash
sudo pacman -S clang
```

### Windows

```bash
winget install LLVM.LLVM
```

## Usage

After installing clangd, register this plugin with CrabCode. The runtime entry is declared in `.mcp.json` and starts the wrapper via `bun run src/lsp-wrapper.ts`. The wrapper proxies LSP traffic between the CrabCode host and the upstream server.

If `clangd` is missing from `PATH`, the wrapper exits with status 127 and prints an install hint to stderr.

## Upstream

- Project: [clangd](https://clangd.llvm.org/)
- License: Apache-2.0 WITH LLVM-exception

See [`docs/legal/THIRD_PARTY_NOTICES.md`](docs/legal/THIRD_PARTY_NOTICES.md) for full attribution.
