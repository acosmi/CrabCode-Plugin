# Plugin Templates

Scaffolding for new CrabCode plugins. Copy a template directory into `plugins/<plugin-name>/`, then rename the manifest `name` and directory so all three identifiers match (directory, manifest, marketplace entry).

## Templates

- `plugin-mcp-wrapper/` — declarative MCP wrapper. No runtime code.
- `plugin-standard/` — TypeScript runtime plugin. Use for hooks, bridges, or any plugin that needs executable logic.
- `worker-report.md` — per-window worker report template referenced by the §"Worker Contract" section of the migration rules.

## Conventions

- Replace every `__PLUGIN_NAME__` placeholder with the chosen kebab-case plugin name.
- Replace every `__DESCRIPTION__` placeholder with the user-facing description.
- Leave `author.name` as `CrabCode` unless the plugin is part of a partner integration (rare).
- Run `bun run validate` from the repository root after copying to confirm the new plugin clears the shared gates.
