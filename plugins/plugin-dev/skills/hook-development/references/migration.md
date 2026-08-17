# Choosing Between Command Hooks and Prompt Hooks

Command hooks and prompt hooks are both current, fully supported types —
neither supersedes the other, and there is no deprecated format to move off of.
(`agent` and `http` hooks exist as well; see the main skill.) This guide is
about picking the right type, and about what a rewrite looks like when the one
you picked turns out not to fit.

Read it as a selection guide, not a migration mandate. Plenty of good hooks
should stay exactly as they are.

## What each type is good at

Prompt hooks judge; command hooks decide.

**Prompt hooks** suit judgement calls whose criteria are easier to state in
language than in code:

- **Natural language reasoning**: the model weighs context and intent
- **Better edge case handling**: adapts to variations you did not enumerate
- **No bash scripting required**: simpler to write and maintain
- **More flexible validation**: complex criteria without encoding them

**Command hooks** suit anything that must be exact, fast, or offline:

- **Deterministic**: same input, same verdict, every time
- **Fast**: no model round-trip, so no latency added to the tool call
- **Offline**: no token cost, and it works when no model call is possible
- **Precise**: correct when the rule genuinely is a regex or a size threshold

A rule that is objectively checkable — a file size, an extension, an exact path
prefix — belongs in a command hook. Asking a model to re-derive it adds latency
and a chance of being wrong about something arithmetic.

## Rewrite Example: Bash Command Validation

### Starting point (Command Hook)

**Configuration:**
```json
{
  "PreToolUse": [
    {
      "matcher": "Bash",
      "hooks": [
        {
          "type": "command",
          "command": "bash validate-bash.sh"
        }
      ]
    }
  ]
}
```

**Script (validate-bash.sh):**
```bash
#!/bin/bash
input=$(cat)
command=$(echo "$input" | jq -r '.tool_input.command')

# Hard-coded validation logic
if [[ "$command" == *"rm -rf"* ]]; then
  echo "Dangerous command detected" >&2
  exit 2
fi
```

**Problems:**
- Only checks for exact "rm -rf" pattern
- Doesn't catch variations like `rm -fr` or `rm -r -f`
- Misses other dangerous commands (`dd`, `mkfs`, etc.)
- No context awareness
- Requires bash scripting knowledge

### Rewritten as a Prompt Hook

**Configuration:**
```json
{
  "PreToolUse": [
    {
      "matcher": "Bash",
      "hooks": [
        {
          "type": "prompt",
          "prompt": "Read .tool_input.command from the payload below. Analyze for: 1) Destructive operations (rm -rf, dd, mkfs, etc) 2) Privilege escalation (sudo) 3) Network operations without user consent. Answer approve or block with an explanation. $ARGUMENTS",
          "timeout": 15
        }
      ]
    }
  ]
}
```

**Benefits:**
- Catches all variations and patterns
- Understands intent, not just literal strings
- No script file needed
- Easy to extend with new criteria
- Context-aware decisions
- Natural language explanation in denial

## Rewrite Example: File Write Validation

### Starting point (Command Hook)

**Configuration:**
```json
{
  "PreToolUse": [
    {
      "matcher": "Write",
      "hooks": [
        {
          "type": "command",
          "command": "bash validate-write.sh"
        }
      ]
    }
  ]
}
```

**Script (validate-write.sh):**
```bash
#!/bin/bash
input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path')

# Check for path traversal
if [[ "$file_path" == *".."* ]]; then
  echo "Path traversal detected" >&2
  exit 2
fi

# Check for system paths
if [[ "$file_path" == "/etc/"* ]] || [[ "$file_path" == "/sys/"* ]]; then
  echo "System file" >&2
  exit 2
fi
```

**Problems:**
- Hard-coded path patterns
- Doesn't understand symlinks
- Missing edge cases (e.g., `/etc` vs `/etc/`)
- No consideration of file content

### Rewritten as a Prompt Hook

**Configuration:**
```json
{
  "PreToolUse": [
    {
      "matcher": "Write|Edit",
      "hooks": [
        {
          "type": "prompt",
          "prompt": "Read .tool_input.file_path and .tool_input.content from the payload below. Verify: 1) Not system directories (/etc, /sys, /usr) 2) Not credentials (.env, tokens, secrets) 3) No path traversal 4) Content doesn't expose secrets. Answer approve or block. $ARGUMENTS"
        }
      ]
    }
  ]
}
```

**Benefits:**
- Context-aware (considers content too)
- Handles symlinks and edge cases
- Natural understanding of "system directories"
- Can detect secrets in content
- Easy to extend criteria

## When a Command Hook Is the Right Answer

Command hooks still have their place:

### 1. Deterministic Performance Checks

