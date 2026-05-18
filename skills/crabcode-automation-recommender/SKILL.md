---
name: crabcode-automation-recommender
description: Analyze a codebase and recommend CrabCode automations such as hooks, agents, skills, plugins, and MCP servers. Use when the user asks for automation recommendations, wants to improve a CrabCode setup, asks how to first configure CrabCode for a project, or wants to know which CrabCode features would help.
allowed-tools: Read, Glob, Grep, Bash(node ${CRABCODE_PLUGIN_ROOT}/dist/cli.js:*), Bash(bun --cwd=${CRABCODE_PLUGIN_ROOT} run analyze:*)
---

# CrabCode Automation Recommender

Analyze the current repository and recommend focused CrabCode automations.

This skill is read-only. It may inspect files and run read-only discovery commands, but it does not create files, install plugins, register MCP servers, or change settings.

## Preferred Workflow

1. Run the local analyzer when available:

```bash
node "${CRABCODE_PLUGIN_ROOT}/dist/cli.js" --cwd "$PWD" --format markdown
```

If the built CLI is unavailable during local development, run the source entrypoint:

```bash
bun --cwd="${CRABCODE_PLUGIN_ROOT}" run analyze -- --cwd "$PWD" --format markdown
```

2. Use the analyzer report as evidence for the final answer.
3. If the analyzer is unavailable, gather equivalent read-only context with `ls`, `find`, `rg`, `git status`, and selected file reads.
4. Recommend only the highest-impact items. Keep each category to one or two suggestions unless the user asks for more.

## Recommendation Categories

- MCP servers for external tools, browser automation, documentation, repositories, and databases.
- Skills for repeatable project-specific workflows.
- Hooks for type checks, linting, tests, formatting, and sensitive-file guards.
- Agents for focused review, repository exploration, security, performance, accessibility, and tests.
- Plugins for bundled workflows that match the project.
- Quick workflows for initializing or improving CrabCode project context.

## Output

Return a compact report with:

- Codebase profile.
- Top recommendations grouped by category.
- Evidence for each recommendation.
- Concrete next steps that the user can approve separately.
