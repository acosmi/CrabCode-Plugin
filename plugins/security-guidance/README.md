# security-guidance

A CrabCode PreToolUse hook that scans Edit / Write / MultiEdit operations for common security pitfalls and surfaces a one-time-per-session warning that blocks the write until the agent has reviewed it.

## What it flags

- Command injection sinks: `child_process.exec`, `execSync`, `os.system`.
- Dynamic code evaluation: `eval(`, `new Function`.
- DOM XSS sinks: `innerHTML =`, `document.write`, `dangerouslySetInnerHTML`.
- Unsafe deserialization: Python `pickle`.
- GitHub Actions workflows under `.github/workflows/*.yml` (warns about untrusted `github.event.*` interpolation in `run:`).

Each rule fires at most once per session per `<file>-<rule>` pair. State is cached under `~/.crabcode/security_warnings_state_<session_id>.json` and pruned after 30 days.

## Settings

Set `ENABLE_SECURITY_REMINDER=0` to disable the hook entirely (the script exits 0 immediately).

## Layout

```
.crabcode-plugin/plugin.json
hooks/hooks.json
src/securityReminderHook.ts
tests/securityReminderHook.test.ts
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
