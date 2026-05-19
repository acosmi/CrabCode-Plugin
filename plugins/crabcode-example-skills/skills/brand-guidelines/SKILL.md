---
name: brand-guidelines
description: "Apply a project-specific visual identity (color palette, typography, accent shapes) to an artifact such as a presentation, document, slide deck, or HTML page. Use this skill when the user asks to apply a brand or style guide, when artifacts must follow a corporate visual identity, or when a deck needs consistent post-processing for colors and fonts. This skill is a workflow template; supply the actual brand assets through configuration."
license: Apache-2.0. See ../../docs/legal/THIRD_PARTY_NOTICES.md for source attribution.
---

# Brand Guidelines Workflow

## Purpose

Provide a repeatable workflow for applying a project-specific or
organization-specific visual identity to artifacts. This skill is the
workflow template; the actual brand assets (colors, fonts, logos) must
be supplied by the user or stored in a configuration file alongside the
artifact.

**Keywords**: branding, visual identity, post-processing, styling,
brand colors, typography, visual formatting, visual design.

## Inputs

The workflow expects:

- A target artifact (slides, document, HTML, image set).
- A brand specification, either inline in the conversation or loaded
  from a JSON or YAML config. The specification must declare:
  - Main color palette (3 to 5 colors with hex values and intended
    usage labels such as "primary text", "background", "accent").
  - Accent color palette (1 to 3 accent colors).
  - Heading and body font pairing (font name plus a documented
    fallback chain).

When the user has not provided a brand specification, ask for one
before proceeding. Do not invent brand assets.

## Workflow

1. Read the brand specification.
2. Inspect the target artifact and identify the elements that need
   restyling (titles, body paragraphs, accent shapes, backgrounds).
3. Apply colors and fonts deterministically:
   - Headings use the heading font; body text uses the body font.
   - Color usage follows the labels in the specification.
   - Non-text shapes cycle through accent colors in declared order.
4. Verify legibility: confirm that text on every background meets a
   readable contrast ratio.
5. Deliver the styled artifact and, when relevant, a short summary
   describing which elements changed.

## Default Heuristics

Use the following defaults only when the user explicitly delegates the
choice and the brand specification is silent:

- Heading sizes greater than or equal to 24pt use the heading font.
- Body sizes less than 24pt use the body font.
- When custom fonts are unavailable, fall back to Arial for headings
  and Georgia for body text. Document the fallback in the delivery
  report.
- Accent colors cycle in the declared order across non-text shapes.

## Output Surfaces

This skill supports applying brand styling to:

- Presentations: drive `pptxgenjs` or unpack-edit-repack workflows
  through the `crabcode-presentations` skill.
- Documents: drive the `docx` library through the `crabcode-documents`
  skill.
- HTML and web artifacts: drive CSS variables or Tailwind theme
  extensions through the `frontend-design` skill.

## Do Not

- Do not embed a specific vendor's brand assets into this skill.
- Do not assume a particular font or color when no specification has
  been provided.
- Do not overwrite an existing brand assignment without explicit user
  consent.

## Validation

After applying styling, validate that:

- All text on dark backgrounds remains legible.
- Font fallback chains render acceptably when the primary font is
  unavailable.
- Accent colors are applied consistently across the artifact.
