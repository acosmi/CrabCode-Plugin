---
name: web-artifacts-builder
description: "Build complex, multi-component HTML artifacts using a modern frontend stack (React + Tailwind CSS + shadcn/ui). Use this skill when an artifact needs state management, routing, or shadcn/ui components. Avoid this skill for simple single-file HTML or JSX artifacts; those should ship as-is."
license: Apache-2.0. See ../../docs/legal/THIRD_PARTY_NOTICES.md for source attribution.
---

# Web Artifacts Builder

To build powerful HTML artifacts that bundle into a single deliverable
file, follow this workflow:

1. Initialize the frontend repo using `scripts/init-artifact.sh`.
2. Develop the artifact by editing the generated code.
3. Bundle all code into a single HTML file using
   `scripts/bundle-artifact.sh`.
4. Deliver the artifact to the user.
5. Optionally test the artifact in a headless browser.

**Stack**: React 18 + TypeScript + Vite + Parcel (bundling) + Tailwind
CSS + shadcn/ui.

## Design and Style Guidelines

To avoid the generic AI aesthetic, do not lean on:

- Excessive centered layouts.
- Purple gradients.
- Uniform rounded corners.
- The default `Inter` font.

Instead, commit to a clear aesthetic direction informed by the brief
(refer to the `frontend-design` skill for deeper guidance).

## Quick Start

### Step 1 — Initialize

```bash
bash scripts/init-artifact.sh <project-name>
cd <project-name>
```

The script creates a fully configured project:

- React + TypeScript via Vite.
- Tailwind CSS 3.4.x with a shadcn/ui theming system.
- Path aliases (`@/`) preconfigured.
- 40+ shadcn/ui components pre-installed.
- All required Radix UI dependencies.
- Parcel configured for single-file bundling via `.parcelrc`.
- Node 18+ compatibility (auto-detects and pins the Vite version).

### Step 2 — Develop

Edit the generated files. The component library and theming are ready
out of the box, so most edits are at the component or page level.

### Step 3 — Bundle

```bash
bash scripts/bundle-artifact.sh
```

The script produces `bundle.html`, a self-contained artifact with all
JavaScript, CSS, and dependencies inlined. The file can be shared
directly in any chat surface that renders HTML attachments.

**Requirements**: the project must have an `index.html` at the
repository root.

Internally, the script:

- Installs bundling dependencies (parcel, `@parcel/config-default`,
  `parcel-resolver-tspaths`, `html-inline`).
- Writes a `.parcelrc` with path alias support.
- Builds with Parcel (no source maps).
- Inlines all assets into a single HTML using `html-inline`.

### Step 4 — Deliver

Share the bundled HTML file with the user. The artifact opens in any
modern browser without additional setup.

### Step 5 — Optional Testing

Testing is optional and adds latency. If verification is requested or
issues are reported after delivery, use available browser automation
tooling (such as a Playwright wrapper or the `webapp-testing` skill).

## Reference

- shadcn/ui components: <https://ui.shadcn.com/docs/components>.
- Tailwind CSS docs: <https://tailwindcss.com/docs>.
- React 18 docs: <https://react.dev>.
