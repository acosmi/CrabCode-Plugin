---
description: Create hooks to prevent unwanted behaviors from conversation analysis or explicit instructions.
argument-hint: "Optional behavior to address"
allowed-tools: ["Read", "Write", "AskUserQuestion", "Task", "Grep", "TodoWrite", "Skill"]
---

# Hookify - create hooks from unwanted behaviors

FIRST: load the `hookify:writing-rules` skill via the Skill tool to understand rule file format and syntax.

Help the user create hookify rules that prevent problematic behaviors. Follow these steps.

## Step 1: gather behavior information

If `$ARGUMENTS` is provided:
- The user gave a specific instruction. Analyze the last 10-15 messages for additional context.
- Look for examples of the behavior happening.

If `$ARGUMENTS` is empty:
- Launch the `conversation-analyzer` subagent (via Task / general-purpose) to scan recent messages for frustration signals, corrections, and repeated issues.
- The agent returns structured findings.

## Step 2: present findings to the user

Use AskUserQuestion to surface findings.

- "Which behaviors should we hookify?" (multi-select, up to 4)
- For each selected behavior: "Block the operation or just warn?"
- Confirm the proposed regex pattern with the user.

## Step 3: generate rule files

For each confirmed behavior, create `.crabcode/hookify.{rule-name}.local.md` in the **current working directory** (not the plugin directory).

Rule naming:
- kebab-case
- start with an action verb: `block-`, `warn-`, `require-`, `prevent-`

Simple rule format:

```markdown
---
name: rule-name
enabled: true
event: bash|file|stop|prompt|all
pattern: regex-pattern-here
action: warn|block
---

Message body shown to the agent when the rule fires.
```

Multi-condition rule:

```markdown
---
name: warn-env-key-add
enabled: true
event: file
conditions:
  - field: file_path
    operator: regex_match
    pattern: \.env$
  - field: new_text
    operator: contains
    pattern: API_KEY
---

You're adding an API key to a .env file. Make sure it is in .gitignore.
```

## Step 4: create files and confirm

1. If `.crabcode/` does not exist in the current working directory, create it (`mkdir -p .crabcode`).
2. Use Write to create each `.crabcode/hookify.{name}.local.md` file.
3. Show the user a short summary of files created and the events they trigger on.
4. Confirm: "Rules are active immediately - no restart needed."

## Event types

- `bash` matches Bash tool commands.
- `file` matches Edit, Write, MultiEdit tools.
- `stop` matches when the agent wants to stop (use for completion checks).
- `prompt` matches when the user submits a prompt.
- `all` matches every event.

## Pattern tips

- Bash: `rm\s+-rf`, `chmod\s+777`, `(eval|exec)\(`.
- File contents: `console\.log\(`, `innerHTML\s*=`, `dangerouslySetInnerHTML`.
- File paths: `\.env$`, `credentials`, `\.pem$`.

## Troubleshooting

- If a rule does not trigger: confirm the file is under `.crabcode/`, that `enabled: true` is set, and that the pattern is a valid regex.
- If `Bun.test` regex testing helps, try: `bun -e "console.log(new RegExp('your_pattern', 'i').test('test text'))"`.
- To toggle a rule: flip `enabled:` in its frontmatter. To remove permanently: delete the file.

Use TodoWrite to track step progress.
