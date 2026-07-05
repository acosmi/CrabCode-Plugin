# CrabCode Setup Plugin

This repository builds a CrabCode-native plugin that analyzes a target codebase and recommends read-only automation improvements.

## Commands

- Install dependencies: `bun install`
- Analyze a project: `bun run analyze -- --cwd /path/to/project --format markdown`
- Typecheck: `bun run typecheck`
- Test: `bun test`
- Build: `bun run build` (`dist/` is not tracked in git; run this before using the `crabcode-setup` bin)
- Brand scan: `bun run lint:brand`
- Validate plugin with a built CrabCode CLI: `crabcode plugin validate /Users/fushihua/Desktop/CrabCode-Plugin`

## Safety

The analyzer must remain read-only. Detection code may read directories and files, but must not write, delete, rename, install packages, call the network, or change CrabCode settings.

Keep product-facing copy CrabCode-native. Upstream reference attribution belongs only in legal notices or implementation planning documents.

