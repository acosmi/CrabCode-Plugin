---
name: case-status
description: 法律援助案件状态跟踪,汇总当前阶段、近期进展、待办、临近期限与风险。当用户提到案件进展、现在到哪一步、状态更新、办案台账、近期要做什么,需要查看或更新援助案件状态时使用本技能(即使未明说"状态")。
argument-hint: "[受援人 matter id 与最新进展]"
---

# /cn-legal-aid:case-status

【AI 辅助草稿，需律师复核】

法律援助案件状态跟踪底稿，汇总案件当前阶段、进展、待办与临近期限。本产出为内部工作底稿，不得标注为可签署或可对外发送的最终版本。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate). 更新前额外确认：受援人=client、援助事项=matter（matterType=legal-aid）已建、冲突筛查通过；跟踪事项落在援助事项范围内。Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 当前阶段定位：确认案件所处阶段（受理审查/已指派/诉前/一审/二审/再审/执行/刑事各阶段/调解等）。
2. 近期进展归纳：汇总自上次更新以来的事件（开庭、提交文书、收到通知、沟通要点等），引用来源文书并按三值标注。
3. 待办事项盘点：列出待办、责任人、时限；与 `compliance-deadline` 中 active 记录对齐，标记临近期限。
4. 风险与变化：识别新增风险或诉讼地位变化（如管辖异议、追加当事人、对方反诉等），按 GREEN/YELLOW/RED 标注，不静默降级上游 🔴/🟠。
5. 受援人配合状态：记录受援人材料补充、联系方式/送达地址变更、是否失联等需跟进事项。
6. matter 状态同步：必要时建议 `matter.status` 变更（active/paused 等），但不在本技能内作结案处理。
7. 来源标注：无核验来源的法律点配 `source-record`（status: source-needs-check）。
8. 建立 `pending-review` 的 review queue item（sourcePlugin: cn-legal-aid）。

## Output

- 状态摘要（reviewer note 置顶）。
- 当前阶段。
- 近期进展（含来源）。
- 待办清单与责任人/时限。
- 临近期限预警（GREEN/YELLOW/RED）。
- 风险与诉讼地位变化。
- 受援人配合状态。
- 来源表与待核项。
- 律师复核要点。

## Next Steps

- 临近期限：移交 `/cn-legal-aid:deadlines` 核对登记。
- 需出新文书：移交 `/cn-legal-aid:document-draft`。
- 需向受援人通报：移交 `/cn-legal-aid:plain-language-letter`。
- 案件具备结案条件：移交 `/cn-legal-aid:case-closure`。
