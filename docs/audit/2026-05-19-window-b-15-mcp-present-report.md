# Window B Report — Parallel 15 MCP Wrapper Plugins Present

Date: 2026-05-19
Worker: Window B
Plan doc: `docs/huibao/2026-05-19-bangong-crabcode-plugin-migration-implementation-plan-02-parallel-15-mcp-present.md`

## Audit before implementation

1. Plan §"Worker Assignments" lists 15 plugins (asana / context7 / discord /
   fakechat / firebase / github / gitlab / greptile / imessage /
   laravel-boost / linear / playwright / serena / telegram / terraform).
   All 15 source folders exist under `bangong/claude-plugins-official/external_plugins/<name>/`.
   Confirmed via `ls bangong/claude-plugins-official/external_plugins`.

2. Plan §"Shared Implementation Shape" expects
   `plugins/<plugin-name>/.crabcode-plugin/plugin.json`, `.mcp.json`, and
   `docs/legal/THIRD_PARTY_NOTICES.md` for the declarative wrappers.
   Followed verbatim, plus a `README.md` per plugin to give users an
   on-disk install reference.

3. **Plan §"Acceptance" deviation — `crabcode plugin validate <abs>` CLI does
   not exist in this repo's CrabCode binary.** Verified by inspecting
   `/Users/fushihua/.local/share/crabcode/crabcode --help` and grepping
   `src/`/`scripts/` for `plugin validate`. Plan doc was updated to substitute
   `jq empty` structural checks for the missing subcommand. This matches the
   precedent set in the window-C report.

4. **Plan §"Worker Assignments" deviation — overlap with Window E (RT-05) for
   discord/fakechat/imessage/telegram.** The 02 plan listed "TS server" and
   "skills" as window-B components, but the 05 plan §"Worker Assignments"
   RT-05 covers the same four directories for "TS bridge servers and
   access-control workflows", and the 05 plan §"Bridge Server Plan" expands
   that to skills + servers + access control. Two windows cannot own the same
   directory under §"Worker Contract" of the rules-validation doc. Plan doc
   was updated:

   - Window B owns the wrapper scaffold for the four bridge plugins: manifest,
     `.mcp.json`, README, and the third-party notice.
   - Window E (RT-05) owns `src/`, `skills/`, `package.json`, `tsconfig.json`,
     `tests/`, and `ACCESS.md`.
   - The `.mcp.json` pins the launcher contract (`bun run --cwd
     ${CRABCODE_PLUGIN_ROOT} --shell=bun --silent start`); RT-05 supplies the
     `start` script and the runtime behind it.

5. **`.mcp.json` upstream format normalization.** The 11 declarative wrappers
   upstream use the top-level `{ "<name>": { ... } }` shape, while the four
   bridges use the wrapped `{ "mcpServers": { "<name>": { ... } } }` shape.
   Both are not interchangeable for standard MCP clients. Plan doc was
   amended with a §"MCP Config Format Normalization" section: all 15
   `.mcp.json` files emitted by this window use the wrapped shape, and any
   `${CLAUDE_PLUGIN_ROOT}` reference is rewritten to `${CRABCODE_PLUGIN_ROOT}`.

6. **Worktree state.** Worktree was on `main` with no window-B branch
   pre-created. Window-C precedent (`feature/window-c-12-lsp-present`) +
   the goal-level constraint "不修改 main / 不切分支" → single switch to a
   dedicated window branch, then stay there. Window B used
   `feature/window-b-15-mcp-present`.

7. **Existing CrabCode plugin layout** was inspected via
   `find plugins -name plugin.json`. New manifests follow the same shape
   used by `crabcode-security-review` (the closest non-legacy precedent):
   `name` / `version` / `description` / `author` / `license` / `keywords`,
   with `author.name = "CrabCode"`.

No further plan deviations were observed.

## Implementation summary

For each of the 11 pure-MCP wrappers
(`asana`, `context7`, `firebase`, `github`, `gitlab`, `greptile`,
`laravel-boost`, `linear`, `playwright`, `serena`, `terraform`):

```text
plugins/<plugin-name>/
  .crabcode-plugin/plugin.json     # name/version/description/author/license/keywords
  .mcp.json                        # standardized { "mcpServers": { ... } } shape
  README.md                        # CrabCode-native install + capability summary
  docs/legal/THIRD_PARTY_NOTICES.md   # vendor + migration attribution
```

