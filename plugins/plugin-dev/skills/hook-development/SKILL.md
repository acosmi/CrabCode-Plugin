---
name: 插件钩子开发
short-description: 开发事件驱动的插件钩子，校验工具调用并实现自动化控制
description: This skill should be used when the user asks to "create a hook", "add a PreToolUse/PostToolUse/Stop hook", "validate tool use", "implement prompt-based hooks", "use ${CRABCODE_PLUGIN_ROOT}", "set up event-driven automation", "block dangerous commands", or mentions hook events (PreToolUse, PostToolUse, Stop, SubagentStop, SessionStart, SessionEnd, UserPromptSubmit, PreCompact, Notification). Provides comprehensive guidance for creating and implementing CrabCode plugin hooks with focus on advanced prompt-based hooks API.
version: 0.1.0
---

# Hook Development for CrabCode plugins

## Overview

Hooks are event-driven automation scripts that execute in response to CrabCode events. Use hooks to validate operations, enforce policies, add context, and integrate external tools into workflows.

**Key capabilities:**
- Validate tool calls before execution (PreToolUse)
- React to tool results (PostToolUse)
- Enforce completion standards (Stop, SubagentStop)
- Load project context (SessionStart)
- Automate workflows across the development lifecycle

## Hook Types

### Prompt-Based Hooks (Recommended)

Use LLM-driven decision making for context-aware validation:

```json
{
  "type": "prompt",
  "prompt": "Evaluate whether this tool use is appropriate. The full hook payload follows. $ARGUMENTS",
  "timeout": 30
}
```

**Supported events:** Stop, SubagentStop, UserPromptSubmit, PreToolUse

**Benefits:**
- Context-aware decisions based on natural language reasoning
- Flexible evaluation logic without bash scripting
- Better edge case handling
- Easier to maintain and extend

### Command Hooks

Execute bash commands for deterministic checks:

```json
{
  "type": "command",
  "command": "bash ${CRABCODE_PLUGIN_ROOT}/scripts/validate.sh",
  "timeout": 60
}
```

**Use for:**
- Fast deterministic validations
- File system operations
- External tool integrations
- Performance-critical checks

## Hook Configuration Formats

### Plugin hooks.json Format

**For plugin hooks** in `hooks/hooks.json`, use wrapper format:

```json
{
  "description": "Brief explanation of hooks (optional)",
  "hooks": {
    "PreToolUse": [...],
    "Stop": [...],
    "SessionStart": [...]
  }
}
```

**Key points:**
- `description` field is optional
- `hooks` field is required wrapper containing actual hook events
- This is the **plugin-specific format**

**Example:**
```json
{
  "description": "Validation hooks for code quality",
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "${CRABCODE_PLUGIN_ROOT}/hooks/validate.sh"
          }
        ]
      }
    ]
  }
}
```

### Settings Format (Direct)

**For settings files**, use the direct format. There are two scopes and they
are different files: project settings live in `.crabcode/settings.json` inside
the repo, user settings in `~/.crabcode/settings.json`. Both take the same
shape:

```json
{
  "PreToolUse": [...],
  "Stop": [...],
  "SessionStart": [...]
}
```

**Key points:**
- No wrapper - events directly at top level
- No description field
- This is the **settings format**

**Important:** The examples below show the hook event structure that goes inside either format. For plugin hooks.json, wrap these in `{"hooks": {...}}`.

## Hook Events

### PreToolUse

Execute before any tool runs. Use to approve, deny, or modify tool calls.

**Example (prompt-based):**
```json
{
  "PreToolUse": [
    {
      "matcher": "Write|Edit",
      "hooks": [
        {
          "type": "prompt",
          "prompt": "Validate file write safety. Check: system paths, credentials, path traversal, sensitive content. Return 'approve' or 'deny'."
        }
      ]
    }
  ]
}
```

