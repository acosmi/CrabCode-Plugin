---
name: require-tests-run
enabled: false
event: stop
action: block
conditions:
  - field: transcript
    operator: not_contains
    pattern: npm test|bun test|pytest|cargo test
---

Tests not detected in transcript.

Before stopping, please run tests to verify your changes work correctly.

Look for test commands like:
- `bun test`
- `npm test`
- `pytest`
- `cargo test`

Note: This rule blocks stopping when no test command appears in the transcript.
Enable it only when you want strict test enforcement.