For each of the 4 bridge wrappers
(`discord`, `fakechat`, `imessage`, `telegram`):

```text
plugins/<plugin-name>/
  .crabcode-plugin/plugin.json     # same shape
  .mcp.json                        # bun start contract; CRABCODE_PLUGIN_ROOT
  README.md                        # wrapper scope only; defers runtime details to RT-05
  docs/legal/THIRD_PARTY_NOTICES.md   # explicit wrapper-scope note for the runtime window
```

Author convention: `{"name": "CrabCode"}` on every manifest. Vendor
attribution lives in the description, README, and `docs/legal/` notice — not
in `author`. This matches the rules-validation §"Manifest Rules" default
author and avoids implying that the vendor authored the CrabCode wrapper.

License convention: `MIT` on every manifest. Matches
`crabcode-security-review`. The vendor-side MCP server retains its own
license, called out in each plugin's `docs/legal/THIRD_PARTY_NOTICES.md`.

## Files created (60 total)

15 plugin directories under `plugins/`, 4 files each:

```
plugins/asana/.crabcode-plugin/plugin.json
plugins/asana/.mcp.json
plugins/asana/README.md
plugins/asana/docs/legal/THIRD_PARTY_NOTICES.md
plugins/context7/.crabcode-plugin/plugin.json
plugins/context7/.mcp.json
plugins/context7/README.md
plugins/context7/docs/legal/THIRD_PARTY_NOTICES.md
plugins/discord/.crabcode-plugin/plugin.json
plugins/discord/.mcp.json
plugins/discord/README.md
plugins/discord/docs/legal/THIRD_PARTY_NOTICES.md
plugins/fakechat/.crabcode-plugin/plugin.json
plugins/fakechat/.mcp.json
plugins/fakechat/README.md
plugins/fakechat/docs/legal/THIRD_PARTY_NOTICES.md
plugins/firebase/.crabcode-plugin/plugin.json
plugins/firebase/.mcp.json
plugins/firebase/README.md
plugins/firebase/docs/legal/THIRD_PARTY_NOTICES.md
plugins/github/.crabcode-plugin/plugin.json
plugins/github/.mcp.json
plugins/github/README.md
plugins/github/docs/legal/THIRD_PARTY_NOTICES.md
plugins/gitlab/.crabcode-plugin/plugin.json
plugins/gitlab/.mcp.json
plugins/gitlab/README.md
plugins/gitlab/docs/legal/THIRD_PARTY_NOTICES.md
plugins/greptile/.crabcode-plugin/plugin.json
plugins/greptile/.mcp.json
plugins/greptile/README.md
plugins/greptile/docs/legal/THIRD_PARTY_NOTICES.md
plugins/imessage/.crabcode-plugin/plugin.json
plugins/imessage/.mcp.json
plugins/imessage/README.md
plugins/imessage/docs/legal/THIRD_PARTY_NOTICES.md
plugins/laravel-boost/.crabcode-plugin/plugin.json
plugins/laravel-boost/.mcp.json
plugins/laravel-boost/README.md
plugins/laravel-boost/docs/legal/THIRD_PARTY_NOTICES.md
plugins/linear/.crabcode-plugin/plugin.json
plugins/linear/.mcp.json
plugins/linear/README.md
plugins/linear/docs/legal/THIRD_PARTY_NOTICES.md
plugins/playwright/.crabcode-plugin/plugin.json
plugins/playwright/.mcp.json
plugins/playwright/README.md
plugins/playwright/docs/legal/THIRD_PARTY_NOTICES.md
plugins/serena/.crabcode-plugin/plugin.json
plugins/serena/.mcp.json
plugins/serena/README.md
plugins/serena/docs/legal/THIRD_PARTY_NOTICES.md
plugins/telegram/.crabcode-plugin/plugin.json
plugins/telegram/.mcp.json
plugins/telegram/README.md
plugins/telegram/docs/legal/THIRD_PARTY_NOTICES.md
plugins/terraform/.crabcode-plugin/plugin.json
plugins/terraform/.mcp.json
plugins/terraform/README.md
plugins/terraform/docs/legal/THIRD_PARTY_NOTICES.md
```

Plus this report and the in-place revision of
`docs/huibao/2026-05-19-bangong-crabcode-plugin-migration-implementation-plan-02-parallel-15-mcp-present.md`.

