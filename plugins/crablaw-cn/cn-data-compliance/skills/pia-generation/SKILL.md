---
name: pia-generation
description: Draft a PRC personal information protection impact assessment workpaper.
argument-hint: "[processing activity or prior triage]"
---

# /cn-data-compliance:pia-generation

【AI 辅助草稿，需律师复核】

Draft a personal information protection impact assessment workpaper. It is not a final compliance approval.

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate from `matter-core/PRACTICE.md` (Required Gate: active matter, authorized scope, conflict-check status `no-hit` or `cleared-by-lawyer`, internal-only output destination, review queue item created, source records writable). Stop with the matching matter-core stop code if any check fails.

## Workflow

1. Load prior triage or collect activity facts.
2. Confirm whether the assessment is required by the activity facts or requested by the reviewer.
3. Structure the workpaper:
   - processing purpose and necessity.
   - impact on individual rights.
   - risk to personal information security.
   - protection measures.
   - third-party and cross-border arrangements.
   - residual risks.
   - reviewer sign-off fields.
4. Record verified sources in `sources.jsonl`. For any unverifiable point, mark it `[需核验]` AND write a paired `source-record` (`status: source-needs-check`; `effectiveStatus` describing the gap). The bundle check enforces that `[需核验]` and `source-needs-check` co-occur.
5. Create a review queue item.

## Output

Return a PIA draft, missing facts, source table, mitigation owner list, and lawyer review points.
