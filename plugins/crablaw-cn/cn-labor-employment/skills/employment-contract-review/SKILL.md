---
name: employment-contract-review
description: Review a PRC employment contract draft as a lawyer-review workpaper.
argument-hint: "[contract text, file path, or facts]"
---

# /cn-labor-employment:employment-contract-review

【AI 辅助草稿，需律师复核】

Review an employment contract draft. Do not mark the contract as approved or ready to sign.

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate: active matter, authorized scope, conflict-check status `no-hit` or `cleared-by-lawyer`, internal-only output destination, review queue item created, source records writable). Stop with the matching matter-core stop code if any check fails.

## Workflow

1. Extract employer, employee, location, term, probation, role, workplace, working hours, compensation, social insurance, benefits, confidentiality, non-compete, service period, termination, and dispute resolution.
2. Check against PRC labor workflow issue areas:
   - written contract and mandatory terms.
   - probation period and term alignment.
   - working hours, overtime, rest, and leave.
   - compensation and social insurance.
   - confidentiality, intellectual property, and non-compete.
   - unilateral change, discipline, and termination clauses.
   - local rule verification needs.
3. Record verified sources in `sources.jsonl`. For any unverifiable point, mark it `[需核验]` AND write a paired `source-record` (`status: source-needs-check`; `effectiveStatus` describing the gap). The bundle check enforces that `[需核验]` and `source-needs-check` co-occur.
4. Create a review queue item.

## Output

Return risk table, clause comments, missing facts, source status, and lawyer review points.

## Next Steps

Route based on the review findings:

- Termination scenarios surfaced: hand off to `/cn-labor-employment:termination-risk-review` with the matter facts.
- Non-compete or post-employment restrictions: hand off to `/cn-labor-employment:non-compete-review`.
- Cross-references to handbook or workplace policies: hand off to `/cn-labor-employment:employee-handbook-review`.
- Pending or live dispute context: hand off to `/cn-labor-employment:labor-dispute-summary`.
