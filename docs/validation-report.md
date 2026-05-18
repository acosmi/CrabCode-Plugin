# Validation Report

Date: 2026-05-18

## Local Checks

- `bun install`
- `bun install --frozen-lockfile`
- `bun run typecheck`
- `bun test`
- `bun run build`
- `bun run lint:brand`
- `bun run scripts/lint-brand.ts dist`
- Raw product-surface brand scan with `rg`

## Analyzer Checks

- Markdown output generated for `/Users/fushihua/Desktop/CrabCode-Plugin`.
- Markdown output generated for `/Users/fushihua/Desktop/CrabCode`.
- JSON output generated for `/Users/fushihua/Desktop/CrabCode`.
- Generated Markdown and JSON reports passed the brand scan.
- Built CLI output from `node dist/cli.js` passed the brand scan.
- Missing scan roots now fail with exit code `1`.
- Nested workspace package detection now finds frontend package dependencies and scripts.
- Target-owned evidence containing banned product terms is sanitized before Markdown and JSON rendering.

## Plugin Checks

- Built the local CrabCode CLI from `/Users/fushihua/Desktop/CrabCode`.
- `plugin validate /Users/fushihua/Desktop/CrabCode-Plugin` passed.
- `plugin validate /Users/fushihua/Desktop/CrabCode-Plugin/.crabcode-plugin/plugin.json` passed.
- `--plugin-dir /Users/fushihua/Desktop/CrabCode-Plugin plugin list --json` loaded `crabcode-setup@inline`.
- Non-interactive invocation with `--plugin-dir` and `/crabcode-setup:recommend-automation` produced a recommendation report for the TypeScript frontend fixture.
- The plugin wrapper now prefers the built Node CLI and keeps a Bun source fallback for local development.

## Notes

- The analyzer remains read-only by design and test.
- Runtime recommendations do not install plugins, register MCP servers, create hooks, or write CrabCode settings.
- Marketplace plugin names remain generic until an available CrabCode marketplace catalog is selected.
