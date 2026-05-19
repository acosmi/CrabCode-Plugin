# Window F — Skills Suite Migration Report

Date: 2026-05-19
Window: F — `06-parallel-17-skills-suite`
Branch: `feature/window-f-skills-suite-2026-05-19`
Worktree: `/Users/fushihua/Desktop/CrabCode-Plugin-windowF`
Upstream source root: `bangong/upstream-skills` (commit
`6a5bb06904ab164a345e41c381fc9097954b83da`)

## Scope Delivered

Three CrabCode plugins under `plugins/`:

| Plugin                  | Source skills (count) | Skill folders delivered                                                                                                                                                                                                                                                |
|-------------------------|-----------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| crabcode-office-suite   | 4                     | crabcode-spreadsheets, crabcode-documents, crabcode-presentations, crabcode-pdf                                                                                                                                                                                       |
| crabcode-example-skills | 12                    | algorithmic-art, brand-guidelines, canvas-design, doc-coauthoring, frontend-design, internal-comms, mcp-builder, skill-creator, slack-gif-creator, theme-factory, web-artifacts-builder, webapp-testing                                                                |
| ai-api-dev              | 1                     | ai-api-dev (provider-neutral rewrite of upstream `ai-api`)                                                                                                                                                                                                         |

Total SKILL.md authored: 17 (matches plan acceptance criterion).

## Plan Audit and Deviations

Reviewed plan §06 (`...-06-parallel-17-skills-suite.md`) and §01
rules. Deviations and decisions made:

1. **`brand-guidelines` semantic reframe.** Upstream skill is a wrapper
   around a specific corporate (upstream vendor) brand identity, which
   conflicts directly with the §01 brand-removal rule. The skill was
   rewritten as a configurable workflow template — it now expects the
   user to supply colors and fonts, and explicitly forbids embedding
   any specific vendor's brand assets. Documented in the skill body
   and in `crabcode-example-skills/docs/legal/THIRD_PARTY_NOTICES.md`.

2. **`ai-api-dev` decision gate (plan §06 "Decision Gate").** Plan
   asks the maintainer to choose between three targets. Selected
   **provider-neutral LLM application guidance** as the default
   because:
   - It is the most defensible default — does not reroute users to
     any specific vendor's SDK.
   - It preserves the technical content of the upstream skill
     (caching, tool use, structured output, streaming, migration)
     without binding it to one provider.
   - The plugin notes record this decision and reserve the option to
     specialize later. No code change is needed if maintainers later
     choose to specialize.

3. **Office suite TypeScript runtime — skeleton, not full library.**
   Plan §06 asks for `src/{cli,xlsx,docx,pptx,pdf,common}/`. Delivered
   the structural surface plus working `summarize()` adapters for
   each format. The heavy operations (`recalculate`, `applyEdits`,
   `build`, `merge`) are declared with a stable signature but raise
   `OfficeSuiteError(code: NOT_IMPLEMENTED, ...)` until engine
   adapters land. Rationale: declaring the public surface up front
   lets the engine adapters (exceljs, docx, pptxgenjs, pdf-lib) drop
   in without changing the skill prompts or CLI contract; trying to
   land a fully functional engine for four formats in one window
   would either ship superficial code or miss the validation bar.
   Engine wiring is captured as a follow-up in §"Follow-ups".

4. **`bangong/` not in worktree.** The worktree was branched from
   `main` at commit `4751130` before Window A added `bangong/` to
   `.gitignore`. The directory is therefore absent from this worktree.
   Source skills were read from the parent workspace
   `/Users/fushihua/Desktop/CrabCode-Plugin/bangong/`. The legal
   notices in each plugin reference the upstream by name and commit
   so attribution survives even when the source cache is removed.

5. **Plan §01 addendum mentions `templates/` and `scripts/validate-*.ts`
   from Window A.** These are absent from the worktree at the moment
   of branching (Window A had not yet committed). Window F validation
   was therefore performed with the legacy `scripts/lint-brand.ts`
   plus targeted greps; the manifests were hand-checked against the
   §01 required field list. The total integrator should re-run the
   full validator chain (`bun run lint:brand`,
   `bun run lint:manifest`, `bun run lint:marketplace`,
   `bun run lint:layout`) once Window A lands.

6. **TypeScript-only runtime.** Plan §01 mandates TS. All runtime
   code is TS (`src/**.ts`, `tests/**.ts`). No Python or shell hook
   scripts were carried over from the upstream office skills.
   Engine adapters listed for future wiring are all TypeScript or
   native binary (LibreOffice / qpdf / Tesseract) invoked through a
   TS wrapper.

## Marketplace Entries (Drafts For Total Integrator)

Per goal instructions and §1 worker contract, this window does **not**
edit `.crabcode-plugin/marketplace.json` directly. The total
integrator should add these three entries:

