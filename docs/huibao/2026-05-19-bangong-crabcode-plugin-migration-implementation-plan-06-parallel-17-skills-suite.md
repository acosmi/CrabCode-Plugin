# Parallel 17: upstream vendor Skills Marketplace Suites

Date: 2026-05-19
Parallelism: 17 workers
Source root: `bangong/upstream-skills`

## Scope

This batch covers the three marketplace entries and seventeen skill folders under `bangong/upstream-skills`.

Marketplace entries:

- `document-skills`
- `example-skills`
- `ai-api`

Skill folders:

- `algorithmic-art`
- `brand-guidelines`
- `canvas-design`
- `ai-api`
- `doc-coauthoring`
- `docx`
- `frontend-design`
- `internal-comms`
- `mcp-builder`
- `pdf`
- `pptx`
- `skill-creator`
- `slack-gif-creator`
- `theme-factory`
- `web-artifacts-builder`
- `webapp-testing`
- `xlsx`

## Target Plugin Grouping

Use three CrabCode plugins:

1. `crabcode-office-suite`
   - `xlsx`
   - `docx`
   - `pptx`
   - `pdf`

2. `crabcode-example-skills`
   - `algorithmic-art`
   - `brand-guidelines`
   - `canvas-design`
   - `doc-coauthoring`
   - `frontend-design`
   - `internal-comms`
   - `mcp-builder`
   - `skill-creator`
   - `slack-gif-creator`
   - `theme-factory`
   - `web-artifacts-builder`
   - `webapp-testing`

3. `ai-api-dev`
   - `ai-api`, rewritten for the target API surface chosen by CrabCode maintainers.

## Worker Assignments

| Worker | Source Skill | Target Plugin | Target Skill |
|---|---|---|---|
| SK-01 | `skills/xlsx` | `crabcode-office-suite` | `crabcode-spreadsheets` |
| SK-02 | `skills/docx` | `crabcode-office-suite` | `crabcode-documents` |
| SK-03 | `skills/pptx` | `crabcode-office-suite` | `crabcode-presentations` |
| SK-04 | `skills/pdf` | `crabcode-office-suite` | `crabcode-pdf` |
| SK-05 | `skills/algorithmic-art` | `crabcode-example-skills` | `algorithmic-art` |
| SK-06 | `skills/brand-guidelines` | `crabcode-example-skills` | `brand-guidelines` |
| SK-07 | `skills/canvas-design` | `crabcode-example-skills` | `canvas-design` |
| SK-08 | `skills/doc-coauthoring` | `crabcode-example-skills` | `doc-coauthoring` |
| SK-09 | `skills/frontend-design` | `crabcode-example-skills` | `frontend-design` |
| SK-10 | `skills/internal-comms` | `crabcode-example-skills` | `internal-comms` |
| SK-11 | `skills/mcp-builder` | `crabcode-example-skills` | `mcp-builder` |
| SK-12 | `skills/skill-creator` | `crabcode-example-skills` | `skill-creator` |
| SK-13 | `skills/slack-gif-creator` | `crabcode-example-skills` | `slack-gif-creator` |
| SK-14 | `skills/theme-factory` | `crabcode-example-skills` | `theme-factory` |
| SK-15 | `skills/web-artifacts-builder` | `crabcode-example-skills` | `web-artifacts-builder` |
| SK-16 | `skills/webapp-testing` | `crabcode-example-skills` | `webapp-testing` |
| SK-17 | `skills/ai-api` | `ai-api-dev` | `ai-api-dev` |

## Office Suite TypeScript Runtime

`crabcode-office-suite` should have TS runtime helpers:

```text
plugins/crabcode-office-suite/
  .crabcode-plugin/plugin.json
  package.json
  tsconfig.json
  src/
    cli.ts
    xlsx/
    docx/
    pptx/
    pdf/
    common/
  skills/
    crabcode-spreadsheets/SKILL.md
    crabcode-documents/SKILL.md
    crabcode-presentations/SKILL.md
    crabcode-pdf/SKILL.md
```

Suggested libraries:

- XLSX: `exceljs`
- DOCX: `docx`, `jszip`, `fast-xml-parser`, `@xmldom/xmldom`
- PPTX: `pptxgenjs`, `jszip`, optional image conversion adapters
- PDF: `pdf-lib`, `pdfjs-dist`, optional Poppler/qpdf adapters

## Skill Rewrite Rules

- Keep trigger descriptions concise and CrabCode-native.
- Move long technical details into `references/` files.
- Keep `SKILL.md` under 500 lines where possible.
- Keep references one level deep.
- Runtime scripts must be TS when bundled with the plugin.
- Do not preserve upstream product author names in document comments, tracked changes, examples, or defaults.

## `ai-api-dev` Decision Gate

Before converting `ai-api`, the maintainer must choose the target:

- CrabCode API docs
- OpenAI API docs
- provider-neutral LLM application guidance

Do not ship a product-facing API skill that points users back to legacy-branded SDKs.

## Validation

For each suite:

```bash
bun run scripts/lint-brand.ts plugins/<plugin-name>
crabcode plugin validate /Users/fushihua/Desktop/CrabCode-Plugin/plugins/<plugin-name>
```

For `crabcode-office-suite`:

```bash
bun install
bun run typecheck
bun test
bun run build
```

## Acceptance

The batch is complete when all 17 source skills are mapped to one of the three CrabCode plugins and every mapped skill has CrabCode-native frontmatter, workflow text, and validation notes.
