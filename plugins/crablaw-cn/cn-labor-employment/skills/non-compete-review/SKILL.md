---
name: non-compete-review
description: Review PRC non-compete clauses, restrictions, compensation, and enforcement risk.
argument-hint: "[clause, agreement, employee facts, or dispute facts]"
---

# /cn-labor-employment:non-compete-review

【AI 辅助草稿，需律师复核】

Review non-compete issues. This is a workpaper, not an enforcement decision.

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate from `matter-core/PRACTICE.md` (Required Gate: active matter, authorized scope, conflict-check status `no-hit` or `cleared-by-lawyer`, internal-only output destination, review queue item created, source records writable). Stop with the matching matter-core stop code if any check fails.

## Workflow

1. Identify employee role, access to confidentiality/trade secrets, restriction scope, territory, period, compensation, breach liability, and termination status.
2. Check:
   - whether the employee category is appropriate for non-compete.
   - whether scope, territory, period, and compensation need narrowing.
   - whether monthly compensation and payment records support enforcement.
   - whether local judicial practice requires verification.
   - relationship with confidentiality and trade secret evidence.
3. Record verified sources in `sources.jsonl`. For any unverifiable point, mark it `[需核验]` AND write a paired `source-record` (`status: source-needs-check`; `effectiveStatus` describing the gap). The bundle check enforces that `[需核验]` and `source-needs-check` co-occur.
4. Create a review queue item.

## Output

Return enforceability risk, drafting suggestions, evidence checklist, source status, and lawyer review points.
