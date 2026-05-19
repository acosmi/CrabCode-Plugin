# Third Party Notices — crabcode-example-skills

This plugin contains skill prompts adapted from the upstream
`anthropic-skills` repository (commit
`6a5bb06904ab164a345e41c381fc9097954b83da`). The upstream source is
distributed under proprietary terms; see
`bangong/anthropic-skills/skills/<source-skill>/LICENSE.txt` in the
source cache for each component. Source attribution is retained here
for legal traceability and is intentionally out-of-band from the
product-facing skill prompts.

| CrabCode skill         | Upstream source skill                           |
|------------------------|-------------------------------------------------|
| algorithmic-art        | anthropic-skills/skills/algorithmic-art         |
| brand-guidelines       | anthropic-skills/skills/brand-guidelines        |
| canvas-design          | anthropic-skills/skills/canvas-design           |
| doc-coauthoring        | anthropic-skills/skills/doc-coauthoring         |
| frontend-design        | anthropic-skills/skills/frontend-design         |
| internal-comms         | anthropic-skills/skills/internal-comms          |
| mcp-builder            | anthropic-skills/skills/mcp-builder             |
| skill-creator          | anthropic-skills/skills/skill-creator           |
| slack-gif-creator      | anthropic-skills/skills/slack-gif-creator       |
| theme-factory          | anthropic-skills/skills/theme-factory           |
| web-artifacts-builder  | anthropic-skills/skills/web-artifacts-builder   |
| webapp-testing         | anthropic-skills/skills/webapp-testing          |

The `brand-guidelines` skill in this plugin is a workflow template,
not an embedding of any specific organization's brand assets. The
upstream skill described a specific corporate brand identity; the
CrabCode rewrite removes vendor-specific colors, fonts, and brand
references in favor of a configurable workflow.
