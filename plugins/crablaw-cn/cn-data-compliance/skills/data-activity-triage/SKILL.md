---
name: 数据处理活动分诊
short-description: 分诊数据处理活动是否涉及个人信息、敏感信息、重要数据及专项评估
description: 对中国法下某项数据处理活动做初步分诊,判断是否涉及个人信息、敏感个人信息、重要数据,以及是否需做个人信息保护影响评估或出境审查。当用户提到这个数据合规吗/要不要做评估/涉不涉及个人信息/数据处理要注意什么/合规分诊/先判一判,或需要为某数据活动确定合规路径时使用本技能(即使未明说"分诊")。
argument-hint: "[processing activity facts]"
---

# /cn-data-compliance:data-activity-triage

【AI 辅助草稿，需律师复核】

Triage a processing activity. This is not a final compliance approval.

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate: active matter, authorized scope, conflict-check status `no-hit` or `cleared-by-lawyer`, internal-only output destination, review queue item created, source records writable). Stop with the matching matter-core stop code if any check fails.

## Workflow

1. Collect facts:
   - processor role.
   - data subjects.
   - data categories.
   - sensitive personal information.
   - minors' personal information.
   - purpose and processing operations.
   - recipients and entrusted processors.
   - retention and deletion.
   - cross-border transfer.
2. Classify:
   - ordinary personal information.
   - sensitive personal information.
   - important data candidate.
   - automated decision-making.
   - cross-border path candidate.
3. Determine whether further workpaper is needed:
   - personal information protection impact assessment.
   - separate consent review.
   - entrusted processing agreement review.
   - cross-border transfer path review.
4. Record verified sources in `sources.jsonl`. For any unverifiable point, mark it `[需核验]` AND write a paired `source-record` (`status: source-needs-check`; `effectiveStatus` describing the gap). The bundle check enforces that `[需核验]` and `source-needs-check` co-occur.
5. Create a review queue item.

## Output

Return initial classification, missing facts, required follow-up workpapers, source status, and lawyer review points.

## Next Steps

Route based on the triage:

- PIA required: hand off to `/cn-data-compliance:pia-generation` with the triage record id.
- Cross-border path candidate: hand off to `/cn-data-compliance:cross-border-transfer-check`.
- Entrusted, joint, or third-party recipient: hand off to `/cn-data-compliance:data-processing-review`.
- Privacy notice gaps surfaced: hand off to `/cn-data-compliance:privacy-policy-review`.
