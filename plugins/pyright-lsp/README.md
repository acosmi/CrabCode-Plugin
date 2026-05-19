# pyright-lsp

Python language server (Pyright) bridge for CrabCode, providing static type checking and code intelligence.

This plugin is a CrabCode wrapper around the upstream Pyright language server. It does **not** install the server for you. The TypeScript launcher at `src/lsp-wrapper.ts` spawns `pyright-langserver` over stdio with no shell interpolation, forwards lifecycle signals, and emits an install hint when the binary is missing.

## Supported Extensions

`.py`, `.pyi`

## Installation

### npm

```bash
npm install -g pyright
```

### pip

```bash
pip install pyright
```

### pipx (recommended)

```bash
pipx install pyright
```

## Usage

After installing pyright-langserver, register this plugin with CrabCode. The runtime entry is declared in `.mcp.json` and starts the wrapper via `bun run src/lsp-wrapper.ts`. The wrapper proxies LSP traffic between the CrabCode host and the upstream server.

If `pyright-langserver` is missing from `PATH`, the wrapper exits with status 127 and prints an install hint to stderr.

## Upstream

- Project: [Pyright](https://github.com/microsoft/pyright)
- License: MIT

See [`docs/legal/THIRD_PARTY_NOTICES.md`](docs/legal/THIRD_PARTY_NOTICES.md) for full attribution.
