# Window G — 07-parallel-33 Local-Path Fetch — Batch Report

- Window: W-G (07-parallel-33-local-path-fetch)
- Date: 2026-05-19
- Workspace: `/Users/fushihua/Desktop/CrabCode-Plugin`
- Branch on commit: see "Branch & commit" section below — Window G inherited the worktree on `feature/window-c-12-lsp-present`; commits are pathspec-scoped to Window G files only.
- Scope: 33 entries listed in [`...-07-parallel-33-local-path-fetch.md`](2026-05-19-bangong-crabcode-plugin-migration-implementation-plan-07-parallel-33-local-path-fetch.md). Window G owns source acquisition + classification + integration tickets. Plugin implementation is explicitly out of scope per the goal prompt ("先拉取和分类，不急着实现").

## Plan audit findings (filed back into plan doc §"Audit Addendum (Window G, 2026-05-19)")

1. The doc title "missing local-path" is misleading. All 33 entries resolve to external git repositories (`source.source` = `git-subdir` ×32 or `url` ×1); the `.path` field merely happens to read `plugins/<name>`. They are categorically external-source entries. The 33-vs-96 split is justified only by parallelism slicing, not by source-type difference.
2. Conversion default for `desktop-commander` source-path rename (`plugins/claude` → `plugins/desktop-commander`) verified correct at the upstream sha.
3. Most upstream subdirs have no local `LICENSE` (it sits at the repo root). Implementation windows must cite the parent repo's LICENSE in `docs/legal/THIRD_PARTY_NOTICES.md` for those subdirs.
4. `legalzoom` declares `PROPRIETARY` in its upstream manifest; integration window should defer redistribution.

## What this window did

