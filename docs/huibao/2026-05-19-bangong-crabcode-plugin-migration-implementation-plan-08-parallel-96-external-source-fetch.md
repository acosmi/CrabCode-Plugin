# Parallel 96: External Source Marketplace Entries

Date: 2026-05-19
Parallelism: 96 workers
Source root: `bangong/claude-plugins-official/.claude-plugin/marketplace.json`

## Scope

These marketplace entries point to external Git repositories, organization-relative paths, provider package paths, or source descriptors that are not present in the current `bangong/claude-plugins-official` clone.

Each worker must fetch source into `bangong/external-sources/<plugin-name>` or document why it cannot be fetched. Implementation happens after source inspection.

## Worker Assignments

| Worker | Plugin | Source | Category |
|---|---|---|---|
| EX-001 | `agentforce-adlc` | `https://github.com/SalesforceAIResearch/agentforce-adlc.git` | development |
| EX-002 | `ai-plugins` | `https://github.com/endorlabs/ai-plugins.git` | none |
| EX-003 | `aikido` | `https://github.com/AikidoSec/aikido-claude-plugin.git` | none |
| EX-004 | `alloydb` | `https://github.com/gemini-cli-extensions/alloydb.git` | database |
| EX-005 | `apollo` | `https://github.com/apolloio/apollo-mcp-plugin.git` | productivity |
| EX-006 | `astronomer-data-agents` | `https://github.com/astronomer/agents.git` | development |
| EX-007 | `atlan` | `https://github.com/atlanhq/agent-toolkit.git` | none |
| EX-008 | `atlassian` | `https://github.com/atlassian/atlassian-mcp-server.git` | productivity |
| EX-009 | `atomic-agents` | `claude-plugin/atomic-agents` | development |
| EX-010 | `azure` | `https://github.com/microsoft/azure-skills.git` | deployment |
| EX-011 | `azure-cosmos-db-assistant` | `https://github.com/AzureCosmosDB/cosmosdb-claude-code-plugin.git` | database |
| EX-012 | `base44` | `https://github.com/base44/skills.git` | development |
| EX-013 | `box` | `https://github.com/box/box-for-ai.git` | productivity |
| EX-014 | `brightdata-plugin` | `https://github.com/brightdata/skills.git` | none |
| EX-015 | `cds-mcp` | `https://github.com/cap-js/mcp-server.git` | development |
| EX-016 | `chrome-devtools-mcp` | `https://github.com/ChromeDevTools/chrome-devtools-mcp.git` | development |
| EX-017 | `circleback` | `https://github.com/circlebackai/claude-code-plugin.git` | productivity |
| EX-018 | `clickhouse` | `https://github.com/ClickHouse/clickhouse-claude-code-plugin.git` | database |
| EX-019 | `cloud-sql-postgresql` | `https://github.com/gemini-cli-extensions/cloud-sql-postgresql.git` | database |
| EX-020 | `cloudflare` | `https://github.com/cloudflare/skills.git` | deployment |
| EX-021 | `cloudinary` | `https://github.com/cloudinary-devs/cloudinary-plugin.git` | none |
| EX-022 | `cockroachdb` | `https://github.com/cockroachdb/claude-plugin.git` | database |
| EX-023 | `coderabbit` | `https://github.com/coderabbitai/skills.git` | productivity |
| EX-024 | `convex-backend` | `https://github.com/get-convex/convex-backend-skill.git` | development |
| EX-025 | `crowdstrike-falcon-foundry` | `https://github.com/CrowdStrike/foundry-skills.git` | security |
| EX-026 | `dash0` | `https://github.com/dash0hq/dash0-agent-plugin.git` | monitoring |
| EX-027 | `data` | `https://github.com/astronomer/agents.git` | development |
| EX-028 | `data-agent-kit-starter-pack` | `https://github.com/gemini-cli-extensions/data-agent-kit-starter-pack.git` | development |
| EX-029 | `data-engineering` | `https://github.com/astronomer/agents.git` | none |
| EX-030 | `datadog` | `https://github.com/datadog-labs/claude-code-plugin.git` | monitoring |
| EX-031 | `datarobot-agent-skills` | `https://github.com/datarobot-oss/datarobot-agent-skills.git` | development |
| EX-032 | `dataverse` | `.github/plugins/dataverse` | database |
| EX-033 | `exa` | `https://github.com/exa-labs/exa-mcp-server.git` | productivity |
| EX-034 | `fastly-agent-toolkit` | `https://github.com/fastly/fastly-agent-toolkit.git` | none |
| EX-035 | `fiftyone` | `https://github.com/voxel51/fiftyone-skills.git` | none |
| EX-036 | `figma` | `https://github.com/figma/mcp-server-guide.git` | design |
| EX-037 | `firecrawl` | `https://github.com/firecrawl/firecrawl-claude-plugin.git` | development |
| EX-038 | `fullstory` | `fullstorydev/fullstory-skills` | monitoring |
| EX-039 | `huggingface-skills` | `https://github.com/huggingface/skills.git` | development |
| EX-040 | `intercom` | `https://github.com/intercom/claude-plugin-external.git` | productivity |
| EX-041 | `jfrog` | `jfrog/claude-plugin` | security |
| EX-042 | `microsoft-docs` | `https://github.com/MicrosoftDocs/mcp.git` | development |
| EX-043 | `mintlify` | `https://github.com/mintlify/mintlify-claude-plugin.git` | development |
| EX-044 | `miro` | `claude-plugins/miro` | design |
| EX-045 | `mongodb` | `https://github.com/mongodb/agent-skills.git` | database |
| EX-046 | `netlify-skills` | `https://github.com/netlify/context-and-tools.git` | development |
| EX-047 | `netsuite-suitecloud` | `packages/agent-skills` | development |
| EX-048 | `nightvision` | `https://github.com/nvsecurity/nightvision-skills.git` | none |
| EX-049 | `nimble` | `https://github.com/Nimbleway/agent-skills.git` | none |
| EX-050 | `notion` | `https://github.com/makenotion/claude-code-notion-plugin.git` | productivity |
| EX-051 | `oracle-ai-data-platform-workbench-spark-connectors` | `ai/claude-code-plugins/oracle-ai-data-platform-workbench-spark-connectors` | development |
| EX-052 | `outputai` | `coding_assistants/claude/plugins/outputai` | development |
| EX-053 | `pagerduty` | `https://github.com/PagerDuty/claude-code-plugins.git` | monitoring |
| EX-054 | `pigment` | `https://github.com/gopigment/ai-plugins.git` | productivity |
| EX-055 | `pinecone` | `https://github.com/pinecone-io/pinecone-claude-code-plugin.git` | database |
| EX-056 | `planetscale` | `https://github.com/planetscale/claude-plugin.git` | database |
| EX-057 | `posthog` | `https://github.com/PostHog/ai-plugin.git` | monitoring |
| EX-058 | `postiz` | `https://github.com/gitroomhq/postiz-agent.git` | none |
| EX-059 | `postman` | `https://github.com/Postman-Devrel/postman-claude-code-plugin.git` | development |
| EX-060 | `prisma` | `https://github.com/prisma/claude-plugin.git` | none |
| EX-061 | `qdrant-skills` | `https://github.com/qdrant/skills.git` | database |
| EX-062 | `qodo-skills` | `https://github.com/qodo-ai/qodo-skills.git` | development |
| EX-063 | `qt-development-skills` | `https://github.com/TheQtCompanyRnD/agent-skills.git` | development |
| EX-064 | `quarkus-agent` | `https://github.com/quarkusio/quarkus-agent-mcp.git` | development |
| EX-065 | `rc` | `revenuecat` | development |
| EX-066 | `remember` | `https://github.com/Digital-Process-Tools/claude-remember.git` | none |
| EX-067 | `revenuecat` | `revenuecat` | development |
| EX-068 | `sanity` | `https://github.com/sanity-io/agent-toolkit.git` | development |
| EX-069 | `sap-cds-mcp` | `https://github.com/cap-js/mcp-server.git` | development |
| EX-070 | `sap-fiori-mcp-server` | `packages/fiori-mcp-server` | development |
| EX-071 | `sap-mdk-server` | `https://github.com/SAP/mdk-mcp-server.git` | development |
| EX-072 | `save-to-spotify` | `plugin` | productivity |
| EX-073 | `semgrep` | `plugin` | security |
| EX-074 | `sentry` | `https://github.com/getsentry/sentry-for-claude.git` | monitoring |
| EX-075 | `servicenow-sdk` | `providers/claude/plugin` | development |
| EX-076 | `shopify` | `https://github.com/Shopify/shopify-plugins.git` | development |
| EX-077 | `shopify-ai-toolkit` | `https://github.com/Shopify/Shopify-AI-Toolkit.git` | development |
| EX-078 | `slack` | `https://github.com/slackapi/slack-mcp-plugin.git` | productivity |
| EX-079 | `sonarqube` | `https://github.com/SonarSource/sonarqube-agent-plugins.git` | security |
| EX-080 | `sonatype-guide` | `https://github.com/sonatype/sonatype-guide-claude-plugin.git` | security |
| EX-081 | `sourcegraph` | `https://github.com/sourcegraph-community/sourcegraph-claudecode-plugin.git` | development |
| EX-082 | `spotify-ads-api` | `https://github.com/spotify/ads-claude-plugin.git` | productivity |
| EX-083 | `stripe` | `providers/claude/plugin` | development |
| EX-084 | `sumup` | `providers/claude/plugin` | development |
| EX-085 | `supabase` | `https://github.com/supabase-community/supabase-plugin.git` | database |
| EX-086 | `superpowers` | `https://github.com/obra/superpowers.git` | development |
| EX-087 | `twilio-developer-kit` | `https://github.com/twilio/ai.git` | development |
| EX-088 | `vanta-mcp-plugin` | `https://github.com/VantaInc/vanta-mcp-plugin.git` | security |
| EX-089 | `vercel` | `https://github.com/vercel/vercel-plugin.git` | deployment |
| EX-090 | `windsor-ai` | `https://github.com/windsor-ai/claude-windsor-ai-plugin.git` | productivity |
| EX-091 | `wix` | `https://github.com/wix/skills.git` | development |
| EX-092 | `wordpress.com` | `https://github.com/Automattic/claude-code-wordpress.com.git` | none |
| EX-093 | `youdotcom-agent-skills` | `https://github.com/youdotcom-oss/agent-skills.git` | productivity |
| EX-094 | `zoom-plugin` | `https://github.com/zoom/zoom-plugin.git` | development |
| EX-095 | `zoominfo` | `https://github.com/Zoominfo/zoominfo-mcp-plugin.git` | productivity |
| EX-096 | `zscaler` | `https://github.com/zscaler/zscaler-mcp-server.git` | security |

