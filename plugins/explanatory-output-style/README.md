# explanatory-output-style

A SessionStart hook that asks the agent to provide brief inline educational insights about implementation choices while it works.

Warning: this plugin adds non-trivial system-context tokens to every session. Install it only if that token cost is acceptable.

## What it does

On every session start, the hook prints a JSON envelope whose `hookSpecificOutput.additionalContext` describes the explanatory mode. The agent is asked to:

1. Provide short educational insights about implementation choices.
2. Explain codebase patterns and decisions.
3. Balance task completion with learning opportunities.

Insights are formatted as:

```
* Insight -----------------------------------------
[2-3 key educational points]
-----------------------------------------------------
```

The hook does not modify any files, settings, or session state. It only emits stdout.

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
