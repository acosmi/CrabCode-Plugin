---
name: clause-redraft
description: Draft or revise a PRC contract clause for lawyer review within an active matter.
argument-hint: "[clause text and objective]"
---

# /cn-contract:clause-redraft

【AI 辅助草稿，需律师复核】

Draft clause language for review. Do not present the clause as final or approved.

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate). If conflict-check status is `pending`, stop before drafting and emit `CONFLICT_CHECK_PENDING`; if `hit-review-required`, stop and emit `CONFLICT_REVIEW_REQUIRED`. Stop with the matching matter-core stop code if any other check fails.

## Workflow

1. Identify the clause type and user objective.
2. Ask for missing facts when the requested drafting depends on commercial terms.
3. Draft a conservative version aligned with PRC contract principles and the active profile.
4. Add alternatives only when the business tradeoff is clear.
5. Mark legal-source gaps as `[需核验]` AND write a paired entry in `sources.jsonl` (`source-record` with `status: source-needs-check`; `effectiveStatus` must describe what verification is needed). The bundle check enforces that `[需核验]` and `source-needs-check` co-occur.
6. Create or update a review queue item.

## Output

Return:

- Draft clause.
- Rationale.
- Business choices.
- Legal verification points.
- Negotiation notes.
