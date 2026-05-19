---
name: employee-handbook-review
description: Review a PRC employee handbook or policy update for legal and procedure risks.
argument-hint: "[handbook text, policy text, or change request]"
---

# /cn-labor-employment:employee-handbook-review

【AI 辅助草稿，需律师复核】

Review employee handbook language. Do not mark it approved for publication or implementation.

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate from `matter-core/PRACTICE.md` (Required Gate: active matter, authorized scope, conflict-check status `no-hit` or `cleared-by-lawyer`, internal-only output destination, review queue item created, source records writable). Stop with the matching matter-core stop code if any check fails.

## Workflow

1. Identify policy sections and intended update.
2. Check:
   - democratic procedure and consultation evidence.
   - publication and acknowledgment process.
   - disciplinary rules and proportionality.
   - compensation, working hours, leave, benefits, confidentiality, data processing, and conflict-of-interest sections.
   - consistency with employment contracts and local rules.
3. Flag rollout risks and missing proof.
4. Record verified sources in `sources.jsonl`. For any unverifiable point, mark it `[需核验]` AND write a paired `source-record` (`status: source-needs-check`; `effectiveStatus` describing the gap). The bundle check enforces that `[需核验]` and `source-needs-check` co-occur.
5. Create a review queue item.

## Output

Return issue table, drafting suggestions, rollout checklist, source status, and lawyer review points.
