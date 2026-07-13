---
name: 诉讼文书分段起草
short-description: 分段起草中国诉讼文书(起诉状/答辩状/上诉状/代理词的"事实与理由""诉讼请求"等分段)
description: 分段起草中国诉讼文书(起诉状/答辩状/上诉状/代理词的"事实与理由""诉讼请求"等分段)。当用户提到写起诉状/答辩状/上诉状/代理词、起草某一段落或诉讼文书,需要按段落成稿时使用本技能(即使未明说"分段起草")。
argument-hint: "[文书类型、目标分段、案件事实与争点，或 claim-chart 条目 id]"
---

# /cn-litigation:brief-section-drafter

【AI 辅助草稿，需律师复核】

按需起草中国诉讼文书的指定分段（起诉状/答辩状/上诉状/代理词中的"诉讼请求""事实与理由""上诉请求""答辩意见"等）。本草稿为内部底稿，不得标注为可向人民法院或仲裁机构提交的最终版本，对外提交须经律师定稿。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate). 动手前另需确认：本案已在 `litigation-matter` 登记（确认 partyRole 与 instance 以匹配文书类型），提交相关期限以 `compliance-deadline`（obligationType=litigation-deadline）为准，输出仅进入内部 review queue。Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 确认文书类型与分段：
   - 起诉状/仲裁申请书——诉讼请求、事实与理由。
   - 答辩状——答辩意见（事实与理由）。
   - 上诉状——上诉请求、上诉事实与理由。
   - 代理词——代理意见（按争点组织论证）。
   并据 `litigation-matter` 的 partyRole / instance 校验文书与诉讼地位、阶段是否匹配（如二审才用上诉状）。
2. 读取争点与证据材料（可来自 `claim-chart`），明确每一争点的主张、法律依据与支撑证据。
3. 起草目标分段：
   - 诉讼请求/上诉请求——具体、可执行、与诉讼标的一致（金额、利息、期间、费用承担）。
   - 事实与理由——按时间或争点组织，事实陈述与证据指引对应，法律适用论证清晰。
   - 代理意见——围绕争点逐项论证，回应对方主张。
4. 引用法律依据按 citationTag 标注（民法典/相关司法解释/程序法条文）；`[模型知识-待核]` 配 `source-record`（`status: source-needs-check`）。
5. 标注待补事实与证据缺口（fact-gap），不得编造事实或案号。
6. 文末固定加注："本件为内部草稿，未经律师定稿不得提交"。
7. 创建 review queue 条目，状态 `pending-review`。

## Output

- 顶部 Reviewer note 固定块（来源 / 审读范围 / 留待律师判断 / 时效 / 依赖前须完成事项）。
- 文书类型与分段范围声明（与 partyRole/instance 的匹配校验结果）。
- 起草的目标分段正文。
- 法律依据与证据指引对应表。
- 待补事实与证据缺口清单。
- GREEN / YELLOW / RED 风险定级（如请求不当、依据待核）。
- 来源表与律师定稿前须确认事项。

## Next Steps

- 需先理清争点与举证责任：回到 `/cn-litigation:claim-chart`。
- 需准备开庭质证与发问配合本文书：移交 `/cn-litigation:deposition-prep`。
- 文书涉及证据调取请求：移交 `/cn-litigation:subpoena-triage`。
- 律师定稿后对外提交：通过 matter-core review queue 升级审批，本技能不执行提交或发送。

## 产出物路由

- 需要将诉讼文书章节交付为 Word 成品时,调用 `crabcode-office-suite:crabcode-documents` 生成 .docx;
- 若触发时报 Unknown skill,说明办公套件未安装:引导用户通过 `/plugin` 安装 `crabcode-office-suite` 后重试;安装完成前先以 markdown 呈现全文供用户确认。
