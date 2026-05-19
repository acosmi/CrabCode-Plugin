# Window H Report — Parallel 96 External Source Fetch

Date: 2026-05-19
Window: H — `08-parallel-96-external-source-fetch`
Owning plan: [`2026-05-19-bangong-crabcode-plugin-migration-implementation-plan-08-parallel-96-external-source-fetch.md`](./2026-05-19-bangong-crabcode-plugin-migration-implementation-plan-08-parallel-96-external-source-fetch.md)
Marketplace baseline: `bangong/claude-plugins-official` @ `4bf08583c37e04f764806ea7a96ca74fb80ced1d` (matches plan-00-index).

## Outcome Summary

| Status | Count |
|---|---|
| `fetched` | 92 |
| `moved-to-local-path-batch` | 0 |
| `source-unavailable` | 0 |
| `duplicate-of-existing-source` | 4 |
| **Total** | **96** |

All 96 declared entries are accounted for; the batch acceptance criterion in plan-08 §"Acceptance" is satisfied.

## Plan-08 Audit Notes (read before consuming this report)

The plan-08 "Worker Assignments" table renders each `source` field as a single string. The actual `bangong/claude-plugins-official/.claude-plugin/marketplace.json` stores each `source` as a typed object that already pins a commit `sha`, a ref (sometimes), and an optional sub-path inside the upstream repo. Concretely:

- 84 entries use `{"source":"url", "url":..., "sha":..., "path"?:...}`.
- 10 entries use `{"source":"git-subdir", "url":..., "ref":..., "sha":..., "path":...}`.
- 2 entries use `{"source":"github", "url":"<org>/<repo>", "sha":...}` (normalized to `https://github.com/<org>/<repo>.git`).

Implications:

1. The "Source" column in plan-08 §"Worker Assignments" sometimes shows the `url` and sometimes shows the `path` (e.g. `atomic-agents` → `claude-plugin/atomic-agents` is the path, not the URL). This report uses the full structured record from the marketplace as authoritative.
2. The pinned `sha` already exists in the marketplace baseline; no separate re-pinning step is needed for the migration ticket — quoting the marketplace `sha` is enough.
3. Several upstream URLs are reused by multiple entries (same `url+path+sha`), which makes the entries true duplicates. These are reported below in the "duplicate-of-existing-source" section.

## Acquisition Method (refinement of plan-08 §"Acquisition Rules")

1. Deduplicated unique upstreams (96 entries → 92 unique repositories) and cloned each upstream once into `bangong/external-sources/<org>__<repo>/`.
2. Used `git clone --depth=1 --no-tags`, then `git fetch --depth=1 origin <sha-pinned>` followed by `git checkout <sha-pinned>` to pin every clone to the exact sha the marketplace entry references. **All 92 clones successfully pinned to the marketplace-pinned sha** (no fallback to HEAD was required).
3. `bangong/` is gitignored at the repo root (see plan-01 §"Audit Addendum (Window A) → `bangong/` tracking"); none of these external clones are committed.
4. URL reachability was probed via `git ls-remote --heads --quiet` for all 92 unique upstreams in parallel before cloning. All 92 returned `OK`.
5. Classification scanned the path-pinned subtree (if `path` was set in the marketplace entry) or the repository root, skipping non-Claude-IDE plugin manifest dirs (`.cursor-plugin`, `.codex-plugin`, `.zed-plugin`, `.copilot-plugin`, `.continue-plugin`, `.windsurf-plugin`, `.cline-plugin`, `.aider-plugin`) so that mirrored IDE plugin manifests do not inflate `plugin.json` counts.

## Component Classification

| Classification | Count | Target later batch |
|---|---|---|
| `mcp-wrapper` | 7 | parallel-15-mcp-present |
| `skill-suite` | 18 | parallel-17-skills-suite |
| `command-workflow` | 5 | parallel-18-workflow-present |
| `mixed-plugin` | 45 | parallel-18-workflow-present |
| `hook-runtime` | 13 | parallel-05-runtime-present |
| `multi-plugin-monorepo` | 4 | parallel-18-workflow-present (requires upstream-by-upstream split decision before implementation) |

Heuristic notes:

- `mcp-wrapper`: contains `.mcp.json` and no `commands/`/`agents/`/`skills/`/`hooks/` directories.
- `skill-suite`: contains a `skills/` directory and no MCP/commands/agents/hooks signals.
- `command-workflow`: contains a `commands/` directory (often with `agents/` or `skills/`) and no MCP server.
- `mixed-plugin`: combines an MCP server with commands/agents/skills (or has both `commands/` and `skills/` plus extra runtime).
- `hook-runtime`: contains a `hooks/` directory with TypeScript/Python/JS/shell handlers — Python/shell must be rewritten in TypeScript per plan-01 §"TypeScript Rules".
- `multi-plugin-monorepo`: the upstream repo contains more than one `.claude-plugin/plugin.json`; a slicing decision is required before the conversion ticket can run cleanly.

## License Inventory

| Detected license | Count |
|---|---|
| `MIT` | 37 |
| `Apache-2.0` | 26 |
| `NONE_DETECTED` | 24 |
| `CC-BY-NC-4.0` | 1 |
| `CC-BY-4.0` | 1 |
| `AGPL-3.0` | 1 |
| `SSAL-1.0` | 1 |
| `GPL-2.0` | 1 |

| License concern | Count |
|---|---|
| `missing-license-file` | 24 |
| `noncommercial-blocker` | 1 |
| `copyleft-network` | 1 |
| `source-available-restrictive` | 1 |
| `copyleft` | 1 |

### Entries that need legal review before publication

| Entry | License | Concern | Action |
|---|---|---|---|
| `agentforce-adlc` | `CC-BY-NC-4.0` | `noncommercial-blocker` | Block: CC-BY-NC-4.0 forbids commercial redistribution. Hold until upstream relicenses or vendor grants commercial-use exception. |
| `aikido` | `NONE_DETECTED` | `missing-license-file` | Contact upstream to confirm licensing intent before publishing a CrabCode mirror. Default assumption: all rights reserved. |
| `circleback` | `NONE_DETECTED` | `missing-license-file` | Contact upstream to confirm licensing intent before publishing a CrabCode mirror. Default assumption: all rights reserved. |
| `cloudinary` | `NONE_DETECTED` | `missing-license-file` | Contact upstream to confirm licensing intent before publishing a CrabCode mirror. Default assumption: all rights reserved. |
| `dataverse` | `NONE_DETECTED` | `missing-license-file` | Contact upstream to confirm licensing intent before publishing a CrabCode mirror. Default assumption: all rights reserved. |
| `figma` | `NONE_DETECTED` | `missing-license-file` | Contact upstream to confirm licensing intent before publishing a CrabCode mirror. Default assumption: all rights reserved. |
| `firecrawl` | `NONE_DETECTED` | `missing-license-file` | Contact upstream to confirm licensing intent before publishing a CrabCode mirror. Default assumption: all rights reserved. |
| `fullstory` | `NONE_DETECTED` | `missing-license-file` | Contact upstream to confirm licensing intent before publishing a CrabCode mirror. Default assumption: all rights reserved. |
| `miro` | `NONE_DETECTED` | `missing-license-file` | Contact upstream to confirm licensing intent before publishing a CrabCode mirror. Default assumption: all rights reserved. |
| `netsuite-suitecloud` | `NONE_DETECTED` | `missing-license-file` | Contact upstream to confirm licensing intent before publishing a CrabCode mirror. Default assumption: all rights reserved. |
| `notion` | `NONE_DETECTED` | `missing-license-file` | Contact upstream to confirm licensing intent before publishing a CrabCode mirror. Default assumption: all rights reserved. |
| `outputai` | `NONE_DETECTED` | `missing-license-file` | Contact upstream to confirm licensing intent before publishing a CrabCode mirror. Default assumption: all rights reserved. |
| `planetscale` | `NONE_DETECTED` | `missing-license-file` | Contact upstream to confirm licensing intent before publishing a CrabCode mirror. Default assumption: all rights reserved. |
| `posthog` | `NONE_DETECTED` | `missing-license-file` | Contact upstream to confirm licensing intent before publishing a CrabCode mirror. Default assumption: all rights reserved. |
| `postiz` | `AGPL-3.0` | `copyleft-network` | Hold: AGPL-3.0 network-copyleft propagates to CrabCode product if linked. Legal sign-off required. |
| `prisma` | `NONE_DETECTED` | `missing-license-file` | Contact upstream to confirm licensing intent before publishing a CrabCode mirror. Default assumption: all rights reserved. |
| `revenuecat` | `NONE_DETECTED` | `missing-license-file` | Contact upstream to confirm licensing intent before publishing a CrabCode mirror. Default assumption: all rights reserved. |
| `save-to-spotify` | `NONE_DETECTED` | `missing-license-file` | Contact upstream to confirm licensing intent before publishing a CrabCode mirror. Default assumption: all rights reserved. |
| `semgrep` | `NONE_DETECTED` | `missing-license-file` | Contact upstream to confirm licensing intent before publishing a CrabCode mirror. Default assumption: all rights reserved. |
| `servicenow-sdk` | `NONE_DETECTED` | `missing-license-file` | Contact upstream to confirm licensing intent before publishing a CrabCode mirror. Default assumption: all rights reserved. |
| `sonarqube` | `SSAL-1.0` | `source-available-restrictive` | Hold: source-available license imposes use restrictions. Read the license terms before publication. |
| `sonatype-guide` | `NONE_DETECTED` | `missing-license-file` | Contact upstream to confirm licensing intent before publishing a CrabCode mirror. Default assumption: all rights reserved. |
| `sourcegraph` | `NONE_DETECTED` | `missing-license-file` | Contact upstream to confirm licensing intent before publishing a CrabCode mirror. Default assumption: all rights reserved. |
| `stripe` | `NONE_DETECTED` | `missing-license-file` | Contact upstream to confirm licensing intent before publishing a CrabCode mirror. Default assumption: all rights reserved. |
| `sumup` | `NONE_DETECTED` | `missing-license-file` | Contact upstream to confirm licensing intent before publishing a CrabCode mirror. Default assumption: all rights reserved. |
| `supabase` | `NONE_DETECTED` | `missing-license-file` | Contact upstream to confirm licensing intent before publishing a CrabCode mirror. Default assumption: all rights reserved. |
| `vercel` | `NONE_DETECTED` | `missing-license-file` | Contact upstream to confirm licensing intent before publishing a CrabCode mirror. Default assumption: all rights reserved. |
| `wordpress.com` | `GPL-2.0` | `copyleft` | Hold: GPL family; vendor sign-off required before embedding into closed-source CrabCode. |

## Duplicate Source Entries

Four upstream entries reuse the exact same `url + path + sha` triple as another entry. The first-named entry is kept as the canonical migration target; the others are marked `duplicate-of-existing-source` and should not get their own product directory.

| Duplicate name | Canonical name | Shared upstream |
|---|---|---|
| `data` | `astronomer-data-agents` | `https://github.com/astronomer/agents.git` @ `535a040c` |
| `data-engineering` | `astronomer-data-agents` | `https://github.com/astronomer/agents.git` @ `535a040c` |
| `rc` | `revenuecat` | `https://github.com/RevenueCat/rc-claude-code-plugin.git` @ `407e4651` |
| `sap-cds-mcp` | `cds-mcp` | `https://github.com/cap-js/mcp-server.git` @ `ef840d43` |

## Multi-Plugin Monorepo Entries (require slicing decision)

These upstream repos contain more than one `.claude-plugin/plugin.json` at or under the marketplace-pinned root. Before the conversion ticket runs, an integration decision must pick which sub-plugin(s) the CrabCode entry should mirror.

