# Parallel 15: MCP Wrapper Plugins Present in Source

Date: 2026-05-19
Parallelism: 15 workers
Source root: `bangong/claude-plugins-official/external_plugins`

## Scope

This batch covers source-present external plugins that are primarily MCP wrappers. They are the lowest-risk conversion group because most behavior is already delegated to an MCP server and CrabCode migration mainly requires manifest, naming, copy, and configuration cleanup.

## Shared Implementation Shape

Target layout:

```text
plugins/<plugin-name>/
  .crabcode-plugin/plugin.json
  .mcp.json
  docs/legal/THIRD_PARTY_NOTICES.md
```

If the source plugin includes skills, preserve the capability by rewriting the skill as CrabCode-native:

```text
plugins/<plugin-name>/
  skills/<skill-name>/SKILL.md
```

## Worker Assignments

| Worker | Source | Target | Components | Notes |
|---|---|---|---|---|
| MCP-01 | `external_plugins/asana` | `plugins/asana` | `.mcp.json` | Replace product copy with CrabCode integration language. |
| MCP-02 | `external_plugins/context7` | `plugins/context7` | `.mcp.json` | Keep docs lookup semantics; remove Claude command references. |
| MCP-03 | `external_plugins/discord` | `plugins/discord` | wrapper scaffold only (`.crabcode-plugin/plugin.json`, `.mcp.json`, README, ACCESS, legal notice) | Skills and `src/server.ts` are owned by Window E RT-05 (runtime). Window B must not author runtime code or rebrand access-control skills. |
| MCP-04 | `external_plugins/fakechat` | `plugins/fakechat` | wrapper scaffold only | Treat as local test bridge; CrabCode-native wrapper copy. `src/server.ts` is RT-05's responsibility. |
| MCP-05 | `external_plugins/firebase` | `plugins/firebase` | `.mcp.json` | Keep Firebase naming; rewrite assistant/product wording. |
| MCP-06 | `external_plugins/github` | `plugins/github` | `.mcp.json` | Preserve GitHub MCP details; avoid claiming official CrabCode ownership unless confirmed. |
| MCP-07 | `external_plugins/gitlab` | `plugins/gitlab` | `.mcp.json` | Same pattern as GitHub. |
| MCP-08 | `external_plugins/greptile` | `plugins/greptile` | `.mcp.json`, README | Keep vendor name; clean Claude copy. |
| MCP-09 | `external_plugins/imessage` | `plugins/imessage` | wrapper scaffold only | Skills and `src/server.ts` owned by Window E RT-05. Window B preserves macOS permission language in the README only. |
| MCP-10 | `external_plugins/laravel-boost` | `plugins/laravel-boost` | `.mcp.json` | Vendor/framework language can remain. |
| MCP-11 | `external_plugins/linear` | `plugins/linear` | `.mcp.json` | Keep Linear semantics. |
| MCP-12 | `external_plugins/playwright` | `plugins/playwright` | `.mcp.json` | Use CrabCode browser/test language. |
| MCP-13 | `external_plugins/serena` | `plugins/serena` | `.mcp.json` | Highlight semantic code navigation. |
| MCP-14 | `external_plugins/telegram` | `plugins/telegram` | wrapper scaffold only | Skills and `src/server.ts` owned by Window E RT-05. |
| MCP-15 | `external_plugins/terraform` | `plugins/terraform` | `.mcp.json` | Keep IaC safety warnings. |

## Required Changes Per Plugin

1. Copy or regenerate `.mcp.json` into target plugin.
2. Create `.crabcode-plugin/plugin.json`.
3. Rewrite description and optional docs to CrabCode.
4. Add or update marketplace entry.
5. Add legal/source note under `docs/legal/THIRD_PARTY_NOTICES.md`.
6. Run brand scan.

## Batch Lead Tasks

- Normalize all descriptions to a consistent marketplace tone.
- Confirm all `.mcp.json` paths and package commands work from the plugin root.
- De-duplicate marketplace categories and tags.
- Coordinate bridge server rewrites with the runtime batch for Discord, fakechat, iMessage, and Telegram.

## Acceptance

Each plugin passes:

```bash
bun run scripts/lint-brand.ts plugins/<plugin-name>
jq empty plugins/<plugin-name>/.crabcode-plugin/plugin.json
jq empty plugins/<plugin-name>/.mcp.json
```

Note: the originally specified `crabcode plugin validate ...` subcommand does
not exist in the current CrabCode CLI. The two `jq empty` invocations stand
in for structural validation until that subcommand ships.

Batch passes when all 15 plugins are discoverable from `.crabcode-plugin/marketplace.json`
(via the batch report; the marketplace file itself is updated by total integration).

## Ownership Boundary With Window E (Runtime, RT-05)

Window E owns the TypeScript runtime, skills, and access-control workflows for
`discord`, `fakechat`, `imessage`, and `telegram`. Window B only delivers the
plugin scaffold (manifest, `.mcp.json`, wrapper docs, legal notice). Concretely:

- Window B may create: `plugins/<name>/.crabcode-plugin/plugin.json`,
  `plugins/<name>/.mcp.json`, `plugins/<name>/README.md`,
  `plugins/<name>/docs/legal/THIRD_PARTY_NOTICES.md`.
- Window B must NOT create: `plugins/<name>/src/`, `plugins/<name>/skills/`,
  `plugins/<name>/package.json`, `plugins/<name>/tsconfig.json`,
  `plugins/<name>/tests/`, `plugins/<name>/ACCESS.md`.
- The `.mcp.json` for the bridge plugins points to the runtime entry that
  RT-05 will produce (`bun run --cwd ${CRABCODE_PLUGIN_ROOT} start`). Window B
  pins the contract; RT-05 supplies the implementation.

## MCP Config Format Normalization

Upstream `.mcp.json` files use two inconsistent shapes (top-level key vs
`{"mcpServers": {...}}` wrapper). Window B normalizes every emitted
`.mcp.json` to the `{"mcpServers": {"<name>": {...}}}` form so CrabCode and
standard MCP clients parse them uniformly. The Claude Code-specific token
`${CLAUDE_PLUGIN_ROOT}` is replaced with `${CRABCODE_PLUGIN_ROOT}` for any
command that referenced it; pure-vendor endpoints are emitted unchanged.
