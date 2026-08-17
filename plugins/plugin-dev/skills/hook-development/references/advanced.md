# Advanced Hook Use Cases

This reference covers advanced hook patterns and techniques for sophisticated automation workflows.

## Multi-Stage Validation

Combine command and prompt hooks for layered validation:

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

**Use case:** Fast deterministic checks followed by intelligent analysis

**Example quick-check.sh:**
```bash
#!/bin/bash
input=$(cat)
command=$(echo "$input" | jq -r '.tool_input.command')

# Immediate approval for safe commands
if [[ "$command" =~ ^(ls|pwd|echo|date|whoami)$ ]]; then
  exit 0
fi

# Let prompt hook handle complex cases
exit 0
```

The command hook quickly approves obviously safe commands, while the prompt hook analyzes everything else.

## Conditional Hook Execution

Execute hooks based on environment or context:

```bash
#!/bin/bash
# Only run in CI environment
if [ -z "$CI" ]; then
  echo '{"continue": true}' # Skip in non-CI
  exit 0
fi

# Run validation logic in CI
input=$(cat)
# ... validation code ...
```

**Use cases:**
- Different behavior in CI vs local development
- Project-specific validation
- User-specific rules

**Example: Skip certain checks for trusted users:**
```bash
#!/bin/bash
# Skip detailed checks for admin users
if [ "$USER" = "admin" ]; then
  exit 0
fi

# Full validation for other users
input=$(cat)
# ... validation code ...
```

## Hook Chaining via State

Share state between hooks using temporary files keyed by `session_id`.

**Do not key the file on `$$`.** Every hook runs in its own process, so `$$`
differs between the writer and the reader — the reader looks for a filename
that never exists and silently takes its fallback branch. Use `session_id`
from the payload: every hook in the same session receives the same value.

```bash
# Hook 1: Analyze and save state
#!/bin/bash
input=$(cat)
session_id=$(echo "$input" | jq -r '.session_id')
command=$(echo "$input" | jq -r '.tool_input.command')

# Analyze command
risk_level=$(calculate_risk "$command")
echo "$risk_level" > "/tmp/hook-state-$session_id"

exit 0
```

```bash
# Hook 2: Use saved state
#!/bin/bash
input=$(cat)
session_id=$(echo "$input" | jq -r '.session_id')
risk_level=$(cat "/tmp/hook-state-$session_id" 2>/dev/null || echo "unknown")

if [ "$risk_level" = "high" ]; then
  echo "High risk operation detected" >&2
  exit 2
fi
```

**Important:** This only works for sequential hook events (e.g., PreToolUse then PostToolUse), not parallel hooks.

Test the reader against a value the writer actually wrote. A broken chain
returns the fallback, which is indistinguishable from a legitimate "unknown" —
it fails silently, not loudly.

## Dynamic Hook Configuration

Modify hook behavior based on project configuration:

```bash
#!/bin/bash
cd "$CRABCODE_PROJECT_DIR" || exit 1

# Read project-specific config
if [ -f ".crabcode-hooks-config.json" ]; then
  strict_mode=$(jq -r '.strict_mode' .crabcode-hooks-config.json)

  if [ "$strict_mode" = "true" ]; then
    # Apply strict validation
    # ...
  else
    # Apply lenient validation
    # ...
  fi
fi
```

**Example .crabcode-hooks-config.json:**
```json
{
  "strict_mode": true,
  "allowed_commands": ["ls", "pwd", "grep"],
  "forbidden_paths": ["/etc", "/sys"]
}
```

## Context-Aware Prompt Hooks

Use transcript and session context for intelligent decisions:

```json
{
  "Stop": [
    {
      "matcher": "*",
      "hooks": [
        {
          "type": "prompt",
          "prompt": "Review the full transcript at $TRANSCRIPT_PATH. Check: 1) Were tests run after code changes? 2) Did the build succeed? 3) Were all user questions answered? 4) Is there any unfinished work? Return 'approve' only if everything is complete."
        }
      ]
    }
  ]
}
```

The LLM can read the transcript file and make context-aware decisions.

## Performance Optimization

### Caching Validation Results

