# Real-World Plugin Settings Examples

Detailed analysis of how production plugins use the `.crabcode/plugin-name.local.md` pattern.

## About these examples

One worked example, taken from a plugin that ships in this marketplace. The
frontmatter fields and defaults below are read from
`plugins/ralph-loop/src/state.ts`, not paraphrased — if they ever disagree with
that file, the file is right.

## ralph-loop Plugin

### Settings File Structure

**.crabcode/ralph-loop.local.md:**

```markdown
---
active: true
iteration: 1
session_id: "01JB2Z0Q4S8N7M6K5J4H3G2F1E"
max_iterations: 5
completion_promise: "All tests passing and build successful"
started_at: "2026-08-15T14:30:00Z"
---

Fix all the linting errors in the project.
Make sure tests pass after each fix.
Document any changes needed in CRABCODE.md.
```

Field notes, from `src/state.ts`:

- `max_iterations` defaults to `DEFAULT_MAX_ITERATIONS` (**5**) and is capped at
  `HARD_MAX_ITERATIONS` (200)
- `completion_promise` and `session_id` are the literal string `null` when unset
  — the parser treats `null` and empty as "absent", so a bare empty value is
  not an error
- `active: true` is written by `renderStateFile` but never read back by
  `parseStateFile`; treat it as a human-facing marker, not a control flag
- The body after the frontmatter is the prompt, and it is **required** — the
  parser rejects a state file with an empty body

### How It's Used

**Files:** `src/stopHook.ts`, `src/state.ts`, `src/setupRalphLoop.ts`
(the plugin is implemented in TypeScript; `hooks/hooks.json` registers the Stop
hook that runs it)

**Purpose:** Prevent session exit and re-feed the stored prompt as input

**Implementation:**

```bash
#!/bin/bash
set -euo pipefail

RALPH_STATE_FILE=".crabcode/ralph-loop.local.md"

# Quick exit if no active loop
if [[ ! -f "$RALPH_STATE_FILE" ]]; then
  exit 0
fi

# Parse frontmatter
FRONTMATTER=$(awk 'NR==1 && /^---$/ {c=1; next} c==1 && /^---$/ {exit} c==1' "$RALPH_STATE_FILE")

# Extract configuration
ITERATION=$(echo "$FRONTMATTER" | grep '^iteration:' | sed 's/iteration: *//')
MAX_ITERATIONS=$(echo "$FRONTMATTER" | grep '^max_iterations:' | sed 's/max_iterations: *//')
COMPLETION_PROMISE=$(echo "$FRONTMATTER" | grep '^completion_promise:' | sed 's/completion_promise: *//' | sed 's/^"\(.*\)"$/\1/')

# Check max iterations
if [[ $MAX_ITERATIONS -gt 0 ]] && [[ $ITERATION -ge $MAX_ITERATIONS ]]; then
  echo "🛑 Ralph loop: Max iterations ($MAX_ITERATIONS) reached."
  rm "$RALPH_STATE_FILE"
  exit 0
fi

# Get transcript and check for completion promise
TRANSCRIPT_PATH=$(echo "$HOOK_INPUT" | jq -r '.transcript_path')
LAST_OUTPUT=$(grep '"role":"assistant"' "$TRANSCRIPT_PATH" | tail -1 | jq -r '.message.content | map(select(.type == "text")) | map(.text) | join("\n")')

# Check for completion
if [[ "$COMPLETION_PROMISE" != "null" ]] && [[ -n "$COMPLETION_PROMISE" ]]; then
  PROMISE_TEXT=$(echo "$LAST_OUTPUT" | perl -0777 -pe 's/.*?<promise>(.*?)<\/promise>.*/$1/s; s/^\s+|\s+$//g')

  if [[ "$PROMISE_TEXT" = "$COMPLETION_PROMISE" ]]; then
    echo "✅ Ralph loop: Detected completion"
    rm "$RALPH_STATE_FILE"
    exit 0
  fi
fi

# Continue loop - increment iteration
NEXT_ITERATION=$((ITERATION + 1))

# Extract prompt from markdown body
PROMPT_TEXT=$(awk 'c==2{print; next} /^---$/{c++}' "$RALPH_STATE_FILE")

# Update iteration counter
TEMP_FILE="${RALPH_STATE_FILE}.tmp.$$"
sed "s/^iteration: .*/iteration: $NEXT_ITERATION/" "$RALPH_STATE_FILE" > "$TEMP_FILE"
mv "$TEMP_FILE" "$RALPH_STATE_FILE"

# Block exit and feed prompt back
jq -n \
  --arg prompt "$PROMPT_TEXT" \
  --arg msg "🔄 Ralph iteration $NEXT_ITERATION" \
  '{
    "decision": "block",
    "reason": $prompt,
    "systemMessage": $msg
  }'

exit 0
```