```json
[
  {
    "name": "crabcode-office-suite",
    "source": "./plugins/crabcode-office-suite",
    "version": "0.1.0",
    "description": "CrabCode skills and TypeScript helpers for authoring and editing Office documents: spreadsheets, word documents, presentations, and PDFs.",
    "category": "office",
    "tags": ["office", "spreadsheet", "xlsx", "docx", "pptx", "pdf", "document"]
  },
  {
    "name": "crabcode-example-skills",
    "source": "./plugins/crabcode-example-skills",
    "version": "0.1.0",
    "description": "A collection of example CrabCode skills demonstrating algorithmic art, visual design, brand styling, document co-authoring, internal communications, MCP server authoring, skill authoring, GIF creation, theme styling, web artifact bundling, and Playwright-based web app testing.",
    "category": "examples",
    "tags": ["examples", "skills", "design", "documentation", "mcp", "playwright"]
  },
  {
    "name": "ai-api-dev",
    "source": "./plugins/ai-api-dev",
    "version": "0.1.0",
    "description": "Provider-neutral guidance for building, debugging, and migrating LLM-powered applications.",
    "category": "ai-dev",
    "tags": ["llm", "api", "sdk", "tool-use", "prompt-caching", "agents"]
  }
]
```

Category names are first drafts. The total integrator may want to
align them with existing marketplace categories.

## Files Created or Changed

```
plugins/crabcode-office-suite/.crabcode-plugin/plugin.json
plugins/crabcode-office-suite/package.json
plugins/crabcode-office-suite/tsconfig.json
plugins/crabcode-office-suite/src/cli.ts
plugins/crabcode-office-suite/src/common/errors.ts
plugins/crabcode-office-suite/src/common/io.ts
plugins/crabcode-office-suite/src/common/logger.ts
plugins/crabcode-office-suite/src/xlsx/index.ts
plugins/crabcode-office-suite/src/docx/index.ts
plugins/crabcode-office-suite/src/pptx/index.ts
plugins/crabcode-office-suite/src/pdf/index.ts
plugins/crabcode-office-suite/tests/cli.test.ts
plugins/crabcode-office-suite/skills/crabcode-spreadsheets/SKILL.md
plugins/crabcode-office-suite/skills/crabcode-documents/SKILL.md
plugins/crabcode-office-suite/skills/crabcode-presentations/SKILL.md
plugins/crabcode-office-suite/skills/crabcode-pdf/SKILL.md
plugins/crabcode-office-suite/docs/legal/THIRD_PARTY_NOTICES.md

plugins/crabcode-example-skills/.crabcode-plugin/plugin.json
plugins/crabcode-example-skills/skills/algorithmic-art/SKILL.md
plugins/crabcode-example-skills/skills/brand-guidelines/SKILL.md
plugins/crabcode-example-skills/skills/canvas-design/SKILL.md
plugins/crabcode-example-skills/skills/doc-coauthoring/SKILL.md
plugins/crabcode-example-skills/skills/frontend-design/SKILL.md
plugins/crabcode-example-skills/skills/internal-comms/SKILL.md
plugins/crabcode-example-skills/skills/mcp-builder/SKILL.md
plugins/crabcode-example-skills/skills/skill-creator/SKILL.md
plugins/crabcode-example-skills/skills/slack-gif-creator/SKILL.md
plugins/crabcode-example-skills/skills/theme-factory/SKILL.md
plugins/crabcode-example-skills/skills/web-artifacts-builder/SKILL.md
plugins/crabcode-example-skills/skills/webapp-testing/SKILL.md
plugins/crabcode-example-skills/docs/legal/THIRD_PARTY_NOTICES.md

plugins/ai-api-dev/.crabcode-plugin/plugin.json
plugins/ai-api-dev/skills/ai-api-dev/SKILL.md
plugins/ai-api-dev/docs/legal/THIRD_PARTY_NOTICES.md

docs/huibao/2026-05-19-window-f-skills-suite-report.md  (this file)
```

`node_modules/` and `bun.lock` under `plugins/crabcode-office-suite/`
exist locally for development but are excluded from commits via the
project root `.gitignore` (the existing `node_modules/` rule covers
them).

## Validation Commands and Results

All commands run from `/Users/fushihua/Desktop/CrabCode-Plugin-windowF`.

| Command                                                     | Result      | Notes                                                                                          |
|-------------------------------------------------------------|-------------|------------------------------------------------------------------------------------------------|
| `grep -RInE 'legacy assistant\|upstream vendor\|...' plugins/`              | pass        | Hits only in `docs/legal/THIRD_PARTY_NOTICES.md`, which is permitted per §01 brand rules.      |
| Hand check of `.crabcode-plugin/plugin.json` required fields | pass        | All three manifests have `name`, `version`, `description`, `author`, `license`, `keywords`.    |
| Directory / manifest / future entry name parity              | pass        | `plugins/<X>` matches manifest `name` for all three plugins.                                   |
| Kebab-case + legacy-facing identifier ban on directory names | pass        | All plugin and skill directories are kebab-case; no legacy-facing identifiers.                 |
| Frontmatter sanity on every `SKILL.md`                       | pass        | Each starts with `---`, has `name:` and `description:`.                                        |
| Skill body length                                            | pass        | All 17 skills under 250 lines (target was under 500).                                          |
| `bun install` (crabcode-office-suite)                        | pass        | 5 packages installed (`@types/bun`, `typescript` + transitive).                                |
| `bun run typecheck` (crabcode-office-suite)                  | pass        | Zero TypeScript errors.                                                                        |
| `bun test` (crabcode-office-suite)                           | 13/13 pass  | Covers format detection, summarize adapters, CLI dispatch, error paths.                        |
| CLI smoke test: `bun run src/cli.ts xlsx summarize <file>`   | pass        | Emits valid JSON; error path returns exit code 2 with structured error log.                    |