## Acquisition Rules

1. Clone source into `bangong/external-sources/<plugin-name>`.
2. Record commit hash and license metadata in the worker report.
3. Classify component type:
   - MCP wrapper
   - skill suite
   - command workflow
   - hook/runtime
   - mixed plugin
4. Create a CrabCode migration ticket under the appropriate later batch.
5. If a source value is not a complete URL, resolve it through marketplace metadata, repository docs, or upstream issue history.

## Conversion Defaults

- Keep vendor/product names where they identify the integration.
- Remove Claude product identity from user-facing text.
- Convert runtime code to TypeScript.
- Do not publish a marketplace entry until source has been fetched and validated.

## Acceptance

The batch is complete when all 96 entries have source status:

- `fetched`
- `moved-to-local-path-batch`
- `source-unavailable`
- `duplicate-of-existing-source`

No entry may remain unclassified.

## Audit Addendum (Window H, 2026-05-19)

This addendum captures findings from Window H's execution of the source-acquisition pass. The original rules above remain authoritative; this section clarifies the source representation and records the realized methodology.

### Source representation

The "Source" column in §"Worker Assignments" is a single-string render. The authoritative `bangong/claude-plugins-official/.claude-plugin/marketplace.json` stores each entry's `source` as a typed object that pins a commit `sha`, an optional `ref`, and an optional sub-path:

