# Parallel 5: Runtime, Hook, and Bridge Plugins Present in Source

Date: 2026-05-19
Parallelism: 5 workers
Source roots:

- `bangong/claude-plugins-official/plugins`
- `bangong/claude-plugins-official/external_plugins`

## Scope

This batch covers source-present plugins with runtime behavior: hook handlers, bridge servers, repeated loop control, or generated policy logic. These require the most careful TypeScript rewrites.

## Shared Runtime Rules

- Re-implement executable code in TypeScript.
- Avoid shell string interpolation.
- Parse hook input as structured JSON.
- Treat all conversation text, file paths, and diff content as untrusted input.
- Make writes explicit and user-triggered.
- Prefer dry-run output when behavior could modify the workspace.

## Worker Assignments

| Worker | Source | Target | Runtime Concern |
|---|---|---|---|
| RT-01 | `plugins/hookify` | `plugins/hookify` | Python matcher/core rewrite to TypeScript; hook rule DSL. |
| RT-02 | `plugins/security-guidance` | `plugins/security-guidance` | Security reminder hook rewrite to TypeScript. |
| RT-03 | `plugins/explanatory-output-style` and `plugins/learning-output-style` | `plugins/explanatory-output-style`, `plugins/learning-output-style` | Hook handler rewrite and output-style copy cleanup. |
| RT-04 | `plugins/ralph-loop` | `plugins/ralph-loop` | Loop command and hook safety; prevent runaway execution. |
| RT-05 | `external_plugins/discord`, `external_plugins/fakechat`, `external_plugins/imessage`, `external_plugins/telegram` | `plugins/discord`, `plugins/fakechat`, `plugins/imessage`, `plugins/telegram` | TS bridge servers and access-control workflows. |

## Target Runtime Layout

```text
plugins/<plugin-name>/
  .crabcode-plugin/plugin.json
  src/
    index.ts
    hooks/
    server/
    policy/
  tests/
  package.json
  tsconfig.json
```

Use separate packages only when a plugin has enough runtime code to justify isolated dependencies.

## Hookify Plan

1. Inventory current Python modules under `core`, `matchers`, and `utils`.
2. Define TS interfaces for hook events, matcher rules, and decisions.
3. Port matcher behavior with fixture tests.
4. Rewrite commands and skills as CrabCode-native.
5. Validate deny/allow decisions with deterministic fixtures.

## Security Guidance Plan

1. Convert hook handler to TS.
2. Keep warnings advisory unless a rule explicitly blocks an action.
3. Test command injection, XSS, unsafe deserialization, and secret-adjacent edit examples.
4. Ensure warning text names concrete risk, not generic fear.

## Output Style Hook Plan

1. Rewrite hook handler copy and installation wording.
2. Ensure no deprecated upstream naming survives.
3. Validate hook events do not write to user files.

## Ralph Loop Plan

1. Rebuild loop orchestration in TS.
2. Add max iteration, timeout, and explicit user confirmation controls.
3. Require per-iteration status output.
4. Disable automatic long-running loops by default.

## Bridge Server Plan

1. Keep transport-specific vendors: Discord, iMessage, Telegram.
2. Replace Claude channel phrasing with CrabCode channel phrasing.
3. Rewrite access control skills and commands.
4. Store credentials only through the approved MCP/server mechanism.
5. Test allowlist, denylist, pairing, and unauthenticated access.

## Validation

Per runtime plugin:

```bash
bun install
bun run typecheck
bun test
bun run build
bun run scripts/lint-brand.ts plugins/<plugin-name>
crabcode plugin validate /Users/fushihua/Desktop/CrabCode-Plugin/plugins/<plugin-name>
```

## Acceptance

Each plugin must include at least one runtime fixture test for every hook/server path it exposes.
