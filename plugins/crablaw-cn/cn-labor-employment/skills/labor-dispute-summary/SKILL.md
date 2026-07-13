---
name: 劳动争议梳理
short-description: 梳理中国法劳动争议的事实、证据、请求、抗辩、期限与复核要点
description: 梳理中国法劳动争议的事实、证据、请求、抗辩、期限与复核要点。当用户提到劳动仲裁/劳动争议/员工告公司/仲裁应对/争议材料整理/被申请仲裁了怎么办,或需要把一摞劳动纠纷材料体系化梳理供律师复核时使用本技能(即使未明说"争议梳理")。
argument-hint: "[dispute materials or facts]"
---

# /cn-labor-employment:labor-dispute-summary

【AI 辅助草稿，需律师复核】

Organize labor dispute materials for lawyer review. Do not decide final litigation or arbitration strategy.

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate: active matter, authorized scope, conflict-check status `no-hit` or `cleared-by-lawyer`, internal-only output destination, review queue item created, source records writable). Stop with the matching matter-core stop code if any check fails.

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
