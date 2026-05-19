# Bangong CrabCode Plugin Migration Index

Date: 2026-05-19
Workspace: `/Users/fushihua/Desktop/CrabCode-Plugin`
Source cache: `/Users/fushihua/Desktop/CrabCode-Plugin/bangong`

## Goal

Convert the plugins and skill suites referenced from `bangong` into CrabCode-compatible plugins, remove all Claude-facing product identifiers from product surfaces, and implement runtime code in TypeScript where a plugin needs executable logic.

This is a planning archive only. No plugin implementation is included in this plan set.

## Source Baseline

- `bangong/claude-plugins-official`
  - Commit: `4bf08583c37e04f764806ea7a96ca74fb80ced1d`
  - Marketplace entries: 178
  - Entries whose source path is represented in this local clone: 49
  - Local-path entries referenced by marketplace but not present in this clone: 33
  - External source entries requiring separate fetch: 96
- `bangong/anthropic-skills`
  - Commit: `6a5bb06904ab164a345e41c381fc9097954b83da`
  - Marketplace entries: 3
  - Skill folders: 17

## Existing CrabCode Coverage

Current CrabCode plugin manifests:

- `crabcode-setup` at repository root
- `crabcode-security-review`
- `matter-core`
- `cn-contract`
- `cn-data-compliance`
- `cn-labor-employment`

Coverage decision:

- `claude-code-setup` is covered by `crabcode-setup`; keep only regression validation for this migration.
- `crabcode-security-review` is a local CrabCode workflow, but it is not a complete replacement for upstream `code-review`, `pr-review-toolkit`, or `security-guidance`.

## Plan Documents

The migration is split by the maximum useful parallelism. Each document is sized so one coordinator can hand off each row to a separate worker without write conflicts.

1. [Migration Rules and Validation](2026-05-19-bangong-crabcode-plugin-migration-implementation-plan-01-rules-validation.md)
   - Recommended parallelism: 1 coordinator.
   - Purpose: shared naming, manifest, brand, TypeScript, testing, and review gates.

2. [Parallel 15: MCP Wrapper Plugins Present in Source](2026-05-19-bangong-crabcode-plugin-migration-implementation-plan-02-parallel-15-mcp-present.md)
   - Recommended parallelism: 15 workers.
   - Purpose: convert source-present external plugins that are mostly `.mcp.json` wrappers.

3. [Parallel 12: LSP Plugins Present in Source](2026-05-19-bangong-crabcode-plugin-migration-implementation-plan-03-parallel-12-lsp-present.md)
   - Recommended parallelism: 12 workers.
   - Purpose: convert language-server plugins with minimal per-language differences.

4. [Parallel 18: Workflow and Skill Plugins Present in Source](2026-05-19-bangong-crabcode-plugin-migration-implementation-plan-04-parallel-18-workflow-present.md)
   - Recommended parallelism: 18 workers.
   - Purpose: convert source-present commands, agents, skills, and review workflows.

5. [Parallel 5: Runtime, Hook, and Bridge Plugins Present in Source](2026-05-19-bangong-crabcode-plugin-migration-implementation-plan-05-parallel-05-runtime-present.md)
   - Recommended parallelism: 5 workers.
   - Purpose: convert hook handlers, bridge servers, and other executable runtime plugins to TypeScript.

6. [Parallel 17: Anthropic Skills Marketplace Suites](2026-05-19-bangong-crabcode-plugin-migration-implementation-plan-06-parallel-17-skills-suite.md)
   - Recommended parallelism: 17 workers.
   - Purpose: convert the three skill marketplace plugins and their 17 component skills into CrabCode-native suites.

7. [Parallel 33: Missing Local-Path Marketplace Entries](2026-05-19-bangong-crabcode-plugin-migration-implementation-plan-07-parallel-33-local-path-fetch.md)
   - Recommended parallelism: 33 workers for source acquisition and first-pass conversion plans.
   - Purpose: handle marketplace entries whose source path is declared under `plugins/...` but absent from this clone.

8. [Parallel 96: External Source Marketplace Entries](2026-05-19-bangong-crabcode-plugin-migration-implementation-plan-08-parallel-96-external-source-fetch.md)
   - Recommended parallelism: 96 workers for source acquisition and first-pass conversion plans.
   - Purpose: handle marketplace entries whose source is a Git URL or non-local source descriptor.

9. [Execution Checklist](2026-05-19-bangong-crabcode-plugin-migration-implementation-plan-09-execution-checklist.md)
   - Recommended parallelism: 1 release coordinator plus batch leads.
   - Purpose: end-to-end migration checklist, merge order, validation commands, and acceptance criteria.

## Wave Order

1. Rules, scaffolding, and inventory checks.
2. MCP wrappers and LSP plugins, because they have low behavioral coupling.
3. Workflow and skill plugins, because they are mostly prompt/content migration.
4. Runtime, hook, and bridge plugins, because they require TypeScript rewrites and security review.
5. Skill marketplace suites, including office/document skills and examples.
6. Missing local-path sources.
7. External source entries.

## Non-Negotiable Gates

- Every plugin must have `.crabcode-plugin/plugin.json`.
- Product-facing content must be CrabCode-native.
- Runtime code must be TypeScript unless the plugin is purely declarative.
- `bangong/` remains a source cache and must not be tracked.
- No generated plugin may reference `.claude`, `CLAUDE.md`, Claude command names, or Claude-branded runtime output.
- Marketplace entries must point to `./plugins/<plugin-name>` or the chosen nested CrabCode plugin path.

## Directory Naming Constraints

1. New CrabCode plugins must live under `plugins/<plugin-name>/`.
2. `<plugin-name>` must be kebab-case and must exactly match `.crabcode-plugin/plugin.json` `name`.
3. Plugin directory name, manifest `name`, and marketplace entry `name` must be identical.
4. New product directories may not contain Claude-facing identifiers such as `claude`, `anthropic`, `.claude`, or `claude-code`.
5. Upstream names containing Claude-facing identifiers must be renamed before becoming product directories:
   - `claude-md-management` -> `crabcode-memory-management`
   - `claude-code-setup` -> `crabcode-setup`
   - `plugins/claude` -> `desktop-commander`
6. TypeScript runtime code must live inside the owning plugin at `plugins/<plugin-name>/src/`.
7. Plugin-specific tests must live inside `plugins/<plugin-name>/tests/` unless the batch lead approves shared infrastructure tests.
8. Temporary external source checkouts must live under `bangong/external-sources/<upstream-name>/` and must not be committed.
9. Marketplace `source` values must point to the final product directory, usually `./plugins/<plugin-name>`.
10. Do not create extra nested plugin families unless the integration window approves that layout.
