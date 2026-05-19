# Migration Rules and Validation

Date: 2026-05-19
Parallelism: 1 coordinator

## Purpose

This document defines the shared rules every parallel migration worker must follow. It is the source of truth for naming, file layout, TypeScript expectations, brand removal, and validation.

## Standard CrabCode Plugin Layout

Use this shape unless a plugin is purely declarative:

```text
plugins/<plugin-name>/
  .crabcode-plugin/
    plugin.json
  commands/
  agents/
  skills/
  hooks/
  src/
  package.json
  tsconfig.json
  docs/
    legal/
      THIRD_PARTY_NOTICES.md
```

For a purely declarative MCP wrapper, keep it smaller:

```text
plugins/<plugin-name>/
  .crabcode-plugin/
    plugin.json
  .mcp.json
  docs/
    legal/
      THIRD_PARTY_NOTICES.md
```

## Manifest Rules

Every `.crabcode-plugin/plugin.json` must include:

- `name`
- `version`
- `description`
- `author`
- `license`
- `keywords`
- optional `skills`, `hooks`, `mcpServers`, `apps`
- optional `interface` for UI presentation

Default author:

```json
{
  "name": "CrabCode"
}
```

If a vendor integration should retain a vendor name, keep the vendor as a technical integration target, not as a legacy assistant/upstream vendor product reference.

## Naming Rules

Use kebab-case. Keep stable vendor names when useful for users:

- `playwright` stays `playwright`
- `github` stays `github`
- `typescript-lsp` stays `typescript-lsp`

Rewrite legacy assistant-specific names:

- `legacy-assistant-setup` -> `crabcode-setup` (already implemented)
- `crabcode-memory-management` -> `crabcode-memory-management`
- `ai-api` -> decide target API before implementation; recommended placeholder `ai-api-dev`
- any source path segment named `legacy-assistant` -> a CrabCode-native or vendor-neutral name

## Directory Naming Constraints

1. New CrabCode plugins must live under `plugins/<plugin-name>/`.
2. `<plugin-name>` must be kebab-case and must exactly match `.crabcode-plugin/plugin.json` `name`.
3. Plugin directory name, manifest `name`, and marketplace entry `name` must be identical.
4. New product directories may not contain legacy-facing identifiers such as `legacy-assistant`, `upstream-vendor`, `.legacy-assistant`, or `legacy-assistant`.
5. Upstream names containing legacy-facing identifiers must be renamed before becoming product directories:
   - `crabcode-memory-management` -> `crabcode-memory-management`
   - `legacy-assistant-setup` -> `crabcode-setup`
   - `plugins/legacy-assistant` -> `desktop-commander`
6. TypeScript runtime code must live inside the owning plugin at `plugins/<plugin-name>/src/`.
7. Plugin-specific tests must live inside `plugins/<plugin-name>/tests/` unless the batch lead approves shared infrastructure tests.
8. Temporary external source checkouts must live under `bangong/external-sources/<upstream-name>/` and must not be committed.
9. Marketplace `source` values must point to the final product directory, usually `./plugins/<plugin-name>`.
10. Do not create extra nested plugin families unless the integration window approves that layout.

## Brand Removal Rules

Remove these from product-facing surfaces:

- `legacy assistant`
- `legacy assistant`
- `upstream vendor`
- `.legacy-assistant`
- `CRABCODE.md`
- `legacy-plugin`
- model family names and hardcoded model names

Replace with:

- `CrabCode`
- `.crabcode`
- `CRABCODE.md`
- `CrabCode plugin`
- `agent`
- `worker` only where the runtime actually supports it

Legal notices may include source attribution when needed. Product runtime, command output, skills, agent prompts, docs intended for users, and marketplace descriptions may not.

## TypeScript Rules

Runtime code must be TypeScript:

- MCP wrapper logic: TypeScript.
- Hook handlers: TypeScript.
- Bridge servers: TypeScript.
- Source acquisition tools: TypeScript.
- Validation scripts: TypeScript.

Acceptable exceptions:

- Pure `.mcp.json` plugin with no runtime code.
- Static skill-only plugin.
- Third-party binary invocation behind a TS wrapper.

Do not directly carry over Python hook handlers or shell scripts from source plugins. Re-implement behavior in TS or call a trusted external binary through a narrow TS adapter.

## Marketplace Rules

The repository marketplace lives at:

```text
.crabcode-plugin/marketplace.json
```

