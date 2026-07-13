---
name: 解除劳动关系风险审查
short-description: 形成中国法下解除/终止劳动关系或不续签的风险研判工作底稿
description: 形成中国法下解除/终止劳动关系或不续签的风险研判工作底稿。当用户提到辞退/开除/解除劳动合同/裁员/不续签/能不能辞退他/违法解除风险/赔偿金,或需要评估某员工离职处理的法律风险时使用本技能(即使未明说"解雇风险")。
argument-hint: "[termination facts and records]"
---

# /cn-labor-employment:termination-risk-review

【AI 辅助草稿，需律师复核】

Prepare a termination risk workpaper. Do not approve termination or issue a notice.

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate: active matter, authorized scope, conflict-check status `no-hit` or `cleared-by-lawyer`, internal-only output destination, review queue item created, source records writable). Stop with the matching matter-core stop code if any check fails.

## Workflow

1. Collect facts:
   - employee, role, location, tenure, contract term, compensation, working hour system.
   - proposed action and reason.
   - evidence, warnings, performance records, investigation records, and prior communications.
   - protected-status concerns: medical period, pregnancy/maternity/breastfeeding, work injury, union or representative status, complaint history.
   - proposed timeline and notice/delivery method.
2. Classify candidate path:
   - mutual termination.
   - employee fault.
   - incompetence or objective circumstance change.
   - economic layoff.
   - expiry or non-renewal.
   - other path requiring lawyer review.
3. Identify missing facts, procedural gaps, compensation calculation inputs, and local rule verification needs.
4. Record verified sources in `sources.jsonl`. For any unverifiable point, mark it `[需核验]` AND write a paired `source-record` (`status: source-needs-check`; `effectiveStatus` describing the gap). The bundle check enforces that `[需核验]` and `source-needs-check` co-occur.
5. Create a review queue item.

## Output

Return a risk matrix, missing evidence list, procedure checklist, compensation fact inputs, source status, and lawyer review points.
