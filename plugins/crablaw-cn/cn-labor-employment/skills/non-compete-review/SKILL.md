---
name: non-compete-review
description: 审查中国法竞业限制条款、限制范围、经济补偿与可执行性风险。当用户提到竞业限制/竞业禁止/竞业协议/离职后不能去同行/竞业补偿/违约金太高,或需要判断某竞业安排是否有效可执行时使用本技能(即使未明说"竞业审查")。
argument-hint: "[clause, agreement, employee facts, or dispute facts]"
---

# /cn-labor-employment:non-compete-review

【AI 辅助草稿，需律师复核】

Review non-compete issues. This is a workpaper, not an enforcement decision.

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate: active matter, authorized scope, conflict-check status `no-hit` or `cleared-by-lawyer`, internal-only output destination, review queue item created, source records writable). Stop with the matching matter-core stop code if any check fails.

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
