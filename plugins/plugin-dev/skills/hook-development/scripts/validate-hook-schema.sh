#!/bin/bash
# Hook Schema Validator
# Validates a plugin hooks/hooks.json against the shape the loader accepts.
#
# A malformed hooks.json is not a soft failure: the plugin loader parses it
# strictly and hard-errors, taking the whole plugin down. This script exists to
# catch that before install.

set -euo pipefail

# Usage
if [ $# -eq 0 ]; then
  echo "Usage: $0 <path/to/hooks.json>"
  echo ""
  echo "Validates hook configuration file for:"
  echo "  - Valid JSON syntax"
  echo "  - The wrapper structure the plugin loader requires"
  echo "  - Known event names"
  echo "  - Hook type validity and type-specific required fields"
  echo "  - Timeout sanity"
  exit 1
fi

HOOKS_FILE="$1"

if [ ! -f "$HOOKS_FILE" ]; then
  echo "❌ Error: File not found: $HOOKS_FILE"
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "❌ Error: jq is required but was not found on PATH"
  exit 1
fi

echo "🔍 Validating hooks configuration: $HOOKS_FILE"
echo ""

error_count=0
warning_count=0
bump_error() { error_count=$((error_count + 1)); }
bump_warning() { warning_count=$((warning_count + 1)); }

# jq builds for Windows terminate lines with CRLF. An unstripped trailing \r
# turns every string comparison and every .hooks[$event] lookup into a silent
# miss, so route all jq reads through here.
jqr() { jq -r "$@" | tr -d '\r'; }

# Check 1: Valid JSON
echo "Checking JSON syntax..."
if ! jq empty "$HOOKS_FILE" 2>/dev/null; then
  echo "❌ Invalid JSON syntax"
  exit 1
fi
echo "✅ Valid JSON"

# Check 2: Wrapper structure.
# A plugin hooks.json is { "description"?: string, "hooks": { <Event>: [...] } }.
# The bare { <Event>: [...] } form is the single most common mistake — it is the
# shape used inside settings.json, and it fails to load as a plugin hooks file.
echo ""
echo "Checking wrapper structure..."

ROOT_TYPE=$(jqr 'type' "$HOOKS_FILE")
if [ "$ROOT_TYPE" != "object" ]; then
  echo "❌ Root must be a JSON object, found: $ROOT_TYPE"
  exit 1
fi

if [ "$(jqr 'has("hooks")' "$HOOKS_FILE")" != "true" ]; then
  echo "❌ Missing required top-level 'hooks' key"
  echo ""
  echo "   Plugin hooks.json must wrap the event map:"
  echo '     { "description": "...", "hooks": { "PreToolUse": [ ... ] } }'
  echo ""
  echo "   The unwrapped form { \"PreToolUse\": [ ... ] } is the settings.json"
  echo "   shape and will fail to load as a plugin hooks file."
  exit 1
fi

if [ "$(jqr '.hooks | type' "$HOOKS_FILE")" != "object" ]; then
  echo "❌ 'hooks' must be an object mapping event names to matcher arrays"
  exit 1
fi
echo "✅ Wrapper structure valid"

# Check 3: Event names.
# Full event set as accepted by the loader.
VALID_EVENTS=(
  "PreToolUse" "PostToolUse" "PostToolUseFailure" "Notification"
  "UserPromptSubmit" "SessionStart" "SessionEnd" "Stop" "StopFailure"
  "SubagentStart" "SubagentStop" "PreCompact" "PostCompact"
  "PermissionRequest" "PermissionDenied" "Setup" "TeammateIdle"
  "TaskCreated" "TaskCompleted" "Elicitation" "ElicitationResult"
  "ConfigChange" "WorktreeCreate" "WorktreeRemove" "InstructionsLoaded"
  "CwdChanged" "FileChanged"
)

echo ""
echo "Checking event names..."
while IFS= read -r event; do
  [ -z "$event" ] && continue
  found=false
  for valid_event in "${VALID_EVENTS[@]}"; do
    if [ "$event" = "$valid_event" ]; then
      found=true
      break
    fi
  done
  if [ "$found" = false ]; then
    echo "❌ Unknown event type: $event"
    bump_error
  fi
done < <(jqr '.hooks | keys[]' "$HOOKS_FILE")
echo "✅ Event names checked"

# Check 4: Validate each hook
echo ""
echo "Validating individual hooks..."

while IFS= read -r event; do
  [ -z "$event" ] && continue

  if [ "$(jqr --arg e "$event" '.hooks[$e] | type' "$HOOKS_FILE")" != "array" ]; then
    echo "❌ $event: value must be an array of matcher groups"
    bump_error
    continue
  fi

  hook_count=$(jqr --arg e "$event" '.hooks[$e] | length' "$HOOKS_FILE")

  for ((i = 0; i < hook_count; i++)); do
    # 'matcher' is optional — omitting it matches every value for the event.
    # Only 'hooks' is required on a matcher group.
    if [ "$(jqr --arg e "$event" --argjson i "$i" '.hooks[$e][$i] | has("hooks")' "$HOOKS_FILE")" != "true" ]; then
      echo "❌ $event[$i]: Missing 'hooks' array"
      bump_error
      continue
    fi

    if [ "$(jqr --arg e "$event" --argjson i "$i" '.hooks[$e][$i].hooks | type' "$HOOKS_FILE")" != "array" ]; then
      echo "❌ $event[$i]: 'hooks' must be an array"
      bump_error
      continue
    fi

    hook_array_count=$(jqr --arg e "$event" --argjson i "$i" '.hooks[$e][$i].hooks | length' "$HOOKS_FILE")

    for ((j = 0; j < hook_array_count; j++)); do
      entry() {
        jqr --arg e "$event" --argjson i "$i" --argjson j "$j" \
          ".hooks[\$e][\$i].hooks[\$j].$1 // empty" "$HOOKS_FILE"
      }

      hook_type=$(entry type)

      if [ -z "$hook_type" ]; then
        echo "❌ $event[$i].hooks[$j]: Missing 'type' field"
        bump_error
        continue
      fi

      case "$hook_type" in
        command)
          command_value=$(entry command)
          if [ -z "$command_value" ]; then
            echo "❌ $event[$i].hooks[$j]: Command hooks must have 'command' field"
            bump_error
          elif [[ "$command_value" == /* ]] && [[ "$command_value" != *'${CRABCODE_PLUGIN_ROOT}'* ]]; then
            echo "⚠️  $event[$i].hooks[$j]: Hardcoded absolute path detected. Consider using \${CRABCODE_PLUGIN_ROOT}"
            bump_warning
          fi
          ;;
        prompt)
          if [ -z "$(entry prompt)" ]; then
            echo "❌ $event[$i].hooks[$j]: Prompt hooks must have 'prompt' field"
            bump_error
          fi
          ;;
        agent)
          if [ -z "$(entry prompt)" ] && [ -z "$(entry agent)" ]; then
            echo "⚠️  $event[$i].hooks[$j]: Agent hooks normally declare the agent to run"
            bump_warning
          fi
          ;;
        http)
          if [ -z "$(entry url)" ]; then
            echo "❌ $event[$i].hooks[$j]: HTTP hooks must have 'url' field"
            bump_error
          fi
          ;;
        *)
          echo "❌ $event[$i].hooks[$j]: Invalid type '$hook_type' (must be command, prompt, agent, or http)"
          bump_error
          ;;
      esac

      # Timeout is in seconds and optional. When omitted the host applies its
      # own default (10 minutes for tool hooks) — 600 is that default, not a
      # ceiling, so a larger value is legal and only worth flagging as unusual.
      timeout=$(entry timeout)
      if [ -n "$timeout" ] && [ "$timeout" != "null" ]; then
        if ! [[ "$timeout" =~ ^[0-9]+$ ]]; then
          echo "❌ $event[$i].hooks[$j]: Timeout must be a number (seconds)"
          bump_error
        elif [ "$timeout" -gt 600 ]; then
          echo "⚠️  $event[$i].hooks[$j]: Timeout ${timeout}s exceeds the 600s default — confirm this is intended"
          bump_warning
        elif [ "$timeout" -lt 5 ]; then
          echo "⚠️  $event[$i].hooks[$j]: Timeout ${timeout}s is very low"
          bump_warning
        fi
      fi
    done
  done
done < <(jqr '.hooks | keys[]' "$HOOKS_FILE")

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $error_count -eq 0 ] && [ $warning_count -eq 0 ]; then
  echo "✅ All checks passed!"
  exit 0
elif [ $error_count -eq 0 ]; then
  echo "⚠️  Validation passed with $warning_count warning(s)"
  exit 0
else
  echo "❌ Validation failed with $error_count error(s) and $warning_count warning(s)"
  exit 1
fi