Every converted plugin entry must include:

- `name`
- `source`
- `version`
- `description`
- `category`
- `tags`

Use `source: "./plugins/<plugin-name>"` unless the plugin intentionally lives in a nested family directory.

## Worker Contract

Each worker owns exactly one plugin directory. Workers must not edit:

- other plugin directories
- root marketplace except through the designated batch lead
- shared scripts unless explicitly assigned

Each worker must return:

- files created or changed
- source plugin path
- brand scan result
- validation commands run
- known gaps

## Validation Commands

At minimum:

```bash
bun run lint:brand
bun run scripts/lint-brand.ts plugins/<plugin-name>
crabcode plugin validate /Users/fushihua/Desktop/CrabCode-Plugin/plugins/<plugin-name>
```

For TypeScript runtime plugins:

```bash
bun install
bun run typecheck
bun test
bun run build
```

For root repository validation:

```bash
bun run typecheck
bun test
bun run build
bun run lint:brand
```

## Acceptance Criteria

A plugin is migration-complete when:

1. `.crabcode-plugin/plugin.json` validates.
2. Any runtime code is TypeScript.
3. Product-facing content is CrabCode-native.
4. Marketplace entry exists or the plugin is intentionally held back.
5. Brand scan passes outside legal notices.
6. Hooks and runtime tools have tests or fixture verification.
7. User-facing command names and skill names are stable.

## Audit Addendum (Window A, 2026-05-19)

This addendum captures Window A audit refinements discovered while implementing the shared validators. The original rules above are still authoritative; this section only adds clarifications and a validator inventory.

### Marketplace `source` exceptions

`source` values must point to the final product directory. Three legitimate forms exist:

1. `./plugins/<plugin-name>` — the standard placement for new plugins.
2. `./plugins/<family>/<plugin-name>` — pre-approved nested family directories (currently `plugins/crablaw-cn/*`). New families need integration window approval.
3. `./` — reserved for the root plugin of this marketplace repository itself (currently `crabcode-setup`). No further plugins should adopt this form.

### Manifest required field exceptions

Every new plugin manifest under this migration must include `name`, `version`, `description`, `author`, `license`, and `keywords`. Pre-existing manifests landed before 2026-05-19 (`crablaw-cn/*`, `crabcode-security-review`) may lack `license` or `keywords`; the manifest validator emits a warning rather than a hard failure for those paths until each owner reissues a manifest. New plugin batches MUST satisfy the full required field set; the validator emits an error for those.

### Validator inventory (Window A delivery)

The shared validators live in `scripts/` and run on plain Bun without any plugin source-cache dependency:

- `scripts/lint-brand.ts` — scans for legacy assistant/upstream vendor identifiers outside `docs/legal/`, `bangong/`, etc.
- `scripts/validate-manifest.ts` — schema-checks every `.crabcode-plugin/plugin.json` under the marketplace.
- `scripts/validate-marketplace.ts` — checks `.crabcode-plugin/marketplace.json` entry shape, source-path existence, and entry-vs-manifest name consistency.
- `scripts/validate-layout.ts` — enforces kebab-case plugin directory names, manifest/directory/entry name parity, and the legacy-facing identifier ban on product directories.
- `scripts/validate-all.ts` — orchestrator that runs all four checks in order and surfaces a single exit code for CI.

The orchestrator is wired to `bun run validate` in `package.json`. Per-check entry points (`bun run lint:brand`, `bun run lint:manifest`, `bun run lint:marketplace`, `bun run lint:layout`) are also exposed for targeted debugging.

### bangong/ tracking

`bangong/` is a local source cache for upstream `legacy-plugins-official` and `upstream-skills`. It must never be committed and is now explicitly listed in `.gitignore`. Existing brand-lint already excludes `bangong/**` from scanning.

### Plugin templates

Two scaffolding templates land under `templates/` (not tracked as plugins; only referenced by batch leads):

- `templates/plugin-mcp-wrapper/` — declarative `.mcp.json` plugin shell with manifest and legal stub.
- `templates/plugin-standard/` — TypeScript runtime plugin shell with `package.json`, `tsconfig.json`, `src/index.ts`, and tests dir.
- `templates/worker-report.md` — per-window completion report template referenced by §"Worker Contract".

### Reserved deliverable boundary

Window A delivers shared rules, validators, templates, the `.gitignore` update, and the addendum above. It does not modify any plugin directory, the marketplace manifest, or batch implementations.