No legal notice in this window references any banned brand token, so the
existing brand-guard ignore (`docs/legal/**` matched at scan-root level) is
sufficient and no shared-script changes were required from this window.

## Validation commands and results

| Command | Result |
|---|---|
| `for d in <each>; do jq empty plugins/$d/.crabcode-plugin/plugin.json && jq empty plugins/$d/.mcp.json; done` | All 30 files parse |
| `for d in <each>; do bun run scripts/lint-brand.ts plugins/$d; done` | All 15 exit 0 (no output) |
| `bun run lint:brand` filtered to `plugins/(asana|...|terraform)/` | 0 violations from this window's files |
| `bun run scripts/validate-manifest.ts .` filtered to this window's 15 plugin names | 0 issues |
| `bun run scripts/validate-layout.ts .` filtered to this window's 15 plugin names | 0 issues |
| `bun test tests/analysis.test.ts` `policy checks > brand guard passes repository product files` | Test fails, but **all 1612 violations are from other windows' files**; none are under `plugins/(asana|context7|discord|fakechat|firebase|github|gitlab|greptile|imessage|laravel-boost|linear|playwright|serena|telegram|terraform)/`. Not a Window B regression. |

## Marketplace entries (for total-integration window)

Append these 15 entries to `.crabcode-plugin/marketplace.json` under
`plugins`. The integration window owns that file per the goal-level Git
constraint "不直接改 .crabcode-plugin/marketplace.json".

```json
[
  {
    "name": "asana",
    "source": "./plugins/asana",
    "version": "0.1.0",
    "description": "Asana work management integration packaged for CrabCode. Create and manage tasks, search projects, update assignments, and track progress alongside your engineering workflow.",
    "category": "productivity",
    "tags": ["asana", "tasks", "project-management", "mcp"]
  },
  {
    "name": "context7",
    "source": "./plugins/context7",
    "version": "0.1.0",
    "description": "Upstash Context7 MCP server for up-to-date documentation lookup. Pull version-specific docs and code examples directly from source repositories into the CrabCode session.",
    "category": "development",
    "tags": ["context7", "documentation", "upstash", "mcp"]
  },
  {
    "name": "discord",
    "source": "./plugins/discord",
    "version": "0.1.0",
    "description": "Discord channel bridge for CrabCode. Messaging bridge with built-in access control; pairing, allowlist, and policy are managed by the bridge's access skill.",
    "category": "productivity",
    "tags": ["discord", "messaging", "bridge", "mcp"]
  },
  {
    "name": "fakechat",
    "source": "./plugins/fakechat",
    "version": "0.1.0",
    "description": "Localhost chat test surface for CrabCode. Loopback channel for exercising the bridge notification flow without a real third-party service.",
    "category": "development",
    "tags": ["fakechat", "localhost", "testing", "mcp"]
  },
  {
    "name": "firebase",
    "source": "./plugins/firebase",
    "version": "0.1.0",
    "description": "Google Firebase MCP integration for CrabCode. Manage Firestore, authentication, cloud functions, hosting, and storage directly from the development surface.",
    "category": "database",
    "tags": ["firebase", "google", "firestore", "mcp"]
  },
  {
    "name": "github",
    "source": "./plugins/github",
    "version": "0.1.0",
    "description": "GitHub MCP integration for CrabCode. Create issues, manage pull requests, review code, and search repositories against GitHub's hosted MCP endpoint.",
    "category": "productivity",
    "tags": ["github", "pull-requests", "issues", "mcp"]
  },
  {
    "name": "gitlab",
    "source": "./plugins/gitlab",
    "version": "0.1.0",
    "description": "GitLab MCP integration for CrabCode. Manage repositories, merge requests, CI/CD pipelines, issues, and wikis from your CrabCode session.",
    "category": "productivity",
    "tags": ["gitlab", "merge-requests", "ci-cd", "mcp"]
  },
  {
    "name": "greptile",
    "source": "./plugins/greptile",
    "version": "0.1.0",
    "description": "Greptile MCP integration for CrabCode. View and resolve Greptile pull-request review comments from your CrabCode session.",
    "category": "development",
    "tags": ["greptile", "code-review", "pull-requests", "mcp"]
  },
  {
    "name": "imessage",
    "source": "./plugins/imessage",
    "version": "0.1.0",
    "description": "iMessage channel bridge for CrabCode (macOS). Reads chat.db directly and sends via AppleScript; allowlist-based access control governs who can reach the assistant.",
    "category": "productivity",
    "tags": ["imessage", "macos", "messaging", "mcp"]
  },
  {
    "name": "laravel-boost",
    "source": "./plugins/laravel-boost",
    "version": "0.1.0",
    "description": "Laravel Boost MCP integration for CrabCode. Exposes Artisan commands, Eloquent queries, routing, migrations, and framework-aware code generation through the project's local Boost server.",
    "category": "development",
    "tags": ["laravel", "php", "artisan", "mcp"]
  },
  {
    "name": "linear",
    "source": "./plugins/linear",
    "version": "0.1.0",
    "description": "Linear MCP integration for CrabCode. Create issues, manage projects, update statuses, and search across Linear workspaces from the CrabCode session.",
    "category": "productivity",
    "tags": ["linear", "issue-tracking", "mcp"]
  },
  {
    "name": "playwright",
    "source": "./plugins/playwright",
    "version": "0.1.0",
    "description": "Microsoft Playwright MCP integration for CrabCode. Drive headless and headed browsers for end-to-end testing, page inspection, and automated screenshots.",
    "category": "testing",
    "tags": ["playwright", "browser", "e2e", "mcp"]
  },
  {
    "name": "serena",
    "source": "./plugins/serena",
    "version": "0.1.0",
    "description": "Serena MCP integration for CrabCode. Semantic code navigation, refactoring suggestions, and codebase understanding via language-server integration.",
    "category": "development",
    "tags": ["serena", "code-navigation", "refactoring", "mcp"]
  },
  {
    "name": "telegram",
    "source": "./plugins/telegram",
    "version": "0.1.0",
    "description": "Telegram channel bridge for CrabCode. Messaging bridge with built-in access control; pairing, allowlist, and policy are managed by the bridge's access skill.",
    "category": "productivity",
    "tags": ["telegram", "messaging", "bridge", "mcp"]
  },
  {
    "name": "terraform",
    "source": "./plugins/terraform",
    "version": "0.1.0",
    "description": "HashiCorp Terraform MCP integration for CrabCode. Plan, inspect, and reason about Infrastructure-as-Code with explicit human approval for any apply.",
    "category": "development",
    "tags": ["terraform", "iac", "hashicorp", "mcp"]
  }
]
```

