# Worker Report Template

Use one report per window. File path:
`docs/huibao/2026-05-19-W-<window-id>-<topic>-report.md`

## Header

- Window: W-__ID__ (__TOPIC__)
- Date: __YYYY-MM-DD__
- Branch: __BRANCH_NAME__
- Latest commit: __HASH__

## Scope

What this window owned, in 2-3 sentences. Quote the plan section it implemented.

## Files changed

List every file touched, grouped by purpose. Avoid wildcards.

## Marketplace entries added or changed

If this window produced a new plugin, list the marketplace entry payload to be merged by the integration window. Do not edit `.crabcode-plugin/marketplace.json` directly.

```json
{
  "name": "__PLUGIN_NAME__",
  "source": "./plugins/__PLUGIN_NAME__",
  "version": "0.1.0",
  "description": "__DESCRIPTION__",
  "category": "__CATEGORY__",
  "tags": ["__TAG_1__"]
}
```

## Validation results

Quote command + result. Required:

- `bun run lint:brand`
- `bun run lint:manifest`
- `bun run lint:marketplace`
- `bun run lint:layout`
- `bun run typecheck`
- `bun test`

If a TypeScript runtime plugin was added, also include its own `typecheck` and `test` outcomes.

## Known gaps / follow-ups

What still needs to land in a future window or what the integration window must finalize.

## Source attribution

- Upstream source path: `bangong/__UPSTREAM_PATH__`
- Upstream commit: __UPSTREAM_COMMIT__
- License: __UPSTREAM_LICENSE__
