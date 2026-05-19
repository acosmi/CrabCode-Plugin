---
name: risk-summary
description: Convert a PRC contract review workpaper into an internal business risk summary.
argument-hint: "[review output path or pasted review]"
---

# /cn-contract:risk-summary

【AI 辅助草稿，需律师复核】

Prepare an internal business-facing summary from a contract review. Do not send externally and do not remove lawyer-review caveats.

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate from `matter-core/PRACTICE.md` (Required Gate). Additionally confirm the upstream review item exists; risk summaries must derive from a recorded review item, not from raw input. Stop with the matching matter-core stop code if any check fails.

## Workflow

1. Load the review output or pasted review.
2. Preserve risk severity and lawyer-review flags.
3. Translate legal detail into business impact:
   - money.
   - operational burden.
   - delivery risk.
   - termination risk.
   - data/IP exposure.
4. Remove privileged strategy only if the user asks for a broader internal audience summary; keep a note that the sanitized version still requires legal review.
5. Create or update a review queue item.

## Output

Return a concise internal summary, decision points, owner list, and lawyer review caveats.