**Output for PreToolUse:**
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow|deny|ask",
    "permissionDecisionReason": "Why this decision was made",
    "updatedInput": {"field": "modified_value"}
  },
  "systemMessage": "Explanation for CrabCode"
}
```

`hookSpecificOutput.hookEventName` is **required** — it is the discriminator
that tells the host which shape it is reading, and the object is rejected
without it. Print it on **stdout and exit 0**; see "Hook Output Format" below
for why stderr is a different channel.

### PostToolUse

Execute after tool completes. Use to react to results, provide feedback, or log.

**Example:**
```json
{
  "PostToolUse": [
    {
      "matcher": "Edit",
      "hooks": [
        {
          "type": "prompt",
          "prompt": "Analyze edit result for potential issues: syntax errors, security vulnerabilities, breaking changes. Provide feedback."
        }
      ]
    }
  ]
}
```

**Output behavior:**
- Exit 0: stdout shown in transcript
- Exit 2: stderr fed back to CrabCode
- systemMessage included in context

### Stop

Execute when main agent considers stopping. Use to validate completeness.

**Example:**
```json
{
  "Stop": [
    {
      "matcher": "*",
      "hooks": [
        {
          "type": "prompt",
          "prompt": "Verify task completion: tests run, build succeeded, questions answered. Return 'approve' to stop or 'block' with reason to continue."
        }
      ]
    }
  ]
}
```

**Decision output:**
```json
{
  "decision": "approve|block",
  "reason": "Explanation",
  "systemMessage": "Additional context"
}
```

### SubagentStop

Execute when agent considers stopping. Use to ensure agent completed its task.

Similar to Stop hook, but for agents.

### UserPromptSubmit

Execute when user submits a prompt. Use to add context, validate, or block prompts.

**Example:**
```json
{
  "UserPromptSubmit": [
    {
      "matcher": "*",
      "hooks": [
        {
          "type": "prompt",
          "prompt": "Check if prompt requires security guidance. If discussing auth, permissions, or API security, return relevant warnings."
        }
      ]
    }
  ]
}
```

### SessionStart

Execute when CrabCode session begins. Use to load context and set environment.

**Example:**
```json
{
  "SessionStart": [
    {
      "matcher": "*",
      "hooks": [
        {
          "type": "command",
          "command": "bash ${CRABCODE_PLUGIN_ROOT}/examples/load-context.sh"
        }
      ]
    }
  ]
}
```

**Special capability:** Persist environment variables using `$CRABCODE_ENV_FILE`:
```bash
echo "export PROJECT_TYPE=nodejs" >> "$CRABCODE_ENV_FILE"
```

See `examples/load-context.sh` for complete example.

### SessionEnd

Execute when session ends. Use for cleanup, logging, and state preservation.

### PreCompact

Execute before context compaction. Use to add critical information to preserve.

### Notification

Execute when CrabCode sends notifications. Use to react to user notifications.

## Hook Output Format

### Standard Output (All Hooks)

```json
{
  "continue": true,
  "suppressOutput": false,
  "systemMessage": "Message for CrabCode"
}
```

- `continue`: If false, halt processing (default true)
- `suppressOutput`: Hide output from transcript (default false)
- `systemMessage`: Message shown to CrabCode

### Exit Codes

- `0` - Success (stdout shown in transcript)
- `2` - Blocking error (stderr fed back to CrabCode)
- Other - Non-blocking error

### Which channel carries what

This is the single most common hook bug, so state it plainly:

| You want to | Write to | Exit |
|---|---|---|
| Return a structured decision | **stdout**, as JSON | `0` |
| Block with a human-readable reason | **stderr**, as plain text | `2` |

Only **stdout** is parsed as JSON, and only when the hook exits `0`. Text on
stderr is surfaced verbatim and is never parsed.

So JSON printed to stderr is the worst of both: the decision is discarded, and
the raw JSON is handed to the model as if it were prose. If you find yourself
writing `echo '{"...":"..."}' >&2`, you meant one of the two rows above.

## Hook Input Format

All hooks receive JSON via stdin with common fields:

```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.txt",
  "cwd": "/current/working/dir",
  "permission_mode": "default",
  "hook_event_name": "PreToolUse"
}
```

`permission_mode` is one of `default`, `acceptEdits`, `bypassPermissions`,
`dontAsk`, `plan`. Subagent invocations additionally carry `agent_id` and
`agent_type`.

**Event-specific fields:**

- **PreToolUse:** `tool_name`, `tool_input`, `tool_use_id`
- **PostToolUse:** `tool_name`, `tool_input`, `tool_response`, `tool_use_id`
- **UserPromptSubmit:** `prompt`
- **Stop:** `stop_hook_active`, `last_assistant_message`
- **SubagentStop:** `stop_hook_active`, `last_assistant_message`, `agent_id`,
  `agent_transcript_path`, `agent_type`
- **SessionStart:** `source`, `agent_type`, `model`
- **SessionEnd:** `reason`

Note the asymmetry that trips people up: the post-tool payload is
`tool_response` (not `tool_result`), the submitted prompt is `prompt` (not
`user_prompt`), and `reason` belongs to **SessionEnd** — a Stop hook gets
`stop_hook_active` and `last_assistant_message` instead.

### Reading fields from a prompt hook

Prompt hooks substitute exactly one placeholder: **`$ARGUMENTS`**, which
expands to the entire stdin JSON as a string. There are no per-field
placeholders — `$TOOL_INPUT`, `$TOOL_RESULT` and `$USER_PROMPT` are not
substituted and would reach the model as literal text.

If a prompt contains no placeholder at all, the JSON is appended automatically
as `ARGUMENTS: {...}`, so the data still arrives — which is why a prompt
written against a non-existent placeholder can look like it works.

Write prompts that name the field to read out of the payload:

```json
{
  "type": "prompt",
  "prompt": "Evaluate the PreToolUse payload below. Read .tool_input.command and decide whether it is safe.\n\n$ARGUMENTS",
  "timeout": 30
}
```

Command hooks parse stdin themselves, normally with `jq`:

```bash
input=$(cat)
command=$(echo "$input" | jq -r '.tool_input.command // empty')
```

## Environment Variables

Injected into command hooks:

- `$CRABCODE_PROJECT_DIR` - Project root path (the stable repo root, not the
  worktree path)
- `$CRABCODE_PLUGIN_ROOT` - Plugin directory (use for portable paths); set for
  plugin and skill hooks
- `$CRABCODE_ENV_FILE` - Path to a `.sh` file whose exports are applied to
  subsequent Bash commands. Set only for `SessionStart`, `Setup`, `CwdChanged`
  and `FileChanged`, and only for bash hooks — PowerShell hooks do not get it,
  because PowerShell export syntax is not parseable by bash.

Hooks also inherit the environment CrabCode itself was launched with, so
externally-set variables such as `CRABCODE_REMOTE` are visible. Those are
inherited, not injected — do not rely on the hook runtime to define them.

**Always use ${CRABCODE_PLUGIN_ROOT} in hook commands for portability:**

```json
{
  "type": "command",
  "command": "bash ${CRABCODE_PLUGIN_ROOT}/scripts/validate.sh"
}
```

## Plugin Hook Configuration

In plugins, define hooks in `hooks/hooks.json`:

```json
{
  "PreToolUse": [
    {
      "matcher": "Write|Edit",
      "hooks": [
        {
          "type": "prompt",
          "prompt": "Validate file write safety"
        }
      ]
    }
  ],
  "Stop": [
    {
      "matcher": "*",
      "hooks": [
        {
          "type": "prompt",
          "prompt": "Verify task completion"
        }
      ]
    }
  ],
  "SessionStart": [
    {
      "matcher": "*",
      "hooks": [
        {
          "type": "command",
          "command": "bash ${CRABCODE_PLUGIN_ROOT}/examples/load-context.sh",
          "timeout": 10
        }
      ]
    }
  ]
}
```

Plugin hooks merge with user's hooks and run in parallel.

## Matchers

### Tool Name Matching

**Exact match:**
```json
"matcher": "Write"
```

**Multiple tools:**
```json
"matcher": "Read|Write|Edit"
```

**Wildcard (all tools):**
```json
"matcher": "*"
```

**Regex patterns:**
```json
"matcher": "mcp__.*__delete.*"  // All MCP delete tools
```

**Note:** Matchers are case-sensitive.

### Common Patterns

```json
// All MCP tools
"matcher": "mcp__.*"