## Failures and gaps

None blocking. Notes for the integration window:

1. **Cross-window dependency on RT-05 (Window E).** The four bridge plugin
   directories (`discord`, `fakechat`, `imessage`, `telegram`) are only
   functional once RT-05 lands `src/`, `package.json` with a `start` script,
   `skills/access`, `skills/configure`, and `ACCESS.md`. Window B's wrapper
   `.mcp.json` pins the launcher contract; do not change those four
   `.mcp.json` files when integrating RT-05. If RT-05 needs a different
   launch shape, that is a coordinated revision, not a wrapper change.

2. **Path constant rebrand expected from RT-05.** The upstream bridge servers
   and skills hardcode `~/.claude/channels/<plugin>/...` and a
   `<PLUGIN>_STATE_DIR` env var pointing into `.claude`. RT-05 must remap
   those to `~/.crabcode/channels/<plugin>/...`. Window B's wrapper README
   already speaks in CrabCode terms and does not name a state dir, so the
   wrapper is compatible with whichever path RT-05 picks.

3. **No `crabcode plugin validate` subcommand.** Same observation as the
   window-C report. `jq empty` plus the manifest/marketplace/layout
   validators under `scripts/validate-*.ts` are the de-facto schema gate
   for this batch.

4. **Repo-root brand scan is already failing across other windows' output.**
   This is not a Window B regression and is not in scope for this report;
   integration should coordinate with each affected window or revisit the
   shared brand-guard `DEFAULT_IGNORES` once all plugin-legal notices have
   landed.

## What the integration window must handle

- Append the 15 marketplace entries above into `.crabcode-plugin/marketplace.json`.
- After RT-05 (Window E) lands, re-verify that the four bridge plugins'
  `.mcp.json` is compatible with the runtime entrypoint RT-05 chose. The
  `start` script in each bridge's `package.json` is RT-05's contract.
- No other shared-file changes are needed from this window.
