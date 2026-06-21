---
name: supervisor-review-queue
description: 法律援助质量监督/督导复核队列,整理待复核交付物、复核要点与质量监督结论,用 review-queue。当用户提到质量监督、督导复核、案件质量检查、复核队列、把材料交主任/督导审,需要对援助交付物做质量把关时使用本技能(即使未明说"复核队列")。
argument-hint: "[受援人 matter id 或待复核的 reviewItemId 与复核范围]"
---

# /cn-legal-aid:supervisor-review-queue

【AI 辅助草稿，需律师复核】

法律援助质量监督/督导复核队列底稿，组织待复核交付物与复核要点，记录于 `review-queue`。本产出为内部工作底稿，复核结论由督导律师作出，本技能不替代人工复核，不标注为最终结论。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate). 入列前额外确认：受援人=client、援助事项=matter（matterType=legal-aid）已建、冲突筛查通过；待复核交付物均落在援助事项范围内。复核结论须由人工督导作出（decisionActor: manual-lawyer-review）。Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 汇总待复核项：列出本事项下状态为 draft/pending-review 的 review-queue item（reviewItemId、sourceSkill、outputPath），按紧迫性与风险排序。
2. 复核要点清单：对每项给出质量监督维度——事实是否清楚、法律适用与依据是否准确（三值标注是否到位）、期限是否齐备、风险分级是否合理、是否存在被静默降级的上游 🔴/🟠、对外件是否经发送目的地检查。
3. 资格与程序合规抽查：抽查资格审查、受理登记、利益冲突回避等关键合规节点是否留痕完整。
4. 来源核验状态：核对各项是否存在未配 `source-record` 的 `[模型知识-待核]` 法律点，标记为整改项。
5. 复核处置建议（待督导确认）：对每项建议 returned（退回整改，须填 decisionNotes）/ approved-internal / approved-external（须填 externalDestination）/ 其他；本技能仅生成建议，最终由督导律师在 review-queue 中作出决定并填 reviewer、reviewedAt、decisionActor。
6. 质量监督记录：归纳本批复核的共性问题与改进建议，供质量监督台账留存。
7. 来源标注：复核中引用的法律点按三值标注；无核验来源配 `source-record`（status: source-needs-check）。

## Output

- 复核队列摘要（reviewer note 置顶）。
- 待复核项列表（reviewItemId/sourceSkill/outputPath/排序）。
- 逐项复核要点与发现。
- 资格与程序合规抽查结果。
- 来源核验整改项。
- 处置建议（待督导确认，含状态流转所需字段）。
- 质量监督共性问题与改进建议。
- 来源表与待核项。
- 督导复核要点。

## Next Steps

- 退回整改：交回对应 skill（如 `/cn-legal-aid:document-draft`、`/cn-legal-aid:aid-application-form`）按 decisionNotes 修改。
- 对外件批准前：确认发送目的地与可发版/完整版选择。
- 案件整体收尾质量评估：移交 `/cn-legal-aid:case-closure`。
- 期限相关整改：移交 `/cn-legal-aid:deadlines`。
