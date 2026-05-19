---
description: Enable or disable hookify rules interactively.
allowed-tools: ["Glob", "Read", "Edit", "AskUserQuestion", "Skill"]
---

# Configure hookify rules

Load the `hookify:writing-rules` skill first to understand rule format.

## Steps

### 1. Find existing rules

Use Glob with pattern `.crabcode/hookify.*.local.md`. If none exist, tell the user:

```
No hookify rules configured yet. Run /hookify to create your first rule.
```

### 2. Read current state

For each rule file, Read and extract `name` and `enabled` from frontmatter.

### 3. Ask which rules to toggle

Use AskUserQuestion with `multiSelect: true`. Format option labels as `name (currently enabled|disabled)` and descriptions as a short summary.

### 4. Toggle selected rules

For each selected rule:
- Use Read, locate `enabled: true` or `enabled: false`.
- Use Edit to flip the value.

### 5. Confirm changes

Show a summary:

```
## Hookify rules updated

Enabled:
- warn-console-log

Disabled:
- warn-dangerous-rm

Unchanged:
- require-tests

Changes apply immediately - no restart needed.
```

## Notes

- You can also edit `.crabcode/hookify.*.local.md` files directly.
- Delete a file to remove a rule permanently.
- Use `/hookify:list` to inspect all configured rules.
