---
name: create-crabcode-plugin
description: >
  Guides the user through creating a brand-new CrabCode plugin from scratch via conversation — discovery,
  component planning, design, implementation, and packaging into an installable .plugin file.
  Use when the user wants to create, build, make, develop, scaffold, design, or start a new plugin,
  "turn this workflow into a plugin", "I want my own plugin", or needs to author plugin components
  (skills, agents, hooks, MCP servers) or a plugin.json manifest from nothing.
---

# Create CrabCode Plugin

Build a new plugin from scratch through guided conversation. Walk the user through discovery, planning, design, implementation, and packaging — delivering a ready-to-install `.plugin` file at the end.

## Overview

A plugin is a self-contained directory that extends CrabCode's capabilities with skills, agents, hooks, and MCP server integrations. This skill encodes the full plugin architecture and a five-phase workflow for creating one conversationally.

The process:

1. **Discovery** — understand what the user wants to build
2. **Component Planning** — determine which component types are needed
3. **Design & Clarifying Questions** — specify each component in detail
4. **Implementation** — create all plugin files
5. **Review & Package** — deliver the `.plugin` file

> **Nontechnical output**: Keep all user-facing conversation in plain language. Do not expose implementation details like file paths, directory structures, or schema fields unless the user asks. Frame everything in terms of what the plugin will do.

## Plugin Architecture

### Directory Structure

Every plugin follows this layout:

```
plugin-name/
├── .crabcode-plugin/
│   └── plugin.json           # Required: plugin manifest
├── skills/                   # Skills (subdirectories with SKILL.md)
│   └── skill-name/
│       ├── SKILL.md
│       └── references/
├── agents/                   # Subagent definitions (.md files)
├── .mcp.json                 # MCP server definitions
└── README.md                 # Plugin documentation
```

> **Legacy `commands/` format**: Older plugins may include a `commands/` directory with single-file `.md` slash commands. This format still works, but new plugins should use `skills/*/SKILL.md` instead — CrabCode presents both as a single "Skills" concept, and the skills format supports progressive disclosure via `references/`.

**Rules:**

- `.crabcode-plugin/plugin.json` is always required
- Component directories (`skills/`, `agents/`) go at the plugin root, not inside `.crabcode-plugin/`
- Only create directories for components the plugin actually uses
- Use kebab-case for all directory and file names

### plugin.json Manifest

Located at `.crabcode-plugin/plugin.json`. Minimal required field is `name`.

```json
{
  "name": "plugin-name",
  "version": "0.1.0",
  "description": "Brief explanation of plugin purpose",
  "author": {
    "name": "Author Name"
  }
}
```

**Name rules:** kebab-case, lowercase with hyphens, no spaces or special characters.
**Version:** semver format (MAJOR.MINOR.PATCH). Start at `0.1.0`.

Optional fields: `homepage`, `repository`, `license`, `keywords`.

Custom component paths can be specified (supplements, does not replace, auto-discovery):

```json
{
  "commands": "./custom-commands",
  "agents": ["./extra/reviewer.md", "./extra/collector.md"],
  "skills": ["./section-a/skills/foo"],
  "hooks": "./config/hooks.json",
  "mcpServers": "./.mcp.json"
}
```

Path rules (enforced by the manifest schema; a violation fails validation and the whole plugin is rejected): `agents` entries must be individual `.md` **files**; `skills` and `commands` entries may be directories; `hooks`/`mcpServers` must be `.json` files; all paths must start with `./`.

### Component Schemas

Detailed schemas for each component type are in `references/component-schemas.md`. Summary:

| Component                          | Location            | Format                      |
| ---------------------------------- | ------------------- | --------------------------- |
| Skills                             | `skills/*/SKILL.md` | Markdown + YAML frontmatter |
| MCP Servers                        | `.mcp.json`         | JSON                        |
| Agents (uncommonly used)           | `agents/*.md`       | Markdown + YAML frontmatter |
| Hooks (rarely used)                | `hooks/hooks.json`  | JSON                        |
| Commands (legacy)                  | `commands/*.md`     | Markdown + YAML frontmatter |

This is the CrabCode plugin system schema, used for building plugins that extend CrabCode with skills and other components.
Users will usually find skills the most useful. **Scaffold new plugins with `skills/*/SKILL.md` — do not create `commands/` unless the user explicitly needs the legacy single-file format.**

### Customizable plugins with `~~` placeholders

> **Do not use or ask about this pattern by default.** Only introduce `~~` placeholders if the user explicitly says they want people outside their organization to use the plugin.
> You can mention this is an option if it seems like the user wants to distribute the plugin externally, but do not proactively ask about this with AskUserQuestion.