// A specific MCP server's tools. Plugin-provided servers are exposed under a
// generated prefix, not the plugin name — run /mcp to read the actual tool
// names first, then match on what you see. Do not hand-assemble the prefix.
"matcher": "mcp__p_[a-z0-9]+__.*"

// All file operations
"matcher": "Read|Write|Edit"

// Bash commands only
"matcher": "Bash"
```

## Security Best Practices

### Input Validation

Always validate inputs in command hooks:

```bash
#!/bin/bash
set -euo pipefail

input=$(cat)
tool_name=$(echo "$input" | jq -r '.tool_name')

# Validate tool name format
if [[ ! "$tool_name" =~ ^[a-zA-Z0-9_]+$ ]]; then
  echo "Invalid tool name" >&2
  exit 2
fi
```

### Path Safety

Check for path traversal and sensitive files:

```bash
file_path=$(echo "$input" | jq -r '.tool_input.file_path')

# Deny path traversal
if [[ "$file_path" == *".."* ]]; then
  echo "Path traversal detected" >&2
  exit 2
fi

# Deny sensitive files
if [[ "$file_path" == *".env"* ]]; then
  echo "Sensitive file" >&2
  exit 2
fi
```

See `examples/validate-write.sh` and `examples/validate-bash.sh` for complete examples.

### Quote All Variables

```bash
# GOOD: Quoted
echo "$file_path"
cd "$CRABCODE_PROJECT_DIR"

