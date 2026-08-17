#!/bin/bash
# Example hook that reads plugin settings from .crabcode/my-plugin.local.md
# Demonstrates the complete pattern for settings-driven hook behavior
#
# Structured decisions go to STDOUT with exit 0 and must carry
# hookSpecificOutput.hookEventName. JSON written to stderr is never parsed —
# stderr is surfaced as plain text, and exit 2 blocks the call outright.

set -euo pipefail

# Define settings file path
SETTINGS_FILE=".crabcode/my-plugin.local.md"

# Quick exit if settings file doesn't exist
if [[ ! -f "$SETTINGS_FILE" ]]; then
  # Plugin not configured - use defaults or skip
  exit 0
fi

# Parse YAML frontmatter (the block between the first two --- markers).
# Stop at the closing marker rather than pairing every --- in the file, so a
# horizontal rule further down the document cannot pull body text into the
# frontmatter.
FRONTMATTER=$(awk 'NR==1 && /^---$/ {c=1; next} c==1 && /^---$/ {exit} c==1' "$SETTINGS_FILE")

# Extract configuration fields
ENABLED=$(echo "$FRONTMATTER" | grep '^enabled:' | sed 's/enabled: *//' | sed 's/^"\(.*\)"$/\1/')
STRICT_MODE=$(echo "$FRONTMATTER" | grep '^strict_mode:' | sed 's/strict_mode: *//' | sed 's/^"\(.*\)"$/\1/')
MAX_SIZE=$(echo "$FRONTMATTER" | grep '^max_file_size:' | sed 's/max_file_size: *//')

# Quick exit if disabled
if [[ "$ENABLED" != "true" ]]; then
  exit 0
fi

# Read hook input
input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

# Emit a structured PreToolUse decision on stdout, then exit 0.
# jq --arg keeps paths containing quotes or backslashes from breaking the JSON.
emit_decision() {
  jq -cn \
    --arg decision "$1" \
    --arg reason "$2" \
    '{hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: $decision,
        permissionDecisionReason: $reason
      }}'
  exit 0
}

# Apply configured validation
if [[ "$STRICT_MODE" == "true" ]]; then
  # Strict mode: apply all checks
  if [[ "$file_path" == *".."* ]]; then
    emit_decision deny "Path traversal blocked (strict mode)"
  fi

  if [[ "$file_path" == *".env"* ]] || [[ "$file_path" == *"secret"* ]]; then
    emit_decision deny "Sensitive file blocked (strict mode)"
  fi
else
  # Standard mode: basic checks only
  if [[ "$file_path" == "/etc/"* ]] || [[ "$file_path" == "/sys/"* ]]; then
    emit_decision deny "System path blocked"
  fi
fi

# Check content length if configured.
# ${#content} counts characters, not bytes — they diverge for any non-ASCII
# content, so the limit is described in characters to match what is measured.
if [[ -n "$MAX_SIZE" ]] && [[ "$MAX_SIZE" =~ ^[0-9]+$ ]]; then
  content=$(echo "$input" | jq -r '.tool_input.content // empty')
  content_size=${#content}

  if [[ $content_size -gt $MAX_SIZE ]]; then
    emit_decision deny "Content is ${content_size} characters, over the configured limit of ${MAX_SIZE}"
  fi
fi

# All checks passed
exit 0
