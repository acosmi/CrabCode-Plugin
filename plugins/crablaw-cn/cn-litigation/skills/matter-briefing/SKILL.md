---
name: 案件简报
short-description: 生成诉讼/仲裁案件简报,梳理争点、程序节点、风险与策略选项
description: 生成诉讼/仲裁案件简报,梳理争点、程序节点、风险与策略选项。当用户提到案件简报/案情概览/给我讲讲这个案子/汇报案件情况,需要一份案件全貌时使用本技能(即使未明说"简报")。
argument-hint: "[案件 caseId 或案件事实与材料]"
---

# /cn-litigation:matter-briefing

【AI 辅助草稿，需律师复核】

诉讼/仲裁案件的内部简报，汇总争议焦点、程序节点、风险与策略选项。本产出为内部工作底稿，不得标注为可签署、可对外发送或可向法院/仲裁机构提交的最终版本。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate). 额外确认：已存在对应的 litigation-matter 记录或可据以建档的案件事实；产出目的地为内部审核队列。Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 读取案件登记：从 litigation-matter 取 forumType、forumName、caseNumber、causeOfAction、partyRole、instance、claimSummary、status；如无登记，先回到 `/cn-litigation:matter-intake`。
2. 争点梳理：归纳事实争点与法律争点，区分双方无争议事实、有争议事实与纯法律适用问题；标注每项主张的证据支撑强弱。
3. 实体法分析：就案由对应的请求权基础（民法典合同编/物权编/侵权责任编等相关条文 [模型知识-待核]）逐项评估构成要件是否满足，识别抗辩事由（诉讼时效、清偿、抵销、不可抗力、情势变更等）。
4. 程序节点：列出当前审级（一审/二审/再审/执行/仲裁）下的关键程序节点——立案、举证期限、开庭、质证、辩论、裁判、上诉、申请执行等；期限以 `compliance-deadline`（obligationType: litigation-deadline）为唯一真实来源，简报仅引用不另存。
5. 管辖与程序风险：复核管辖（含仲裁协议效力、管辖权异议窗口）、当事人适格、是否需追加当事人、是否涉先予执行或保全（民事诉讼法相关规定、仲裁法 [模型知识-待核]）。
6. 证据评估：对照证明对象评估现有证据的关联性、合法性、真实性与证明力，标记需补强、需鉴定或需申请法院调取的证据。
7. 风险评估：按 GREEN/YELLOW/RED 评估胜诉/部分胜诉/败诉风险、执行回款风险、对方反诉/反请求风险、程序逾期风险。
8. 策略选项：列出诉讼/仲裁策略备选（如和解、调解、撤诉、变更或增加诉请、申请保全、提管辖权异议）及各自利弊与触发条件，不作单一定论。
9. 来源标注：法律与事实断言按三值标注；无核验来源的法律点配 `source-record`（status: source-needs-check）。建立 `pending-review` 的 review queue item。

## Output

- 案件简报（reviewer note 置顶）。
- 争点表（事实争点 / 法律争点 / 证据支撑）。
- 请求权与抗辩分析。
- 程序节点与期限引用（来源于 compliance-deadline）。
- 风险评估表（GREEN/YELLOW/RED）。
- 策略选项对比。
- 缺失事实与来源表。
- 律师复核要点。

## Next Steps

- 需构建事实时间线：移交 `/cn-litigation:chronology`。
- 进展更新（开庭/裁定/送达后）：移交 `/cn-litigation:matter-update`。
- 需跟踪对方：移交 `/cn-litigation:oc-status`。
- 需证据保全/固定：移交 `/cn-litigation:legal-hold`。