# BAD: Unquoted (injection risk)
echo $file_path
cd $CRABCODE_PROJECT_DIR
```

### Set Appropriate Timeouts

```json
{
  "type": "command",
  "command": "bash script.sh",
  "timeout": 10
}
```

**Default:** 600s (10 minutes) for tool-lifecycle hooks. `SessionEnd` is the
exception at 1.5s — shutdown cannot be held up, so cleanup there must be near
instant. `timeout` is in seconds and only narrows the window; it is not capped
at the default.

A generous default is not licence to be slow: every matching hook runs before
the tool call proceeds, so the user waits for the slowest one.

## Performance Considerations

### Parallel Execution

All matching hooks run **in parallel**:

```json
{
  "PreToolUse": [
    {
      "matcher": "Write",
      "hooks": [
        {"type": "command", "command": "check1.sh"},  // Parallel
        {"type": "command", "command": "check2.sh"},  // Parallel
        {"type": "prompt", "prompt": "Validate..."}   // Parallel
      ]
    }
  ]
}
```

**Design implications:**
- Hooks don't see each other's output
- Non-deterministic ordering
- Design for independence

### Optimization

1. Use command hooks for quick deterministic checks
2. Use prompt hooks for complex reasoning
3. Cache validation results in temp files
4. Minimize I/O in hot paths

## Temporarily Active Hooks

Create hooks that activate conditionally by checking for a flag file or configuration:

**Pattern: Flag file activation**
```bash
#!/bin/bash
# Only active when flag file exists
FLAG_FILE="$CRABCODE_PROJECT_DIR/.enable-strict-validation"

if [ ! -f "$FLAG_FILE" ]; then
  # Flag not present, skip validation
  exit 0
fi

# Flag present, run validation
input=$(cat)
# ... validation logic ...
```

**Pattern: Configuration-based activation**
```bash
#!/bin/bash
# Check configuration for activation
CONFIG_FILE="$CRABCODE_PROJECT_DIR/.crabcode/plugin-config.json"

if [ -f "$CONFIG_FILE" ]; then
  enabled=$(jq -r '.strictMode // false' "$CONFIG_FILE")
  if [ "$enabled" != "true" ]; then
    exit 0  # Not enabled, skip
  fi
fi

# Enabled, run hook logic
input=$(cat)
# ... hook logic ...
```

**Use cases:**
- Enable strict validation only when needed
- Temporary debugging hooks
- Project-specific hook behavior
- Feature flags for hooks

**Best practice:** Document activation mechanism in plugin README so users know how to enable/disable temporary hooks.

## Hook Lifecycle and Limitations

### Applying Hook Changes

Hooks are loaded with the plugin at session start, but you do **not** have to
restart to pick up changes — `/reload-plugins` re-reads plugins in place and
reports how many hooks it loaded.

**What needs a reload:**
- Editing `hooks/hooks.json` (adding events, changing matchers, commands or prompts)
- Registering a new hook script that the config did not previously reference

**What does not:**
- Editing the *body* of a script that `hooks.json` already points at. The
  command is executed fresh each time the event fires, so the new code runs on
  the next invocation.
- Data a hook reads at run time (settings files, flag files). Those are read
  per invocation, so changes take effect immediately.

**To test hook changes:**
1. Edit hook configuration or scripts
2. Run `/reload-plugins`
3. Trigger the event and observe
4. Inspect details with `crabcode --debug`

### Hook Validation at Startup

Hooks are validated when CrabCode starts:
- Invalid JSON in hooks.json causes loading failure
- Missing scripts cause warnings
- Syntax errors reported in debug mode

Use `/hooks` command to review loaded hooks in current session.

## Debugging Hooks

### Enable Debug Mode

```bash
crabcode --debug
```

Look for hook registration, execution logs, input/output JSON, and timing information.

### Test Hook Scripts

Test command hooks directly:

```bash
echo '{"tool_name": "Write", "tool_input": {"file_path": "/test"}}' | \
  bash ${CRABCODE_PLUGIN_ROOT}/scripts/validate.sh