```bash
#!/bin/bash
# Check file size quickly
file_path=$(echo "$input" | jq -r '.tool_input.file_path')
size=$(stat -f%z "$file_path" 2>/dev/null || stat -c%s "$file_path" 2>/dev/null)

if [ "$size" -gt 10000000 ]; then
  echo "File too large" >&2
  exit 2
fi
```

**Use command hooks when:** Validation is purely mathematical or deterministic.

### 2. External Tool Integration

```bash
#!/bin/bash
# Run security scanner
file_path=$(echo "$input" | jq -r '.tool_input.file_path')
scan_result=$(security-scanner "$file_path")

if [ "$?" -ne 0 ]; then
  echo "Security scan failed: $scan_result" >&2
  exit 2
fi
```

**Use command hooks when:** Integrating with external tools that provide yes/no answers.

### 3. Very Fast Checks (< 50ms)

```bash
#!/bin/bash
# Quick regex check
command=$(echo "$input" | jq -r '.tool_input.command')

if [[ "$command" =~ ^(ls|pwd|echo)$ ]]; then
  exit 0  # Safe commands
fi
```

**Use command hooks when:** Performance is critical and logic is simple.

## Hybrid Approach

Combine both for multi-stage validation:

```json
{
  "PreToolUse": [
    {
      "matcher": "Bash",
      "hooks": [
        {
          "type": "command",
          "command": "bash ${CRABCODE_PLUGIN_ROOT}/scripts/quick-check.sh",
          "timeout": 5
        },
        {
          "type": "prompt",
          "prompt": "Deep analysis of the bash command in .tool_input.command. $ARGUMENTS",
          "timeout": 15
        }
      ]
    }
  ]
}
```

The command hook does fast deterministic checks, while the prompt hook handles complex reasoning.

## Rewrite Checklist

When converting a command hook to a prompt hook:

- [ ] Identify the validation logic in the command hook
- [ ] Convert hard-coded patterns to natural language criteria
- [ ] Test with edge cases the old hook missed
- [ ] Verify LLM understands the intent
- [ ] Set appropriate timeout (usually 15-30s for prompt hooks)
- [ ] Document the new hook in README
- [ ] Leave the old script in place until the replacement is proven in practice

## Rewrite Tips

1. **Convert one hook at a time**: never convert them all at once
2. **Test thoroughly**: Verify prompt hook catches what command hook caught
3. **Look for improvements**: use the rewrite as an opportunity to widen coverage
4. **Keep the old script**: it is the specification of what the replacement must still catch
5. **Document reasoning**: record why this hook is better as a prompt hook

## Complete Rewrite Example

### Before

```
my-plugin/
├── .crabcode-plugin/plugin.json
├── hooks/hooks.json
└── scripts/
    ├── validate-bash.sh
    ├── validate-write.sh
    └── check-tests.sh
```

### After

```
my-plugin/
├── .crabcode-plugin/plugin.json
├── hooks/hooks.json      # Bash/Write validation now uses prompt hooks
└── scripts/              # check-tests.sh stays: it is a fast, exact check
    └── check-tests.sh
```

### Updated hooks.json

```json
{
  "description": "Validation hooks for bash, file writes, and completion",
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Validate bash command safety: destructive ops, privilege escalation, network access"
          }
        ]
      },
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Validate file write safety: system paths, credentials, path traversal, content secrets"
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
            "prompt": "Verify tests were run if code was modified"
          }
        ]
      }
    ]
  }
}
```

**Result:** Simpler, more maintainable, more powerful.

## Common Rewrite Patterns

### Pattern: String Contains → Natural Language

**Before:**
```bash
if [[ "$command" == *"sudo"* ]]; then
  echo "Privilege escalation" >&2
  exit 2
fi
```

**After:**
```
"Check for privilege escalation (sudo, su, etc)"
```

### Pattern: Regex → Intent

**Before:**
```bash
if [[ "$file" =~ \.(env|secret|key|token)$ ]]; then
  echo "Credential file" >&2
  exit 2
fi
```

**After:**
```
"Verify not writing to credential files (.env, secrets, keys, tokens)"
```

### Pattern: Multiple Conditions → Criteria List

**Before:**
```bash
if [ condition1 ] || [ condition2 ] || [ condition3 ]; then
  echo "Invalid" >&2
  exit 2
fi
```

**After:**
```
"Check: 1) condition1 2) condition2 3) condition3. Deny if any fail."
```

## Conclusion

Pick the type that matches the decision. Prompt hooks earn their latency on
judgement calls where the criteria are easier to state than to encode; command
hooks stay the right answer for anything deterministic, fast, or offline. Most
non-trivial plugins end up with both, and a hook that already does its job
well does not need rewriting at all.
