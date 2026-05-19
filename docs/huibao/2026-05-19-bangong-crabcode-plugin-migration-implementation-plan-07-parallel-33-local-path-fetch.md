# Parallel 33: Missing Local-Path Marketplace Entries

Date: 2026-05-19
Parallelism: 33 workers
Source root: `bangong/claude-plugins-official/.claude-plugin/marketplace.json`

## Scope

These marketplace entries point to local-looking paths such as `plugins/...`, but those paths are not present in the current `bangong/claude-plugins-official` clone. Each worker must first acquire or locate the missing source, then produce a CrabCode migration plan or implementation in a later phase.

## Worker Assignments

| Worker | Marketplace Entry | Declared Source | Target Plugin | Category |
|---|---|---|---|---|
| LP-01 | `42crunch-api-security-testing` | `plugins/api-security-testing` | `plugins/42crunch-api-security-testing` | security |
| LP-02 | `adobe-for-creativity` | `plugins/creative-cloud/adobe-for-creativity` | `plugins/adobe-for-creativity` | design |
| LP-03 | `airtable` | `plugins/airtable` | `plugins/airtable` | productivity |
| LP-04 | `amazon-location-service` | `plugins/amazon-location-service` | `plugins/amazon-location-service` | location |
| LP-05 | `amplitude` | `plugins/amplitude` | `plugins/amplitude` | monitoring |
| LP-06 | `auth0` | `plugins/auth0` | `plugins/auth0` | security |
| LP-07 | `aws-agents` | `plugins/aws-agents` | `plugins/aws-agents` | development |
| LP-08 | `aws-amplify` | `plugins/aws-amplify` | `plugins/aws-amplify` | development |
| LP-09 | `aws-core` | `plugins/aws-core` | `plugins/aws-core` | development |
| LP-10 | `aws-data-analytics` | `plugins/aws-data-analytics` | `plugins/aws-data-analytics` | development |
| LP-11 | `aws-dev-toolkit` | `plugins/aws-dev-toolkit` | `plugins/aws-dev-toolkit` | development |
| LP-12 | `aws-serverless` | `plugins/aws-serverless` | `plugins/aws-serverless` | development |
| LP-13 | `bigdata-com` | `plugins/bigdata-com` | `plugins/bigdata-com` | database |
| LP-14 | `carta-cap-table` | `plugins/carta-cap-table` | `plugins/carta-cap-table` | productivity |
| LP-15 | `carta-crm` | `plugins/carta-crm` | `plugins/carta-crm` | productivity |
| LP-16 | `carta-investors` | `plugins/carta-investors` | `plugins/carta-investors` | productivity |
| LP-17 | `databases-on-aws` | `plugins/databases-on-aws` | `plugins/databases-on-aws` | database |
| LP-18 | `deploy-on-aws` | `plugins/deploy-on-aws` | `plugins/deploy-on-aws` | deployment |
| LP-19 | `desktop-commander` | `plugins/claude` | `plugins/desktop-commander` | productivity |
| LP-20 | `expo` | `plugins/expo` | `plugins/expo` | development |
| LP-21 | `legalzoom` | `plugins/legalzoom` | `plugins/legalzoom` | productivity |
| LP-22 | `liquid-lsp` | `plugins/liquid-lsp` | `plugins/liquid-lsp` | development |
| LP-23 | `liquid-skills` | `plugins/liquid-skills` | `plugins/liquid-skills` | development |
| LP-24 | `logfire` | `plugins/logfire` | `plugins/logfire` | monitoring |
| LP-25 | `mercadopago` | `plugins/mercadopago` | `plugins/mercadopago` | development |
| LP-26 | `neon` | `plugins/neon-postgres` | `plugins/neon-postgres` | database |
| LP-27 | `pydantic-ai` | `plugins/ai` | `plugins/pydantic-ai` | development |
| LP-28 | `railway` | `plugins/railway` | `plugins/railway` | deployment |
| LP-29 | `snowflake-cortex-code` | `plugins/cortex-code` | `plugins/snowflake-cortex-code` | development |
| LP-30 | `ui5` | `plugins/ui5` | `plugins/ui5` | development |
| LP-31 | `ui5-typescript-conversion` | `plugins/ui5-typescript-conversion` | `plugins/ui5-typescript-conversion` | development |
| LP-32 | `zapier` | `plugins/zapier` | `plugins/zapier` | productivity |
| LP-33 | `zilliz` | `plugins/zilliz` | `plugins/zilliz` | database |

