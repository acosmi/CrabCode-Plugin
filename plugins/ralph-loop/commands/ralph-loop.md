---
description: "Start a Ralph loop in the current session."
argument-hint: "PROMPT [--max-iterations N] [--completion-promise TEXT] [--yes]"
allowed-tools: ["Bash(bun ${CRABCODE_PLUGIN_ROOT}/src/setupRalphLoop.ts:*)"]
hide-from-slash-command-tool: "true"
---

# Ralph Loop

Run the CrabCode setup script to register the loop. The setup script writes a state file at `.crabcode/ralph-loop.local.md` in the current working directory and prints a summary.

```!
bun "${CRABCODE_PLUGIN_ROOT}/src/setupRalphLoop.ts" $ARGUMENTS
```

Once the loop is active, work on the task. When you try to exit, the Stop hook re-feeds the SAME PROMPT and bumps the iteration counter. The loop ends when:

- `--max-iterations` is reached, or
- you output `<promise>...</promise>` matching `--completion-promise`.

CRITICAL: never output a completion promise that is not genuinely TRUE. If the task is impossible or stuck, run `/cancel-ralph` instead.