**Key patterns:**
1. **Quick exit** (line 7-9): Skip if not active
2. **Iteration tracking** (lines 11-20): Count and enforce max iterations
3. **Promise detection** (lines 25-33): Check for completion signal in output
4. **Prompt extraction** (line 38): Read markdown body as next prompt
5. **State update** (lines 40-43): Increment iteration atomically
6. **Loop continuation** (lines 45-53): Block exit and feed prompt back

### Creation

**File:** `scripts/setup-ralph-loop.sh`

```bash
#!/bin/bash
PROMPT="$1"
MAX_ITERATIONS="${2:-0}"
COMPLETION_PROMISE="${3:-}"

# Create state file
cat > ".crabcode/ralph-loop.local.md" <<EOF
---
iteration: 1
max_iterations: $MAX_ITERATIONS
completion_promise: "$COMPLETION_PROMISE"
started_at: "$(date -Iseconds)"
---

$PROMPT
EOF

echo "Ralph loop initialized: .crabcode/ralph-loop.local.md"
```

## What the shape buys you

| Aspect | How ralph-loop uses it |
|---|---|
| **File** | `.crabcode/ralph-loop.local.md` |
| **Purpose** | Loop iteration state |
| **Frontmatter** | Loop configuration (counter, cap, promise, session) |
| **Body** | The prompt to re-feed |
| **Updates** | Iteration counter, rewritten each pass |
| **Deletion** | On loop exit |
| **Hook** | Stop (loop control) |

The split is the point: machine-readable settings in frontmatter, free-form
content in the body. A counter belongs above the fence; a paragraph of prompt
does not.

## Best Practices from Real Plugins

### 1. Quick Exit Pattern

Check file existence first:

```bash
if [[ ! -f "$STATE_FILE" ]]; then
  exit 0  # Not active
fi
```

**Why:** Avoids errors when plugin isn't configured and performs fast.

### 2. A Presence-or-Flag Decision

ralph-loop treats **file existence** as the on/off switch: no state file means
no loop. It also writes `active: true`, but nothing reads that back.

Either convention works; pick one and be consistent:

```yaml
enabled: true    # only meaningful if your hook actually reads it
```

**Why it matters:** a flag that no code reads is worse than no flag, because it
looks like a control the user can turn off. If you write `enabled`, read it.

### 3. Atomic Updates

Write to a temp file, then move it into place:

```bash
TEMP_FILE="${FILE}.tmp.$$"
sed "s/^field: .*/field: $NEW_VALUE/" "$FILE" > "$TEMP_FILE"
mv "$TEMP_FILE" "$FILE"
```

**Why:** Prevents corruption if process is interrupted.

### 4. Quote Handling

Both strip surrounding quotes from YAML values:

```bash
sed 's/^"\(.*\)"$/\1/'
```

**Why:** YAML allows both `field: value` and `field: "value"`.

### 5. Error Handling

Both handle missing/corrupt files gracefully:

```bash
if [[ ! -f "$FILE" ]]; then
  exit 0  # No error, just not configured
fi

if [[ -z "$CRITICAL_FIELD" ]]; then
  echo "Settings file corrupt" >&2
  rm "$FILE"  # Clean up
  exit 0
fi
```

**Why:** Fails gracefully instead of crashing.

## Anti-Patterns to Avoid

### ❌ Hardcoded Paths

```bash
# BAD
FILE="/Users/alice/.crabcode/my-plugin.local.md"

# GOOD
FILE=".crabcode/my-plugin.local.md"
```

### ❌ Unquoted Variables

```bash
# BAD
echo $VALUE

# GOOD
echo "$VALUE"
```

### ❌ Non-Atomic Updates

```bash
# BAD: Can corrupt file if interrupted
sed -i "s/field: .*/field: $VALUE/" "$FILE"

# GOOD: Atomic
TEMP_FILE="${FILE}.tmp.$$"
sed "s/field: .*/field: $VALUE/" "$FILE" > "$TEMP_FILE"
mv "$TEMP_FILE" "$FILE"
```

### ❌ No Default Values

```bash
# BAD: Fails if field missing
if [[ $MAX -gt 100 ]]; then
  # MAX might be empty!
fi

# GOOD: Provide default
MAX=${MAX:-10}
```

### ❌ Ignoring Edge Cases

```bash
# BAD: Assumes exactly 2 --- markers
awk 'NR==1 && /^---$/ {c=1; next} c==1 && /^---$/ {exit} c==1'

# GOOD: Handles --- in body
awk 'c==2{print; next} /^---$/{c++}'  # For body
```

## Conclusion

The `.crabcode/plugin-name.local.md` pattern provides:
- Simple, human-readable configuration
- Version-control friendly (gitignored)
- Per-project settings
- Easy parsing with standard bash tools
- Supports both structured config (YAML) and freeform content (markdown)

Use this pattern for any plugin that needs user-configurable behavior or state persistence.