| Entry | Upstream | Pinned sha | claude-plugin/plugin.json count | Hint |
|---|---|---|---|---|
| `azure` | `https://github.com/microsoft/azure-skills.git` | `350e050c` | 2 | `bangong/external-sources/microsoft__azure-skills` |
| `huggingface-skills` | `https://github.com/huggingface/skills.git` | `7c71cfb2` | 2 | `bangong/external-sources/huggingface__skills` |
| `quarkus-agent` | `https://github.com/quarkusio/quarkus-agent-mcp.git` | `c1728023` | 2 | `bangong/external-sources/quarkusio__quarkus-agent-mcp` |
| `vanta-mcp-plugin` | `https://github.com/VantaInc/vanta-mcp-plugin.git` | `345d86b5` | 2 | `bangong/external-sources/VantaInc__vanta-mcp-plugin` |

## Hand-off to Later Batches

| Target batch | Count | Entries |
|---|---|---|
| `parallel-18-workflow-present` | 54 | aikido, apollo, atlassian, atomic-agents, azure, azure-cosmos-db-assistant, chrome-devtools-mcp, clickhouse, cloudflare, cloudinary, coderabbit, data-agent-kit-starter-pack, datadog, fiftyone, figma, firecrawl, fullstory, huggingface-skills, intercom, microsoft-docs, mintlify, miro, mongodb, netlify-skills, netsuite-suitecloud, nimble, notion, outputai, pagerduty, pigment, pinecone, postiz, postman, quarkus-agent, revenuecat, sanity, sap-fiori-mcp-server, sentry, shopify-ai-toolkit, slack, sonarqube, sonatype-guide, sourcegraph, stripe, sumup, supabase, twilio-developer-kit, vanta-mcp-plugin, windsor-ai, wix, wordpress.com, zoom-plugin, zoominfo, zscaler |
| `parallel-17-skills-suite` | 18 | ai-plugins, alloydb, base44, box, brightdata-plugin, cloud-sql-postgresql, convex-backend, datarobot-agent-skills, dataverse, exa, fastly-agent-toolkit, nightvision, oracle-ai-data-platform-workbench-spark-connectors, qdrant-skills, qodo-skills, qt-development-skills, save-to-spotify, servicenow-sdk |
| `parallel-05-runtime-present` | 13 | agentforce-adlc, astronomer-data-agents, cockroachdb, crowdstrike-falcon-foundry, dash0, jfrog, posthog, remember, semgrep, spotify-ads-api, superpowers, vercel, youdotcom-agent-skills |
| `parallel-15-mcp-present` | 7 | atlan, cds-mcp, circleback, planetscale, prisma, sap-mdk-server, shopify |

## Per-Entry Detail Table

Columns: status, classification, target batch, upstream url, upstream sub-path, pinned sha, license, license concern.

