# Visual Design Reference

Design system for generated assets. Apply these styles in Phase 4. Default to a dark theme with the prospect's brand color as the accent.

## Color System

```css
:root {
    /* === Prospect Brand (Primary) === */
    --brand-primary: #[extracted from research];
    --brand-secondary: #[extracted];
    --brand-primary-rgb: [r, g, b]; /* For rgba() usage */

    /* === Dark Theme Base === */
    --bg-primary: #0a0d14;
    --bg-elevated: #0f131c;
    --bg-surface: #161b28;
    --bg-hover: #1e2536;

    /* === Text === */
    --text-primary: #ffffff;
    --text-secondary: rgba(255, 255, 255, 0.7);
    --text-muted: rgba(255, 255, 255, 0.5);

    /* === Accent === */
    --accent: var(--brand-primary);
    --accent-hover: var(--brand-secondary);
    --accent-glow: rgba(var(--brand-primary-rgb), 0.3);

    /* === Status === */
    --success: #10b981;
    --warning: #f59e0b;
    --error: #ef4444;
}
```

## Typography

```css
/* Primary: Clean, professional sans-serif */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

/* Headings */
h1: 2.5rem, font-weight: 700
h2: 1.75rem, font-weight: 600
h3: 1.25rem, font-weight: 600

/* Body */
body: 1rem, font-weight: 400, line-height: 1.6

/* Captions/Labels */
small: 0.875rem, font-weight: 500
```

## Visual Elements

**Cards:**
- Background: `var(--bg-surface)`
- Border: 1px solid rgba(255,255,255,0.1)
- Border-radius: 12px
- Box-shadow: subtle, layered
- Hover: slight elevation, border glow

**Buttons:**
- Primary: `var(--accent)` background, white text
- Secondary: transparent, accent border
- Hover: brightness increase, subtle scale

**Animations:**
- Transitions: 200-300ms ease
- Tab switches: fade + slide
- Hover states: smooth, not jarring
- Loading: subtle pulse or skeleton

## Workflow Demo Specific

**Component Nodes:**
```css
.node {
    background: var(--bg-surface);
    border: 2px solid var(--brand-primary);
    border-radius: 12px;
    padding: 16px;
    min-width: 140px;
}

.node.active {
    box-shadow: 0 0 20px var(--accent-glow);
    border-color: var(--accent);
}

.node.human {
    border-color: #f59e0b; /* Warm color for humans */
}

.node.ai {
    background: linear-gradient(135deg, var(--bg-surface), var(--bg-elevated));
    border-color: var(--accent);
}
```

**Flow Arrows:**
```css
.arrow {
    stroke: var(--text-muted);
    stroke-width: 2;
    fill: none;
    marker-end: url(#arrowhead);
}

.arrow.active {
    stroke: var(--accent);
    stroke-dasharray: 8 4;
    animation: flowDash 1s linear infinite;
}
```

**Canvas:**
```css
.canvas {
    background:
        radial-gradient(circle at center, var(--bg-elevated) 0%, var(--bg-primary) 100%),
        url("data:image/svg+xml,..."); /* Subtle grid pattern */
    overflow: auto;
}
```