When a plugin is intended to be shared with others outside their company, it might have parts that need to be adapted to individual users.
You might need to reference external tools by category rather than specific product (e.g., "project tracker" instead of "Jira").
When sharing is needed, use generic language and mark these as requiring customization with two tilde characters such as `create an issue in ~~project tracker`.
If used any tool categories, write a `CONNECTORS.md` file at the plugin root to explain:

```markdown
# Connectors

## How tool references work

Plugin files use `~~category` as a placeholder for whatever tool the user
connects in that category. Plugins are tool-agnostic — they describe
workflows in terms of categories rather than specific products.

## Connectors for this plugin

| Category        | Placeholder         | Options                         |
| --------------- | ------------------- | ------------------------------- |
| Chat            | `~~chat`            | Slack, Microsoft Teams, Discord |
| Project tracker | `~~project tracker` | Linear, Asana, Jira             |
```

### ${CRABCODE_PLUGIN_ROOT} Variable

Use `${CRABCODE_PLUGIN_ROOT}` for all intra-plugin path references in hooks and MCP configs. Never hardcode absolute paths.

## Guided Workflow

When you ask the user something, use AskUserQuestion. Don't assume "industry standard" defaults are correct. Note: AskUserQuestion always includes a Skip button and a free-text input box for custom answers, so do not include `None` or `Other` as options.

### Phase 1: Discovery

**Goal**: Understand what the user wants to build and why.

