---
description: Recommend CrabCode automations for the current repository.
allowed-tools: Read, Glob, Grep, Bash(node ${CRABCODE_PLUGIN_ROOT}/dist/cli.js:*), Bash(bun --cwd=${CRABCODE_PLUGIN_ROOT} run analyze:*)
---

Run the local analyzer in read-only mode and summarize the highest-impact CrabCode automation recommendations:

```bash
node "${CRABCODE_PLUGIN_ROOT}/dist/cli.js" --cwd "$PWD" --format markdown
```

If the built CLI is unavailable during local development, run `bun --cwd="${CRABCODE_PLUGIN_ROOT}" run analyze -- --cwd "$PWD" --format markdown`.

If the analyzer is unavailable, inspect the repository with read-only commands and return recommendations grouped by MCP servers, skills, hooks, agents, plugins, and workflows.
