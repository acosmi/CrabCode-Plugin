# lua-lsp

Lua language server bridge for CrabCode, providing code intelligence and diagnostics.

This plugin is a CrabCode wrapper around the upstream lua-language-server language server. It does **not** install the server for you. The TypeScript launcher at `src/lsp-wrapper.ts` spawns `lua-language-server` over stdio with no shell interpolation, forwards lifecycle signals, and emits an install hint when the binary is missing.

## Supported Extensions

`.lua`

## Installation

### macOS (Homebrew)

```bash
brew install lua-language-server
```

### Ubuntu (snap)

```bash
sudo snap install lua-language-server --classic
```

### Arch Linux

```bash
sudo pacman -S lua-language-server
```

### Fedora

```bash
sudo dnf install lua-language-server
```

### Manual

```bash
# Pre-built binaries: https://github.com/LuaLS/lua-language-server/releases
```

## Usage

After installing lua-language-server, register this plugin with CrabCode. The runtime entry is declared in `.mcp.json` and starts the wrapper via `bun run src/lsp-wrapper.ts`. The wrapper proxies LSP traffic between the CrabCode host and the upstream server.

If `lua-language-server` is missing from `PATH`, the wrapper exits with status 127 and prints an install hint to stderr.

## Upstream

- Project: [lua-language-server](https://github.com/LuaLS/lua-language-server)
- License: MIT

See [`docs/legal/THIRD_PARTY_NOTICES.md`](docs/legal/THIRD_PARTY_NOTICES.md) for full attribution.