| # | Name | Status | Classification | Target batch | Upstream | Path | Sha | License | Concern |
|---|---|---|---|---|---|---|---|---|---|
| EX-001 | `agentforce-adlc` | fetched | `hook-runtime` | `parallel-05-runtime-present` | `https://github.com/SalesforceAIResearch/agentforce-adlc.git` | `.` | `d645d2c8` | `CC-BY-NC-4.0` | `noncommercial-blocker` |
| EX-002 | `ai-plugins` | fetched | `skill-suite` | `parallel-17-skills-suite` | `https://github.com/endorlabs/ai-plugins.git` | `.` | `975f0ce4` | `MIT` | `—` |
| EX-003 | `aikido` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/AikidoSec/aikido-claude-plugin.git` | `.` | `79ac524f` | `NONE_DETECTED` | `missing-license-file` |
| EX-004 | `alloydb` | fetched | `skill-suite` | `parallel-17-skills-suite` | `https://github.com/gemini-cli-extensions/alloydb.git` | `.` | `4a756532` | `Apache-2.0` | `—` |
| EX-005 | `apollo` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/apolloio/apollo-mcp-plugin.git` | `.` | `79577f93` | `MIT` | `—` |
| EX-006 | `astronomer-data-agents` | fetched | `hook-runtime` | `parallel-05-runtime-present` | `https://github.com/astronomer/agents.git` | `.` | `535a040c` | `Apache-2.0` | `—` |
| EX-007 | `atlan` | fetched | `mcp-wrapper` | `parallel-15-mcp-present` | `https://github.com/atlanhq/agent-toolkit.git` | `.` | `790398c8` | `MIT` | `—` |
| EX-008 | `atlassian` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/atlassian/atlassian-mcp-server.git` | `.` | `9b52fb18` | `Apache-2.0` | `—` |
| EX-009 | `atomic-agents` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/BrainBlend-AI/atomic-agents.git` | `claude-plugin/atomic-agents` | `f849087b` | `MIT` | `—` |
| EX-010 | `azure` | fetched | `multi-plugin-monorepo` | `parallel-18-workflow-present` | `https://github.com/microsoft/azure-skills.git` | `.` | `350e050c` | `MIT` | `—` |
| EX-011 | `azure-cosmos-db-assistant` | fetched | `command-workflow` | `parallel-18-workflow-present` | `https://github.com/AzureCosmosDB/cosmosdb-claude-code-plugin.git` | `.` | `f1e04985` | `MIT` | `—` |
| EX-012 | `base44` | fetched | `skill-suite` | `parallel-17-skills-suite` | `https://github.com/base44/skills.git` | `.` | `ec420cf2` | `MIT` | `—` |
| EX-013 | `box` | fetched | `skill-suite` | `parallel-17-skills-suite` | `https://github.com/box/box-for-ai.git` | `.` | `16f1a042` | `MIT` | `—` |
| EX-014 | `brightdata-plugin` | fetched | `skill-suite` | `parallel-17-skills-suite` | `https://github.com/brightdata/skills.git` | `.` | `37145178` | `MIT` | `—` |
| EX-015 | `cds-mcp` | fetched | `mcp-wrapper` | `parallel-15-mcp-present` | `https://github.com/cap-js/mcp-server.git` | `.` | `ef840d43` | `Apache-2.0` | `—` |
| EX-016 | `chrome-devtools-mcp` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/ChromeDevTools/chrome-devtools-mcp.git` | `.` | `32dc50d5` | `Apache-2.0` | `—` |
| EX-017 | `circleback` | fetched | `mcp-wrapper` | `parallel-15-mcp-present` | `https://github.com/circlebackai/claude-code-plugin.git` | `.` | `6369dec7` | `NONE_DETECTED` | `missing-license-file` |
| EX-018 | `clickhouse` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/ClickHouse/clickhouse-claude-code-plugin.git` | `.` | `13a2df00` | `Apache-2.0` | `—` |
| EX-019 | `cloud-sql-postgresql` | fetched | `skill-suite` | `parallel-17-skills-suite` | `https://github.com/gemini-cli-extensions/cloud-sql-postgresql.git` | `.` | `966f7b88` | `Apache-2.0` | `—` |
| EX-020 | `cloudflare` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/cloudflare/skills.git` | `.` | `60147cbb` | `Apache-2.0` | `—` |
| EX-021 | `cloudinary` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/cloudinary-devs/cloudinary-plugin.git` | `.` | `7b443d7d` | `NONE_DETECTED` | `missing-license-file` |
| EX-022 | `cockroachdb` | fetched | `hook-runtime` | `parallel-05-runtime-present` | `https://github.com/cockroachdb/claude-plugin.git` | `.` | `736bd11d` | `Apache-2.0` | `—` |
| EX-023 | `coderabbit` | fetched | `command-workflow` | `parallel-18-workflow-present` | `https://github.com/coderabbitai/skills.git` | `.` | `a81eb76a` | `MIT` | `—` |
| EX-024 | `convex-backend` | fetched | `skill-suite` | `parallel-17-skills-suite` | `https://github.com/get-convex/convex-backend-skill.git` | `.` | `9acbc549` | `Apache-2.0` | `—` |
| EX-025 | `crowdstrike-falcon-foundry` | fetched | `hook-runtime` | `parallel-05-runtime-present` | `https://github.com/CrowdStrike/foundry-skills.git` | `.` | `4b517aa5` | `MIT` | `—` |
| EX-026 | `dash0` | fetched | `hook-runtime` | `parallel-05-runtime-present` | `https://github.com/dash0hq/dash0-agent-plugin.git` | `.` | `feae46e4` | `Apache-2.0` | `—` |
| EX-027 | `data` | duplicate-of-existing-source | — | — | `https://github.com/astronomer/agents.git` | `.` | `535a040c` | — | duplicate-of=`astronomer-data-agents` |
| EX-028 | `data-agent-kit-starter-pack` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/gemini-cli-extensions/data-agent-kit-starter-pack.git` | `.` | `7bc75b5e` | `Apache-2.0` | `—` |
| EX-029 | `data-engineering` | duplicate-of-existing-source | — | — | `https://github.com/astronomer/agents.git` | `.` | `535a040c` | — | duplicate-of=`astronomer-data-agents` |
| EX-030 | `datadog` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/datadog-labs/claude-code-plugin.git` | `.` | `eeb2f746` | `Apache-2.0` | `—` |
| EX-031 | `datarobot-agent-skills` | fetched | `skill-suite` | `parallel-17-skills-suite` | `https://github.com/datarobot-oss/datarobot-agent-skills.git` | `.` | `6a13377a` | `Apache-2.0` | `—` |
| EX-032 | `dataverse` | fetched | `skill-suite` | `parallel-17-skills-suite` | `https://github.com/microsoft/Dataverse-skills.git` | `.github/plugins/dataverse` | `5f186bf8` | `NONE_DETECTED` | `missing-license-file` |
| EX-033 | `exa` | fetched | `skill-suite` | `parallel-17-skills-suite` | `https://github.com/exa-labs/exa-mcp-server.git` | `.` | `5ce6c53b` | `MIT` | `—` |
| EX-034 | `fastly-agent-toolkit` | fetched | `skill-suite` | `parallel-17-skills-suite` | `https://github.com/fastly/fastly-agent-toolkit.git` | `.` | `e0f42057` | `MIT` | `—` |
| EX-035 | `fiftyone` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/voxel51/fiftyone-skills.git` | `.` | `a79e53c6` | `Apache-2.0` | `—` |
| EX-036 | `figma` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/figma/mcp-server-guide.git` | `.` | `a742f0a7` | `NONE_DETECTED` | `missing-license-file` |
| EX-037 | `firecrawl` | fetched | `command-workflow` | `parallel-18-workflow-present` | `https://github.com/firecrawl/firecrawl-claude-plugin.git` | `.` | `48edd794` | `NONE_DETECTED` | `missing-license-file` |
| EX-038 | `fullstory` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/fullstorydev/fullstory-skills.git` | `.` | `1ec5865e` | `NONE_DETECTED` | `missing-license-file` |
| EX-039 | `huggingface-skills` | fetched | `multi-plugin-monorepo` | `parallel-18-workflow-present` | `https://github.com/huggingface/skills.git` | `.` | `7c71cfb2` | `Apache-2.0` | `—` |
| EX-040 | `intercom` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/intercom/claude-plugin-external.git` | `.` | `52653572` | `MIT` | `—` |
| EX-041 | `jfrog` | fetched | `hook-runtime` | `parallel-05-runtime-present` | `https://github.com/jfrog/claude-plugin.git` | `.` | `259c8e71` | `Apache-2.0` | `—` |
| EX-042 | `microsoft-docs` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/MicrosoftDocs/mcp.git` | `.` | `954c17e7` | `CC-BY-4.0` | `—` |
| EX-043 | `mintlify` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/mintlify/mintlify-claude-plugin.git` | `.` | `acd6d2e0` | `MIT` | `—` |
| EX-044 | `miro` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/miroapp/miro-ai.git` | `claude-plugins/miro` | `00e619e6` | `NONE_DETECTED` | `missing-license-file` |
| EX-045 | `mongodb` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/mongodb/agent-skills.git` | `.` | `24529d95` | `Apache-2.0` | `—` |
| EX-046 | `netlify-skills` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/netlify/context-and-tools.git` | `.` | `a49ebc59` | `MIT` | `—` |
| EX-047 | `netsuite-suitecloud` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/oracle/netsuite-suitecloud-sdk.git` | `packages/agent-skills` | `43bacf43` | `NONE_DETECTED` | `missing-license-file` |
| EX-048 | `nightvision` | fetched | `skill-suite` | `parallel-17-skills-suite` | `https://github.com/nvsecurity/nightvision-skills.git` | `.` | `7d7a3f34` | `Apache-2.0` | `—` |
| EX-049 | `nimble` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/Nimbleway/agent-skills.git` | `.` | `626930f1` | `MIT` | `—` |
| EX-050 | `notion` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/makenotion/claude-code-notion-plugin.git` | `.` | `9847f2aa` | `NONE_DETECTED` | `missing-license-file` |
| EX-051 | `oracle-ai-data-platform-workbench-spark-connectors` | fetched | `skill-suite` | `parallel-17-skills-suite` | `https://github.com/oracle-samples/oracle-aidp-samples.git` | `ai/claude-code-plugins/oracle-ai-data-platform-workbench-spark-connectors` | `f436f3a4` | `MIT` | `—` |
| EX-052 | `outputai` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/growthxai/output.git` | `coding_assistants/claude/plugins/outputai` | `756d32d1` | `NONE_DETECTED` | `missing-license-file` |
| EX-053 | `pagerduty` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/PagerDuty/claude-code-plugins.git` | `.` | `761cba75` | `Apache-2.0` | `—` |
| EX-054 | `pigment` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/gopigment/ai-plugins.git` | `.` | `5bdf0886` | `MIT` | `—` |
| EX-055 | `pinecone` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/pinecone-io/pinecone-claude-code-plugin.git` | `.` | `7dc3cfe0` | `MIT` | `—` |
| EX-056 | `planetscale` | fetched | `mcp-wrapper` | `parallel-15-mcp-present` | `https://github.com/planetscale/claude-plugin.git` | `.` | `f1066cac` | `NONE_DETECTED` | `missing-license-file` |
| EX-057 | `posthog` | fetched | `hook-runtime` | `parallel-05-runtime-present` | `https://github.com/PostHog/ai-plugin.git` | `.` | `ff08c376` | `NONE_DETECTED` | `missing-license-file` |
| EX-058 | `postiz` | fetched | `command-workflow` | `parallel-18-workflow-present` | `https://github.com/gitroomhq/postiz-agent.git` | `.` | `37d62724` | `AGPL-3.0` | `copyleft-network` |
| EX-059 | `postman` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/Postman-Devrel/postman-claude-code-plugin.git` | `.` | `416e40da` | `Apache-2.0` | `—` |
| EX-060 | `prisma` | fetched | `mcp-wrapper` | `parallel-15-mcp-present` | `https://github.com/prisma/claude-plugin.git` | `.` | `815dbc4a` | `NONE_DETECTED` | `missing-license-file` |
| EX-061 | `qdrant-skills` | fetched | `skill-suite` | `parallel-17-skills-suite` | `https://github.com/qdrant/skills.git` | `.` | `9f935f8b` | `Apache-2.0` | `—` |
| EX-062 | `qodo-skills` | fetched | `skill-suite` | `parallel-17-skills-suite` | `https://github.com/qodo-ai/qodo-skills.git` | `.` | `8fb6b550` | `MIT` | `—` |
| EX-063 | `qt-development-skills` | fetched | `skill-suite` | `parallel-17-skills-suite` | `https://github.com/TheQtCompanyRnD/agent-skills.git` | `.` | `62a98e23` | `MIT` | `—` |
| EX-064 | `quarkus-agent` | fetched | `multi-plugin-monorepo` | `parallel-18-workflow-present` | `https://github.com/quarkusio/quarkus-agent-mcp.git` | `.` | `c1728023` | `Apache-2.0` | `—` |
| EX-065 | `rc` | duplicate-of-existing-source | — | — | `https://github.com/RevenueCat/rc-claude-code-plugin.git` | `revenuecat` | `407e4651` | — | duplicate-of=`revenuecat` |
| EX-066 | `remember` | fetched | `hook-runtime` | `parallel-05-runtime-present` | `https://github.com/Digital-Process-Tools/claude-remember.git` | `.` | `aa55ba3f` | `MIT` | `—` |
| EX-067 | `revenuecat` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/RevenueCat/rc-claude-code-plugin.git` | `revenuecat` | `407e4651` | `NONE_DETECTED` | `missing-license-file` |
| EX-068 | `sanity` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/sanity-io/agent-toolkit.git` | `.` | `236348e2` | `MIT` | `—` |
| EX-069 | `sap-cds-mcp` | duplicate-of-existing-source | — | — | `https://github.com/cap-js/mcp-server.git` | `.` | `ef840d43` | — | duplicate-of=`cds-mcp` |
| EX-070 | `sap-fiori-mcp-server` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/SAP/open-ux-tools.git` | `packages/fiori-mcp-server` | `157120fd` | `Apache-2.0` | `—` |
| EX-071 | `sap-mdk-server` | fetched | `mcp-wrapper` | `parallel-15-mcp-present` | `https://github.com/SAP/mdk-mcp-server.git` | `.` | `10ff6ccf` | `Apache-2.0` | `—` |
| EX-072 | `save-to-spotify` | fetched | `skill-suite` | `parallel-17-skills-suite` | `https://github.com/spotify/save-to-spotify.git` | `plugin` | `b3d362f7` | `NONE_DETECTED` | `missing-license-file` |
| EX-073 | `semgrep` | fetched | `hook-runtime` | `parallel-05-runtime-present` | `https://github.com/semgrep/mcp-marketplace.git` | `plugin` | `274846f6` | `NONE_DETECTED` | `missing-license-file` |
| EX-074 | `sentry` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/getsentry/sentry-for-claude.git` | `.` | `cf7efd37` | `MIT` | `—` |
| EX-075 | `servicenow-sdk` | fetched | `skill-suite` | `parallel-17-skills-suite` | `https://github.com/ServiceNow/sdk.git` | `providers/claude/plugin` | `06adf37c` | `NONE_DETECTED` | `missing-license-file` |
| EX-076 | `shopify` | fetched | `mcp-wrapper` | `parallel-15-mcp-present` | `https://github.com/Shopify/shopify-plugins.git` | `.` | `5631b93b` | `MIT` | `—` |
| EX-077 | `shopify-ai-toolkit` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/Shopify/Shopify-AI-Toolkit.git` | `.` | `c164cf45` | `MIT` | `—` |
| EX-078 | `slack` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/slackapi/slack-mcp-plugin.git` | `.` | `7b945895` | `MIT` | `—` |
| EX-079 | `sonarqube` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/SonarSource/sonarqube-agent-plugins.git` | `.` | `c64e09af` | `SSAL-1.0` | `source-available-restrictive` |
| EX-080 | `sonatype-guide` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/sonatype/sonatype-guide-claude-plugin.git` | `.` | `1dae7398` | `NONE_DETECTED` | `missing-license-file` |
| EX-081 | `sourcegraph` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/sourcegraph-community/sourcegraph-claudecode-plugin.git` | `.` | `332ee0ca` | `NONE_DETECTED` | `missing-license-file` |
| EX-082 | `spotify-ads-api` | fetched | `hook-runtime` | `parallel-05-runtime-present` | `https://github.com/spotify/ads-claude-plugin.git` | `.` | `cc3db744` | `Apache-2.0` | `—` |
| EX-083 | `stripe` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/stripe/ai.git` | `providers/claude/plugin` | `ec93d4c4` | `NONE_DETECTED` | `missing-license-file` |
| EX-084 | `sumup` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/sumup/sumup-skills.git` | `providers/claude/plugin` | `a4b5a978` | `NONE_DETECTED` | `missing-license-file` |
| EX-085 | `supabase` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/supabase-community/supabase-plugin.git` | `.` | `693a17a9` | `NONE_DETECTED` | `missing-license-file` |
| EX-086 | `superpowers` | fetched | `hook-runtime` | `parallel-05-runtime-present` | `https://github.com/obra/superpowers.git` | `.` | `f2cbfbef` | `MIT` | `—` |
| EX-087 | `twilio-developer-kit` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/twilio/ai.git` | `.` | `7d15b215` | `MIT` | `—` |
| EX-088 | `vanta-mcp-plugin` | fetched | `multi-plugin-monorepo` | `parallel-18-workflow-present` | `https://github.com/VantaInc/vanta-mcp-plugin.git` | `.` | `345d86b5` | `MIT` | `—` |
| EX-089 | `vercel` | fetched | `hook-runtime` | `parallel-05-runtime-present` | `https://github.com/vercel/vercel-plugin.git` | `.` | `1edb125d` | `NONE_DETECTED` | `missing-license-file` |
| EX-090 | `windsor-ai` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/windsor-ai/claude-windsor-ai-plugin.git` | `.` | `248a6994` | `MIT` | `—` |
| EX-091 | `wix` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/wix/skills.git` | `.` | `7ae38286` | `MIT` | `—` |
| EX-092 | `wordpress.com` | fetched | `command-workflow` | `parallel-18-workflow-present` | `https://github.com/Automattic/claude-code-wordpress.com.git` | `.` | `052ca970` | `GPL-2.0` | `copyleft` |
| EX-093 | `youdotcom-agent-skills` | fetched | `hook-runtime` | `parallel-05-runtime-present` | `https://github.com/youdotcom-oss/agent-skills.git` | `.` | `4712250a` | `MIT` | `—` |
| EX-094 | `zoom-plugin` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/zoom/zoom-plugin.git` | `.` | `88f6ca35` | `MIT` | `—` |
| EX-095 | `zoominfo` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/Zoominfo/zoominfo-mcp-plugin.git` | `.` | `14752e45` | `MIT` | `—` |
| EX-096 | `zscaler` | fetched | `mixed-plugin` | `parallel-18-workflow-present` | `https://github.com/zscaler/zscaler-mcp-server.git` | `.` | `246430c8` | `MIT` | `—` |

## Marketplace Entry Drafts (for total integration window)

Per the Window H goal contract: drafts are NOT written into `.crabcode-plugin/marketplace.json` by this window. The total integration coordinator should review and stage them after the corresponding implementation batches land each plugin directory.

Description fields have been pre-sanitized for the `Claude` / `Claude Code` / `Anthropic` / `.claude` tokens per plan-01 §"Brand Removal Rules". Vendor-product names (Atlassian, Stripe, Supabase, etc.) are retained as required by plan-01 §"Naming Rules". The `version` field defaults to `0.0.1` when the upstream marketplace entry leaves it blank.

Each draft also carries an internal `_meta` block with the upstream coordinates. Integration must strip `_meta` before writing into `.crabcode-plugin/marketplace.json`.

