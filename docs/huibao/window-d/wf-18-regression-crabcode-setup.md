# WF-18 Regression: `legacy-assistant-setup` → `crabcode-setup`

Date: 2026-05-19
Owner: Window D
Plan: `04-parallel-18-workflow-present.md` row WF-18.

## Scope

Per the migration plan, `crabcode-setup` is "Already implemented; run
regression diff and update only if gaps remain." This document is the
regression report.

## Source baseline

- Upstream: `bangong/legacy-plugins-official/plugins/legacy-assistant-setup`
- Commit: `4bf08583c37e04f764806ea7a96ca74fb80ced1d`

## Upstream inventory

```
plugins/legacy-assistant-setup/
  .legacy-plugin/plugin.json
  README.md
  LICENSE
  automation-recommender-example.png
  skills/legacy-assistant-automation-recommender/
    SKILL.md                                   (288 lines, prompt-only walk-through)
    references/hooks-patterns.md
    references/mcp-servers.md
    references/plugins-reference.md
    references/skills-reference.md
    references/subagent-templates.md
```

The upstream plugin is purely declarative: a long SKILL.md that walks the
model through codebase inspection plus five reference catalogs the model
reads opportunistically.

## CrabCode current implementation (this repo root)

`crabcode-setup` is the root marketplace plugin. Layout:

```
./
  .crabcode-plugin/plugin.json
  package.json                           (Bun CLI scripts)
  tsconfig.json
  README.md
  skills/crabcode-automation-recommender/
    SKILL.md                             (47 lines, CLI-first wrapper)
  src/
    cli.ts
    index.ts
    types.ts
    analyzer/profile.ts                  (66 lines)
    analyzer/projectScanner.ts           (156 lines)
    detectors/{backend,ci,crabcodeConfig,frontend,packageJson,rustWorkspace}.ts
                                         (~350 lines combined)
    recommendations/{catalog,ranker,rules}.ts
    render/{markdown,json}.ts
    policy/brandGuard.ts
  scripts/lint-brand.ts
```

Total TS runtime: ~880 LOC across analyzer, detectors, recommendations,
and renderers — more than the upstream 288-line prompt plus references.

## Behavioral diff

| Capability | Upstream (prompt) | crabcode-setup (TS CLI) | Verdict |
|---|---|---|---|
| Codebase profile inspection | Model reads files via Read/Glob/Grep | `projectScanner.ts` walks tree deterministically | covered, deterministic |
| Hook pattern recommendations | `references/hooks-patterns.md` consumed by model | Encoded in `recommendations/catalog.ts` + `rules.ts` | covered |
| MCP server suggestions | `references/mcp-servers.md` | Encoded in catalog | covered |
| Plugin suggestions | `references/plugins-reference.md` | Encoded in catalog | covered |
| Skill suggestions | `references/skills-reference.md` | Encoded in catalog | covered |
| Subagent templates | `references/subagent-templates.md` | Out of scope (CrabCode agent runtime owns templates) | n/a — different product surface |
| Output format | Free-form prose in chat | Markdown / JSON via `render/` | covered |
| Brand identity | legacy assistant | CrabCode | satisfies migration rule |

## Gap analysis

- **No regression.** The current `crabcode-setup` implements the upstream
  recommendation behavior as TypeScript with a CLI binary, then exposes
  the result through a thin skill that invokes the CLI.
- **No need to port the 5 upstream reference files.** Their content is
  embedded in `src/recommendations/catalog.ts` and `rules.ts`.
- **No need to port the 288-line upstream SKILL.md.** The 47-line current
  skill plus the TS analyzer subsumes it.

## Action

- **No code change required for WF-18.**
- The brand audit of `crabcode-setup` is already clean — verified by
  running `bun run scripts/lint-brand.ts .` from the repo root before
  any window-D files were added.

## Caveat — out-of-scope follow-up

The current `crabcode-setup` does not emit subagent template suggestions.
Upstream's `references/subagent-templates.md` covers that domain. Whether
CrabCode wants subagent-template recommendations is a product decision
owned by the CrabCode agent runtime team, not this migration. Filing as a
deferral, not a window-D gap.
