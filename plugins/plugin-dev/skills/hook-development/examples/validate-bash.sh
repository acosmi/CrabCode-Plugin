#!/bin/bash
# Example PreToolUse hook for validating Bash commands
# This script demonstrates bash command validation patterns
#
# Two output channels, and they are not interchangeable:
#
#   1. Structured decision — print JSON on STDOUT and exit 0.
#      Only stdout is parsed, and hookSpecificOutput.hookEventName is
#      required. This is the only way to return "ask", and the only way a
#      permissionDecision is honoured at all.
#
#   2. Plain blocking feedback — write the reason to STDERR and exit 2.
#      The stderr text is surfaced verbatim; it is NOT parsed as JSON.
#
# Printing JSON to stderr combines the worst of both: the decision is
# silently discarded and the raw JSON is shown to the model as prose.

set -euo pipefail

# Read input from stdin
input=$(cat)

# Extract command
command=$(echo "$input" | jq -r '.tool_input.command // empty')

# Validate command exists
if [ -z "$command" ]; then
  echo '{"continue": true}' # No command to validate
  exit 0
fi

# Check for obviously safe commands (quick approval)
if [[ "$command" =~ ^(ls|pwd|echo|date|whoami)(\s|$) ]]; then
  exit 0
fi

# Emit a structured PreToolUse decision on stdout, then exit 0.
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

# Check for destructive operations
if [[ "$command" == *"rm -rf"* ]] || [[ "$command" == *"rm -fr"* ]]; then
  emit_decision deny "Dangerous command detected: rm -rf"
fi

# Check for other dangerous commands
if [[ "$command" == *"dd if="* ]] || [[ "$command" == *"mkfs"* ]] || [[ "$command" == *"> /dev/"* ]]; then
  emit_decision deny "Dangerous system operation detected"
fi

# Check for privilege escalation. This must be a structured "ask": exiting 2
# would block outright, which is a different answer than asking the user.
if [[ "$command" == sudo* ]] || [[ "$command" == su* ]]; then
  emit_decision ask "Command requires elevated privileges"
fi

# Approve the operation
exit 0