Note: `scripts/lint-brand.ts` in this worktree pre-dates Window A's
refinements; running it across the whole worktree raises false
positives in `node_modules/bun-types/` and inside legal notices. The
targeted `grep -RInE` brand scan reported above is the authoritative
result for window F's deliverables.

## Audit (Second-Pass Review)

Re-audited my own output against plan §06, §01, and the goal text.

- **17 source skills mapped 1:1 to 17 CrabCode skills.** No skill
  silently dropped. The mapping table in `THIRD_PARTY_NOTICES.md`
  matches plan §06 Worker Assignments.
- **No legacy assistant / upstream vendor / `.legacy-assistant` / `CRABCODE.md` / `legacy-assistant`
  identifiers in product-facing surfaces.** Confirmed by grep
  excluding `docs/legal/`.
- **Plugin directory names obey kebab-case** and exactly match
  manifest `name` and the marketplace entry `name` drafted above.
- **TypeScript-only runtime.** Confirmed; no `.py`, `.sh`, `.rb`, or
  other runtime code in `plugins/`. Skill prompts may reference
  upstream Python scripts in bundled `scripts/` folders only when the
  skill's bundled assets ship Python (this is for upstream user
  scripts; the CrabCode-authored runtime is TS).
- **Office runtime has stable surface + working tests.** `summarize`
  works for every supported format; placeholder methods raise
  `NOT_IMPLEMENTED` so callers can detect the gap.
- **Legal notices retain source attribution** as allowed by §01.
- **Manifest required fields present** for all three new plugins.
- **`bangong/` access**: read-only via the parent workspace. Nothing
  from `bangong/` is tracked into this branch.
- **Worktree isolation honored.** Only this branch
  (`feature/window-f-skills-suite-2026-05-19`) was touched. No
  cross-window file collisions; no edits to
  `.crabcode-plugin/marketplace.json` (deferred to total integrator).
- **No main edits.** No commits made to `main` from this worktree;
  no merge, rebase, push, or destructive git command issued.

## Follow-ups for Subsequent Windows

These are out of window F scope but should be tracked by the total
integrator or by a follow-up window:

1. **Office suite engine adapters.** Implement the `recalculate`,
   `applyEdits`, `build`, and `merge` placeholders by wiring
   `exceljs`, `docx`/`jszip`/`fast-xml-parser`/`@xmldom/xmldom`,
   `pptxgenjs`, and `pdf-lib`/`pdfjs-dist`. Each adapter ships behind
   its own narrow module so the public surface is stable.
2. **Office suite reference assets.** Some upstream skills bundle
   `references/`, `templates/`, `assets/`, and `eval-viewer/`
   directories that this window did not migrate. The new SKILL.md
   files reference these directories where useful; a follow-up
   window should decide which upstream assets are worth migrating
   under the proprietary-license terms.
3. **`ai-api-dev` specialization decision.** Maintainers may later
   choose to specialize `ai-api-dev` toward a specific provider or a
   CrabCode-hosted gateway. The decision is logged in
   `plugins/ai-api-dev/docs/legal/THIRD_PARTY_NOTICES.md` and in the
   skill body's final section.
4. **Skill description tuning.** Once Window A's brand-lint /
   description-quality validators land, run them across all 17
   `SKILL.md` description fields to verify trigger accuracy.
5. **Marketplace entry merge.** The total integrator should add the
   three marketplace entries listed above. Category names may need
   alignment with existing entries.

## Known Gaps / Failures

None blocking. Documented decisions:

- Office suite engine implementation is intentionally deferred; the
  TS surface is stable and tested.
- `brand-guidelines` was reframed semantically (configurable workflow
  template instead of a fixed brand). The skill name is preserved per
  plan §06 worker assignment table.
- `ai-api-dev` decision gate was decided in-window per
  `feedback_decide_dont_ask` guidance. Reversible without code
  changes.

## Branch Status

```
$ git branch --show-current
feature/window-f-skills-suite-2026-05-19

$ git rev-parse --abbrev-ref @{upstream} || echo '(no upstream yet)'
(no upstream yet)
```

This branch is local-only. Total integrator should fetch with
`git fetch <worktree path> feature/window-f-skills-suite-2026-05-19`
or by pulling the branch directly.