```json
[
  {
    "name": "agentforce-adlc",
    "source": "./plugins/agentforce-adlc",
    "version": "0.0.1",
    "description": "Agentforce Agent Development Life Cycle \u2014 author, discover, scaffold, deploy, test, and optimize .agent files",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/SalesforceAIResearch/agentforce-adlc.git",
      "upstream_sha": "d645d2c8ce0689a568224436061872ab9f0ab179",
      "upstream_subpath": null,
      "classification": "hook-runtime",
      "target_batch": "parallel-05-runtime-present",
      "license": "CC-BY-NC-4.0",
      "license_concern": "noncommercial-blocker"
    }
  },
  {
    "name": "ai-plugins",
    "source": "./plugins/ai-plugins",
    "version": "0.0.1",
    "description": "Set up endorctl and use Endor Labs to scan, prioritize, and fix security risks across your software supply chain",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/endorlabs/ai-plugins.git",
      "upstream_sha": "975f0ce422b1f2677681ffd085aef34ea1826b70",
      "upstream_subpath": null,
      "classification": "skill-suite",
      "target_batch": "parallel-17-skills-suite",
      "license": "MIT",
      "license_concern": null
    }
  },
  {
    "name": "aikido",
    "source": "./plugins/aikido",
    "version": "0.0.1",
    "description": "Aikido Security scanning for CrabCode \u2014 SAST, secrets, and IaC vulnerability detection powered by the Aikido MCP server.",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/AikidoSec/aikido-claude-plugin.git",
      "upstream_sha": "79ac524f87c9faa9a356ff3d495b8a5b77e01bbd",
      "upstream_subpath": null,
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "NONE_DETECTED",
      "license_concern": "missing-license-file"
    }
  },
  {
    "name": "alloydb",
    "source": "./plugins/alloydb",
    "version": "0.0.1",
    "description": "Create, connect, and interact with an AlloyDB for PostgreSQL database and data.",
    "category": "database",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/gemini-cli-extensions/alloydb.git",
      "upstream_sha": "4a75653275b095fcacf1508796b0fee8cc758c07",
      "upstream_subpath": null,
      "classification": "skill-suite",
      "target_batch": "parallel-17-skills-suite",
      "license": "Apache-2.0",
      "license_concern": null
    }
  },
  {
    "name": "apollo",
    "source": "./plugins/apollo",
    "version": "0.0.1",
    "description": "Prospect, enrich leads, load outreach sequences, and query sales analytics with Apollo.io \u2014 one-click MCP server integration for CrabCode and Cowork.",
    "category": "productivity",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/apolloio/apollo-mcp-plugin.git",
      "upstream_sha": "79577f9361c8b0d89e9fa36a1511bd4b37375f40",
      "upstream_subpath": null,
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "MIT",
      "license_concern": null
    }
  },
  {
    "name": "astronomer-data-agents",
    "source": "./plugins/astronomer-data-agents",
    "version": "0.0.1",
    "description": "Data engineering for Apache Airflow and Astronomer. Author DAGs with best practices, debug pipeline failures, trace data lineage, profile tables, migrate Airflow 2 to 3, and manage local and cloud deployments.",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/astronomer/agents.git",
      "upstream_sha": "535a040ca9e27aaed6da13f0f959625fb3294820",
      "upstream_subpath": null,
      "classification": "hook-runtime",
      "target_batch": "parallel-05-runtime-present",
      "license": "Apache-2.0",
      "license_concern": null
    }
  },
  {
    "name": "atlan",
    "source": "./plugins/atlan",
    "version": "0.0.1",
    "description": "Atlan data catalog plugin for CrabCode. Search, explore, govern, and manage your data assets through natural language. Powered by the Atlan MCP server with semantic search, lineage traversal, glossary management, data quality rules, and more.",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/atlanhq/agent-toolkit.git",
      "upstream_sha": "790398c87378f128bdc74c31bb7ecfb8e4695f29",
      "upstream_subpath": null,
      "classification": "mcp-wrapper",
      "target_batch": "parallel-15-mcp-present",
      "license": "MIT",
      "license_concern": null
    }
  },
  {
    "name": "atlassian",
    "source": "./plugins/atlassian",
    "version": "0.0.1",
    "description": "Connect to Atlassian products including Jira and Confluence. Search and create issues, access documentation, manage sprints, and integrate your development workflow with Atlassian's collaboration tools.",
    "category": "productivity",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/atlassian/atlassian-mcp-server.git",
      "upstream_sha": "9b52fb18e184edc307ce33f8bf4cdf148dedf1f2",
      "upstream_subpath": null,
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "Apache-2.0",
      "license_concern": null
    }
  },
  {
    "name": "atomic-agents",
    "source": "./plugins/atomic-agents",
    "version": "0.0.1",
    "description": "Comprehensive development workflow for building AI agents with the Atomic Agents framework. Includes specialized agents for schema design, architecture planning, code review, and tool development. Features guided workflows, progressive-disclosure skills, and best practice validation.",
    "category": "development",
    "tags": [
      "community-managed"
    ],
    "_meta": {
      "upstream_url": "https://github.com/BrainBlend-AI/atomic-agents.git",
      "upstream_sha": "f849087b26bbb6fb5e63acb60f2b566ce874aaa7",
      "upstream_subpath": "claude-plugin/atomic-agents",
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "MIT",
      "license_concern": null
    }
  },
  {
    "name": "azure",
    "source": "./plugins/azure",
    "version": "0.0.1",
    "description": "Transform CrabCode into an Azure expert. This plugin integrates the Azure MCP server and specialized Azure skills to move beyond generic advice. It enables CrabCode to perform real-world tasks: listing resources, validating deployments, diagnosing infrastructure issues, and optimizing costs across 50+ Azure services.",
    "category": "deployment",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/microsoft/azure-skills.git",
      "upstream_sha": "350e050ca30fe3464483f66193a8ff3a973b1d77",
      "upstream_subpath": null,
      "classification": "multi-plugin-monorepo",
      "target_batch": "parallel-18-workflow-present",
      "license": "MIT",
      "license_concern": null
    }
  },
  {
    "name": "azure-cosmos-db-assistant",
    "source": "./plugins/azure-cosmos-db-assistant",
    "version": "0.0.1",
    "description": "Expert assistant for Azure Cosmos DB \u2014 data modeling, query optimization, performance tuning, and best practices.",
    "category": "database",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/AzureCosmosDB/cosmosdb-claude-code-plugin.git",
      "upstream_sha": "f1e0498579a9251e5f3179b92d25d6ce3409bae5",
      "upstream_subpath": null,
      "classification": "command-workflow",
      "target_batch": "parallel-18-workflow-present",
      "license": "MIT",
      "license_concern": null
    }
  },
  {
    "name": "base44",
    "source": "./plugins/base44",
    "version": "0.0.1",
    "description": "Build and deploy Base44 full-stack apps with CLI project management and JavaScript/TypeScript SDK development skills",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/base44/skills.git",
      "upstream_sha": "ec420cf2edd2c7e9a523d5afe2e71498a6357fa4",
      "upstream_subpath": null,
      "classification": "skill-suite",
      "target_batch": "parallel-17-skills-suite",
      "license": "MIT",
      "license_concern": null
    }
  },
  {
    "name": "box",
    "source": "./plugins/box",
    "version": "0.0.1",
    "description": "Work with your Box content directly from CrabCode \u2014 search files, organize folders, collaborate with your team, and use Box AI to answer questions, summarize documents, and extract data without leaving your workflow.",
    "category": "productivity",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/box/box-for-ai.git",
      "upstream_sha": "16f1a0427710b0812519ea634cd5ce6830bde8fc",
      "upstream_subpath": null,
      "classification": "skill-suite",
      "target_batch": "parallel-17-skills-suite",
      "license": "MIT",
      "license_concern": null
    }
  },
  {
    "name": "brightdata-plugin",
    "source": "./plugins/brightdata-plugin",
    "version": "0.0.1",
    "description": "Web scraping, Google search, structured data extraction, and MCP server integration powered by Bright Data. Includes 7 skills: scrape any webpage as markdown (with bot detection/CAPTCHA bypass), search Google with structured JSON results, extract data from 40+ websites (Amazon, LinkedIn, Instagram, TikTok, YouTube, and more), orchestrate Bright Data's 60+ MCP tools, built-in best practices for Web Unlocker, SERP API, Web Scraper API, and Browser API, Python SDK best practices for the brightda...",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/brightdata/skills.git",
      "upstream_sha": "37145178dfc9b52e28dd224afeccc7184f7711fc",
      "upstream_subpath": null,
      "classification": "skill-suite",
      "target_batch": "parallel-17-skills-suite",
      "license": "MIT",
      "license_concern": null
    }
  },
  {
    "name": "cds-mcp",
    "source": "./plugins/cds-mcp",
    "version": "0.0.1",
    "description": "AI-assisted development of SAP Cloud Application Programming Model (CAP) projects. Search CDS models and CAP documentation.",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/cap-js/mcp-server.git",
      "upstream_sha": "ef840d4315fa34264be6b71d0077a3b5288cb5fa",
      "upstream_subpath": null,
      "classification": "mcp-wrapper",
      "target_batch": "parallel-15-mcp-present",
      "license": "Apache-2.0",
      "license_concern": null
    }
  },
  {
    "name": "chrome-devtools-mcp",
    "source": "./plugins/chrome-devtools-mcp",
    "version": "0.0.1",
    "description": "Control and inspect a live Chrome browser from your coding agent. Record performance traces, analyze network requests, check console messages with source-mapped stack traces, and automate browser actions with Puppeteer.",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/ChromeDevTools/chrome-devtools-mcp.git",
      "upstream_sha": "32dc50d59bdb87242c67391ddc755368ebe77104",
      "upstream_subpath": null,
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "Apache-2.0",
      "license_concern": null
    }
  },
  {
    "name": "circleback",
    "source": "./plugins/circleback",
    "version": "0.0.1",
    "description": "Circleback conversational context integration. Search and access meetings, emails, calendar events, and more.",
    "category": "productivity",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/circlebackai/claude-code-plugin.git",
      "upstream_sha": "6369dec7da4059dd0a12cf1b62ba749799ee15ef",
      "upstream_subpath": null,
      "classification": "mcp-wrapper",
      "target_batch": "parallel-15-mcp-present",
      "license": "NONE_DETECTED",
      "license_concern": "missing-license-file"
    }
  },
  {
    "name": "clickhouse",
    "source": "./plugins/clickhouse",
    "version": "0.0.1",
    "description": "Connect CrabCode to your ClickHouse Cloud databases. Browse organizations, services, databases, and table schemas. Run read-only SQL queries against your data and get instant analytical answers. Monitor service backups, review billing costs, and inspect ClickPipe configurations - all through natural conversation.",
    "category": "database",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/ClickHouse/clickhouse-claude-code-plugin.git",
      "upstream_sha": "13a2df004af0df46661c9de2d4ef4e85eba2f040",
      "upstream_subpath": null,
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "Apache-2.0",
      "license_concern": null
    }
  },
  {
    "name": "cloud-sql-postgresql",
    "source": "./plugins/cloud-sql-postgresql",
    "version": "0.0.1",
    "description": "Create, connect, and interact with a Cloud SQL for PostgreSQL database and data.",
    "category": "database",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/gemini-cli-extensions/cloud-sql-postgresql.git",
      "upstream_sha": "966f7b883998692d05389e4c3d3793412ca0659f",
      "upstream_subpath": null,
      "classification": "skill-suite",
      "target_batch": "parallel-17-skills-suite",
      "license": "Apache-2.0",
      "license_concern": null
    }
  },
  {
    "name": "cloudflare",
    "source": "./plugins/cloudflare",
    "version": "0.0.1",
    "description": "Skills for the Cloudflare developer platform: Workers, Durable Objects, Agents SDK, MCP servers, Wrangler CLI, and web performance.",
    "category": "deployment",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/cloudflare/skills.git",
      "upstream_sha": "60147cbb773649eadca89cee92b4e0caf02234b4",
      "upstream_subpath": null,
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "Apache-2.0",
      "license_concern": null
    }
  },
  {
    "name": "cloudinary",
    "source": "./plugins/cloudinary",
    "version": "0.0.1",
    "description": "Use Cloudinary directly in CrabCode. Manage assets, apply transformations, optimize media, and more through natural conversation.",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/cloudinary-devs/cloudinary-plugin.git",
      "upstream_sha": "7b443d7dbd607bfe4850d8cfcab6ba4cbf1a57c3",
      "upstream_subpath": null,
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "NONE_DETECTED",
      "license_concern": "missing-license-file"
    }
  },
  {
    "name": "cockroachdb",
    "source": "./plugins/cockroachdb",
    "version": "0.0.1",
    "description": "Connect CrabCode directly to your CockroachDB clusters for hands-on database work \u2014 explore schemas, write optimized SQL, debug queries, and manage distributed database clusters. This plugin provides 14 tools across two active MCP backends (self-hosted MCP Toolbox and managed CockroachDB Cloud MCP Server), three specialized agents (DBA, Developer, Operator), 32 skills across 6 operational domains, and built-in safety hooks.",
    "category": "database",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/cockroachdb/claude-plugin.git",
      "upstream_sha": "736bd11df55bac97e2a6c98be8e93503b125902c",
      "upstream_subpath": null,
      "classification": "hook-runtime",
      "target_batch": "parallel-05-runtime-present",
      "license": "Apache-2.0",
      "license_concern": null
    }
  },
  {
    "name": "coderabbit",
    "source": "./plugins/coderabbit",
    "version": "0.0.1",
    "description": "Your code review partner. CodeRabbit provides external validation using a specialized AI architecture and 40+ integrated static analyzers\u2014offering a different perspective that catches bugs, security vulnerabilities, logic errors, and edge cases. Context-aware analysis via AST parsing and codegraph relationships. Automatically incorporates CLAUDE.md and project coding guidelines into reviews. Useful after writing or modifying code, before commits, when implementing complex or security-sensitive logic, or when a second opinion would increase confidence in the changes. Returns specific findings with suggested fixes that can be applied immediately. Free to use.",
    "category": "productivity",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/coderabbitai/skills.git",
      "upstream_sha": "a81eb76a1539e4a3f2b5c6fc133849124e72d303",
      "upstream_subpath": null,
      "classification": "command-workflow",
      "target_batch": "parallel-18-workflow-present",
      "license": "MIT",
      "license_concern": null
    }
  },
  {
    "name": "convex-backend",
    "source": "./plugins/convex-backend",
    "version": "0.0.1",
    "description": "Convex backend skill for building reactive, type-safe, production-grade backends. Helps CrabCode design schemas, server functions, auth, file storage, scheduled jobs, and real-time multiplayer features on Convex.",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/get-convex/convex-backend-skill.git",
      "upstream_sha": "9acbc5495dd26749a5e6341dc2438146c4caa03b",
      "upstream_subpath": null,
      "classification": "skill-suite",
      "target_batch": "parallel-17-skills-suite",
      "license": "Apache-2.0",
      "license_concern": null
    }
  },
  {
    "name": "crowdstrike-falcon-foundry",
    "source": "./plugins/crowdstrike-falcon-foundry",
    "version": "0.0.1",
    "description": "CrowdStrike Falcon Foundry development skills for building cybersecurity applications on the Falcon platform. Includes UI development, collections, functions, workflows, API integration, security patterns, and debugging workflows.",
    "category": "security",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/CrowdStrike/foundry-skills.git",
      "upstream_sha": "4b517aa5729d5bb5e397ff779f98eb05c91d1b21",
      "upstream_subpath": null,
      "classification": "hook-runtime",
      "target_batch": "parallel-05-runtime-present",
      "license": "MIT",
      "license_concern": null
    }
  },
  {
    "name": "dash0",
    "source": "./plugins/dash0",
    "version": "0.0.1",
    "description": "OpenTelemetry observability for CrabCode sessions. Captures tool calls, LLM invocations, token usage, and errors as OTel traces. Send telemetry to Dash0 or any OpenTelemetry-compatible backend.",
    "category": "monitoring",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/dash0hq/dash0-agent-plugin.git",
      "upstream_sha": "feae46e4099d31a1a76debe39f22aebb72a18ce5",
      "upstream_subpath": null,
      "classification": "hook-runtime",
      "target_batch": "parallel-05-runtime-present",
      "license": "Apache-2.0",
      "license_concern": null
    }
  },
  {
    "name": "data-agent-kit-starter-pack",
    "source": "./plugins/data-agent-kit-starter-pack",
    "version": "0.0.1",
    "description": "This plugin provides a specialized suite of skills for data engineers and database practitioners working on Google Cloud. It acts as an expert assistant, allowing you to use natural language prompts in your preferred coding agent to architect complex data pipelines, transform data with dbt, write Spark and BigQuery SQL notebooks, and orchestrate end-to-end workflows across GCP's data ecosystem.",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/gemini-cli-extensions/data-agent-kit-starter-pack.git",
      "upstream_sha": "7bc75b5e53d6eaae103132fd1a47de26239e4ae4",
      "upstream_subpath": null,
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "Apache-2.0",
      "license_concern": null
    }
  },
  {
    "name": "datadog",
    "source": "./plugins/datadog",
    "version": "0.0.1",
    "description": "Use Datadog directly in CrabCode through a preconfigured Datadog MCP server. Query logs, metrics, traces, dashboards, and more through natural conversation. This plugin is in preview.",
    "category": "monitoring",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/datadog-labs/claude-code-plugin.git",
      "upstream_sha": "eeb2f746a857f8d97f69cd0968fb63874541c112",
      "upstream_subpath": null,
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "Apache-2.0",
      "license_concern": null
    }
  },
  {
    "name": "datarobot-agent-skills",
    "source": "./plugins/datarobot-agent-skills",
    "version": "0.0.1",
    "description": "DataRobot skills for AI/ML workflows \u2014 model training, deployment, predictions, feature engineering, monitoring, explainability, data preparation, App Framework CI/CD, and external agent monitoring.",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/datarobot-oss/datarobot-agent-skills.git",
      "upstream_sha": "6a13377ad0b3317c7c4133fce36b7fcc626334cd",
      "upstream_subpath": null,
      "classification": "skill-suite",
      "target_batch": "parallel-17-skills-suite",
      "license": "Apache-2.0",
      "license_concern": null
    }
  },
  {
    "name": "dataverse",
    "source": "./plugins/dataverse",
    "version": "0.0.1",
    "description": "Agent skills for building on, analyzing, and managing Microsoft Dataverse \u2014 with Dataverse MCP, PAC CLI, and Python SDK.",
    "category": "database",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/microsoft/Dataverse-skills.git",
      "upstream_sha": "5f186bf8ab1a3d6e242492d982276bbd7443ee0f",
      "upstream_subpath": ".github/plugins/dataverse",
      "classification": "skill-suite",
      "target_batch": "parallel-17-skills-suite",
      "license": "NONE_DETECTED",
      "license_concern": "missing-license-file"
    }
  },
  {
    "name": "exa",
    "source": "./plugins/exa",
    "version": "0.0.1",
    "description": "Exa AI web search, deep research, and content extraction. Provides MCP tools and research skills for comprehensive web search, people discovery, company research, academic papers, and more.",
    "category": "productivity",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/exa-labs/exa-mcp-server.git",
      "upstream_sha": "5ce6c53bae8baa3248a1d197a4e89b7e464227e3",
      "upstream_subpath": null,
      "classification": "skill-suite",
      "target_batch": "parallel-17-skills-suite",
      "license": "MIT",
      "license_concern": null
    }
  },
  {
    "name": "fastly-agent-toolkit",
    "source": "./plugins/fastly-agent-toolkit",
    "version": "0.0.1",
    "description": "Fastly development tools and platform skills",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/fastly/fastly-agent-toolkit.git",
      "upstream_sha": "e0f4205723b843de0b07da4a2aea6c84a3bcb579",
      "upstream_subpath": null,
      "classification": "skill-suite",
      "target_batch": "parallel-17-skills-suite",
      "license": "MIT",
      "license_concern": null
    }
  },
  {
    "name": "fiftyone",
    "source": "./plugins/fiftyone",
    "version": "0.0.1",
    "description": "Build high-quality datasets and computer vision models. Visualize datasets, analyze models, find duplicates, run inference, evaluate predictions, and develop custom plugins.",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/voxel51/fiftyone-skills.git",
      "upstream_sha": "a79e53c6fd1784e1476421185f3ed67637e642b4",
      "upstream_subpath": null,
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "Apache-2.0",
      "license_concern": null
    }
  },
  {
    "name": "figma",
    "source": "./plugins/figma",
    "version": "0.0.1",
    "description": "Figma design platform integration. Access design files, extract component information, read design tokens, and translate designs into code. Bridge the gap between design and development workflows.",
    "category": "design",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/figma/mcp-server-guide.git",
      "upstream_sha": "a742f0a700a7772ff5ed85f7c9fc1dad5afa9fcc",
      "upstream_subpath": null,
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "NONE_DETECTED",
      "license_concern": "missing-license-file"
    }
  },
  {
    "name": "firecrawl",
    "source": "./plugins/firecrawl",
    "version": "0.0.1",
    "description": "Web scraping and crawling powered by Firecrawl. Turn any website into clean, LLM-ready markdown or structured data. Scrape single pages, crawl entire sites, search the web, and extract structured information. Includes an AI agent for autonomous multi-source data gathering - just describe what you need and it finds, navigates, and extracts automatically.",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/firecrawl/firecrawl-claude-plugin.git",
      "upstream_sha": "48edd7943009eb4442a6f0102bbd0c251eecef3e",
      "upstream_subpath": null,
      "classification": "command-workflow",
      "target_batch": "parallel-18-workflow-present",
      "license": "NONE_DETECTED",
      "license_concern": "missing-license-file"
    }
  },
  {
    "name": "fullstory",
    "source": "./plugins/fullstory",
    "version": "0.0.1",
    "description": "Connect CrabCode to Fullstory to query behavioral analytics, session replays, and customer experience insights.",
    "category": "monitoring",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/fullstorydev/fullstory-skills.git",
      "upstream_sha": "1ec5865e7ab1449f9a0859d164c4b6a8c53b6e2f",
      "upstream_subpath": null,
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "NONE_DETECTED",
      "license_concern": "missing-license-file"
    }
  },
  {
    "name": "huggingface-skills",
    "source": "./plugins/huggingface-skills",
    "version": "0.0.1",
    "description": "Build, train, evaluate, and use open source AI models, datasets, and spaces.",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/huggingface/skills.git",
      "upstream_sha": "7c71cfb2b12920002c3177474c779feeec4e9ad1",
      "upstream_subpath": null,
      "classification": "multi-plugin-monorepo",
      "target_batch": "parallel-18-workflow-present",
      "license": "Apache-2.0",
      "license_concern": null
    }
  },
  {
    "name": "intercom",
    "source": "./plugins/intercom",
    "version": "0.0.1",
    "description": "Intercom integration for CrabCode. Search conversations, analyze customer support patterns, look up contacts and companies, and install the Intercom Messenger. Connect your Intercom workspace to get real-time insights from customer data.",
    "category": "productivity",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/intercom/claude-plugin-external.git",
      "upstream_sha": "52653572c47700443eb61154c4e4334a355e755e",
      "upstream_subpath": null,
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "MIT",
      "license_concern": null
    }
  },
  {
    "name": "jfrog",
    "source": "./plugins/jfrog",
    "version": "0.0.1",
    "description": "Use the JFrog Platform from CrabCode: Artifactory repos and artifacts, security findings and exposures, Catalog package safety and downloads, workflows across the SDLC, and platform administration.",
    "category": "security",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/jfrog/claude-plugin.git",
      "upstream_sha": "259c8e718266c16e99b4f30ae9b1ed0f9f00d98d",
      "upstream_subpath": null,
      "classification": "hook-runtime",
      "target_batch": "parallel-05-runtime-present",
      "license": "Apache-2.0",
      "license_concern": null
    }
  },
  {
    "name": "microsoft-docs",
    "source": "./plugins/microsoft-docs",
    "version": "0.0.1",
    "description": "Access official Microsoft documentation, API references, and code samples for Azure, .NET, Windows, and more.",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/MicrosoftDocs/mcp.git",
      "upstream_sha": "954c17e72d65b0ee1fc7009c10b8a57e6889d34a",
      "upstream_subpath": null,
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "CC-BY-4.0",
      "license_concern": null
    }
  },
  {
    "name": "mintlify",
    "source": "./plugins/mintlify",
    "version": "0.0.1",
    "description": "Build beautiful documentation sites with Mintlify. Convert non-markdown files into properly formatted MDX pages, add and modify content with correct component use, and automate documentation updates.",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/mintlify/mintlify-claude-plugin.git",
      "upstream_sha": "acd6d2e0128c4f235d55cfb8d8c91ecbdd5df8cc",
      "upstream_subpath": null,
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "MIT",
      "license_concern": null
    }
  },
  {
    "name": "miro",
    "source": "./plugins/miro",
    "version": "0.0.1",
    "description": "Secure access to Miro boards. Enables AI to read board context, create diagrams, and generate code with enterprise-grade security.",
    "category": "design",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/miroapp/miro-ai.git",
      "upstream_sha": "00e619e63ca9a8fd788c2db9f294bc90773aac48",
      "upstream_subpath": "claude-plugins/miro",
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "NONE_DETECTED",
      "license_concern": "missing-license-file"
    }
  },
  {
    "name": "mongodb",
    "source": "./plugins/mongodb",
    "version": "0.0.1",
    "description": "Official CrabCode plugin for MongoDB (MCP Server + Skills). Connect to databases, explore data, manage collections, optimize queries, generate reliable code, implement best practices, develop advanced features, and more.",
    "category": "database",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/mongodb/agent-skills.git",
      "upstream_sha": "24529d9540b962d57f30e75d25071bebea5809ad",
      "upstream_subpath": null,
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "Apache-2.0",
      "license_concern": null
    }
  },
  {
    "name": "netlify-skills",
    "source": "./plugins/netlify-skills",
    "version": "0.0.1",
    "description": "Netlify platform skills for CrabCode \u2014 functions, edge functions, blobs, database, image CDN, forms, config, CLI, frameworks, caching, AI gateway, and deployment.",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/netlify/context-and-tools.git",
      "upstream_sha": "a49ebc5965e0476edf958474d3feaeec754ffc6b",
      "upstream_subpath": null,
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "MIT",
      "license_concern": null
    }
  },
  {
    "name": "netsuite-suitecloud",
    "source": "./plugins/netsuite-suitecloud",
    "version": "0.0.1",
    "description": "NetSuite agent skills from Oracle \u2014 authoring guidance for SuiteCloud Development Framework (SDF) objects and UIF single-page-app components, plus runtime guidance for the NetSuite AI Service Connector.",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/oracle/netsuite-suitecloud-sdk.git",
      "upstream_sha": "43bacf43763e1eedd0892b4652be3d45df94f0e7",
      "upstream_subpath": "packages/agent-skills",
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "NONE_DETECTED",
      "license_concern": "missing-license-file"
    }
  },
  {
    "name": "nightvision",
    "source": "./plugins/nightvision",
    "version": "0.0.1",
    "description": "Skills for working with NightVision, a DAST and API Discovery platform that finds exploitable vulnerabilities in web applications and REST APIs",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/nvsecurity/nightvision-skills.git",
      "upstream_sha": "7d7a3f342bbf4d02b6e012279800cf91ff0c1c97",
      "upstream_subpath": null,
      "classification": "skill-suite",
      "target_batch": "parallel-17-skills-suite",
      "license": "Apache-2.0",
      "license_concern": null
    }
  },
  {
    "name": "nimble",
    "source": "./plugins/nimble",
    "version": "0.0.1",
    "description": "Nimble web data toolkit \u2014 search, extract, map, crawl the web and work with structured data agents",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/Nimbleway/agent-skills.git",
      "upstream_sha": "626930f102dc51ef3858a28f94318ceabfdea071",
      "upstream_subpath": null,
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "MIT",
      "license_concern": null
    }
  },
  {
    "name": "notion",
    "source": "./plugins/notion",
    "version": "0.0.1",
    "description": "Notion workspace integration. Search pages, create and update documents, manage databases, and access your team's knowledge base directly from CrabCode for seamless documentation workflows.",
    "category": "productivity",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/makenotion/claude-code-notion-plugin.git",
      "upstream_sha": "9847f2aa1a15f25df35ed1fb7b4557dbb60cd651",
      "upstream_subpath": null,
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "NONE_DETECTED",
      "license_concern": "missing-license-file"
    }
  },
  {
    "name": "oracle-ai-data-platform-workbench-spark-connectors",
    "source": "./plugins/oracle-ai-data-platform-workbench-spark-connectors",
    "version": "0.0.1",
    "description": "Oracle AI Data Platform Workbench Spark connectors for CrabCode. 18 connector skills covering every data source workbench customers commonly need: Oracle Autonomous DB family (ALH/ADW/ATP) via wallet/IAM-DB-Token/API-key, ExaCS, Fusion ERP REST, Fusion BICC, EPM Cloud Planning, Essbase 21c, OCI Streaming (Kafka), OCI Object Storage, Apache Iceberg, plus external systems (PostgreSQL, MySQL/HeatWave, SQL Server, Snowflake, Azure ADLS Gen2, AWS S3, generic REST, custom JDBC, Excel). Live-validated on the workbench `tpcds` cluster (Spark 3.5.0): 17 PASS / 4 ship-as-is out of 21 test rows.",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/oracle-samples/oracle-aidp-samples.git",
      "upstream_sha": "f436f3a40dfaedbef6a076ad3992b697ba5dcef6",
      "upstream_subpath": "ai/claude-code-plugins/oracle-ai-data-platform-workbench-spark-connectors",
      "classification": "skill-suite",
      "target_batch": "parallel-17-skills-suite",
      "license": "MIT",
      "license_concern": null
    }
  },
  {
    "name": "outputai",
    "source": "./plugins/outputai",
    "version": "0.0.1",
    "description": "Output.ai workflow development toolkit for CrabCode. Adds 5 specialist agents (planner, builder, debugger, prompt writer, quality reviewer), 40+ slash-command skills covering scaffolding, debugging, evaluation, and credential management, plus a SessionStart hook that auto-loads Output SDK conventions so CrabCode understands the framework before the first prompt.",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/growthxai/output.git",
      "upstream_sha": "756d32d1d4fad028850ae5a28921432b825060f2",
      "upstream_subpath": "coding_assistants/claude/plugins/outputai",
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "NONE_DETECTED",
      "license_concern": "missing-license-file"
    }
  },
  {
    "name": "pagerduty",
    "source": "./plugins/pagerduty",
    "version": "0.0.1",
    "description": "Enhance code quality and security through PagerDuty risk scoring and incident correlation. Score pre-commit diffs against historical incident data and surface deployment risk before you ship.",
    "category": "monitoring",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/PagerDuty/claude-code-plugins.git",
      "upstream_sha": "761cba75bd50fd561405c3b173ecf36084432089",
      "upstream_subpath": null,
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "Apache-2.0",
      "license_concern": null
    }
  },
  {
    "name": "pigment",
    "source": "./plugins/pigment",
    "version": "0.0.1",
    "description": "Analyze business data and build custom Pigment models, metrics, and boards through natural language.",
    "category": "productivity",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/gopigment/ai-plugins.git",
      "upstream_sha": "5bdf088652ef9d2065cf25e2e42df9b19a1486e1",
      "upstream_subpath": null,
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "MIT",
      "license_concern": null
    }
  },
  {
    "name": "pinecone",
    "source": "./plugins/pinecone",
    "version": "0.0.1",
    "description": "Pinecone vector database integration. Streamline your Pinecone development with powerful tools for managing vector indexes, querying data, and rapid prototyping. Use slash commands like /quickstart to generate AGENTS.md files and initialize Python projects and /query to quickly explore indexes. Access the Pinecone MCP server for creating, describing, upserting and querying indexes with CrabCode. Perfect for developers building semantic search, RAG applications, recommendation systems, and other vector-based applications with Pinecone.",
    "category": "database",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/pinecone-io/pinecone-claude-code-plugin.git",
      "upstream_sha": "7dc3cfe091335f5053ec9e6eb05403e674a73c5e",
      "upstream_subpath": null,
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "MIT",
      "license_concern": null
    }
  },
  {
    "name": "planetscale",
    "source": "./plugins/planetscale",
    "version": "0.0.1",
    "description": "An authenticated hosted MCP server that accesses your PlanetScale organizations, databases, branches, schema, and Insights data. Query against your data, surface slow queries, and get organizational and account information.",
    "category": "database",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/planetscale/claude-plugin.git",
      "upstream_sha": "f1066cac5bb956bbbb05918f5b07fe0e873d44ea",
      "upstream_subpath": null,
      "classification": "mcp-wrapper",
      "target_batch": "parallel-15-mcp-present",
      "license": "NONE_DETECTED",
      "license_concern": "missing-license-file"
    }
  },
  {
    "name": "posthog",
    "source": "./plugins/posthog",
    "version": "0.0.1",
    "description": "Access PostHog analytics, feature flags, experiments, error tracking, and insights directly from CrabCode.",
    "category": "monitoring",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/PostHog/ai-plugin.git",
      "upstream_sha": "ff08c376af53d7c5ba2e909b8065f786c7c3b506",
      "upstream_subpath": null,
      "classification": "hook-runtime",
      "target_batch": "parallel-05-runtime-present",
      "license": "NONE_DETECTED",
      "license_concern": "missing-license-file"
    }
  },
  {
    "name": "postiz",
    "source": "./plugins/postiz",
    "version": "0.0.1",
    "description": "Social media automation CLI for scheduling posts, managing integrations, uploading media, and tracking analytics across 28+ platforms including X, LinkedIn, Reddit, YouTube, TikTok, Instagram, and more",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/gitroomhq/postiz-agent.git",
      "upstream_sha": "37d627244c53a4b3a7ca94c52cc2db13aaaf468e",
      "upstream_subpath": null,
      "classification": "command-workflow",
      "target_batch": "parallel-18-workflow-present",
      "license": "AGPL-3.0",
      "license_concern": "copyleft-network"
    }
  },
  {
    "name": "postman",
    "source": "./plugins/postman",
    "version": "0.0.1",
    "description": "Full API lifecycle management for CrabCode. Sync collections, generate client code, discover APIs, run tests, create mocks, publish docs, and audit security. Powered by the Postman MCP Server.",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/Postman-Devrel/postman-claude-code-plugin.git",
      "upstream_sha": "416e40da03a237df7bf03f4362cf6fc7b989b567",
      "upstream_subpath": null,
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "Apache-2.0",
      "license_concern": null
    }
  },
  {
    "name": "prisma",
    "source": "./plugins/prisma",
    "version": "0.0.1",
    "description": "Prisma MCP integration for Postgres database management, schema migrations, SQL queries, and connection string management. Provision Prisma Postgres databases, run migrations, and interact with your data directly.",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/prisma/claude-plugin.git",
      "upstream_sha": "815dbc4a045a29e3b81510ba0e3ab806f1baaf0e",
      "upstream_subpath": null,
      "classification": "mcp-wrapper",
      "target_batch": "parallel-15-mcp-present",
      "license": "NONE_DETECTED",
      "license_concern": "missing-license-file"
    }
  },
  {
    "name": "qdrant-skills",
    "source": "./plugins/qdrant-skills",
    "version": "0.0.1",
    "description": "Agent skills for Qdrant vector search covering scaling, performance optimization, search quality, monitoring, deployment, model migration, version upgrades, and SDK usage across Python, TypeScript, Rust, Go, .NET, and Java.",
    "category": "database",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/qdrant/skills.git",
      "upstream_sha": "9f935f8bbb13ec62a07f0da0d42e89722029fb25",
      "upstream_subpath": null,
      "classification": "skill-suite",
      "target_batch": "parallel-17-skills-suite",
      "license": "Apache-2.0",
      "license_concern": null
    }
  },
  {
    "name": "qodo-skills",
    "source": "./plugins/qodo-skills",
    "version": "0.0.1",
    "description": "Qodo Skills provides a curated library of reusable AI agent capabilities that extend CrabCode's functionality for software development workflows. Each skill is designed to integrate seamlessly into your development process, enabling tasks like code quality checks, automated testing, security scanning, and compliance validation. Skills operate across your entire SDLC\u2014from IDE to CI/CD\u2014ensuring consistent standards and catching issues early.",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/qodo-ai/qodo-skills.git",
      "upstream_sha": "8fb6b5502dbe7876bbd672a27d6efa299f5820d7",
      "upstream_subpath": null,
      "classification": "skill-suite",
      "target_batch": "parallel-17-skills-suite",
      "license": "MIT",
      "license_concern": null
    }
  },
  {
    "name": "qt-development-skills",
    "source": "./plugins/qt-development-skills",
    "version": "0.0.1",
    "description": "Agentic engineering skills for Qt software development \u2014 Qt C++/QML code review, QML coding, and Qt C++/QML code documentation.",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/TheQtCompanyRnD/agent-skills.git",
      "upstream_sha": "62a98e2339e6eefcff108cfc3fe9db8a7301856c",
      "upstream_subpath": null,
      "classification": "skill-suite",
      "target_batch": "parallel-17-skills-suite",
      "license": "MIT",
      "license_concern": null
    }
  },
  {
    "name": "quarkus-agent",
    "source": "./plugins/quarkus-agent",
    "version": "0.0.1",
    "description": "MCP server for AI coding agents to create, manage, and interact with Quarkus applications. Provides tools for project scaffolding, dev mode lifecycle, extension skills, Dev MCP proxy, and documentation search.",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/quarkusio/quarkus-agent-mcp.git",
      "upstream_sha": "c17280236a8080aab2bc10ff8e334922a2619a5f",
      "upstream_subpath": null,
      "classification": "multi-plugin-monorepo",
      "target_batch": "parallel-18-workflow-present",
      "license": "Apache-2.0",
      "license_concern": null
    }
  },
  {
    "name": "remember",
    "source": "./plugins/remember",
    "version": "0.0.1",
    "description": "Continuous memory for CrabCode. Extracts, summarizes, and compresses conversations into tiered daily logs. CrabCode remembers what you did yesterday.",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/Digital-Process-Tools/claude-remember.git",
      "upstream_sha": "aa55ba3f553e23f4d84387f5d7ece1ba0ce68d93",
      "upstream_subpath": null,
      "classification": "hook-runtime",
      "target_batch": "parallel-05-runtime-present",
      "license": "MIT",
      "license_concern": null
    }
  },
  {
    "name": "revenuecat",
    "source": "./plugins/revenuecat",
    "version": "0.0.1",
    "description": "Configure RevenueCat projects, apps, products, entitlements, and offerings directly from CrabCode. Manage your in-app purchase backend without leaving your development workflow.",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/RevenueCat/rc-claude-code-plugin.git",
      "upstream_sha": "407e4651ff74dbaf47c457948ab540e620403c2a",
      "upstream_subpath": "revenuecat",
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "NONE_DETECTED",
      "license_concern": "missing-license-file"
    }
  },
  {
    "name": "sanity",
    "source": "./plugins/sanity",
    "version": "0.0.1",
    "description": "Sanity content platform integration with MCP server, agent skills, and slash commands. Query and author content, build and optimize GROQ queries, design schemas, and set up Visual Editing.",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/sanity-io/agent-toolkit.git",
      "upstream_sha": "236348e29b31e834ce71e4e2e3072184dd1c1e27",
      "upstream_subpath": null,
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "MIT",
      "license_concern": null
    }
  },
  {
    "name": "sap-fiori-mcp-server",
    "source": "./plugins/sap-fiori-mcp-server",
    "version": "0.0.1",
    "description": "MCP server for SAP Fiori development tools for CrabCode. Build and modify SAP Fiori applications with AI assistance.",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/SAP/open-ux-tools.git",
      "upstream_sha": "157120fda8577fda6fb7546ed1b2305bfa65b9f5",
      "upstream_subpath": "packages/fiori-mcp-server",
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "Apache-2.0",
      "license_concern": null
    }
  },
  {
    "name": "sap-mdk-server",
    "source": "./plugins/sap-mdk-server",
    "version": "0.0.1",
    "description": "MCP server for SAP Mobile Development Kit (MDK). Build and modify MDK applications with AI assistance \u2014 schema lookups, action validation, rule editing, and project scaffolding.",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/SAP/mdk-mcp-server.git",
      "upstream_sha": "10ff6ccfee094b9fb3b3877a41f00fa278b1bcc4",
      "upstream_subpath": null,
      "classification": "mcp-wrapper",
      "target_batch": "parallel-15-mcp-present",
      "license": "Apache-2.0",
      "license_concern": null
    }
  },
  {
    "name": "save-to-spotify",
    "source": "./plugins/save-to-spotify",
    "version": "0.0.1",
    "description": "Create polished audio episodes with TTS narration, rich timelines, cover images, and save them to Spotify via the save-to-spotify CLI.",
    "category": "productivity",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/spotify/save-to-spotify.git",
      "upstream_sha": "b3d362f7851d184098dcb220ba2fab10c996d1f2",
      "upstream_subpath": "plugin",
      "classification": "skill-suite",
      "target_batch": "parallel-17-skills-suite",
      "license": "NONE_DETECTED",
      "license_concern": "missing-license-file"
    }
  },
  {
    "name": "semgrep",
    "source": "./plugins/semgrep",
    "version": "0.0.1",
    "description": "Semgrep catches security vulnerabilities in real-time and guides CrabCode to write secure code from the start.",
    "category": "security",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/semgrep/mcp-marketplace.git",
      "upstream_sha": "274846f6f9da5f56be53b19170bc008d357142a7",
      "upstream_subpath": "plugin",
      "classification": "hook-runtime",
      "target_batch": "parallel-05-runtime-present",
      "license": "NONE_DETECTED",
      "license_concern": "missing-license-file"
    }
  },
  {
    "name": "sentry",
    "source": "./plugins/sentry",
    "version": "0.0.1",
    "description": "Sentry error monitoring integration. Access error reports, analyze stack traces, search issues by fingerprint, and debug production errors directly from your development environment.",
    "category": "monitoring",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/getsentry/sentry-for-claude.git",
      "upstream_sha": "cf7efd373069d6fb073413324fe313319fb54ad9",
      "upstream_subpath": null,
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "MIT",
      "license_concern": null
    }
  },
  {
    "name": "servicenow-sdk",
    "source": "./plugins/servicenow-sdk",
    "version": "0.0.1",
    "description": "Create, edit, and deploy ServiceNow applications with the Fluent SDK effortlessly through CrabCode AI.",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/ServiceNow/sdk.git",
      "upstream_sha": "06adf37ca78c270a57f93e7b9dfbb7bf16e24611",
      "upstream_subpath": "providers/claude/plugin",
      "classification": "skill-suite",
      "target_batch": "parallel-17-skills-suite",
      "license": "NONE_DETECTED",
      "license_concern": "missing-license-file"
    }
  },
  {
    "name": "shopify",
    "source": "./plugins/shopify",
    "version": "0.0.1",
    "description": "Shopify developer tools for CrabCode \u2014 search Shopify docs, generate and validate GraphQL, Liquid, and UI extension code",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/Shopify/shopify-plugins.git",
      "upstream_sha": "5631b93b88759561fec321192b6b083dbf0a2fd2",
      "upstream_subpath": null,
      "classification": "mcp-wrapper",
      "target_batch": "parallel-15-mcp-present",
      "license": "MIT",
      "license_concern": null
    }
  },
  {
    "name": "shopify-ai-toolkit",
    "source": "./plugins/shopify-ai-toolkit",
    "version": "0.0.1",
    "description": "Shopify's AI Toolkit provides 18 development skills for building on the Shopify platform, covering documentation search, API schema access, GraphQL and Liquid code validation, Hydrogen storefronts, Polaris UI extensions, store management via CLI, and onboarding guidance for both developers and merchants.",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/Shopify/Shopify-AI-Toolkit.git",
      "upstream_sha": "c164cf45c4bc1d17bbc105168d99a4f744cfaac2",
      "upstream_subpath": null,
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "MIT",
      "license_concern": null
    }
  },
  {
    "name": "slack",
    "source": "./plugins/slack",
    "version": "0.0.1",
    "description": "Slack workspace integration. Search messages, access channels, read threads, and stay connected with your team's communications while coding. Find relevant discussions and context quickly.",
    "category": "productivity",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/slackapi/slack-mcp-plugin.git",
      "upstream_sha": "7b9458950d38bb01ddb48b669f9fa89bcdfd98b8",
      "upstream_subpath": null,
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "MIT",
      "license_concern": null
    }
  },
  {
    "name": "sonarqube",
    "source": "./plugins/sonarqube",
    "version": "0.0.1",
    "description": "Automatically enforce SonarQube code quality and security in the agent coding loop \u2014 7,000+ rules, secrets scanning, agentic analysis, and quality gates across 40+ languages. PostToolUse hooks run analysis after every file edit. Pre-tool secrets scanning prevents 450+ patterns from reaching the LLM. Slash commands give on-demand access to quality gate status, coverage, duplication, and dependency risks. Includes SonarQube CLI, MCP Server, skills, hooks, and slash commands.",
    "category": "security",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/SonarSource/sonarqube-agent-plugins.git",
      "upstream_sha": "c64e09af314406a8d8806d57cd11cda81578ce20",
      "upstream_subpath": null,
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "SSAL-1.0",
      "license_concern": "source-available-restrictive"
    }
  },
  {
    "name": "sonatype-guide",
    "source": "./plugins/sonatype-guide",
    "version": "0.0.1",
    "description": "Sonatype Guide MCP server for software supply chain intelligence and dependency security. Analyze dependencies for vulnerabilities, get secure version recommendations, and check component quality metrics.",
    "category": "security",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/sonatype/sonatype-guide-claude-plugin.git",
      "upstream_sha": "1dae73980f591d3196f5532ac72186513563d028",
      "upstream_subpath": null,
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "NONE_DETECTED",
      "license_concern": "missing-license-file"
    }
  },
  {
    "name": "sourcegraph",
    "source": "./plugins/sourcegraph",
    "version": "0.0.1",
    "description": "Code search and understanding across codebases. Search, read, and trace references across repositories; analyze refactor impact; investigate incidents via commit and diff search; run targeted security sweeps.",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/sourcegraph-community/sourcegraph-claudecode-plugin.git",
      "upstream_sha": "332ee0ca9a409ccd791abee43c7abf2606469017",
      "upstream_subpath": null,
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "NONE_DETECTED",
      "license_concern": "missing-license-file"
    }
  },
  {
    "name": "spotify-ads-api",
    "source": "./plugins/spotify-ads-api",
    "version": "0.0.1",
    "description": "Manage Spotify ad campaigns with natural language. Create campaigns, ad sets, ads, pull reports, and handle OAuth \u2014 all through conversation.",
    "category": "productivity",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/spotify/ads-claude-plugin.git",
      "upstream_sha": "cc3db744f4a4c14f7265ef3e9fb50f44cf08e0e7",
      "upstream_subpath": null,
      "classification": "hook-runtime",
      "target_batch": "parallel-05-runtime-present",
      "license": "Apache-2.0",
      "license_concern": null
    }
  },
  {
    "name": "stripe",
    "source": "./plugins/stripe",
    "version": "0.0.1",
    "description": "Stripe development plugin for CrabCode",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/stripe/ai.git",
      "upstream_sha": "ec93d4c4b9ffdbc994ac45ce692d4ec1cdb755f0",
      "upstream_subpath": "providers/claude/plugin",
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "NONE_DETECTED",
      "license_concern": "missing-license-file"
    }
  },
  {
    "name": "sumup",
    "source": "./plugins/sumup",
    "version": "0.0.1",
    "description": "SumUp payment integrations across terminal and online checkout flows. Build Android and iOS POS apps with SumUp card readers, online checkout with server SDKs and the checkout widget, and control card readers remotely via Cloud API.",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/sumup/sumup-skills.git",
      "upstream_sha": "a4b5a9789e10e27fb375b68279bb0916074b8dd4",
      "upstream_subpath": "providers/claude/plugin",
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "NONE_DETECTED",
      "license_concern": "missing-license-file"
    }
  },
  {
    "name": "supabase",
    "source": "./plugins/supabase",
    "version": "0.0.1",
    "description": "Supabase MCP integration for database operations, authentication, storage, and real-time subscriptions. Manage your Supabase projects, run SQL queries, and interact with your backend directly.",
    "category": "database",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/supabase-community/supabase-plugin.git",
      "upstream_sha": "693a17a9970ba96e01afb9bef060d1dca48463ba",
      "upstream_subpath": null,
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "NONE_DETECTED",
      "license_concern": "missing-license-file"
    }
  },
  {
    "name": "superpowers",
    "source": "./plugins/superpowers",
    "version": "0.0.1",
    "description": "Superpowers teaches CrabCode brainstorming, subagent driven development with built in code review, systematic debugging, and red/green TDD. Additionally, it teaches CrabCode how to author and test new skills.",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/obra/superpowers.git",
      "upstream_sha": "f2cbfbefebbfef77321e4c9abc9e949826bea9d7",
      "upstream_subpath": null,
      "classification": "hook-runtime",
      "target_batch": "parallel-05-runtime-present",
      "license": "MIT",
      "license_concern": null
    }
  },
  {
    "name": "twilio-developer-kit",
    "source": "./plugins/twilio-developer-kit",
    "version": "0.0.1",
    "description": "Twilio Skills provide procedural knowledge for AI coding agents \u2014 which APIs to use, in what order, and what to avoid. Covers SMS, Voice, WhatsApp, Verify, SendGrid, Compliance, and 30+ products.",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/twilio/ai.git",
      "upstream_sha": "7d15b215240df28e86a0b7305520524a2c005005",
      "upstream_subpath": null,
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "MIT",
      "license_concern": null
    }
  },
  {
    "name": "vanta-mcp-plugin",
    "source": "./plugins/vanta-mcp-plugin",
    "version": "0.0.1",
    "description": "The Vanta plugin connects CrabCode to Vanta's security and compliance platform through the Vanta MCP server. It combines Vanta's test-specific remediation intelligence with your local repository context to help you fix compliance failures faster.",
    "category": "security",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/VantaInc/vanta-mcp-plugin.git",
      "upstream_sha": "345d86b55faa649e955b7ea5569cf52d8425c2d5",
      "upstream_subpath": null,
      "classification": "multi-plugin-monorepo",
      "target_batch": "parallel-18-workflow-present",
      "license": "MIT",
      "license_concern": null
    }
  },
  {
    "name": "vercel",
    "source": "./plugins/vercel",
    "version": "0.0.1",
    "description": "Vercel deployment platform integration. Manage deployments, check build status, access logs, configure domains, and control your frontend infrastructure directly from CrabCode.",
    "category": "deployment",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/vercel/vercel-plugin.git",
      "upstream_sha": "1edb125d13a29a1e6212f5ca5afcdf1b89b9b211",
      "upstream_subpath": null,
      "classification": "hook-runtime",
      "target_batch": "parallel-05-runtime-present",
      "license": "NONE_DETECTED",
      "license_concern": "missing-license-file"
    }
  },
  {
    "name": "windsor-ai",
    "source": "./plugins/windsor-ai",
    "version": "0.0.1",
    "description": "Connect CrabCode to 325+ business data sources via Windsor.ai. Query marketing, sales, CRM, ecommerce, finance, and analytics data from Google Ads, Meta, HubSpot, Salesforce, Shopify, Stripe, and hundreds more \u2014 directly from your terminal.",
    "category": "productivity",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/windsor-ai/claude-windsor-ai-plugin.git",
      "upstream_sha": "248a6994b15b410cc025b105bb4ed5558e9b1af9",
      "upstream_subpath": null,
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "MIT",
      "license_concern": null
    }
  },
  {
    "name": "wix",
    "source": "./plugins/wix",
    "version": "0.0.1",
    "description": "Build, manage, and deploy Wix sites and apps. CLI development skills for dashboard extensions, backend APIs, site widgets, and service plugins with the Wix Design System, plus MCP server for site management.",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/wix/skills.git",
      "upstream_sha": "7ae38286b49e5e0cbf7069b6fd8cf6b5db2ba786",
      "upstream_subpath": null,
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "MIT",
      "license_concern": null
    }
  },
  {
    "name": "wordpress.com",
    "source": "./plugins/wordpress.com",
    "version": "0.0.1",
    "description": "Uses CrabCode to create and edit WordPress sites with WordPress Studio before deploying changes to your WordPress.com site.",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/Automattic/claude-code-wordpress.com.git",
      "upstream_sha": "052ca970df2c577d7c651e784935186ff93e6779",
      "upstream_subpath": null,
      "classification": "command-workflow",
      "target_batch": "parallel-18-workflow-present",
      "license": "GPL-2.0",
      "license_concern": "copyleft"
    }
  },
  {
    "name": "youdotcom-agent-skills",
    "source": "./plugins/youdotcom-agent-skills",
    "version": "0.0.1",
    "description": "You.com agent skills for web search, research with citations, and content extraction. Guided integrations for Vercel AI SDK, CrabCode Agent SDK, OpenAI Agents SDK, crewAI, LangChain, Microsoft Teams.ai, direct REST API, and bash CLI.",
    "category": "productivity",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/youdotcom-oss/agent-skills.git",
      "upstream_sha": "4712250ae8e5ce3095cad3b43b62b33608888863",
      "upstream_subpath": null,
      "classification": "hook-runtime",
      "target_batch": "parallel-05-runtime-present",
      "license": "MIT",
      "license_concern": null
    }
  },
  {
    "name": "zoom-plugin",
    "source": "./plugins/zoom-plugin",
    "version": "0.0.1",
    "description": "CrabCode plugin for planning, building, and debugging Zoom integrations across REST APIs, SDKs, webhooks, bots, and MCP workflows.",
    "category": "development",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/zoom/zoom-plugin.git",
      "upstream_sha": "88f6ca3529c2dca7a38db24359ecf6fd15a23379",
      "upstream_subpath": null,
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "MIT",
      "license_concern": null
    }
  },
  {
    "name": "zoominfo",
    "source": "./plugins/zoominfo",
    "version": "0.0.1",
    "description": "Search companies and contacts, enrich leads, find lookalikes, and get AI-ranked contact recommendations. Pre-built skills chain multiple ZoomInfo tools into complete B2B sales workflows.",
    "category": "productivity",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/Zoominfo/zoominfo-mcp-plugin.git",
      "upstream_sha": "14752e4553312d8af3eb3a3264a97d76bb3e0215",
      "upstream_subpath": null,
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "MIT",
      "license_concern": null
    }
  },
  {
    "name": "zscaler",
    "source": "./plugins/zscaler",
    "version": "0.0.1",
    "description": "Manage Zscaler cloud security platform including ZPA (private access), ZIA (internet access), ZDX (digital experience), ZCC (client connector), EASM (attack surface), and Z-Insights (analytics). Create and manage policies, troubleshoot connectivity, audit security configurations, and investigate incidents across the full Zscaler ecosystem.",
    "category": "security",
    "tags": [],
    "_meta": {
      "upstream_url": "https://github.com/zscaler/zscaler-mcp-server.git",
      "upstream_sha": "246430c8d2d99726ad6cdcb00d1adc4e316cb966",
      "upstream_subpath": null,
      "classification": "mixed-plugin",
      "target_batch": "parallel-18-workflow-present",
      "license": "MIT",
      "license_concern": null
    }
  }
]
```

