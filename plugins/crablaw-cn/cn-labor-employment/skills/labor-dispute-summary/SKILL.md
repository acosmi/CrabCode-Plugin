---
name: labor-dispute-summary
description: Organize PRC labor dispute facts, evidence, claims, defenses, deadlines, and review points.
argument-hint: "[dispute materials or facts]"
---

# /cn-labor-employment:labor-dispute-summary

【AI 辅助草稿，需律师复核】

Organize labor dispute materials for lawyer review. Do not decide final litigation or arbitration strategy.

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate from `matter-core/PRACTICE.md` (Required Gate: active matter, authorized scope, conflict-check status `no-hit` or `cleared-by-lawyer`, internal-only output destination, review queue item created, source records writable). Stop with the matching matter-core stop code if any check fails.

## Workflow

1. Collect dispute parties, claims, timeline, employment facts, evidence, communications, and procedural posture.
2. Build:
   - chronology.
   - claim/defense table.
   - evidence index.
   - missing facts.
   - deadline verification list.
   - settlement or communication constraints.
3. Record verified sources in `sources.jsonl`. For any unverifiable point, mark it `[需核验]` AND write a paired `source-record` (`status: source-needs-check`; `effectiveStatus` describing the gap). The bundle check enforces that `[需核验]` and `source-needs-check` co-occur.
4. Create a review queue item.

## Output

Return dispute summary, chronology, evidence map, risk points, source status, and lawyer review points.
