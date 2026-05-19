# hookify

A CrabCode plugin that lets users create custom hooks by writing small markdown rule files instead of editing `hooks.json`. Rules live in `.crabcode/hookify.*.local.md` in the project root and are evaluated on every PreToolUse / PostToolUse / Stop / UserPromptSubmit event.

## What you get

- A TypeScript rule engine (regex with cache + structured conditions).
- A simple frontmatter rule format with both `pattern:` (simple) and `conditions:` (AND of multiple field checks).
- Four hook entry points wired in `hooks/hooks.json`.
- Commands: `/hookify`, `/hookify:list`, `/hookify:help`, `/hookify:configure`.
- A `writing-rules` skill the commands load before generating rules.
- A `conversation-analyzer` agent invoked by `/hookify` when no arguments are given.
- Example rules under `examples/` covering Bash, file, and Stop events.

## Quick start

1. Run `/hookify` and describe the behavior you want to prevent, or write a rule file directly:

   ```markdown
   ---
   name: block-dangerous-rm
   enabled: true
   event: bash
   pattern: rm\s+-rf
   action: block
   ---

   Dangerous rm command detected. Verify the path before proceeding.
   ```

2. Save it as `.crabcode/hookify.dangerous-rm.local.md` in the project root.
3. Trigger the rule. No restart needed.

## Layout

```
.crabcode-plugin/plugin.json
hooks/hooks.json
commands/
  hookify.md
  list.md
  help.md
  configure.md
skills/
  writing-rules/SKILL.md
agents/
  conversation-analyzer.md
examples/
  dangerous-rm.local.md
  console-log-warning.local.md
  sensitive-files-warning.local.md
  require-tests-stop.local.md
src/
  types.ts
  frontmatter.ts
  configLoader.ts
  ruleEngine.ts
  hookRunner.ts
  hooks/
    preToolUse.ts
    postToolUse.ts
    stop.ts
    userPromptSubmit.ts
tests/
  frontmatter.test.ts
  configLoader.test.ts
  ruleEngine.test.ts
  hookRunner.test.ts
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
