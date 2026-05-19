---
description: Get help with the hookify plugin.
allowed-tools: ["Read"]
---

# Hookify plugin help

Hookify lets users create custom hooks by writing small markdown rule files instead of editing `hooks.json`.

## How it works

Hookify installs CrabCode hooks for the following events:

- `PreToolUse` - before any tool executes.
- `PostToolUse` - after a tool executes.
- `Stop` - when the agent wants to stop.
- `UserPromptSubmit` - when the user submits a prompt.

Each hook reads rule files from `.crabcode/hookify.*.local.md` in the current working directory and evaluates them against the hook input.

## Rule file format

```markdown
---
name: warn-dangerous-rm
enabled: true
event: bash
pattern: rm\s+-rf
action: warn
---

Dangerous rm command detected. Verify the path before proceeding.
```

Fields:

- `name` - unique identifier (kebab-case).
- `enabled` - `true` or `false`.
- `event` - `bash`, `file`, `stop`, `prompt`, or `all`.
- `pattern` - simple regex (optional if `conditions:` is set).
- `action` - `warn` (default) or `block`.

For more complex rules use `conditions:` to AND multiple field checks. See `examples/sensitive-files-warning.local.md` and `examples/require-tests-stop.local.md`.

## Available commands

- `/hookify` - create rules from conversation analysis or explicit instructions.
- `/hookify:help` - this help.
- `/hookify:list` - list all configured rules.
- `/hookify:configure` - enable/disable existing rules interactively.

## Pattern syntax

Hookify uses JavaScript regular expressions (case-insensitive) so usage matches Bun's `new RegExp("pattern", "i")`. Examples:

| Pattern | Matches |
|---------|---------|
| `rm\s+-rf` | `rm -rf`, `rm  -rf` |
| `console\.log\(` | `console.log(` |
| `(eval\|exec)\(` | `eval(`, `exec(` |
| `chmod\s+777` | `chmod 777`, `chmod  777` |
| `API_KEY\s*=` | `API_KEY=`, `API_KEY =` |

## Notes

- No restart needed. Rules take effect on the next tool use.
- Rule files live in `.crabcode/` in the project root. Consider adding `.crabcode/*.local.md` to `.gitignore` if rules are personal.
- Set `enabled: false` to temporarily disable a rule; delete the file to remove it permanently.

## Quick start

1. `bash -c 'mkdir -p .crabcode'` (if `.crabcode/` does not yet exist).
2. Run `/hookify` and describe the unwanted behavior, or write a `.crabcode/hookify.NAME.local.md` file yourself.
3. Try to trigger the rule. The hookify hooks will surface the warning or block automatically.

For more examples see this plugin's `examples/` directory.
