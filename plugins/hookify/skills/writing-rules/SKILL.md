---
name: writing-hookify-rules
description: "Use this skill when the user asks to 'create a hookify rule', 'write a hook rule', 'configure hookify', 'add a hookify rule', or needs guidance on hookify rule syntax and patterns."
version: 0.1.0
---

# Writing hookify rules

## Overview

Hookify rules are markdown files with YAML frontmatter that describe patterns to watch for and messages to show when those patterns fire. Rules live in `.crabcode/hookify.{rule-name}.local.md` in the project root.

## Rule file format

```markdown
---
name: rule-identifier
enabled: true
event: bash|file|stop|prompt|all
pattern: regex-pattern-here
---

Message shown to the agent when the rule fires.
Markdown formatting, lists, and warnings are all fine.
```

### Frontmatter fields

- `name` (required) — unique kebab-case identifier. Start with an action verb (`warn-`, `block-`, `prevent-`, `require-`, `check-`).
- `enabled` (required) — `true` to activate, `false` to disable. You can toggle without deleting.
- `event` (required) — `bash`, `file`, `stop`, `prompt`, or `all`.
- `action` (optional) — `warn` (default) shows a message but allows the operation; `block` denies tool use on PreToolUse or blocks stopping on Stop.
- `pattern` (optional) — simple regex form. Matches against `command` for `bash` events, `new_text` for `file` events, and `content` otherwise. Cannot be combined with `conditions:` (conditions win).

### Advanced format: multiple conditions

```markdown
---
name: warn-env-file-edits
enabled: true
event: file
conditions:
  - field: file_path
    operator: regex_match
    pattern: \.env$
  - field: new_text
    operator: contains
    pattern: API_KEY
---

You're adding an API key to a .env file. Ensure this file is in .gitignore.
```

Condition fields:

- `field` — which input field to check.
  - bash: `command`.
  - file: `file_path`, `new_text`, `old_text`, `content`.
  - stop: `reason`, `transcript`.
  - prompt: `user_prompt`.
- `operator` — `regex_match`, `contains`, `equals`, `not_contains`, `starts_with`, `ends_with`.
- `pattern` — the string or regex pattern.

All conditions must match for the rule to fire (logical AND).

## Message body

The markdown content after the frontmatter is what the agent sees when the rule fires.

Good messages:

- explain what was detected;
- explain why it matters;
- suggest a safer alternative;
- use lists, bold, and short paragraphs for clarity.

## Event guide

### bash

Match Bash command patterns.

```markdown
---
event: bash
pattern: sudo\s+|rm\s+-rf|chmod\s+777
---
Dangerous command detected.
```

Common patterns:

- Dangerous commands: `rm\s+-rf`, `dd\s+if=`, `mkfs`.
- Privilege escalation: `sudo\s+`, `su\s+`.
- Permission widening: `chmod\s+777`, `chown\s+root`.

### file

Match Edit / Write / MultiEdit operations.

```markdown
---
event: file
pattern: console\.log\(|eval\(|innerHTML\s*=
---
Potentially risky code pattern detected.
```

Match different fields with `conditions:`:

```markdown
---
event: file
conditions:
  - field: file_path
    operator: regex_match
    pattern: \.tsx?$
  - field: new_text
    operator: regex_match
    pattern: console\.log\(
---
console.log added to a TypeScript file.
```

### stop

Run on session exit to enforce completion checks.

```markdown
---
event: stop
action: block
conditions:
  - field: transcript
    operator: not_contains
    pattern: bun test|npm test|pytest|cargo test
---
Tests were not run before stopping. Run them before exiting.
```

### prompt

Run when the user submits a prompt.

```markdown
---
event: prompt
conditions:
  - field: user_prompt
    operator: contains
    pattern: deploy to production
---
Production deployment checklist:
- tests passing?
- code reviewed?
- monitoring ready?
```

## Pattern tips

- Hookify uses JavaScript regex with the `i` (case-insensitive) flag.
- Test a pattern with `bun -e 'console.log(new RegExp("rm\\\\s+-rf", "i").test("rm -rf /tmp"))'`.
- YAML unquoted scalars treat `\s` literally, which is what regex expects. If you must quote, double the backslashes (`"\\s"`).
- Avoid overly broad patterns. `log` matches `login`, `dialog`, `catalog`. Prefer `console\.log\(|logger\.`.

## File organization

- Location: `.crabcode/hookify.{descriptive-name}.local.md`.
- Naming: kebab-case, start with action verb.
- Consider adding `.crabcode/*.local.md` to `.gitignore` if the rules are personal preferences.

Examples:

- `.crabcode/hookify.dangerous-rm.local.md`
- `.crabcode/hookify.console-log.local.md`
- `.crabcode/hookify.sensitive-files.local.md`
- `.crabcode/hookify.require-tests.local.md`

## Workflow

1. Identify the unwanted behavior.
2. Pick the event and field(s) it shows up in.
3. Write the regex / condition list.
4. Create `.crabcode/hookify.{name}.local.md`.
5. Trigger it once to confirm. Rules are reloaded on every hook fire — no restart needed.

## Disabling a rule

- Temporarily: set `enabled: false`.
- Permanently: delete the file.

## Field reference

| Event | Common fields |
|-------|---------------|
| bash | `command` |
| file | `file_path`, `new_text`, `old_text`, `content` |
| stop | `reason`, `transcript` |
| prompt | `user_prompt` |

## Operators

`regex_match`, `contains`, `equals`, `not_contains`, `starts_with`, `ends_with`.
