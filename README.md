# CrabCode Setup

CrabCode Setup analyzes a local repository and recommends high-value CrabCode automations. It is read-only by default: it reports what would help, but it does not create files, install plugins, or change settings.

## Usage

```bash
bun install
bun run analyze -- --cwd /path/to/project --format markdown
```

For machine-readable output:

```bash
bun run analyze -- --cwd /path/to/project --format json
```

## Checks

```bash
bun run typecheck
bun run test
bun run build
bun run lint:brand
```

## Plugin Entry

The skill wrapper lives at `skills/crabcode-automation-recommender/SKILL.md`. The command wrapper lives at `commands/recommend-automation.md`.

