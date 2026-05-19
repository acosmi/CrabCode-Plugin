---
description: List all configured hookify rules.
allowed-tools: ["Glob", "Read", "Skill"]
---

# List hookify rules

Load the `hookify:writing-rules` skill first to understand rule format.

## Steps

1. Use Glob to find all hookify rule files:

   ```
   pattern: ".crabcode/hookify.*.local.md"
   ```

2. For each file:
   - Use Read to load it.
   - Extract frontmatter fields: `name`, `enabled`, `event`, `pattern`.
   - Extract the first 100 chars of the message body as a preview.

3. Present results as a table:

   ```
   ## Configured hookify rules

   | Name | Enabled | Event | Pattern | File |
   |------|---------|-------|---------|------|
   | warn-dangerous-rm | yes | bash | rm\s+-rf | hookify.dangerous-rm.local.md |
   | warn-console-log | yes | file | console\.log\( | hookify.console-log.local.md |
   | require-tests | no | stop | (none) | hookify.require-tests.local.md |

   Total: 3 rules (2 enabled, 1 disabled)
   ```

4. For each rule, include a brief preview:

   ```
   ### warn-dangerous-rm
   Event: bash
   Pattern: rm\s+-rf
   Message: "Dangerous rm command detected. Verify the path before proceeding."
   Status: active
   File: .crabcode/hookify.dangerous-rm.local.md
   ```

5. Footer:

   ```
   - To modify a rule: edit its .local.md file directly.
   - To disable: set `enabled: false`. To enable: `enabled: true`.
   - To delete a rule: remove its .local.md file.
   - To create a new rule: run /hookify.
   - Changes take effect on the next tool use.
   ```

## If no rules exist

```
No hookify rules configured.

To get started:
1. Run /hookify to analyze the conversation and create rules.
2. Or manually add `.crabcode/hookify.my-rule.local.md` files.
3. See /hookify:help for documentation.

Example: /hookify Warn me when I use console.log

Sample rule files live in this plugin's `examples/` directory.
```
