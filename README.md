# CrabCode Plugin Marketplace

This repository is the official CrabCode plugin marketplace source at
`acosmi/CrabCode-Plugin`.

It also contains the `crabcode-setup` plugin, which analyzes a local repository
and recommends high-value CrabCode automations. It is read-only by default: it
reports what would help, but it does not create files, install plugins, or
change settings.

## Marketplace

CrabCode reads the marketplace manifest from:

```text
.crabcode-plugin/marketplace.json
```

The marketplace name is `crabcode-plugins-official`. Plugin entries are
declared in the manifest and should point either to the repository root
(`crabcode-setup`) or to a concrete plugin directory under `plugins/`.

The current marketplace includes the root setup plugin, the CrabLaw-CN and
security review plugins, and the migrated MCP, LSP, workflow, runtime, and
office-skill plugins under `plugins/`.

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
bun run validate
```

`dist/` is a build artifact and is not tracked in git. Run `bun run build` first when you need the `crabcode-setup` bin (`./dist/cli.js`).

## Plugin Entry

The skill wrapper lives at `skills/crabcode-automation-recommender/SKILL.md`. The command wrapper lives at `commands/recommend-automation.md`.

Additional marketplace plugins live under `plugins/`.
