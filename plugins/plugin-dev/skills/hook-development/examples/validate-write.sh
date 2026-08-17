#!/bin/bash
# Example PreToolUse hook for validating Write/Edit operations
# This script demonstrates file write validation patterns
#
# Structured decisions go to STDOUT with exit 0 and must carry
# hookSpecificOutput.hookEventName. Writing them to stderr with exit 2 blocks
# the call and throws the decision away. See validate-bash.sh for the full
# explanation of the two channels.

set -euo pipefail

# Read input from stdin
input=$(cat)

# Extract file path and content
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

# Validate path exists
if [ -z "$file_path" ]; then
  echo '{"continue": true}' # No path to validate
  exit 0
fi

# Emit a structured PreToolUse decision on stdout, then exit 0.
# Built with jq --arg so a path containing quotes or backslashes cannot break
# out of the JSON string.
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

# Check for path traversal
if [[ "$file_path" == *".."* ]]; then
  emit_decision deny "Path traversal detected in: $file_path"
fi

# Check for system directories
if [[ "$file_path" == /etc/* ]] || [[ "$file_path" == /sys/* ]] || [[ "$file_path" == /usr/* ]]; then
  emit_decision deny "Cannot write to system directory: $file_path"
fi

# Check for sensitive files
if [[ "$file_path" == *.env ]] || [[ "$file_path" == *secret* ]] || [[ "$file_path" == *credentials* ]]; then
  emit_decision ask "Writing to potentially sensitive file: $file_path"
fi

# Approve the operation
exit 0