Ask (only what is unclear — skip questions if the user's initial request already answers them):

- What should this plugin do? What problem does it solve?
- Who will use it and in what context?
- Does it integrate with any external tools or services?
- Is there a similar plugin or workflow to reference?

Summarize understanding and confirm before proceeding.

**Output**: Clear statement of plugin purpose and scope.

### Phase 2: Component Planning

**Goal**: Determine which component types the plugin needs.

Based on the discovery answers, determine:

- **Skills** — Does it need specialized knowledge that CrabCode should load on-demand, or user-initiated actions? (domain expertise, reference schemas, workflow guides, deploy/configure/analyze/review actions)
- **MCP Servers** — Does it need external service integration? (databases, APIs, SaaS tools)
- **Agents (uncommon)** — Are there autonomous multi-step tasks? (validation, generation, analysis)
- **Hooks (rare)** — Should something happen automatically on certain events? (enforce policies, load context, validate operations)

Present a component plan table, including component types you decided not to create:

```
| Component | Count | Purpose |
|-----------|-------|---------|
| Skills    | 3     | Domain knowledge for X, /do-thing, /check-thing |
| Agents    | 0     | Not needed |
| Hooks     | 1     | Validate writes |
| MCP       | 1     | Connect to service Y |
```

Get user confirmation or adjustments before proceeding.

**Output**: Confirmed list of components to create.

### Phase 3: Design & Clarifying Questions

**Goal**: Specify each component in detail. Resolve all ambiguities before implementation.

For each component type in the plan, ask targeted design questions. Present questions grouped by component type. Wait for answers before proceeding.

**Skills:**

- What user queries should trigger this skill?
- What knowledge domains does it cover?
- Should it include reference files for detailed content?
- If the skill represents a user-initiated action: what arguments does it accept, and what tools does it need? (Read, Write, Bash, Grep, etc.)

**Agents:**

- Should each agent trigger proactively or only when requested?
- What tools does it need?
- What should the output format be?

**Hooks:**

- Which events? (PreToolUse, PostToolUse, Stop, SessionStart, etc.)
- What behavior — validate, block, modify, add context?
- Prompt-based (LLM-driven) or command-based (deterministic script)?

**MCP Servers:**

- What server type? (stdio for local, SSE for hosted with OAuth, HTTP for REST APIs)
- What authentication method?
- What tools should be exposed?

If the user says "whatever you think is best," provide specific recommendations and get explicit confirmation.

**Output**: Detailed specification for every component.

### Phase 4: Implementation

**Goal**: Create all plugin files following best practices.

**Order of operations:**

1. Create the plugin directory structure
2. Create `plugin.json` manifest
3. Create each component (see `references/component-schemas.md` for exact formats)
4. Create `README.md` documenting the plugin

**Implementation guidelines:**

- **Skills** use progressive disclosure: lean SKILL.md body (under 3,000 words), detailed content in `references/`. Frontmatter description must be third-person with specific trigger phrases. Skill bodies are instructions FOR CrabCode, not messages to the user — write them as directives about what to do.
- **Agents** need a description with `<example>` blocks showing triggering conditions, plus a system prompt in the markdown body.
- **Hooks** config goes in `hooks/hooks.json`. Use `${CRABCODE_PLUGIN_ROOT}` for script paths. Prefer prompt-based hooks for complex logic.
- **MCP configs** go in `.mcp.json` at plugin root. Use `${CRABCODE_PLUGIN_ROOT}` for local server paths. Document required env vars in README.

### Phase 5: Review & Package

**Goal**: Deliver the finished plugin.

1. Summarize what was created — list each component and its purpose
2. Ask if the user wants any adjustments
3. Run `crabcode plugin validate <path-to-plugin-json>` to check the plugin structure. If this command is unavailable, verify the structure manually:
   - `.crabcode-plugin/plugin.json` exists and contains valid JSON with at least a `name` field
   - The `name` field is kebab-case (lowercase letters, numbers, and hyphens only)
   - Any component directories referenced by the plugin (`commands/`, `skills/`, `agents/`, `hooks/`) actually exist and contain files in the expected formats — `.md` for commands/skills/agents, `.json` for hooks
   - Each skill subdirectory contains a `SKILL.md`
   - Report what passed and what didn't, the same way the CLI validator would

   Fix any errors before proceeding.
4. Package as a `.plugin` file:

```bash
cd /path/to/plugin-dir && zip -r /tmp/plugin-name.plugin . -x "*.DS_Store" && cp /tmp/plugin-name.plugin /path/to/outputs/plugin-name.plugin
```

> **Important**: Always create the zip in `/tmp/` first, then copy to the outputs folder. Writing directly to the outputs folder may fail due to permissions.

> **Naming**: Use the plugin name from `plugin.json` for the `.plugin` file (e.g., if name is `code-reviewer`, output `code-reviewer.plugin`).

The `.plugin` file will appear in the chat as a rich preview where the user can browse the files and accept the plugin by pressing a button.

## Cross-plugin capability routing (引用引导)

When a skill's deliverable can or must leave markdown (Word/Excel/PPT/PDF files, deep research, media publishing…), do not rebuild that capability — route to the provider plugin. CrabCode injects a skill's body only when it is invoked, and at that moment the model can still trigger other plugins' skills by fully-qualified name (`plugin-name:skill-name`). Triggering a skill from a plugin that is not installed returns an `Unknown skill` error and nothing is auto-installed, so routing text must include an install fallback.

Pick the layer by dependency strength:

1. **Hard dependency** — the plugin cannot deliver its main workflow without another plugin: declare it in `plugin.json` `dependencies`. Warning: this is strong semantics — at load time a missing/disabled dependency demotes YOUR ENTIRE plugin. Never use it for optional outputs.
2. **Optional output** — the deliverable has an optional file upgrade (e.g. a legal memo optionally delivered as .docx): add a short "产出物路由" paragraph in the SKILL.md body containing the provider's fully-qualified skill name verbatim (e.g. `crabcode-office-suite:crabcode-documents`) plus the `/plugin` install fallback.
3. **Heavy multi-step workflows** — probe required capabilities at the start of the workflow and guide the user to install missing plugins before work begins (see `crabcopyright-cn` `apply-manager` for the proven pattern).

Consult the capability registry at `docs/capability-routing.md` (repo root) for registered capability domains, provider FQNs, and the exact paragraph templates. `bun run lint:refs` enforces this: dead FQN references, undeclared `mcp__server__` tools, and upstream `/mnt/skills/` paths are errors; capability keywords without routing raise warnings unless explicitly exempted with `<!-- capability-route: <id>=none(reason) -->`.

## Best Practices

- **Start small**: Begin with the minimum viable set of components. A plugin with one well-crafted skill is more useful than one with five half-baked components.
- **Route, don't rebuild**: When output needs Office files, deep research, or another registered capability, reference the provider plugin by fully-qualified skill name per `docs/capability-routing.md` instead of embedding a parallel implementation.
- **Progressive disclosure for skills**: Core knowledge in SKILL.md, detailed reference material in `references/`, working examples in `examples/`.
- **Clear trigger phrases**: Skill descriptions should include specific phrases users would say. Agent descriptions should include `<example>` blocks.
- **Skills are for CrabCode**: Write skill body content as instructions for CrabCode to follow, not documentation for the user to read.
- **Imperative writing style**: Use verb-first instructions in skills ("Parse the config file," not "You should parse the config file").
- **Portability**: Always use `${CRABCODE_PLUGIN_ROOT}` for intra-plugin paths, never hardcoded paths.
- **Security**: Use environment variables for credentials, HTTPS for remote servers, least-privilege tool access.

## Additional Resources

- **`references/component-schemas.md`** — Detailed format specifications for every component type (skills, agents, hooks, MCP, legacy commands, CONNECTORS.md)
- **`references/example-plugins.md`** — Three complete example plugin structures at different complexity levels
