---
description: "Cancel the active Ralph loop in this directory."
allowed-tools: ["Bash(test -f .crabcode/ralph-loop.local.md:*)", "Bash(rm .crabcode/ralph-loop.local.md)", "Read(.crabcode/ralph-loop.local.md)"]
hide-from-slash-command-tool: "true"
---

# Cancel Ralph

1. Check whether `.crabcode/ralph-loop.local.md` exists:

```!
test -f .crabcode/ralph-loop.local.md && echo "EXISTS" || echo "NOT_FOUND"
```

2. If `NOT_FOUND`: reply "No active Ralph loop found." and stop.
3. If `EXISTS`:
   - Read `.crabcode/ralph-loop.local.md`, find the `iteration:` field.
   - Remove the file:

```!
rm .crabcode/ralph-loop.local.md
```

   - Report: "Cancelled Ralph loop (was at iteration N)."
