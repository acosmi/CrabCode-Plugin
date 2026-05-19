---
name: slack-gif-creator
description: "Knowledge and utilities for creating animated GIFs optimized for Slack. Use this skill when the user asks for an animated GIF for Slack — for example, \"make me a GIF of X doing Y for Slack\" — including emoji-sized GIFs and message-sized GIFs."
license: Apache-2.0. See ../../docs/legal/THIRD_PARTY_NOTICES.md for source attribution.
---

# Slack GIF Creator

A workflow for producing animated GIFs that fit Slack's emoji and
message constraints.

## Slack Constraints

**Dimensions.**

- Emoji GIFs: 128 × 128 pixels (recommended).
- Message GIFs: 480 × 480 pixels.

**Animation parameters.**

- FPS: 10-30. Lower FPS reduces file size.
- Color palette: 48-128 colors. Fewer colors reduce file size.
- Duration: keep emoji GIFs under three seconds.

## Core Workflow

1. **Plan**: pick subject, target size, frame count, and color palette.
   Confirm whether the GIF is an emoji or a message GIF.
2. **Generate frames**: produce N frames using a 2D drawing library
   (Pillow in Python, `canvas` in Node, or a similar primitive set).
3. **Compose**: assemble the frames into a GIF with the chosen FPS,
   palette size, and dither settings.
4. **Optimize**: minimize palette and drop redundant frames so the
   final file size respects Slack's upload ceiling.
5. **Preview**: open the GIF locally and confirm it animates as
   intended before sharing.

## Drawing Graphics

### Working With User-Provided Images

If the user uploads an image, decide whether they want to:

- Use it directly (animate the image, split it into frames).
- Use it as inspiration for a new animation (palette and style cues
  only).

Confirm the intent before proceeding.

### Drawing From Scratch

When drawing from scratch, prefer primitive shapes (circles, polygons,
lines, rectangles) layered over a solid background. Keep the silhouette
readable at the target size — emoji GIFs are tiny.

## Palette and Color

- Pick three to five core colors aligned with the brief.
- Use a limited dither so the file stays small.
- Reserve one accent color for motion highlights.

## Motion Patterns

Useful motion idioms:

- **Loop**: end frames match start frames so the GIF cycles cleanly.
- **Ease**: vary frame spacing to imply acceleration or deceleration.
- **Hold**: a longer hold at the start anchors the viewer.
- **Reveal**: progressive draw or wipe of the main subject.
- **Bounce**: simple physics for objects entering or exiting the
  frame.

## Validation

Before delivery, confirm:

- File size is within Slack's upload limit for the target use
  (emoji vs. message).
- The animation loops without a hitch.
- The subject is readable at the rendered size.

## Reference Examples

The bundled `references/` directory (when present) holds:

- `palettes.md` — color palettes that survive aggressive
  quantization.
- `motion.md` — common motion idioms with frame-count guidance.
- `examples/` — sample frame sequences and final GIFs.

Load these files only when the current task benefits from the extra
detail.
