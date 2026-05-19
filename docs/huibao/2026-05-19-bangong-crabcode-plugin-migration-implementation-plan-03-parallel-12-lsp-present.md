# Parallel 12: LSP Plugins Present in Source

Date: 2026-05-19
Parallelism: 12 workers
Source root: `bangong/claude-plugins-official/plugins`

## Scope

This batch covers source-present language server plugins that currently contain minimal source material. Most have only `README.md` and `LICENSE`, so the CrabCode implementation should use a shared TypeScript LSP wrapper pattern plus per-language metadata.

## Shared Target Shape

```text
plugins/<language>-lsp/
  .crabcode-plugin/plugin.json
  .mcp.json
  src/lsp-wrapper.ts
  package.json
  tsconfig.json
  docs/legal/THIRD_PARTY_NOTICES.md
```

If a plugin can be purely declarative, use `.mcp.json` only and omit `src/`.

## Shared TypeScript Runtime

Create a common runtime package or template that:

- locates the language server executable,
- reports a helpful missing-binary message,
- starts the server through stdio,
- avoids shell interpolation,
- logs only safe diagnostic text,
- does not install dependencies automatically.

The batch lead should decide whether this lives in each plugin or a shared `packages/lsp-wrapper` utility.

## Worker Assignments

| Worker | Source | Target | Server |
|---|---|---|---|
| LSP-01 | `plugins/clangd-lsp` | `plugins/clangd-lsp` | `clangd` |
| LSP-02 | `plugins/csharp-lsp` | `plugins/csharp-lsp` | C# language server |
| LSP-03 | `plugins/gopls-lsp` | `plugins/gopls-lsp` | `gopls` |
| LSP-04 | `plugins/jdtls-lsp` | `plugins/jdtls-lsp` | Eclipse JDT LS |
| LSP-05 | `plugins/kotlin-lsp` | `plugins/kotlin-lsp` | Kotlin language server |
| LSP-06 | `plugins/lua-lsp` | `plugins/lua-lsp` | Lua language server |
| LSP-07 | `plugins/php-lsp` | `plugins/php-lsp` | Intelephense or configured PHP LSP |
| LSP-08 | `plugins/pyright-lsp` | `plugins/pyright-lsp` | Pyright |
| LSP-09 | `plugins/ruby-lsp` | `plugins/ruby-lsp` | Ruby LSP |
| LSP-10 | `plugins/rust-analyzer-lsp` | `plugins/rust-analyzer-lsp` | rust-analyzer |
| LSP-11 | `plugins/swift-lsp` | `plugins/swift-lsp` | SourceKit-LSP |
| LSP-12 | `plugins/typescript-lsp` | `plugins/typescript-lsp` | TypeScript language server |

## Required Changes Per Plugin

1. Add `.crabcode-plugin/plugin.json`.
2. Add or adapt `.mcp.json` for the LSP runtime.
3. Add per-language executable metadata.
4. Add a short CrabCode-native skill only if usage needs procedural guidance.
5. Keep install hints as hints, not auto-install behavior.
6. Add marketplace entry.

## Validation

For each plugin:

```bash
bun run scripts/lint-brand.ts plugins/<plugin-name>
crabcode plugin validate /Users/fushihua/Desktop/CrabCode-Plugin/plugins/<plugin-name>
```

If TypeScript runtime is used:

```bash
bun run typecheck
bun test
```

## Acceptance

Each plugin must fail gracefully when the language server is missing and must start without shell injection risk when the server exists.
