# Parallel 18: Workflow and Skill Plugins Present in Source

Date: 2026-05-19
Parallelism: 18 workers
Source root: `bangong/claude-plugins-official/plugins`

## Scope

This batch covers source-present plugins that are mostly commands, agents, skills, or workflow prompts. They are content-heavy and should be rewritten CrabCode-native while preserving useful workflow structure.

## Shared Target Shape

```text
plugins/<plugin-name>/
  .crabcode-plugin/plugin.json
  commands/
  agents/
  skills/
  docs/legal/THIRD_PARTY_NOTICES.md
```

Use `src/` only when the plugin has executable logic that must be rewritten in TypeScript.

## Worker Assignments

| Worker | Source | Target | Primary Work |
|---|---|---|---|
| WF-01 | `plugins/agent-sdk-dev` | `plugins/agent-sdk-dev` | Agent SDK guidance, commands, agents. |
| WF-02 | `plugins/claude-md-management` | `plugins/crabcode-memory-management` | Convert `CLAUDE.md` workflows to `CRABCODE.md`. |
| WF-03 | `plugins/code-modernization` | `plugins/code-modernization` | Modernization commands and specialist agents. |
| WF-04 | `plugins/code-review` | `plugins/code-review` | PR/code review workflow, confidence filtering. |
| WF-05 | `plugins/code-simplifier` | `plugins/code-simplifier` | Simplification agent. |
| WF-06 | `plugins/commit-commands` | `plugins/commit-commands` | Commit, push, PR command workflows. |
| WF-07 | `plugins/cwc-makers` | `plugins/cwc-makers` | Maker setup command and device skills. |
| WF-08 | `plugins/example-plugin` | `plugins/crabcode-example-plugin` | CrabCode example/reference plugin. |
| WF-09 | `plugins/feature-dev` | `plugins/feature-dev` | Feature development agents and commands. |
| WF-10 | `plugins/frontend-design` | `plugins/frontend-design` | Frontend design skill. |
| WF-11 | `plugins/math-olympiad` | `plugins/math-olympiad` | Competition math skill suite. |
| WF-12 | `plugins/mcp-server-dev` | `plugins/mcp-server-dev` | MCP server creation skills. |
| WF-13 | `plugins/playground` | `plugins/playground` | Interactive HTML playground skills. |
| WF-14 | `plugins/plugin-dev` | `plugins/plugin-dev` | Plugin creation skills and commands. |
| WF-15 | `plugins/pr-review-toolkit` | `plugins/pr-review-toolkit` | PR review agents and commands. |
| WF-16 | `plugins/session-report` | `plugins/session-report` | Session report skill; add manifest. |
| WF-17 | `plugins/skill-creator` | `plugins/skill-creator` | Skill creation and evaluation skills. |
| WF-18 | `plugins/claude-code-setup` | `crabcode-setup` | Already implemented; run regression diff and update only if gaps remain. |

## Rewrite Rules

- Do not perform blind search-and-replace only; read each command/skill and rewrite intent.
- Keep technical domain terms, remove Claude product identity.
- Replace `subagent` with `agent` or `parallel worker` depending on semantics.
- Replace `CLAUDE.md` with `CRABCODE.md`.
- Replace plugin development examples with `.crabcode-plugin/plugin.json`.
- Remove model-specific wording.
- Preserve prompt safety boundaries.

## Per-Plugin Deliverable

Each worker produces:

- CrabCode manifest.
- Rewritten commands, agents, and skills.
- Marketplace entry.
- Brand scan report.
- Notes on intentionally dropped source content.

## Batch Lead Checks

- Ensure `plugin-dev` and `skill-creator` do not conflict with existing Codex/CrabCode skill creator guidance.
- Ensure `code-review`, `pr-review-toolkit`, and `code-simplifier` have distinct invocation purposes.
- Ensure `crabcode-memory-management` aligns with this repository's `CRABCODE.md` conventions.

## Acceptance

```bash
bun run scripts/lint-brand.ts plugins/<plugin-name>
crabcode plugin validate /Users/fushihua/Desktop/CrabCode-Plugin/plugins/<plugin-name>
```

For `crabcode-setup`, acceptance is a regression report confirming existing implementation still covers upstream behavior.