echo "Exit code: $?"
```

### Validate JSON Output

Ensure hooks output valid JSON:

```bash
output=$(./your-hook.sh < test-input.json)
echo "$output" | jq .
```

## Quick Reference

### Hook Events Summary

The commonly used subset. This is **not** the full event list — run `/hooks`
to see every event the installed version accepts, and treat that as the source
of truth before writing a matcher.

| Event | When | Use For |
|-------|------|---------|
| PreToolUse | Before tool | Validation, modification |
| PostToolUse | After tool | Feedback, logging |
| UserPromptSubmit | User input | Context, validation |
| Stop | Agent stopping | Completeness check |
| SubagentStop | Subagent done | Task validation |
| SessionStart | Session begins | Context loading |
| SessionEnd | Session ends | Cleanup, logging |
| PreCompact | Before compact | Preserve context |
| Notification | User notified | Logging, reactions |

Beyond these, the runtime also emits lifecycle events such as `Setup`,
`CwdChanged`, `FileChanged`, `PostToolUseFailure`, `StopFailure`,
`SubagentStart`, `PostCompact`, `PermissionRequest`, `PermissionDenied`,
`TaskCreated`, `TaskCompleted`, `WorktreeCreate`, `WorktreeRemove`,
`InstructionsLoaded`, `ConfigChange`, `TeammateIdle`, `Elicitation` and
`ElicitationResult`.

### Best Practices

**DO:**
- ✅ Use prompt-based hooks for complex logic
- ✅ Use ${CRABCODE_PLUGIN_ROOT} for portability
- ✅ Validate all inputs in command hooks
- ✅ Quote all bash variables
- ✅ Set appropriate timeouts
- ✅ Return structured JSON output
- ✅ Test hooks thoroughly

**DON'T:**
- ❌ Use hardcoded paths
- ❌ Trust user input without validation
- ❌ Create long-running hooks
- ❌ Rely on hook execution order
- ❌ Modify global state unpredictably
- ❌ Log sensitive information

## Additional Resources

### Reference Files

For detailed patterns and advanced techniques, consult:

- **`references/patterns.md`** - Common hook patterns (8+ proven patterns)
- **`references/migration.md`** - Migrating from basic to advanced hooks
- **`references/advanced.md`** - Advanced use cases and techniques

### Example Hook Scripts

Working examples in `examples/`:

- **`validate-write.sh`** - File write validation example
- **`validate-bash.sh`** - Bash command validation example
- **`load-context.sh`** - SessionStart context loading example

### Utility Scripts

Development tools in `scripts/`:

- **`validate-hook-schema.sh`** - Validate hooks.json structure and syntax
- **`test-hook.sh`** - Test hooks with sample input before deployment
- **`hook-linter.sh`** - Check hook scripts for common issues and best practices

### External Resources

- **Examples**: See security-guidance plugin in marketplace
- **Testing**: Use `crabcode --debug` for detailed logs
- **Validation**: Use `jq` to validate hook JSON output

## Implementation Workflow

To implement hooks in a plugin:

1. Identify events to hook into (PreToolUse, Stop, SessionStart, etc.)
2. Decide between prompt-based (flexible) or command (deterministic) hooks
3. Write hook configuration in `hooks/hooks.json`
4. For command hooks, create hook scripts
5. Use ${CRABCODE_PLUGIN_ROOT} for all file references
6. Validate configuration with `scripts/validate-hook-schema.sh hooks/hooks.json`
7. Test hooks with `scripts/test-hook.sh` before deployment
8. Test in CrabCode with `crabcode --debug`
9. Document hooks in plugin README

Focus on prompt-based hooks for most use cases. Reserve command hooks for performance-critical or deterministic checks.
