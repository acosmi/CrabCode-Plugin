---
name: canvas-design
description: "Create beautiful visual art in .png and .pdf documents using a design philosophy. Use this skill when the user asks for a poster, piece of art, design artifact, or other static visual piece. Produce original visual designs; never copy a specific living artist's identifiable style."
license: Apache-2.0. See ../../docs/legal/THIRD_PARTY_NOTICES.md for source attribution.
---

<!-- capability-route: office-pdf=none(PDF here is this skill's own art-canvas rendering target alongside PNG; the file is produced by the skill's design pipeline, not an office-document deliverable to route) -->

# Canvas Design

This skill creates a design philosophy — an aesthetic movement — and
then expresses it visually on a canvas. Deliverables are `.md`, `.pdf`,
and `.png` files only.

The pipeline has two stages: create the philosophy, then produce the
canvas.

## Stage 1 — Design Philosophy

Write a visual philosophy, not a layout or template. The philosophy is
interpretable through:

- Form, space, color, and composition.
- Images, graphics, shapes, and patterns.
- Minimal text used as a visual accent.

### Critical Framing

- **Input**: the user's brief is a foundation, not a constraint.
- **Output of this stage**: a visual philosophy — an aesthetic
  worldview.
- **Next stage**: the same agent receives this philosophy and produces
  artifacts that are roughly 90 percent visual design and 10 percent
  essential text.

The philosophy must emphasize visual expression, spatial communication,
artistic interpretation, and minimal words.

### How to Generate a Visual Philosophy

**Name the movement** (one or two words): `Brutalist Joy`,
`Chromatic Silence`, `Metabolist Dreams`.

**Articulate the philosophy** in four to six concise paragraphs. Capture
how it manifests through:

- Space and form.
- Color and material.
- Scale and rhythm.
- Composition and balance.
- Visual hierarchy.

### Guidelines

- **Avoid redundancy**: each design aspect appears once unless a later
  mention adds depth.
- **Emphasize craftsmanship**: the philosophy must repeatedly stress
  that the final work should read as meticulously crafted, the product
  of deep expertise. Use phrases such as "meticulously crafted",
  "the product of deep expertise", "painstaking attention", and
  "master-level execution".
- **Leave creative room**: be specific about direction while leaving
  space for interpretive choices.

### Examples

**Concrete Poetry**. Communication through monumental form and bold
geometry. Massive color blocks, sculptural typography (huge single
words, tiny labels), brutalist spatial divisions, Polish poster energy
meeting Le Corbusier. Ideas expressed through weight and tension. Text
is a rare gesture integrated into the visual architecture.

**Chromatic Language**. Color as the primary information system.
Geometric precision; color zones create meaning. Typography is minimal;
small sans-serif labels let chromatic fields communicate. Information
encoded spatially and chromatically. Words anchor what color already
shows.

**Analog Meditation**. Quiet visual contemplation through texture and
breathing room. Paper grain, ink bleeds, vast negative space.
Photography and illustration dominate. Typography is whispered. Images
breathe across pages. Text appears sparingly — short phrases, never
explanatory blocks.

**Organic Systems**. Natural clustering and modular growth patterns.
Rounded forms, organic arrangements, color drawn from nature.
Information shown through visual diagrams, spatial relationships, and
iconography. Text labels float in space.

**Geometric Silence**. Pure order and restraint. Grid-based precision,
bold photography or stark graphics, dramatic negative space. Typography
is small and essential; large quiet zones do most of the work. Swiss
formalism meets brutalist material honesty.

These examples are condensed. Actual philosophies should span four to
six substantial paragraphs.

### Essential Principles

- **Visual philosophy**: an aesthetic worldview expressed through
  design.
- **Minimal text**: text is sparse, integrated as a visual element.
- **Spatial expression**: ideas communicate through space, form, color,
  and composition.
- **Artistic freedom**: leave room for interpretive choices.
- **Pure design**: produce art objects, not decorated documents.
- **Expert craftsmanship**: the work must look meticulously crafted,
  the product of deep expertise.

Output the philosophy as a single `.md` file with four to six
paragraphs.

## Stage 2 — Subtle Reference

Before creating the canvas, identify a subtle conceptual thread from
the original brief. Embed the reference in form, color, and composition
rather than in literal symbols. People familiar with the subject should
feel the reference intuitively; others should still experience a
masterful abstract composition.

## Stage 3 — Canvas Creation

Use the philosophy and the conceptual thread to produce a single-page
PDF or PNG by default (more pages only when requested). General
guidance:

- Use repeating patterns and exact shapes.
- Borrow the visual language of systematic observation: dense
  accumulation of marks, repeated elements, layered patterns that
  build meaning through patient repetition.
- Add sparse, clinical typography and systematic reference markers.
- Anchor the piece with subtle phrases or details.
- Use a limited, intentional color palette.

### Text Discipline

- Text is minimal and visual-first.
- Use larger, more aggressive type only when the brief supports it
  (for example, a punk venue poster).
- Fonts should usually be thin and design-forward.
- Nothing falls off the page; nothing overlaps. Every element sits
  inside the canvas with intentional margins.
- For inline text in artistic compositions, consider integrating the
  typography into the artwork rather than typesetting it digitally.

When custom fonts are needed, install them deliberately and confirm
that the install survives bundling.

### Quality Bar

The final work must look like it took deep effort. Composition,
spacing, color, and typography must all read as expert-level. Verify
that nothing overlaps and that formatting is flawless before delivery.

## Final Refinement Pass

After the first version, take a second pass focused on refinement
rather than addition. Improve cohesion, alignment, and color
relationships instead of inserting new elements. If the impulse is to
draw a new shape, first ask whether the existing composition can be
sharpened.

## Multi-Page Option

When more pages are requested, treat the first page as one entry in a
coffee-table set. Each new page should follow the same philosophy
through a distinctly different composition so the sequence reads as a
considered set rather than variations on one image.

## Deliverables

- `philosophy.md` — the design philosophy.
- One or more `.pdf` or `.png` files — the final visual output.
