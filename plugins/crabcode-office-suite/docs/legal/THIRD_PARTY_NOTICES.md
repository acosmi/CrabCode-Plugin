# Third Party Notices — crabcode-office-suite

This plugin contains skill prompts and structural conventions adapted from the
upstream `anthropic-skills` repository (commit `6a5bb06904ab164a345e41c381fc9097954b83da`).
The upstream source is distributed under proprietary terms; see
`bangong/anthropic-skills/skills/<source-skill>/LICENSE.txt` in the source
cache for each component. Source attribution is retained here for legal
traceability and is intentionally out-of-band from the product-facing skill
prompts.

| CrabCode skill                | Upstream source skill                         |
|-------------------------------|-----------------------------------------------|
| crabcode-spreadsheets         | anthropic-skills/skills/xlsx                  |
| crabcode-documents            | anthropic-skills/skills/docx                  |
| crabcode-presentations        | anthropic-skills/skills/pptx                  |
| crabcode-pdf                  | anthropic-skills/skills/pdf                   |

Runtime helpers in this plugin reference third-party libraries that
downstream packagers should evaluate before installation:

- `exceljs` (MIT) — proposed xlsx authoring engine
- `docx` (MIT), `jszip` (MIT or GPL-2.0), `fast-xml-parser` (MIT),
  `@xmldom/xmldom` (LGPL-2.1 or MIT dual) — proposed docx editing engines
- `pptxgenjs` (MIT) — proposed pptx authoring engine
- `pdf-lib` (MIT), `pdfjs-dist` (Apache-2.0) — proposed pdf engines

No third-party engine is installed by this plugin alone. The runtime
publishes a stable surface so that downstream owners can wire engines in
without disturbing the skill prompts or the CLI contract.