```bash
#!/bin/bash
input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path')
cache_key=$(echo -n "$file_path" | md5sum | cut -d' ' -f1)
cache_file="/tmp/hook-cache-$cache_key"

# Check cache
if [ -f "$cache_file" ]; then
  cache_age=$(($(date +%s) - $(stat -f%m "$cache_file" 2>/dev/null || stat -c%Y "$cache_file")))
  if [ "$cache_age" -lt 300 ]; then  # 5 minute cache
    cat "$cache_file"
    exit 0
  fi
fi

# Perform validation.
# PreToolUse answers with hookSpecificOutput.permissionDecision, not the
# top-level `decision` field — `decision` is the Stop/PostToolUse shape and
# its only values are "approve" and "block".
result='{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "allow"}}'

# Cache result
echo "$result" > "$cache_file"
echo "$result"
```

### Parallel Execution Optimization

Since hooks run in parallel, design them to be independent:

```json
{
  "PreToolUse": [
    {
      "matcher": "Write",
      "hooks": [
        {
          "type": "command",
          "command": "bash check-size.sh",      // Independent
          "timeout": 2
        },
        {
          "type": "command",
          "command": "bash check-path.sh",      // Independent
          "timeout": 2
        },
        {
          "type": "prompt",
          "prompt": "Check content safety",     // Independent
          "timeout": 10
        }
      ]
    }
  ]
}
```

All three hooks run simultaneously, reducing total latency.

## Cross-Event Workflows

Coordinate hooks across different events:

All three hooks key their state on `session_id`, which is the only identifier
they share. `$$` would give each of them a different filename.

**SessionStart - Set up tracking:**
```bash
#!/bin/bash
input=$(cat)
session_id=$(echo "$input" | jq -r '.session_id')

# Initialize session tracking
echo "0" > "/tmp/test-count-$session_id"
echo "0" > "/tmp/build-count-$session_id"
```

**PostToolUse - Track events:**
```bash
#!/bin/bash
input=$(cat)
session_id=$(echo "$input" | jq -r '.session_id')
tool_name=$(echo "$input" | jq -r '.tool_name')

if [ "$tool_name" = "Bash" ]; then
  # PostToolUse carries the tool output as .tool_response
  output=$(echo "$input" | jq -r '.tool_response')
  if [[ "$output" == *"test"* ]]; then
    count=$(cat "/tmp/test-count-$session_id" 2>/dev/null || echo "0")
    echo $((count + 1)) > "/tmp/test-count-$session_id"
  fi
fi
```

**Stop - Verify based on tracking:**
```bash
#!/bin/bash
input=$(cat)
session_id=$(echo "$input" | jq -r '.session_id')
test_count=$(cat "/tmp/test-count-$session_id" 2>/dev/null || echo "0")

if [ "$test_count" -eq 0 ]; then
  echo "No tests were run" >&2
  exit 2
fi
```

## Integration with External Systems

### Slack Notifications

```bash
#!/bin/bash
input=$(cat)
tool_name=$(echo "$input" | jq -r '.tool_name')
decision="blocked"

# Send notification to Slack
curl -X POST "$SLACK_WEBHOOK" \
  -H 'Content-Type: application/json' \
  -d "{\"text\": \"Hook ${decision} ${tool_name} operation\"}" \
  2>/dev/null

echo "Blocked by hook" >&2
exit 2
```

### Database Logging

```bash
#!/bin/bash
input=$(cat)

# Log to database
psql "$DATABASE_URL" -c "INSERT INTO hook_logs (event, data) VALUES ('PreToolUse', '$input')" \
  2>/dev/null

exit 0
```

### Metrics Collection

```bash
#!/bin/bash
input=$(cat)
tool_name=$(echo "$input" | jq -r '.tool_name')

# Send metrics to monitoring system
echo "hook.pretooluse.${tool_name}:1|c" | nc -u -w1 statsd.local 8125

exit 0
```

## Security Patterns

### Rate Limiting

