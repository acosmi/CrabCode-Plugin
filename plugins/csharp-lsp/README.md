# csharp-lsp

C# language server bridge for CrabCode, providing code intelligence and diagnostics.

This plugin is a CrabCode wrapper around the upstream csharp-language-server language server. It does **not** install the server for you. The TypeScript launcher at `src/lsp-wrapper.ts` spawns `csharp-ls` over stdio with no shell interpolation, forwards lifecycle signals, and emits an install hint when the binary is missing.

## Supported Extensions

`.cs`

## Installation

### .NET tool (recommended)

```bash
dotnet tool install --global csharp-ls
```

### macOS (Homebrew)

```bash
brew install csharp-ls
```

## Requirements

- .NET SDK 6.0 or later.

## Usage

After installing csharp-ls, register this plugin with CrabCode. The runtime entry is declared in `.mcp.json` and starts the wrapper via `bun run src/lsp-wrapper.ts`. The wrapper proxies LSP traffic between the CrabCode host and the upstream server.

If `csharp-ls` is missing from `PATH`, the wrapper exits with status 127 and prints an install hint to stderr.

## Upstream

- Project: [csharp-language-server](https://github.com/razzmatazz/csharp-language-server)
- License: MIT

See [`docs/legal/THIRD_PARTY_NOTICES.md`](docs/legal/THIRD_PARTY_NOTICES.md) for full attribution.