1. Verified all 33 marketplace names exist in `bangong/claude-plugins-official/.claude-plugin/marketplace.json` at the baseline commit (`4bf08583`). Each entry's declared upstream URL, ref, baseline sha, and inner `path` were captured.
2. For each entry, performed a partial-clone + sparse-checkout of the upstream subdirectory at the baseline sha, snapshotting it into `bangong/external-sources/snapshots/<entry-name>/`.
3. Classified each snapshot into one of: `mcp-wrapper`, `skill-only`, `workflow`, `runtime`, `hook-runtime`, `declarative-only`.
4. Counted feature artefacts (mcp files, SKILL.md, commands, agents, hooks, runtime files by language) and recorded current Claude/Anthropic brand hit counts to size brand-removal effort.
5. Captured each entry's license value from upstream manifest.
6. Filed integration-window guidance (this report's tables + marketplace-entry payloads).

## Source acquisition mechanism

- For each unique upstream URL: `git clone --filter=blob:none --no-checkout <url>` into `bangong/external-sources/_clones/<basename>`.
- Then `git fetch --filter=blob:none origin <sha>` to obtain the baseline commit, `git sparse-checkout set <path>`, and `git checkout <sha>`.
- Snapshot via `cp -R _clones/<basename>/<path> snapshots/<entry-name>/`.
- `bangong/` is gitignored (Window A addendum) so the cache and snapshots are not tracked.
- Six entries collided on `basename(url .git)`. Resolved by re-cloning into org-prefixed dirs (`airtable-skills`, `expo-skills`, `legalzoom-claude-plugins`, `pydantic-skills`, `neondatabase-agent-skills`). See "Collisions resolved" below.

Driver scripts (ephemeral, not committed): `/tmp/lp33_entries.tsv`, `/tmp/lp33_fetch.sh`, `/tmp/lp33_fixups.sh`, `/tmp/lp33_classify.sh`. Logs: `bangong/external-sources/_fetch-log.tsv`, `bangong/external-sources/_classification.tsv`.

## Processed entries (all 33 OK)

All 33 entries successfully snapshotted at their baseline sha. Status counts: `OK = 33`. Failures: 0 after collision fixup.

| # | Entry | Upstream | Baseline sha | Path | Kind | mcp / skill / cmd / agent / hook | License | Brand hits |
|---|---|---|---|---|---|---|---|---|
| LP-01 | `42crunch-api-security-testing` | `42Crunch-AI/claude-plugins` | `faf5305` | `plugins/api-security-testing` | skill-only | 0/5/0/0/0 | Apache 2.0 | 2 |
| LP-02 | `adobe-for-creativity` | `adobe/skills` | `9ca1da2` | `plugins/creative-cloud/adobe-for-creativity` | mcp-wrapper | 1/6/0/0/0 | Apache-2.0 | 3 |
| LP-03 | `airtable` | `Airtable/skills` | `aaeb4f3` | `plugins/airtable` | mcp-wrapper | 1/2/0/0/0 | MIT | 1 |
| LP-04 | `amazon-location-service` | `awslabs/agent-plugins` | `95381e8` | `plugins/amazon-location-service` | mcp-wrapper | 1/1/0/0/0 | Apache-2.0 | 0 |
| LP-05 | `amplitude` | `amplitude/mcp-marketplace` | `e9b4e15` | `plugins/amplitude` | mcp-wrapper | 1/26/0/0/0 | (manifest empty) | 2 |
| LP-06 | `auth0` | `auth0/agent-skills` | `3aa943b` | `plugins/auth0` | runtime (ts+js) | 0/28/0/0/0 | (manifest empty) | 1 |
| LP-07 | `aws-agents` | `aws/agent-toolkit-for-aws` | `ba1cc8c` | `plugins/aws-agents` | mcp-wrapper | 1/7/0/0/0 | Apache-2.0 | 14 |
| LP-08 | `aws-amplify` | `awslabs/agent-plugins` | `95381e8` | `plugins/aws-amplify` | mcp-wrapper | 1/1/0/0/0 | Apache-2.0 | 1 |
| LP-09 | `aws-core` | `aws/agent-toolkit-for-aws` | `ba1cc8c` | `plugins/aws-core` | runtime (ts+py) | 1/13/0/0/0 | Apache-2.0 | 13 |
| LP-10 | `aws-data-analytics` | `aws/agent-toolkit-for-aws` | `ba1cc8c` | `plugins/aws-data-analytics` | mcp-wrapper | 1/7/0/0/0 | Apache-2.0 | 1 |
| LP-11 | `aws-dev-toolkit` | `aws-samples/sample-claude-code-plugins-for-startups` | `ddea7fd` | `plugins/aws-dev-toolkit` | mcp-wrapper | 1/34/0/11/0 | MIT-0 | 16 |
| LP-12 | `aws-serverless` | `awslabs/agent-plugins` | `95381e8` | `plugins/aws-serverless` | hook-runtime | 1/4/0/0/1 | Apache-2.0 | 3 |
| LP-13 | `bigdata-com` | `Bigdata-com/bigdata-plugins-marketplace` | `c77a09c` | `plugins/bigdata-com` | runtime (py) | 1/1/22/0/0 | (manifest empty) | 1 |
| LP-14 | `carta-cap-table` | `carta/plugins` | `49db52a` | `plugins/carta-cap-table` | hook-runtime (js) | 0/14/0/0/1 | (manifest empty) | 12 |
| LP-15 | `carta-crm` | `carta/plugins` | `e72e8d5` | `plugins/carta-crm` | mcp-wrapper | 0/21/0/0/0 | (manifest empty) | 2 |
| LP-16 | `carta-investors` | `carta/plugins` | `e72e8d5` | `plugins/carta-investors` | hook-runtime (py+js) | 0/5/0/0/1 | (manifest empty) | 11 |
| LP-17 | `databases-on-aws` | `awslabs/agent-plugins` | `95381e8` | `plugins/databases-on-aws` | hook-runtime (py) | 1/1/0/0/1 | Apache-2.0 | 3 |
| LP-18 | `deploy-on-aws` | `awslabs/agent-plugins` | `95381e8` | `plugins/deploy-on-aws` | hook-runtime (py) | 1/2/0/0/1 | Apache-2.0 | 2 |
| LP-19 | `desktop-commander` | `wonderwhy-er/DesktopCommanderMCP` | `9c44119` | `plugins/claude` → `plugins/desktop-commander` | mcp-wrapper | 0/1/0/0/0 | MIT | 1 |
| LP-20 | `expo` | `expo/skills` | `47f0ef6` | `plugins/expo` | runtime (js) | 0/13/0/0/0 | (manifest empty) | 0 |
| LP-21 | `legalzoom` | `legalzoom/claude-plugins` | `f9fd8a0` | `plugins/legalzoom` | mcp-wrapper | 1/1/1/0/0 | **PROPRIETARY** | 5 |
| LP-22 | `liquid-lsp` | `Shopify/liquid-skills` | `a00ca03` | `plugins/liquid-lsp` | declarative-only (LSP) | 0/0/0/0/0 | MIT | 1 |
| LP-23 | `liquid-skills` | `Shopify/liquid-skills` | `bf7a7aa` | `plugins/liquid-skills` | skill-only | 0/3/0/0/0 | MIT | 0 |
| LP-24 | `logfire` | `pydantic/skills` | `92bd097` | `plugins/logfire` | mcp-wrapper | 1/2/4/0/0 | (manifest empty) | 5 |
| LP-25 | `mercadopago` | `mercadopago/mercadopago-claude-marketplace` | `1de8d97` | `plugins/mercadopago` | hook-runtime (py) | 1/13/3/1/2 | Apache-2.0 | 7 |
| LP-26 | `neon` | `neondatabase/agent-skills` | `1438d7d` | `plugins/neon-postgres` | mcp-wrapper (+ skills dir promised in manifest but not present at sha) | 0/0/0/0/0 | Apache-2.0 | 0 |
| LP-27 | `pydantic-ai` | `pydantic/skills` | `92bd097` | `plugins/ai` → `plugins/pydantic-ai` | skill-only | 0/1/0/0/0 | (manifest empty) | 5 |
| LP-28 | `railway` | `railwayapp/railway-skills` | `eaa89d8` | `plugins/railway` | hook-runtime (py) | 0/1/0/0/2 | MIT | 2 |
| LP-29 | `snowflake-cortex-code` | `Snowflake-Labs/snowflake-ai-kit` | `b16692d` | `plugins/cortex-code` → `plugins/snowflake-cortex-code` | hook-runtime (py) | 0/3/0/0/1 | Apache-2.0 | 16 |
| LP-30 | `ui5` | `UI5/plugins-claude` | `19b2fb3` | `plugins/ui5` | mcp-wrapper | 1/0/0/0/0 | Apache-2.0 | 2 |
| LP-31 | `ui5-typescript-conversion` | `UI5/plugins-claude` | `19b2fb3` | `plugins/ui5-typescript-conversion` | mcp-wrapper | 1/1/0/0/0 | Apache-2.0 | 2 |
| LP-32 | `zapier` | `zapier/zapier-mcp` | `f34a785` | `plugins/zapier` | mcp-wrapper | 1/3/0/1/0 | (manifest empty) | 4 |
| LP-33 | `zilliz` | `zilliztech/zilliz-plugin` | `e960396` | `plugins/zilliz` | workflow (commands) | 0/20/2/0/0 | Apache-2.0 | 4 |

"Brand hits" = count of files containing the literal strings `claude`, `anthropic`, `.claude`, or `CLAUDE.md` under the snapshotted tree (regardless of context). Used to size brand-removal effort in implementation phases. Hits ≠ violations; many are legitimate references to the source repo or to the Claude Code product name.

## Implementation type breakdown

| Kind | Count | Entries |
|---|---|---|
| mcp-wrapper | 16 | adobe-for-creativity, airtable, amazon-location-service, amplitude, aws-agents, aws-amplify, aws-data-analytics, aws-dev-toolkit, carta-crm, desktop-commander, legalzoom, logfire, neon, ui5, ui5-typescript-conversion, zapier |
| hook-runtime | 8 | aws-serverless, carta-cap-table, carta-investors, databases-on-aws, deploy-on-aws, mercadopago, railway, snowflake-cortex-code |
| runtime | 4 | auth0, aws-core, bigdata-com, expo |
| skill-only | 3 | 42crunch-api-security-testing, liquid-skills, pydantic-ai |
| workflow | 1 | zilliz |
| declarative-only (LSP) | 1 | liquid-lsp |

Total: 16+8+4+3+1+1 = 33. Primary classification assigned by precedence hook-runtime > runtime > mcp-wrapper > workflow > skill-only > declarative-only when multiple categories could fit (e.g. plugins shipping both MCP servers and skills are counted as `mcp-wrapper` because skills go in without runtime work; plugins shipping hooks are `hook-runtime` regardless of how many skills also exist).

## Collisions resolved

Initial driver used `basename(url .git)` as clone directory name, causing six collisions where unrelated repos shared the same basename. Each was re-cloned into an org-prefixed dir and re-snapshotted at the baseline sha. Fixed entries:

| Entry | Original collision target | Fixed clone dir |
|---|---|---|
| `airtable` | `_clones/skills` (held adobe's clone) | `_clones/airtable-skills` |
| `expo` | `_clones/skills` | `_clones/expo-skills` |
| `legalzoom` | `_clones/claude-plugins` (held 42crunch's clone) | `_clones/legalzoom-claude-plugins` |
| `logfire` | `_clones/skills` | `_clones/pydantic-skills` |
| `neon` | `_clones/agent-skills` (held auth0's clone) | `_clones/neondatabase-agent-skills` |
| `pydantic-ai` | `_clones/skills` | `_clones/pydantic-skills` (shared with logfire — same repo) |

## Marketplace entries to add (integration window action)

Per goal prompt ("不直接改 `.crabcode-plugin/marketplace.json`；需新增的 entry 写入批次报告"), the integration window should merge these 33 entries into `.crabcode-plugin/marketplace.json` after each plugin actually lands under `plugins/<name>/`. **Do not add an entry before its plugin directory exists** — `scripts/validate-marketplace.ts` will reject it.

Descriptions below are brand-laundered drafts; implementation windows should refine.

```json
{
  "name": "42crunch-api-security-testing",
  "source": "./plugins/42crunch-api-security-testing",
  "version": "0.1.0",
  "description": "Catch API security issues during development: audit, scan, remediate, and validate OpenAPI specs with 42Crunch.",
  "category": "security",
  "tags": ["openapi", "api-security", "audit", "scan", "owasp", "42crunch"]
}
```
```json
{
  "name": "adobe-for-creativity",
  "source": "./plugins/adobe-for-creativity",
  "version": "0.1.0",
  "description": "Adobe Creative Cloud integration for images, vectors, design, and video editing workflows.",
  "category": "design",
  "tags": ["adobe", "creative-cloud", "design", "media", "mcp"]
}
```
```json
{
  "name": "airtable",
  "source": "./plugins/airtable",
  "version": "0.1.0",
  "description": "Airtable database and operations layer for agent-driven product, marketing, sales, ops, HR, and finance workflows.",
  "category": "productivity",
  "tags": ["airtable", "database", "ops", "mcp"]
}
```
```json
{
  "name": "amazon-location-service",
  "source": "./plugins/amazon-location-service",
  "version": "0.1.0",
  "description": "Maps, places search, geocoding, routing, and geospatial features with Amazon Location Service.",
  "category": "location",
  "tags": ["aws", "location", "maps", "geospatial", "mcp"]
}
```
```json
{
  "name": "amplitude",
  "source": "./plugins/amplitude",
  "version": "0.1.0",
  "description": "Amplitude analytics instrumentation, product opportunity discovery, dashboard creation, and chart analysis.",
  "category": "monitoring",
  "tags": ["amplitude", "analytics", "product", "dashboards", "mcp"]
}
```
```json
{
  "name": "auth0",
  "source": "./plugins/auth0",
  "version": "0.1.0",
  "description": "Auth0 quickstarts, migration, MFA, Advanced Custom Universal Login, and framework-specific authentication patterns.",
  "category": "security",
  "tags": ["auth0", "auth", "identity", "mfa", "skills"]
}
```
```json
{
  "name": "aws-agents",
  "source": "./plugins/aws-agents",
  "version": "0.1.0",
  "description": "Scaffold AI agents on AWS with Amazon Bedrock AgentCore, tool connections, and deployment patterns.",
  "category": "development",
  "tags": ["aws", "bedrock", "agents", "mcp"]
}
```
```json
{
  "name": "aws-amplify",
  "source": "./plugins/aws-amplify",
  "version": "0.1.0",
  "description": "Full-stack app development with AWS Amplify Gen 2: auth, data models, storage, GraphQL APIs, and hosting.",
  "category": "development",
  "tags": ["aws", "amplify", "fullstack", "mcp"]
}
```
```json
{
  "name": "aws-core",
  "source": "./plugins/aws-core",
  "version": "0.1.0",
  "description": "Build, deploy, and operate on AWS with infrastructure-as-code, core services, and end-to-end workflow skills.",
  "category": "development",
  "tags": ["aws", "iac", "cloud", "skills"]
}
```
```json
{
  "name": "aws-data-analytics",
  "source": "./plugins/aws-data-analytics",
  "version": "0.1.0",
  "description": "Data lake, analytics, and ETL workflows with S3 Tables, AWS Glue, and Athena.",
  "category": "development",
  "tags": ["aws", "data", "etl", "athena", "glue"]
}
```
```json
{
  "name": "aws-dev-toolkit",
  "source": "./plugins/aws-dev-toolkit",
  "version": "0.1.0",
  "description": "AWS development toolkit with skills, agents, and MCP servers for building, migrating, and architecture review.",
  "category": "development",
  "tags": ["aws", "toolkit", "skills", "agents", "mcp"]
}
```
```json
{
  "name": "aws-serverless",
  "source": "./plugins/aws-serverless",
  "version": "0.1.0",
  "description": "Design, build, deploy, test, and debug serverless applications with AWS serverless services.",
  "category": "development",
  "tags": ["aws", "serverless", "lambda", "hooks"]
}
```
```json
{
  "name": "bigdata-com",
  "source": "./plugins/bigdata-com",
  "version": "0.1.0",
  "description": "Bigdata.com financial research, analytics, and intelligence tools via Bigdata MCP.",
  "category": "database",
  "tags": ["finance", "research", "analytics", "mcp"]
}
```
```json
{
  "name": "carta-cap-table",
  "source": "./plugins/carta-cap-table",
  "version": "0.1.0",
  "description": "Carta cap-table skills and hooks: querying cap tables, grants, SAFEs, 409A valuations, and waterfall scenarios.",
  "category": "productivity",
  "tags": ["carta", "cap-table", "equity", "skills"]
}
```
```json
{
  "name": "carta-crm",
  "source": "./plugins/carta-crm",
  "version": "0.1.0",
  "description": "Manage the Carta CRM conversationally: investors, companies, contacts, deals, notes, and enrichment.",
  "category": "productivity",
  "tags": ["carta", "crm", "investors", "skills"]
}
```
```json
{
  "name": "carta-investors",
  "source": "./plugins/carta-investors",
  "version": "0.1.0",
  "description": "Carta Investors plugin: investor data, performance benchmarks, regulatory reporting, AGM deck generation, and portfolio insights.",
  "category": "productivity",
  "tags": ["carta", "investors", "reporting", "skills"]
}
```
```json
{
  "name": "databases-on-aws",
  "source": "./plugins/databases-on-aws",
  "version": "0.1.0",
  "description": "Expert guidance for the AWS database portfolio: schema design, queries, migrations, and database selection.",
  "category": "database",
  "tags": ["aws", "databases", "migration", "schemas"]
}
```
```json
{
  "name": "deploy-on-aws",
  "source": "./plugins/deploy-on-aws",
  "version": "0.1.0",
  "description": "Deploy applications to AWS with architecture recommendations, cost estimates, and validated IaC.",
  "category": "deployment",
  "tags": ["aws", "deployment", "iac", "architecture"]
}
```
```json
{
  "name": "desktop-commander",
  "source": "./plugins/desktop-commander",
  "version": "0.1.0",
  "description": "Terminal commands, process management, and file operations across text, code, PDF, DOCX, Excel, and images via MCP.",
  "category": "productivity",
  "tags": ["desktop", "filesystem", "process", "mcp"]
}
```
```json
{
  "name": "expo",
  "source": "./plugins/expo",
  "version": "0.1.0",
  "description": "Official Expo skills for building, deploying, upgrading, and debugging Expo apps.",
  "category": "development",
  "tags": ["expo", "react-native", "mobile", "skills"]
}
```
```json
{
  "name": "legalzoom",
  "source": "./plugins/legalzoom",
  "version": "0.1.0",
  "description": "LegalZoom AI-powered business legal assistance with contract review and attorney consultation.",
  "category": "productivity",
  "tags": ["legal", "contracts", "consultation", "mcp"]
}
```
> **Hold for integration**: `legalzoom` manifest declares `PROPRIETARY` license. Do not add this marketplace entry until LegalZoom redistribution rights are confirmed.

```json
{
  "name": "liquid-lsp",
  "source": "./plugins/liquid-lsp",
  "version": "0.1.0",
  "description": "LSP integration for Shopify Liquid templates via the Shopify CLI theme language server.",
  "category": "development",
  "tags": ["liquid", "shopify", "lsp", "themes"]
}
```
```json
{
  "name": "liquid-skills",
  "source": "./plugins/liquid-skills",
  "version": "0.1.0",
  "description": "Liquid language fundamentals, CSS/JS/HTML coding standards, and WCAG accessibility patterns for Shopify themes.",
  "category": "development",
  "tags": ["liquid", "shopify", "themes", "accessibility", "skills"]
}
```
```json
{
  "name": "logfire",
  "source": "./plugins/logfire",
  "version": "0.1.0",
  "description": "Add Logfire observability to Python apps with auto-instrumentation for FastAPI, httpx, asyncpg, SQLAlchemy, and more.",
  "category": "monitoring",
  "tags": ["logfire", "observability", "python", "tracing", "mcp"]
}
```
```json
{
  "name": "mercadopago",
  "source": "./plugins/mercadopago",
  "version": "0.1.0",
  "description": "Mercado Pago full-product integration toolkit: 13 product skills routed by an expert agent, hybrid skill+MCP architecture.",
  "category": "development",
  "tags": ["payments", "mercadopago", "latam", "skills", "mcp"]
}
```
```json
{
  "name": "neon",
  "source": "./plugins/neon",
  "version": "0.1.0",
  "description": "Manage Neon projects and Postgres databases via the Neon MCP server and the neon-postgres agent skill.",
  "category": "database",
  "tags": ["neon", "postgres", "serverless", "mcp"]
}
```
> Source path renames from `plugins/neon-postgres` (upstream) to `plugins/neon` (target). At baseline sha the upstream `./skills/` referenced by the manifest does not yet exist in the snapshot; implementation window should pull the latest skills dir if/when Neon publishes it, or ship MCP-only.

```json
{
  "name": "pydantic-ai",
  "source": "./plugins/pydantic-ai",
  "version": "0.1.0",
  "description": "Build production-grade AI agents with Pydantic AI: tools, capabilities, structured output, streaming, and testing patterns.",
  "category": "development",
  "tags": ["pydantic", "agents", "structured-output", "skills"]
}
```
```json
{
  "name": "railway",
  "source": "./plugins/railway",
  "version": "0.1.0",
  "description": "Railway deployment skills and hooks for build, deploy, and operations on the Railway platform.",
  "category": "deployment",
  "tags": ["railway", "deployment", "hooks"]
}
```
```json
{
  "name": "snowflake-cortex-code",
  "source": "./plugins/snowflake-cortex-code",
  "version": "0.1.0",
  "description": "Route Snowflake prompts to Cortex Code for execution and AI workflows on Snowflake.",
  "category": "development",
  "tags": ["snowflake", "cortex", "ai", "data"]
}
```
```json
{
  "name": "ui5",
  "source": "./plugins/ui5",
  "version": "0.1.0",
  "description": "SAPUI5 / OpenUI5: create and validate UI5 projects, API documentation, UI5 linter, and developer guides.",
  "category": "development",
  "tags": ["ui5", "openui5", "sap", "mcp"]
}
```
```json
{
  "name": "ui5-typescript-conversion",
  "source": "./plugins/ui5-typescript-conversion",
  "version": "0.1.0",
  "description": "Convert JavaScript-based UI5 projects to TypeScript.",
  "category": "development",
  "tags": ["ui5", "typescript", "migration", "mcp"]
}
```
```json
{
  "name": "zapier",
  "source": "./plugins/zapier",
  "version": "0.1.0",
  "description": "Connect 9,000+ apps to your AI workflow. Discover, enable, and execute Zapier actions directly from the agent.",
  "category": "productivity",
  "tags": ["zapier", "automation", "integrations", "mcp"]
}
```
```json
{
  "name": "zilliz",
  "source": "./plugins/zilliz",
  "version": "0.1.0",
  "description": "Manage Zilliz Cloud clusters and Milvus vector databases via zilliz-cli commands.",
  "category": "database",
  "tags": ["zilliz", "milvus", "vector-db", "workflow"]
}
```

## Follow-up implementation tickets (one per entry)

Each ticket below maps to one implementation window in a subsequent wave. The "TS work" column estimates whether TypeScript runtime rewrites are required (per Migration Rules §"TypeScript Rules").

| Ticket | Plugin | Kind | TS work needed |
|---|---|---|---|
| W-LP-IMPL-01 | 42crunch-api-security-testing | skill-only | No (skill files only) |
| W-LP-IMPL-02 | adobe-for-creativity | mcp-wrapper | No (.mcp.json + skills) |
| W-LP-IMPL-03 | airtable | mcp-wrapper | No |
| W-LP-IMPL-04 | amazon-location-service | mcp-wrapper | No |
| W-LP-IMPL-05 | amplitude | mcp-wrapper | No |
| W-LP-IMPL-06 | auth0 | runtime (ts+js) | **Yes** — port 2 .js files to .ts; review 6 .ts files for branding |
| W-LP-IMPL-07 | aws-agents | mcp-wrapper | No |
| W-LP-IMPL-08 | aws-amplify | mcp-wrapper | No |
| W-LP-IMPL-09 | aws-core | runtime (ts+py) | **Yes** — port 1 .py to TS |
| W-LP-IMPL-10 | aws-data-analytics | mcp-wrapper | No |
| W-LP-IMPL-11 | aws-dev-toolkit | mcp-wrapper + 11 agents | No (descriptive agents) |
| W-LP-IMPL-12 | aws-serverless | hook-runtime | **Yes** — rewrite 1 hook |
| W-LP-IMPL-13 | bigdata-com | runtime (py) | **Yes** — port 5 .py files (workflow heavy) |
| W-LP-IMPL-14 | carta-cap-table | hook-runtime (js) | **Yes** — port 6 .js hooks/scripts to TS |
| W-LP-IMPL-15 | carta-crm | mcp-wrapper | No |
| W-LP-IMPL-16 | carta-investors | hook-runtime (py+js) | **Yes** — port 5 .py + 3 .js to TS |
| W-LP-IMPL-17 | databases-on-aws | hook-runtime (py) | **Yes** — rewrite 1 py hook |
| W-LP-IMPL-18 | deploy-on-aws | hook-runtime (py) | **Yes** — rewrite 6 py files |
| W-LP-IMPL-19 | desktop-commander | mcp-wrapper | No (single manifest+description) |
| W-LP-IMPL-20 | expo | runtime (js) | **Yes** — port 2 .js to TS |
| W-LP-IMPL-21 | legalzoom | mcp-wrapper | **Hold** — PROPRIETARY license; confirm redistribution rights first |
| W-LP-IMPL-22 | liquid-lsp | declarative-only (LSP) | No (.lsp.json) |
| W-LP-IMPL-23 | liquid-skills | skill-only | No |
| W-LP-IMPL-24 | logfire | mcp-wrapper | No (4 cmd templates) |
| W-LP-IMPL-25 | mercadopago | hook-runtime (py) | **Yes** — port 1 py hook + verify 13 skills + 3 cmd + 1 agent |
| W-LP-IMPL-26 | neon | mcp-wrapper | No (manifest references future skills dir not present at baseline) |
| W-LP-IMPL-27 | pydantic-ai | skill-only | No |
| W-LP-IMPL-28 | railway | hook-runtime (py) | **Yes** — port 7 .py to TS |
| W-LP-IMPL-29 | snowflake-cortex-code | hook-runtime (py) | **Yes** — port 18 .py to TS (largest runtime work) |
| W-LP-IMPL-30 | ui5 | mcp-wrapper | No |
| W-LP-IMPL-31 | ui5-typescript-conversion | mcp-wrapper | No |
| W-LP-IMPL-32 | zapier | mcp-wrapper + 1 agent | No |
| W-LP-IMPL-33 | zilliz | workflow (commands) | Maybe — 20 skills + 2 commands; review for shell-script content |

## Files changed by this window

Window G commits only documentation:

- `docs/huibao/2026-05-19-bangong-crabcode-plugin-migration-implementation-plan-07-parallel-33-local-path-fetch.md` — added "Audit Addendum (Window G, 2026-05-19)" section.
- `docs/huibao/2026-05-19-W-G-07-local-path-fetch-batch-report.md` — this report.

No plugin directories, no marketplace.json, no validators, no templates were touched. `bangong/external-sources/snapshots/`, `bangong/external-sources/_clones/`, and the log/classification tsv files are written under `bangong/` and remain gitignored (Window A addendum).

## Validation commands run

- `cd bangong/claude-plugins-official && git rev-parse HEAD` → `4bf08583c37e04f764806ea7a96ca74fb80ced1d` (matches plan baseline).
- `jq` cross-checks of marketplace.json: 178 plugins total; 49 string-source ("present local") + 33 git-subdir/url subset (this batch) + 96 other external (batch 08) = 178. ✓
- All 33 names resolved via `jq -r '.plugins[] | select(.name == "<n>") | .source'` matching plan-doc target paths.
- 33/33 snapshot directories present under `bangong/external-sources/snapshots/`; `_fetch-log.tsv` reports `OK` for all 33 after collision fixup.
- Classification driver `lp33_classify.sh` produces consistent counts that round-trip with manual inspection of 6 spot-checks (42crunch, neon, liquid-lsp, snowflake-cortex-code, mercadopago, zilliz).

**Did not run** the repo validators (`bun run lint:brand`, `lint:manifest`, `lint:marketplace`, `lint:layout`, `typecheck`, `test`). Reason: Window G adds only documentation under `docs/huibao/` and no plugin manifests, marketplace entries, or runtime code. These validators have nothing to evaluate from this window. They MUST be run by each W-LP-IMPL-N window when its plugin lands.

## Failures / known gaps

- 0 fetch failures. All 33 snapshotted at baseline sha (after collision fixup for 6 entries).
- `legalzoom` is `PROPRIETARY`; integration window must verify redistribution rights or defer.
- 9 entries have empty `license` in their upstream subdir manifest (`amplitude`, `auth0`, `bigdata-com`, `carta-cap-table`, `carta-crm`, `carta-investors`, `expo`, `logfire`, `pydantic-ai`, `zapier`). Each implementation window must determine the effective license by reading the parent repo's root LICENSE file and citing it in `docs/legal/THIRD_PARTY_NOTICES.md`.
- `neon` baseline sha snapshot has `mcp.json` + manifest + a logo asset only; the manifest's `./skills/` reference points to content not yet published at that commit. Implementation window should decide whether to ship MCP-only or pin to a newer sha that includes the skills directory.

## Source attribution

Each snapshot retains its upstream provenance in the `bangong/external-sources/_fetch-log.tsv` log:

| column | meaning |
|---|---|
| entry | marketplace name |
| status | OK / PATH_MISSING / NO_SHA / CLONE_FAIL |
| baseline_sha | sha from marketplace.json |
| actual_sha | sha that was actually checked out |
| clone_dir | absolute path of the upstream clone |
| notes | "fixup" for the 6 re-cloned entries, baseline-drift annotations, etc. |

For each per-entry implementation window, source provenance is:

- Upstream URL: `source.url` from marketplace.json (preserved in the table above)
- Upstream baseline sha: `source.sha` (preserved in the table above)
- Inner subdirectory: `source.path` (preserved in the table above)
- Snapshot location for inspection: `bangong/external-sources/snapshots/<entry-name>/`

## Branch & commit

- **Worktree**: `/Users/fushihua/Desktop/CrabCode-Plugin` (the only CrabCode-Plugin worktree on this machine besides Window F's at `/Users/fushihua/Desktop/CrabCode-Plugin-windowF`).
- **Branch at session start**: `feature/window-c-12-lsp-present` (Window C left this worktree on its branch; Window G inherited it).
- **Commit strategy**: explicit pathspec — `git commit -- docs/huibao/2026-05-19-bangong-crabcode-plugin-migration-implementation-plan-07-parallel-33-local-path-fetch.md docs/huibao/2026-05-19-W-G-07-local-path-fetch-batch-report.md` — to commit only Window G's two documentation files without touching the staged/untracked files left by Windows A / C / H / etc. on the shared worktree.
- **Branch on which the commit lands**: `feature/window-c-12-lsp-present` (inherited; goal prompt forbade switching branches).
- **Commit hash**: see git history for the most recent commit authored "feat(docs): Window G ...".

## Notes for integration window

1. Window G's commit is interleaved with Window C's branch history. When merging windows back to `main`, the integration window must either (a) cherry-pick Window G's commit onto a dedicated `feature/window-g-...` branch before merging, or (b) accept the combined branch.
2. Plan doc 07 was edited in-place to add the Window G addendum. If multiple windows edit other plan docs the same way, integration should merge addendum sections (they're at the end and append-only).
3. None of the 33 plugins themselves were created in this window. Implementation windows (W-LP-IMPL-01 .. W-LP-IMPL-33) must each follow Window A's rules + templates and produce manifest, brand-stripped product surfaces, TypeScript runtime (where required), and the marketplace entry payloads above.
4. The `legalzoom` ticket should not proceed without explicit license clearance.