```bash
#!/bin/bash
input=$(cat)
session_id=$(echo "$input" | jq -r '.session_id')
command=$(echo "$input" | jq -r '.tool_input.command')

# Track command frequency. Keyed by session_id, not $$: a per-process file
# would be fresh on every invocation, so the counter could never exceed 1 and
# the limit would never trigger.
rate_file="/tmp/hook-rate-$session_id"
current_minute=$(date +%Y%m%d%H%M)

if [ -f "$rate_file" ]; then
  last_minute=$(head -1 "$rate_file")
  count=$(tail -1 "$rate_file")

  if [ "$current_minute" = "$last_minute" ]; then
    if [ "$count" -gt 10 ]; then
      echo "Rate limit exceeded" >&2
      exit 2
    fi
    count=$((count + 1))
  else
    count=1
  fi
else
  count=1
fi

echo "$current_minute" > "$rate_file"
echo "$count" >> "$rate_file"

exit 0
```

### Audit Logging

```bash
#!/bin/bash
input=$(cat)
tool_name=$(echo "$input" | jq -r '.tool_name')
timestamp=$(date -Iseconds)

# Append to audit log
echo "$timestamp | $USER | $tool_name | $input" >> ~/.crabcode/audit.log

exit 0
```

### Secret Detection

```bash
#!/bin/bash
input=$(cat)
content=$(echo "$input" | jq -r '.tool_input.content')

# Check for common secret patterns
if echo "$content" | grep -qE "(api[_-]?key|password|secret|token).{0,20}['\"]?[A-Za-z0-9]{20,}"; then
  echo "Potential secret detected in content" >&2
  exit 2
fi

exit 0
```

## Testing Advanced Hooks

### Unit Testing Hook Scripts

```bash
# test-hook.sh
#!/bin/bash

# Test 1: Approve safe command
result=$(echo '{"tool_input": {"command": "ls"}}' | bash validate-bash.sh)
if [ $? -eq 0 ]; then
  echo "✓ Test 1 passed"
else
  echo "✗ Test 1 failed"
fi

# Test 2: Block dangerous command
result=$(echo '{"tool_input": {"command": "rm -rf /"}}' | bash validate-bash.sh)
if [ $? -eq 2 ]; then
  echo "✓ Test 2 passed"
else
  echo "✗ Test 2 failed"
fi
```

### Integration Testing

Create test scenarios that exercise the full hook workflow:

```bash
# integration-test.sh
#!/bin/bash

# Set up test environment
export CRABCODE_PROJECT_DIR="/tmp/test-project"
export CRABCODE_PLUGIN_ROOT="$(pwd)"
mkdir -p "$CRABCODE_PROJECT_DIR"

# Test SessionStart hook
echo '{}' | bash hooks/session-start.sh
if [ -f "/tmp/session-initialized" ]; then
  echo "✓ SessionStart hook works"
else
  echo "✗ SessionStart hook failed"
fi

# Clean up
rm -rf "$CRABCODE_PROJECT_DIR"
```

## Best Practices for Advanced Hooks

1. **Keep hooks independent**: Don't rely on execution order
2. **Use timeouts**: Set appropriate limits for each hook type
3. **Handle errors gracefully**: Provide clear error messages
4. **Document complexity**: Explain advanced patterns in README
5. **Test thoroughly**: Cover edge cases and failure modes
6. **Monitor performance**: Track hook execution time
7. **Version configuration**: Use version control for hook configs
8. **Provide escape hatches**: Allow users to bypass hooks when needed

## Common Pitfalls

### ❌ Assuming Hook Order

```bash
# BAD: Assumes hooks run in specific order
# Hook 1 saves state, Hook 2 reads it
# This can fail because hooks run in parallel!
```

### ❌ Long-Running Hooks

```bash
# BAD: Hook takes 2 minutes to run
sleep 120
# This will timeout and block the workflow
```

### ❌ Uncaught Exceptions

```bash
# BAD: Script crashes on unexpected input
file_path=$(echo "$input" | jq -r '.tool_input.file_path')
cat "$file_path"  # Fails if file doesn't exist
```

### ✅ Proper Error Handling

```bash
# GOOD: Handles errors gracefully.
# The JSON goes to stdout — on stderr it would be ignored, since only stdout
# is parsed as hook output.
file_path=$(echo "$input" | jq -r '.tool_input.file_path')
if [ ! -f "$file_path" ]; then
  echo '{"continue": true, "systemMessage": "File not found, skipping check"}'
  exit 0
fi
```

## Conclusion

Advanced hook patterns enable sophisticated automation while maintaining reliability and performance. Use these techniques when basic hooks are insufficient, but always prioritize simplicity and maintainability.
