#!/bin/bash
# Agent File Validator
# Validates agent markdown files for correct structure and content

set -euo pipefail

# Usage
if [ $# -eq 0 ]; then
  echo "Usage: $0 <path/to/agent.md>"
  echo ""
  echo "Validates agent file for:"
  echo "  - YAML frontmatter structure"
  echo "  - Required fields (name, description)"
  echo "  - Optional fields (model, color, tools)"
  echo "  - Field formats and constraints"
  echo "  - System prompt presence and length"
  echo "  - Prose trigger scenarios in description"
  exit 1
fi

AGENT_FILE="$1"

echo "🔍 Validating agent file: $AGENT_FILE"
echo ""

# Check 1: File exists
if [ ! -f "$AGENT_FILE" ]; then
  echo "❌ File not found: $AGENT_FILE"
  exit 1
fi
echo "✅ File exists"

# Check 2: Starts with ---
FIRST_LINE=$(head -1 "$AGENT_FILE")
if [ "$FIRST_LINE" != "---" ]; then
  echo "❌ File must start with YAML frontmatter (---)"
  exit 1
fi
echo "✅ Starts with frontmatter"

# Check 3: Has closing ---
if ! tail -n +2 "$AGENT_FILE" | grep -q '^---$'; then
  echo "❌ Frontmatter not closed (missing second ---)"
  exit 1
fi
echo "✅ Frontmatter properly closed"

# Extract frontmatter and system prompt.
# Both extractors stop counting delimiters once the body starts, so a `---`
# horizontal rule inside the system prompt is preserved verbatim instead of
# being swallowed or mistaken for a frontmatter fence.
FRONTMATTER=$(awk 'NR==1 && /^---$/ {c=1; next} c==1 && /^---$/ {exit} c==1' "$AGENT_FILE")
SYSTEM_PROMPT=$(awk 'c==2 {print; next} /^---$/ {c++}' "$AGENT_FILE")

# Read one frontmatter field. Handles both inline values and YAML block
# scalars (`key: |`, `key: >-`, ...), which the agent `description` field
# almost always uses — reading only the header line yields just "|".
get_field() {
  printf '%s\n' "$FRONTMATTER" | awk -v key="$1" '
    !done && index($0, key ":") == 1 {
      value = substr($0, length(key) + 2)
      sub(/^[ \t]+/, "", value)
      if (value ~ /^[|>][-+0-9]*[ \t]*$/) { block = 1; done = 1; next }
      sub(/^"(.*)"$/, "\\1", value)
      sub(/^'\''(.*)'\''$/, "\\1", value)
      print value; done = 1; next
    }
    block {
      if ($0 ~ /^[ \t]/ || $0 ~ /^[ \t]*$/) { sub(/^[ \t]+/, "", $0); print; next }
      block = 0
    }
  '
}

# Check 4: Required fields
echo ""
echo "Checking required fields..."

error_count=0
warning_count=0

# Counter helpers: bare `((n++))` evaluates to the pre-increment value, so the
# first increment from 0 returns exit status 1 and `set -e` kills the run.
bump_error() { error_count=$((error_count + 1)); }
bump_warning() { warning_count=$((warning_count + 1)); }

# Check name field
NAME=$(get_field name)

if [ -z "$NAME" ]; then
  echo "❌ Missing required field: name"
  bump_error
else
  echo "✅ name: $NAME"

  # Validate name format
  if ! [[ "$NAME" =~ ^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$ ]]; then
    echo "❌ name must start/end with alphanumeric and contain only letters, numbers, hyphens"
    bump_error
  fi

  # Validate name length
  name_length=${#NAME}
  if [ $name_length -lt 3 ]; then
    echo "❌ name too short (minimum 3 characters)"
    bump_error
  elif [ $name_length -gt 50 ]; then
    echo "❌ name too long (maximum 50 characters)"
    bump_error
  fi

  # Check for generic names
  if [[ "$NAME" =~ ^(helper|assistant|agent|tool)$ ]]; then
    echo "⚠️  name is too generic: $NAME"
    bump_warning
  fi
fi

# Check description field
DESCRIPTION=$(get_field description)

if [ -z "$DESCRIPTION" ]; then
  echo "❌ Missing required field: description"
  bump_error
else
  desc_length=${#DESCRIPTION}
  echo "✅ description: ${desc_length} characters"

  if [ $desc_length -lt 10 ]; then
    echo "⚠️  description too short (minimum 10 characters recommended)"
    bump_warning
  elif [ $desc_length -gt 5000 ]; then
    echo "⚠️  description very long (over 5000 characters)"
    bump_warning
  fi

  # Check for prose trigger scenarios (this skill teaches prose, not transcript
  # <example> blocks — see SKILL.md "description (required)" and the checklist)
  if ! echo "$DESCRIPTION" | grep -qi 'typical triggers\|trigger'; then
    echo "⚠️  description should name 2-4 trigger scenarios in prose"
    bump_warning
  fi

  # Check for "Use this agent when" pattern
  if ! echo "$DESCRIPTION" | grep -qi 'use this agent when'; then
    echo "⚠️  description should start with 'Use this agent when...'"
    bump_warning
  fi
fi

# Check model field
MODEL=$(get_field model)

if [ -z "$MODEL" ]; then
  echo "💡 model: not specified (optional — agent inherits the session model)"
else
  echo "✅ model: $MODEL"

  # Accepted values: 'inherit', the semantic aliases, or a full model id.
  # Do not pin a literal model id in shipped examples — ids change between
  # catalog releases, and a stale pin fails closed at load time.
  case "$MODEL" in
    inherit|best|planmode)
      # Semantic value — stable across catalog releases
      ;;
    *)
      echo "💡 model '$MODEL' is treated as a literal model id"
      echo "   (prefer: inherit, best, or planmode)"
      ;;
  esac
fi

# Check color field
COLOR=$(get_field color)

if [ -z "$COLOR" ]; then
  echo "💡 color: not specified (optional — one is assigned automatically)"
else
  echo "✅ color: $COLOR"

  case "$COLOR" in
    red|blue|green|yellow|purple|orange|pink|cyan)
      # Valid color
      ;;
    *)
      echo "⚠️  Unknown color: $COLOR"
      echo "   (valid: red, blue, green, yellow, purple, orange, pink, cyan)"
      bump_warning
      ;;
  esac
