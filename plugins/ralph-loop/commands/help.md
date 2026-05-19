---
description: "Explain the Ralph Loop plugin and its commands."
---

# Ralph Loop Plugin

## Concept

Ralph Loop implements the "Ralph Wiggum" iterative development pattern: the same prompt is re-fed on every Stop until either a hard iteration cap is hit or the agent outputs a completion-promise tag. The agent's previous work persists in files and git history, so each iteration sees its own prior attempts and can refine them.

## Safety defaults

- The default cap is 5 iterations. The hard cap is 200.
- A loop with no `--completion-promise` requires `--yes` to start (you must confirm you want a capped but unattended loop).
- State lives in `.crabcode/ralph-loop.local.md` in the current working directory. Cancel any time with `/cancel-ralph`.

## Commands

### /ralph-loop PROMPT [OPTIONS]

Start a loop in this session. Examples:

```
/ralph-loop "Refactor the cache layer" --completion-promise "CACHE DONE"
/ralph-loop "Fix the auth bug" --completion-promise "FIXED" --max-iterations 10
/ralph-loop "Sweep dead code" --yes --max-iterations 3
```

Options:

- `--max-iterations N` — cap iterations (1..200). Default: 5.
- `--completion-promise TEXT` — phrase you must wrap in `<promise>TEXT</promise>` to exit early.
- `--yes` — required when no completion promise is set.

### /cancel-ralph

Removes the state file and reports the iteration count it was at.

## Stopping naturally

To finish a loop, output exactly:

```
<promise>YOUR_PHRASE</promise>
```

Only do so when the statement is genuinely true. If you cannot finish, run `/cancel-ralph` rather than emitting a false promise.

## When to use Ralph

Good for:

- Well-defined tasks with clear success criteria.
- Iteration with self-correction (greenfield modules, test-driven sweeps).

Not good for:

- Open-ended design work that needs human judgment.
- One-shot operations.
- Production debugging — use targeted debugging instead.
