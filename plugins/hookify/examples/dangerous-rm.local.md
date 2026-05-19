---
name: block-dangerous-rm
enabled: true
event: bash
pattern: rm\s+-rf
action: block
---

Dangerous rm command detected.

This command could delete important files. Before running it:
- Verify the path is correct.
- Consider a safer approach (move to trash, archive, scoped path).
- Make sure you have backups.
