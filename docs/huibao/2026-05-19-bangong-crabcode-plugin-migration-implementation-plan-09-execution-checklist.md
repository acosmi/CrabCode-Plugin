# Execution Checklist

Date: 2026-05-19
Parallelism: 1 release coordinator plus batch leads

## Purpose

This checklist controls execution across all parallel migration documents. Use it to avoid duplicate work, marketplace conflicts, and brand regressions.

## Pre-Flight

- [ ] Confirm `bangong/` is ignored by git.
- [ ] Confirm current source commits:
  - `bangong/legacy-plugins-official`: `4bf08583c37e04f764806ea7a96ca74fb80ced1d`
  - `bangong/upstream-skills`: `6a5bb06904ab164a345e41c381fc9097954b83da`
- [ ] Freeze the migration inventory.
- [ ] Assign one batch lead per plan document.
- [ ] Assign one worker per row inside each batch document.

## Shared Scaffolding

- [ ] Add a CrabCode plugin scaffold helper if needed.
- [ ] Add a marketplace update helper if needed.
- [ ] Add a root inventory checker for all expected plugin names.
- [ ] Extend brand scanning for generated plugin directories.
- [ ] Define standard `plugin.json` interface metadata.

## Batch Merge Order

1. Rules and scaffolding.
2. MCP wrapper plugins.
3. LSP plugins.
4. Workflow and skill plugins.
5. Runtime, hook, and bridge plugins.
6. upstream vendor skills marketplace suites.
7. Missing local-path marketplace entries.
8. External source marketplace entries.

## Per-Plugin Checklist

- [ ] Source path and commit recorded.
- [ ] Target plugin name approved.
- [ ] `.crabcode-plugin/plugin.json` created.
- [ ] Components converted:
  - [ ] `.mcp.json`
  - [ ] `commands/`
  - [ ] `agents/`
  - [ ] `skills/`
  - [ ] `hooks/`
  - [ ] `src/`
- [ ] Runtime code is TypeScript or plugin is declarative.
- [ ] Product-facing legacy assistant/upstream vendor identifiers removed.
- [ ] Marketplace entry added or explicitly deferred.
- [ ] Legal/source notice added.
- [ ] Validation commands run.

## Brand Gate

Every plugin must pass:

```bash
bun run scripts/lint-brand.ts plugins/<plugin-name>
```

The root must pass:

```bash
bun run lint:brand
```

If a term appears in a legal notice, the brand scanner should ignore only that legal notice path, not the whole plugin.

## TypeScript Gate

Every plugin with runtime code must pass:

```bash
bun install
bun run typecheck
bun test
bun run build
```

If the plugin keeps its own package boundary, run these inside that plugin. If runtime is shared at repo root, run the root commands.

## Plugin Validation Gate

Run:

```bash
crabcode plugin validate /Users/fushihua/Desktop/CrabCode-Plugin/plugins/<plugin-name>
```

For root-level `crabcode-setup`, run:

```bash
crabcode plugin validate /Users/fushihua/Desktop/CrabCode-Plugin
```

## Marketplace Gate

Before merge:

- [ ] Entry path exists.
- [ ] Plugin manifest name matches marketplace name.
- [ ] Category is normalized.
- [ ] Description is CrabCode-native.
- [ ] Tags are useful and not overbroad.
- [ ] No duplicate plugin names.

## Coverage Gate

The final migration inventory must account for:

- [ ] 178 `legacy-plugins-official` marketplace entries.
- [ ] 3 `upstream-skills` marketplace entries.
- [ ] 17 `upstream-skills` component skills.
- [ ] Existing `crabcode-setup` coverage of `legacy-assistant-setup`.
- [ ] All missing local-path entries classified.
- [ ] All external source entries classified.

## Release Candidate Checklist

- [ ] Root typecheck passes.
- [ ] Root tests pass.
- [ ] Root build passes.
- [ ] Root brand scan passes.
- [ ] Every plugin validates or has a documented deferral.
- [ ] Marketplace loads in CrabCode.
- [ ] At least one smoke prompt per plugin category is documented.
- [ ] Batch leads sign off on their rows.

## Final Archive

When implementation is complete, create:

```text
docs/huibao/<date>-bangong-crabcode-plugin-migration-validation-report.md
```

Include:

- total migrated,
- total deferred,
- validation commands,
- known gaps,
- source commits,
- marketplace diff summary.
