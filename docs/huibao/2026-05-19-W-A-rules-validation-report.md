# Window A — Rules & Validation Report

- Window: W-A (01-rules-validation)
- Date: 2026-05-19
- Worktree: `/Users/fushihua/Desktop/CrabCode-Plugin`
- Branch: `feature/window-c-12-lsp-present` (see "Branch caveat" below)
- Latest commit: filled after commit (see below)

## Scope

Per plan `2026-05-19-bangong-crabcode-plugin-migration-implementation-plan-01-rules-validation.md`, Window A is the rules / validation / template coordinator. This window does not modify any plugin directory, the marketplace manifest, or any batch implementation. It delivers:

1. The shared validator scripts (brand, manifest, marketplace, layout) and a `validate-all` orchestrator.
2. Plugin scaffolding templates (MCP wrapper, TypeScript standard, worker report).
3. The `.gitignore` clamp for `bangong/`.
4. The audit addendum at the end of plan-01 documenting marketplace-source exceptions, manifest legacy exceptions, validator inventory, and bangong / template guidance.

## Branch caveat

`git worktree list` shows two worktrees: this one on `feature/window-c-12-lsp-present`, and a window-F worktree at `/Users/fushihua/Desktop/CrabCode-Plugin-windowF`. There is no dedicated window-A branch checked out. The user instructions explicitly forbid branch switching, so Window A's commit lands on `feature/window-c-12-lsp-present`. The total-integration window should treat this branch as carrying two distinct payloads — Window C's 12 LSP plugins (commit `aae7970d`) and Window A's rules/validators — and re-split them via cherry-pick or per-path rebase before merging to `main`.

## Plan audit findings

Before implementation, the plan-01 doc was reviewed for correctness. Three minor gaps were found and recorded in the new "Audit Addendum" section at the end of plan-01:

1. Marketplace `source` exception list — the plan listed `./plugins/<name>` and nested family directories, but missed the root-plugin form (`./`) that `crabcode-setup` already uses. The addendum names this as the third legitimate form and locks future plugins out of it.
2. Manifest required-field policy did not distinguish new plugins from legacy plugins. The addendum splits required-field enforcement into hard (always error) and soft (warning for the five pre-existing plugins, error for new plugins). The validator implements this split.
3. The plan referenced `crabcode plugin validate <path>` for per-plugin validation but did not specify which checks the marketplace itself enforces. The addendum publishes the validator inventory and wires it to `bun run validate`.

No hard contradictions were found.

## Files changed

### Documentation

- `docs/huibao/2026-05-19-bangong-crabcode-plugin-migration-implementation-plan-01-rules-validation.md` — appended Window A audit addendum.
- `docs/huibao/2026-05-19-W-A-rules-validation-report.md` — this report.

### Configuration

- `.gitignore` — added `bangong/`.
- `package.json` — added `lint:manifest`, `lint:marketplace`, `lint:layout`, `validate` scripts and scoped `test` to `./tests/`.

### Validator library (under `src/policy/`)

- `src/policy/pluginScan.ts` — manifest discovery walker plus shared `isKebabCase` and `isCrabcodeNeutralName` helpers.
- `src/policy/manifestValidator.ts` — `validateManifests(root)` with legacy-plugin allowlist.
- `src/policy/marketplaceValidator.ts` — `validateMarketplace(root)` covering entry shape, source-path existence, and name parity with referenced manifests.
- `src/policy/layoutValidator.ts` — `validateLayout(root)` covering kebab-case, banned identifiers, and the nested-family allowlist.
- `src/policy/brandGuard.ts` — pattern matcher upgrade so `.window-*-workdir/**` and similar wildcard prefixes work, plus the new `.window-*-workdir/**` ignore.

### Validator entry scripts (under `scripts/`)

- `scripts/validate-manifest.ts`
- `scripts/validate-marketplace.ts`
- `scripts/validate-layout.ts`
- `scripts/validate-all.ts`

### Templates (under `templates/`)

- `templates/README.md` — copy / rename usage.
- `templates/plugin-mcp-wrapper/.crabcode-plugin/plugin.json`
- `templates/plugin-mcp-wrapper/.mcp.json`
- `templates/plugin-mcp-wrapper/docs/legal/THIRD_PARTY_NOTICES.md`
- `templates/plugin-standard/.crabcode-plugin/plugin.json`
- `templates/plugin-standard/package.json`
- `templates/plugin-standard/tsconfig.json`
- `templates/plugin-standard/src/index.ts`
- `templates/plugin-standard/tests/.gitkeep`
- `templates/plugin-standard/docs/legal/THIRD_PARTY_NOTICES.md`
- `templates/worker-report.md`

### Tests

- `tests/validators/manifest.test.ts` (7 tests)
- `tests/validators/marketplace.test.ts` (7 tests)
- `tests/validators/layout.test.ts` (6 tests)

## Marketplace entries added or changed

None. Window A does not touch `.crabcode-plugin/marketplace.json`. Other windows must use the worker-report template to surface their new entries to the integration window.

## Validation results

```bash
bun run typecheck        # PASS — tsc clean
bun test ./tests/validators/  # PASS — 20 / 20 expectations green
```

Detailed counts:

- `tests/validators/manifest.test.ts` — 7 tests, all green.
- `tests/validators/marketplace.test.ts` — 7 tests, all green.
- `tests/validators/layout.test.ts` — 6 tests, all green.

```bash
bun run test             # 28 / 29 green; 1 failure is in tests/analysis.test.ts
```

The 1 failure in `tests/analysis.test.ts > policy checks > brand guard passes repository product files` is **not caused by Window A**. It fires because other parallel windows (B / C / D / E / etc.) have already deposited un-rebranded upstream source into `plugins/*` (e.g. `plugins/kotlin-lsp/docs/legal/...`, `plugins/mcp-server-dev/...`) inside this same shared worktree. The brand guard correctly identifies these — that is the validator working as intended. Window A introduced no plugin content; the failure is pre-existing parallel-window WIP that those windows must clean before they commit.

```bash
bun run lint:brand
```

Currently reports 377 violations across `plugins/*` directories owned by other parallel windows. Window A produced **zero** brand violations in any file it authored (validators, templates, addendum, report, gitignore, package.json).

```bash
bun run lint:manifest
bun run lint:marketplace
bun run lint:layout
```

Each of these scripts is verified to run via the test suite. Running them against the live repo (with other-window WIP present) surfaces those windows' uncommitted plugin issues — again, the validator correctly identifying out-of-spec work.

## Known gaps / follow-ups

- Marketplace integration (the actual `.crabcode-plugin/marketplace.json` rewrite) is reserved for the total-integration window.
- The `dist/cli.js` artifact remains tracked because `package.json` exposes it as `bin`. No change needed for Window A; future cleanup should reissue `dist/` via release tooling.
- The legacy-plugin allowlist (matter-core, cn-contract, cn-data-compliance, cn-labor-employment, crabcode-security-review) is hard-coded in `manifestValidator.ts`. When those owners reissue manifests with full required fields, those names should be dropped from `LEGACY_RELAXED_PLUGINS`.

## Source attribution

This window adds no plugin content. No upstream source is incorporated. Plan-01 audit addendum references `bangong/claude-plugins-official` and `bangong/anthropic-skills` as the upstream cache by name only; their actual content is not committed and is now in `.gitignore`.
