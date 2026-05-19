---
name: theme-factory
description: "Toolkit for styling artifacts with a theme. Artifacts include slide decks, documents, reports, HTML landing pages, and similar visual outputs. There are ten preset themes with color palettes and font pairings, and the skill can also generate a new theme on demand."
license: Apache-2.0. See ../../docs/legal/THIRD_PARTY_NOTICES.md for source attribution.
---

# Theme Factory

This skill provides a curated collection of professional color and
font themes. Once a theme is chosen, apply it to any compatible
artifact.

## Purpose

Apply consistent, professional styling to presentation decks,
documents, and other visual artifacts. Each theme includes:

- A cohesive color palette with hex codes.
- Complementary font pairings for headings and body text.
- A distinct visual identity suitable for different contexts and
  audiences.

## Workflow

1. **Showcase**. Display `theme-showcase.pdf` so the user can compare
   themes visually. Do not modify the showcase file; render it for
   inspection only.
2. **Selection**. Ask the user which theme to apply.
3. **Confirmation**. Wait for explicit confirmation before applying.
4. **Application**. Apply the selected theme's colors and fonts to
   the target artifact.

## Built-in Themes

The bundled `theme-showcase.pdf` highlights ten themes:

1. **Ocean Depths** — professional and calming maritime palette.
2. **Sunset Boulevard** — warm and vibrant sunset colors.
3. **Forest Canopy** — natural, grounded earth tones.
4. **Modern Minimalist** — clean and contemporary grayscale.
5. **Golden Hour** — rich and warm autumnal palette.
6. **Arctic Frost** — cool and crisp winter palette.
7. **Desert Rose** — soft and sophisticated dusty tones.
8. **Tech Innovation** — bold and modern tech aesthetic.
9. **Botanical Garden** — fresh and organic garden palette.
10. **Midnight Galaxy** — dramatic and cosmic deep tones.

Each theme is defined in the `themes/` directory with a full
specification: color palette with hex codes, font pairings, and a
description of the intended visual identity.

## Application Process

Once a theme has been selected:

1. Read the corresponding file in the `themes/` directory.
2. Apply the colors and fonts consistently across the artifact.
3. Verify contrast and legibility on every slide, page, or section.
4. Maintain the visual identity throughout the artifact.

## Custom Themes

When none of the built-in themes fit, generate a custom theme:

1. Gather inputs from the user (mood, audience, accent colors,
   typography preferences).
2. Produce a theme similar in shape to the built-ins: name, palette,
   font pairing, intended use cases.
3. Show the new theme for review and explicit approval.
4. Apply the approved theme using the standard application process.
