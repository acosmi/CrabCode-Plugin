---
name: deadlines
description: 法律援助案件期限管理,识别并登记诉讼时效、起诉/上诉/举证/申请等期限到 compliance-deadline。当用户提到案件期限、上诉期、举证期限、诉讼时效、申请期限、关键时间节点、别错过期限,需要管理援助案件时间节点时使用本技能(即使未明说"期限")。
argument-hint: "[受援人 matter id 与已知期限/诉讼阶段]"
---

# /cn-legal-aid:deadlines

【AI 辅助草稿，需律师复核】

法律援助案件期限管理底稿，将识别出的期限结构化写入 `compliance-deadline`，供 compliance-deadline-watcher 确定性监测。本产出为内部工作底稿，不得标注为可签署或可对外发送的最终版本；期限以现行法律与生效文书为准。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate). 登记前额外确认：受援人=client、援助事项=matter（matterType=legal-aid）已建、冲突筛查通过；期限事项落在援助事项范围内。Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 期限来源识别：从案件阶段、已收文书（受理通知、举证通知、判决/裁定书等）、法律规定中识别应管理的期限。
2. 期限类型梳理：覆盖诉讼时效（一般三年，自知道或应当知道权利受损害及义务人之日起算，含中止/中断/最长二十年 [模型知识-待核]）、起诉期限、上诉期限、举证期限、申请再审期限、申请仲裁期限、申请执行期间、刑事各阶段期限、行政复议/诉讼期限等。
3. 起算与届满计算：记录每一期限的起算事实、计算方式与届满日；区分自然日/工作日并提示节假日顺延规则，计算结果标注为待律师复核。
4. 严重度与提前量：为每条期限设 severity（red/yellow/green/info）与 leadTimeDays（提前提醒天数）；高风险（如上诉期、诉讼时效届满）置 red。
5. 写入记录：每条期限写入 `compliance-deadline`（deadlineId、matterId、title、obligationType: litigation-deadline 或 other、basis、citationTag、dueDate、leadTimeDays、severity、status: active、createdAt；recurrenceMonths 仅用于周期性事项）；citationTag 为 `[已核验-来源]` 时须填 sourceRef。
6. 来源标注：期限的法律基础按三值标注；无核验来源配 `source-record`（status: source-needs-check）。期限规则属高变动项，按 Currency Gate 复核。
7. 不静默降级上游 🔴/🟠；建立 `pending-review` 的 review queue item（sourcePlugin: cn-legal-aid）。

## Output

- 期限清单摘要（reviewer note 置顶）。
- 各期限：类型、起算事实、计算方式、届满日（待复核）。
- severity 与 leadTimeDays 设置。
- compliance-deadline 记录字段表。
- 高风险临近期限预警（GREEN/YELLOW/RED）。
- 来源表与待核项。
- 律师复核要点。

## Next Steps

- 期限监测：交由 matter-core 的 compliance-deadline-watcher 监测。
- 临近上诉/举证期限需出文书：移交 `/cn-legal-aid:document-draft`。
- 期限变动需告知受援人：移交 `/cn-legal-aid:plain-language-letter`。
- 期限随状态变化更新：移交 `/cn-legal-aid:case-status`。