- 84/96 entries use `{"source":"url", "url":..., "sha":..., "path"?:...}`.
- 10/96 entries use `{"source":"git-subdir", "url":..., "ref":..., "sha":..., "path":...}`.
- 2/96 entries use `{"source":"github", "url":"<org>/<repo>", "sha":...}` (normalize via `https://github.com/<org>/<repo>.git`).

Implication: where the single-string render shows a path like `claude-plugin/atomic-agents`, `revenuecat`, or `providers/claude/plugin`, that string is the upstream sub-path, not the upstream URL. The full structured record (URL + path + sha) is the only safe input to the conversion ticket.

### Realized methodology

1. Extract structured records for all 96 entries; deduplicate by upstream URL (96 entries collapse to 92 unique upstream repositories).
2. `git ls-remote --heads --quiet` (parallel-16) for reachability — all 92 returned `OK`.
3. `git clone --depth=1 --no-tags`, then `git fetch --depth=1 origin <sha-pinned>` and `git checkout <sha-pinned>` (parallel-12) — all 92 pinned to the marketplace-pinned sha; no fallback to HEAD was required.
4. Classification scans the path-pinned subtree when `path` is set, else the repo root. It skips non-Claude-IDE plugin manifest dirs (`.cursor-plugin`, `.codex-plugin`, `.zed-plugin`, `.copilot-plugin`, `.continue-plugin`, `.windsurf-plugin`, `.cline-plugin`, `.aider-plugin`) so that mirrored IDE manifests do not inflate `plugin.json` counts.

### Status outcomes

- `fetched`: 92
- `duplicate-of-existing-source`: 4 (`rc → revenuecat`, `data → astronomer-data-agents`, `data-engineering → astronomer-data-agents`, `sap-cds-mcp → cds-mcp`)
- `source-unavailable`: 0
- `moved-to-local-path-batch`: 0 (no Window H entry needed a hand-off to Parallel-33)

Total 96 entries classified — plan-08 §"Acceptance" satisfied.

### Decisions deferred to the integration window

1. Whether to publish duplicate names as marketplace aliases or drop them.
2. Slicing decision for the four multi-plugin-monorepo upstreams (`azure`, `huggingface-skills`, `quarkus-agent`, `vanta-mcp-plugin`).
3. Legal review for 1 noncommercial-blocker (`agentforce-adlc`, CC-BY-NC-4.0), 1 AGPL (`postiz`), 1 GPL (`wordpress.com`), 1 source-available (`sonarqube`), and 24 missing-license entries.
4. Capacity rebalance for `parallel-05-runtime-present` — Window H adds 13 hook-runtime candidates on top of the 5 original.

### Worker report

Full per-entry table and marketplace entry drafts live in [`2026-05-19-bangong-crabcode-plugin-migration-implementation-plan-08-window-h-report.md`](2026-05-19-bangong-crabcode-plugin-migration-implementation-plan-08-window-h-report.md). Drafts are written into the report, not directly into `.crabcode-plugin/marketplace.json`, per the Window H goal contract.
