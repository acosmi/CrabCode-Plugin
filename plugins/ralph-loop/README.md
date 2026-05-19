# ralph-loop

Iterative self-referential development loop for CrabCode. A Stop hook intercepts session exit, re-feeds the same prompt, and bumps an iteration counter persisted to `.crabcode/ralph-loop.local.md`.

## Safety defaults

- Default max iterations is 5; hard cap is 200. Loops can never run unbounded.
- Loops without `--completion-promise` require `--yes` to confirm.
- Per-iteration status is emitted via the Stop hook's `systemMessage`.
- Cancel any time with `/cancel-ralph`.

## Layout

```
.crabcode-plugin/plugin.json
hooks/hooks.json
commands/
  ralph-loop.md
  cancel-ralph.md
  help.md
src/
  state.ts
  setupRalphLoop.ts
  stopHook.ts
tests/
  state.test.ts
  setupRalphLoop.test.ts
  stopHook.test.ts
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
