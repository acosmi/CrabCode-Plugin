# Third Party Notices — ai-api-dev

This plugin contains skill prompts adapted from the upstream
`anthropic-skills` repository (commit
`6a5bb06904ab164a345e41c381fc9097954b83da`), specifically the
`claude-api` skill. The upstream source is distributed under
proprietary terms; see
`bangong/anthropic-skills/skills/claude-api/LICENSE.txt` in the source
cache. Source attribution is retained here for legal traceability and
is intentionally out-of-band from the product-facing skill prompts.

| CrabCode skill | Upstream source skill            |
|----------------|----------------------------------|
| ai-api-dev     | anthropic-skills/skills/claude-api |

This plugin departs structurally from the upstream by:

- Reframing the workflow as provider-neutral guidance rather than a
  single-vendor SDK guide.
- Removing vendor-specific model identifiers, version strings, and
  links.
- Replacing references to a specific provider's managed-agent product
  with a provider-neutral decision surface.

The CrabCode maintainers reserve the option to later specialize this
skill toward a specific provider or a CrabCode-hosted gateway. Until
that decision is made, the plugin remains provider-neutral.
