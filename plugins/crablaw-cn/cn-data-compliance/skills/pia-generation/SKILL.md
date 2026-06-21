---
name: pia-generation
description: 起草中国法个人信息保护影响评估(PIA/PIPIA)工作底稿。当用户提到做 PIA/个人信息保护影响评估/影响评估报告/PIPIA/出个评估底稿,或需要为某处理活动形成影响评估文档时使用本技能(即使未明说"评估生成")。
argument-hint: "[processing activity or prior triage]"
---

# /cn-data-compliance:pia-generation

【AI 辅助草稿，需律师复核】

Draft a personal information protection impact assessment workpaper. It is not a final compliance approval.

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate: active matter, authorized scope, conflict-check status `no-hit` or `cleared-by-lawyer`, internal-only output destination, review queue item created, source records writable). Stop with the matching matter-core stop code if any check fails.

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