fi

# Check tools field (optional)
TOOLS=$(get_field tools)

if [ -n "$TOOLS" ]; then
  echo "✅ tools: $TOOLS"
else
  echo "💡 tools: not specified (agent has access to all tools)"
fi

# Check 5: System prompt
echo ""
echo "Checking system prompt..."

if [ -z "$SYSTEM_PROMPT" ]; then
  echo "❌ System prompt is empty"
  bump_error
else
  prompt_length=${#SYSTEM_PROMPT}
  echo "✅ System prompt: $prompt_length characters"

  if [ $prompt_length -lt 20 ]; then
    echo "❌ System prompt too short (minimum 20 characters)"
    bump_error
  elif [ $prompt_length -gt 10000 ]; then
    echo "⚠️  System prompt very long (over 10,000 characters)"
    bump_warning
  fi

  # Check for second person
  if ! echo "$SYSTEM_PROMPT" | grep -q "You are\|You will\|Your"; then
    echo "⚠️  System prompt should use second person (You are..., You will...)"
    bump_warning
  fi

  # Check for structure
  if ! echo "$SYSTEM_PROMPT" | grep -qi "responsibilities\|process\|steps"; then
    echo "💡 Consider adding clear responsibilities or process steps"
  fi

  if ! echo "$SYSTEM_PROMPT" | grep -qi "output"; then
    echo "💡 Consider defining output format expectations"
  fi
fi

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
