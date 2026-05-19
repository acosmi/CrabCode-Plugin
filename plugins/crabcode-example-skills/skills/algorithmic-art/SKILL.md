---
name: algorithmic-art
description: "Create algorithmic art with p5.js, seeded randomness, and parameter exploration. Use this skill when the user requests generative art, flow fields, particle systems, or any code-driven aesthetic piece. Produce original algorithmic art rather than imitating any specific human artist's style."
license: Apache-2.0. See ../../docs/legal/THIRD_PARTY_NOTICES.md for source attribution.
---

# Algorithmic Art

An algorithmic philosophy is a computational aesthetic stance expressed
through code. Deliverables come in three files:

- A `.md` file capturing the philosophy.
- An `.html` file with the interactive viewer.
- One or more `.js` files implementing the generative algorithm.

The pipeline has two stages: create the philosophy, then express it as
p5.js code.

## Stage 1 — Algorithmic Philosophy

Write a philosophy, not a static image plan. The philosophy must be
interpretable through:

- Computational processes, emergent behavior, mathematical structure.
- Seeded randomness, noise fields, organic systems.
- Particles, flows, fields, and forces.
- Parametric variation and controlled chaos.

### Critical Framing

- **Input**: the user's brief is a foundation, not a constraint. Treat it
  as creative seed material.
- **Output of this stage**: an algorithmic philosophy. A worldview that
  describes how visual beauty will emerge from computation.
- **Next stage**: the same agent receives this philosophy and writes
  p5.js code that is roughly 90 percent algorithmic generation and 10
  percent essential parameters.

The philosophy must emphasize algorithmic expression, emergent behavior,
computational beauty, and seeded variation.

### How to Generate a Philosophy

**Name the movement** (one or two words): `Organic Turbulence`,
`Quantum Harmonics`, `Emergent Stillness`.

**Articulate the philosophy** in four to six concise paragraphs. Capture
how it manifests through:

- Computational processes and mathematical relationships.
- Noise functions and randomness patterns.
- Particle behavior and field dynamics.
- Temporal evolution and system states.
- Parametric variation and emergent complexity.

### Guidelines

- **Avoid redundancy**. Each algorithmic aspect appears once unless a
  later mention adds depth.
- **Emphasize craftsmanship**. The philosophy must repeatedly stress
  that the final algorithm should feel meticulously refined and should
  read as the product of deep expertise. Use phrases such as
  "meticulously crafted algorithm", "deep computational expertise",
  "painstaking optimization", and "master-level implementation".
- **Leave creative room**. Be specific about the algorithmic direction
  while leaving space for interpretive implementation choices.

### Examples

**Organic Turbulence**. Chaos constrained by natural law, order emerging
from disorder. Flow fields driven by layered Perlin noise. Thousands of
particles follow vector forces; their trails accumulate into organic
density maps. Multiple noise octaves create turbulent regions and calm
zones. Color emerges from velocity and density; fast particles burn
bright, slow ones fade to shadow. The algorithm runs until equilibrium
— a balance that reads as the product of countless tuning iterations.

**Quantum Harmonics**. Discrete entities exhibit wave-like interference
patterns. Particles initialized on a grid carry phase values that evolve
through sine waves. Near-by particles interfere; constructive
interference creates bright nodes, destructive creates voids. Simple
harmonic motion generates complex emergent mandalas. The result reads as
painstaking frequency calibration.

**Recursive Whispers**. Self-similarity across scales; infinite depth in
finite space. Branching structures subdivide recursively. Each branch is
slightly randomized but constrained by golden ratios. L-systems or
recursive subdivision generate tree-like forms that feel both
mathematical and organic. Subtle noise perturbations break perfect
symmetry. Line weights diminish with each recursion level.

**Field Dynamics**. Invisible forces made visible through their effects
on matter. Vector fields are constructed from mathematical functions or
noise. Particles are born at edges, flow along field lines, and die at
equilibrium or boundaries. Multiple fields can attract, repel, or rotate
particles. The visualization shows only the traces — ghost-like evidence
of invisible forces.

**Stochastic Crystallization**. Random processes crystallize into
ordered structures. Randomized circle packing or Voronoi tessellation
starts with random points, then relaxation drives cells apart until
equilibrium. Color follows cell size, neighbor count, or radial
distance. The organic tiling feels random yet inevitable.

These examples are condensed. Actual philosophies should span four to
six substantial paragraphs.

### Essential Principles

- **Algorithmic philosophy**: a computational worldview that code will
  express.
- **Process over product**: beauty emerges during execution; each seed
  produces a unique frame.
- **Parametric expression**: ideas communicate through mathematical
  relationships, forces, and behavior — not through static composition.
- **Artistic freedom**: leave room for interpretive implementation.
- **Pure generative art**: produce living algorithms, not static images
  with a sprinkle of randomness.
- **Expert craftsmanship**: the algorithm should feel meticulously
  refined, the product of deep expertise.

Output the philosophy as a single `.md` file with four to six
paragraphs.

## Stage 2 — Conceptual Seed

Before implementation, identify a subtle conceptual thread from the
original brief. The reference should be embedded in algorithmic
parameters, behavior, and emergence patterns — not in literal symbols.
Someone familiar with the subject should feel it intuitively, while
everyone else simply experiences a masterful generative composition.

## Stage 3 — p5.js Implementation

With the philosophy and conceptual seed in hand, express the work as
code. Use only the philosophy above and the rules in this section.

### Read the Viewer Template First

Before writing any HTML, read the bundled viewer template at
`templates/viewer.html`. Treat it as the literal starting point:

1. Keep the fixed sections of the template intact: header, sidebar
   structure, fonts, seed controls, action buttons.
2. Replace only the variable sections marked in the template comments:
   the algorithm body, the parameter list, and the UI controls for
   those parameters.

Avoid the following:

- Building HTML from scratch.
- Inventing custom styling or color schemes that conflict with the
  template.
- Defaulting to generic system fonts or unmotivated dark themes.
- Modifying the sidebar structure.

### Seeded Randomness

Every algorithm must be deterministic for a given seed. Expose the seed
in the viewer and route every `Math.random` or `noise` call through the
seed.

### Parameter Surface

Expose four to eight named parameters. Each parameter must have a
sensible default and a documented range. The viewer should make every
parameter adjustable interactively.

### Quality Bar

The algorithm should feel meticulously crafted. Tune defaults so that
the first frame already looks intentional. Add documentation comments
near non-obvious mathematical expressions so a reader can trace the
intent.

## Deliverables

For each piece, deliver:

- `philosophy.md`: the algorithmic philosophy.
- `viewer.html`: the interactive viewer derived from the template.
- `algorithm.js`: the p5.js implementation.

Optionally include a `README.md` with seed examples and screenshot
references.
