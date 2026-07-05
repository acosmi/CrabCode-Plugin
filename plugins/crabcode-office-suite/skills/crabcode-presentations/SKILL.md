---
name: crabcode-presentations
description: "Create, edit, parse, or merge .pptx slide decks: pitch decks, templates, layouts, speaker notes. 中文场景:演示文稿、幻灯片、路演材料、PPT 制作与内容提取。Trigger whenever a .pptx file or the words \"deck\", \"slides\", \"presentation\" are involved as input or output."
license: Apache-2.0. See docs/legal/THIRD_PARTY_NOTICES.md for source attribution.
---

# Presentation Workflows

## Purpose

This skill guides any task that produces or modifies a slide deck. The
deliverable must be a `.pptx` file on disk.

## Quick Reference

| Task                                  | Approach                                                  |
|---------------------------------------|-----------------------------------------------------------|
| Read or analyze content               | Extract text with a markdown converter; render thumbnails. |
| Create new deck from a template       | Unpack → mutate slide XML → repack.                       |
| Create new deck from scratch          | Use a programmatic library (`pptxgenjs`).                 |
| Combine or split decks                | Unpack each file, copy slide parts, repack.               |

## Recommended Library Stack

- `pptxgenjs`: primary TypeScript surface for authoring slides.
- `jszip`: low-level archive read and write for in-place edits.
- `fast-xml-parser` and `@xmldom/xmldom`: traverse and mutate
  `ppt/slides/slide*.xml` and related parts.
- A LibreOffice adapter: render to PDF or to image thumbnails.

The CrabCode office suite TypeScript runtime under
`plugins/crabcode-office-suite/src/pptx/` declares the stable surface
that adapters can plug into.

## Reading Content

For prose extraction, drive a markdown converter and feed the result into
downstream consumers. For visual review, render slide thumbnails to PNG or
JPG via the LibreOffice adapter. For low-level inspection or for edits not
expressible through `pptxgenjs`, unpack the archive and read
`ppt/slides/slide*.xml` directly.

## Editing Existing Decks

1. Capture the current visual state with a thumbnail render to anchor
   what each slide currently looks like.
2. Unpack the archive to a temporary directory.
3. Mutate slide XML or replace media parts as needed.
4. Repack the directory into a new `.pptx`.
5. Validate the result and re-render thumbnails for verification.

Common edit cases:

- **Replace placeholder text**: traverse `<a:t>` runs and replace the
  inner text. Re-merge adjacent runs if the replacement spans them.
- **Swap an image**: replace the media part under `ppt/media/`, update
  the slide's relationship file, and confirm that the image dimensions
  still fit the placeholder.
- **Duplicate or reorder slides**: copy slide parts and their relationship
  files, then regenerate slide numbers in
  `ppt/_rels/presentation.xml.rels`.

## Creating From Scratch

Use `pptxgenjs` when there is no template:

1. Plan the structure: title slide, content slides, conclusion. Decide
   the master and layout for each.
2. Build the deck declaratively. Each slide value should be a plain
   object that the renderer translates into pptxgenjs calls.
3. Save the deck to disk.
4. Validate by rendering thumbnails and inspecting the OOXML.

## Design Guidelines

Do not ship a plain bulleted deck on a white background. Apply these
principles deliberately on every slide.

### Before Starting

- **Pick a bold, topic-aware color palette.** The palette should look
  designed for this presentation, not generic.
- **Dominance over equality.** One color should carry the visual weight,
  with one or two supporting tones and a single sharp accent.
- **Dark and light rhythm.** Reserve dark backgrounds for title and
  conclusion slides and light backgrounds for content, or commit to a
  dark theme throughout when the brief supports it.
- **Visual motif.** Choose one distinctive structural element (rounded
  image frames, icon-in-circle row, thick single-side border) and repeat
  it consistently across the deck.

### Color Palette Inspiration

| Theme              | Primary       | Secondary     | Accent        |
|--------------------|---------------|---------------|---------------|
| Midnight Executive | `1E2761`      | `CADCFC`      | `FFFFFF`      |
| Forest and Moss    | `2C5F2D`      | `97BC62`      | `F5F5F5`      |
| Coral Energy       | `F96167`      | `F9E795`      | `2F3C7E`      |
| Warm Terracotta    | `B85042`      | `E7E8D1`      | `A7BEAE`      |
| Ocean Gradient     | `065A82`      | `1C7293`      | `21295C`      |
| Charcoal Minimal   | `36454F`      | `F2F2F2`      | `212121`      |
| Teal Trust         | `028090`      | `00A896`      | `02C39A`      |
| Berry and Cream    | `6D2E46`      | `A26769`      | `ECE2D0`      |
| Sage Calm          | `84B59F`      | `69A297`      | `50808E`      |
| Cherry Bold        | `990011`      | `FCF6F5`      | `2F3C7E`      |

### Per-slide Composition

- Every slide needs a visual anchor: image, chart, icon, or shape.
- Two-column layouts (text left, visual right) read well for content
  slides.
- Icon-plus-text rows with the icon inside a colored circle work for
  agendas and feature lists.
- Two-by-two or two-by-three grids work for comparisons or service
  catalogs.
- Half-bleed images with overlay text work for opening slides and
  section dividers.
- Use large stat callouts (60-72pt) with small labels for headline
  metrics.

### Typography

- Pair a distinctive heading font with a clean body font.
- Use one font family per role. Mixing more than two families distracts
  from the content.
- Keep heading sizes consistent across slides; do not freestyle.

### Speaker Notes

When the user asks for notes, generate them in plain prose alongside the
slide. Notes should be specific, actionable, and free of marketing
hyperbole.

## Validation

Every deck must pass OOXML validation before delivery and should be
rendered to thumbnails for visual confirmation. Common failures:

- **Missing or stale relationship file**: edits to slide ordering need
  matching updates to `ppt/_rels/presentation.xml.rels`.
- **Image missing from media folder**: a slide references an image that
  was deleted from `ppt/media/` during edits.
- **Inconsistent slide numbering**: occurs when slides are duplicated
  without updating relationship references.

## Code Style

- Keep slide builders declarative; map plain slide data to library calls
  inside a single helper.
- Avoid magic numbers for positions; centralize layout constants near
  the master definition.
- Validate inputs early and fail with a clear error before invoking the
  renderer.