## Failures / Gaps / Follow-ups

- **0 source-unavailable**, **0 unreachable upstreams**: every URL responded to `git ls-remote` and every pinned sha was reachable.
- **4 duplicate entries**: `rc`, `data`, `data-engineering`, `sap-cds-mcp` collapse into 3 canonicals (`revenuecat`, `astronomer-data-agents`, `cds-mcp`). Recommend NOT publishing the duplicate names as separate plugin directories; instead either alias them inside the marketplace (if the marketplace schema supports aliases) or pick one display name and drop the others. **This requires an integration decision.**
- **4 multi-plugin-monorepo upstreams**: `azure`, `huggingface-skills`, `quarkus-agent`, `vanta-mcp-plugin` upstream repos contain more than one `.claude-plugin/plugin.json`. Each needs a slicing decision before the per-batch conversion ticket can run.
- **28 license concerns** (1 noncommercial blocker, 1 AGPL, 1 GPL, 1 source-available, 24 missing license files). All 28 must clear legal review before a public marketplace mirror is published. `agentforce-adlc` (CC-BY-NC-4.0) is the only hard blocker among these.
- **13 entries land in hook-runtime**: every Python or shell hook from upstream must be rewritten in TypeScript before implementation per plan-01 §"TypeScript Rules". This affects worker capacity planning for `parallel-05-runtime-present` (originally sized for 5 workers; this Window H influx alone adds 13 candidates).
- **`bangong/external-sources/` size**: roughly 1.8 GB on disk after this run (92 shallow clones at pinned sha). Stays untracked. Re-running this fetch on another machine reproduces the exact tree via the pinned shas recorded above.

## Reproduction

```bash
cd /Users/fushihua/Desktop/CrabCode-Plugin
# 1. extract authoritative source records from marketplace.json (script lives in .window-h-workdir/, not committed)
# 2. deduplicate upstreams (92 unique repos)
# 3. parallel git ls-remote (16-way) for reachability
# 4. parallel shallow-clone then pin to marketplace-recorded sha (12-way)
# 5. classify by file structure and write this report
```

The intermediate JSON (`sources.json`, `repos.json`, `marketplace_drafts.json`) is kept in `.window-h-workdir/` (gitignored next commit) and can be replayed deterministically against the same marketplace baseline.

---

Generated by Window H, 2026-05-19. All file counts, sha values, and license findings above are sourced from the actual cloned trees at the marketplace-pinned commits.