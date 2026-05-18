# Deep Audit Fix Plan

Date: 2026-05-18

## Root Causes

1. Invalid scan roots were not validated before directory walking, so missing paths looked like empty projects.
2. Runtime evidence from target repositories was rendered directly, so target-owned script names and paths could leak banned product terms.
3. The scanner only parsed the root `package.json`, which missed nested workspace packages.
4. The wrapper relied on Bun even though the plugin ships a built Node CLI.
5. The read-only guard only scanned analyzer and detector folders, leaving later pipeline stages outside the check.

## Fixes Implemented

1. Validate `--cwd` before scanning and fail on missing or non-directory roots.
2. Parse every discovered `package.json` outside ignored directories and merge dependency/script signals.
3. Detect nested frontend files and nested package dependencies.
4. Sanitize every string in the report object before Markdown or JSON rendering.
5. Prefer `node ${CRABCODE_PLUGIN_ROOT}/dist/cli.js` in plugin wrappers, with a Bun source fallback for local development.
6. Expand the read-only guard to all `src/**/*.ts`.
7. Add regression tests for missing roots, nested workspaces, and sanitized target evidence.
8. Add a CI scan for built `dist` output.

## Verification

- `bun run typecheck`
- `bun test`
- `bun run build`
- `bun run lint:brand`
- `bun run scripts/lint-brand.ts dist`
- `plugin validate /Users/fushihua/Desktop/CrabCode-Plugin`
- `--plugin-dir /Users/fushihua/Desktop/CrabCode-Plugin plugin list --json`
- Node wrapper execution against the TypeScript frontend fixture
- Non-interactive CrabCode plugin invocation against the TypeScript frontend fixture

