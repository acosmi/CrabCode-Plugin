---
name: oc-status
description: 跟踪对方当事人与对方代理人的主体、地址、动向与回应状态。当用户提到对方当事人/对方律师/对方代理人情况、对方有无回应或最新动向、需要梳理对方信息时使用本技能(即使未明说"对方状态")。
argument-hint: "[案件 caseId 与对方当事人/代理人信息或最新动向]"
---

# /cn-litigation:oc-status

【AI 辅助草稿，需律师复核】

诉讼/仲裁案件对方当事人（opposing party）与对方代理人（opposing counsel）的状态跟踪底稿。本产出为内部工作底稿，不得标注为可签署、可对外发送或可向法院/仲裁机构提交的最终版本。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate). 额外确认：存在对应 litigation-matter；对方信息来源合法（公开登记、案卷、对方送达材料），不得以非法手段获取个人信息。Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 对方主体核查：核对对方当事人名称、主体性质、统一社会信用代码/证件、住所、法定代表人/负责人、送达地址；来源限于公开登记信息、本案案卷与对方提交材料，按 `[已核验-来源]`/`[用户提供]`/`[模型知识-待核]` 标注（不接入境外数据库/SaaS）。
2. 诉讼地位：记录对方在本案的诉讼地位（被告/原告/第三人/被申请人等）及是否提起反诉/反请求。
3. 对方代理人：记录对方委托代理人姓名、所属机构、代理权限（一般授权/特别授权），核对授权委托手续是否完备；如系律师，记录其执业机构（仅作案件联络与冲突参考）。
4. 回应与动向：跟踪对方的程序动作与回应状态——是否应诉、是否提交答辩/证据、是否提管辖权异议、是否申请保全、是否到庭、是否上诉、是否申请执行或提执行异议；标注时间与来源文书。
5. 财产与履行能力：在保全/执行场景下，记录合法获取的对方财产线索与履行能力信息，提示是否需财产保全或执行措施（民事诉讼法保全与执行规定 [模型知识-待核]）。
6. 冲突与利益提示：如发现对方主体或代理人与本所/我方存在潜在利益冲突信号，标记并回到 matter-core 冲突检查流程，不在本 skill 作终局冲突结论。
7. 风险标注：对对方动向引发的风险（如对方反诉、对方申请保全、对方下落不明需公告送达）按 GREEN/YELLOW/RED 标注。无核验来源的法律点配 `source-record`（status: source-needs-check）。建立 `pending-review` 的 review queue item。

## Output

- 对方状态摘要（reviewer note 置顶）。
- 对方当事人主体信息表。
- 对方代理人与授权权限。
- 程序动作与回应状态跟踪。
- 财产/履行能力线索（如适用）。
- 风险与冲突信号（GREEN/YELLOW/RED）。
- 来源表与待核项。
- 律师复核要点。

## Next Steps

- 发现冲突信号：回到 matter-core 冲突检查。
- 对方动向影响策略：移交 `/cn-litigation:matter-briefing`。
- 财产线索需保全：移交 `/cn-litigation:legal-hold` 或 `/cn-litigation:matter-update`。
- 多案件对方汇总：移交 `/cn-litigation:portfolio-status`。