## Acquisition Plan

For each entry:

1. Inspect marketplace history and repository tags to locate the missing path.
2. If the plugin moved to an external repository, record the new URL and move it to the external-source workflow.
3. If the plugin is absent because the clone is shallow or sparse, fetch the missing path into `bangong/<source-cache>`.
4. Record source commit.
5. Classify implementation type:
   - MCP wrapper
   - skill-only
   - command/agent workflow
   - TypeScript runtime
   - hook/runtime rewrite
6. Produce a follow-up implementation ticket.

## Conversion Defaults

- Use target plugin name equal to marketplace name unless the source path contains a Claude-specific segment.
- `desktop-commander` must not keep a target path named `plugins/claude`.
- Vendor names remain where they identify an external product.
- All runtime code must be TypeScript.

## Acceptance

This batch is complete when every row has one of:

- source acquired and ready for conversion,
- source moved to the external-source document,
- intentionally skipped with a documented reason.

## Audit Addendum (Window G, 2026-05-19)

Audit driven by Window G during source acquisition. Original scope above remains authoritative; this addendum captures terminology corrections and findings discovered while fetching all 33 entries.

### Terminology correction: "missing local-path" is misleading

Every one of the 33 rows in this batch resolves to an external repository via `source.source = "git-subdir"` (32 entries) or `source.source = "url"` (1 entry, `zilliz`). The `.path` field within that record happens to read `plugins/...`, which is the path **inside the upstream repository** — not a local directory in the `claude-plugins-official` clone.

In other words, the 33 entries were never expected to live inside this clone in the first place; they look "missing" only because their nested `path` resembles a local plugin directory. They are categorically the same as the entries handled by [08-parallel-96-external-source-fetch](2026-05-19-bangong-crabcode-plugin-migration-implementation-plan-08-parallel-96-external-source-fetch.md).

The plan is still useful as a parallelism slice (33 workers vs. 96), but downstream readers should not interpret "missing" as "shallow/sparse-checkout problem". Future scope/integration windows should align this with doc 08's terminology.

### Source acquisition mechanism (used by Window G)

For each entry the upstream repository was cloned with `--filter=blob:none --no-checkout`, the baseline `source.sha` was fetched directly via `git fetch origin <sha>`, then `git sparse-checkout set <path>` + `git checkout <sha>` produced an authoritative snapshot. Snapshots were copied into `bangong/external-sources/snapshots/<entry-name>/`. `bangong/` is already in `.gitignore` (Window A addendum) so the cache is never committed.

Six entries collided on `basename(url .git)` and required org-prefixed clone directories (`airtable`, `expo`, `legalzoom`, `logfire`, `neon`, `pydantic-ai`); see Window G batch report for details.

### Conversion default refinement: licensing

Most upstream subdirectories ship without a top-level `LICENSE` (the license file is at the repository root and was not pulled by sparse-checkout). The legal stub under `plugins/<plugin>/docs/legal/THIRD_PARTY_NOTICES.md` (Window A template) MUST cite the parent repository's LICENSE file by URL when the plugin subdir does not contain one. One entry (`legalzoom`) declares `PROPRIETARY` in its manifest and cannot be redistributed under this marketplace without explicit vendor authorization — recommend the integration window defer `legalzoom` rather than implementing it.

### Conversion default refinement: `desktop-commander` source path is correct

Plan row LP-19 says `plugins/claude` → `plugins/desktop-commander`. Verified: upstream `wonderwhy-er/DesktopCommanderMCP.git` at sha `9c44119` does contain `plugins/claude/` with a single `.claude-plugin/plugin.json` + `description.md`. Renaming to `plugins/desktop-commander` correctly removes the Claude-facing path segment per Directory Naming Constraints rule 5.
