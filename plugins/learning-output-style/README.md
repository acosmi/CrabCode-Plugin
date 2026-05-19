# learning-output-style

A SessionStart hook that switches the agent into learning mode: it surfaces meaningful 5-10 line code-write opportunities for the user and pairs them with inline educational insights.

Warning: this plugin adds non-trivial system-context tokens to every session. Install it only if that token cost is acceptable.

## What it does

On every session start, the hook prints a JSON envelope whose `hookSpecificOutput.additionalContext` configures learning mode. The agent is asked to:

1. Hand the user 5-10 line code-write moments that shape the solution.
2. Frame each request with context, why it matters, and trade-offs.
3. Skip handing off boilerplate, CRUD, and obvious implementations.
4. Provide inline educational insights formatted as:

```
* Insight -----------------------------------------
[2-3 key educational points]
-----------------------------------------------------
```

The hook does not modify any files, settings, or session state.

## Layout

```
.crabcode-plugin/plugin.json
hooks/hooks.json
src/sessionStart.ts
tests/sessionStart.test.ts
package.json
tsconfig.json
docs/legal/THIRD_PARTY_NOTICES.md
```

## Validation

```bash
bun install
bun run typecheck
bun test
bun run build
```
