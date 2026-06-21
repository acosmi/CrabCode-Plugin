---
name: demand-intake
description: 收集中国法律师函起草所需的需求要素(目的、对方主体、事实依据、诉求、时限),形成结构化需求记录。当用户想发律师函但要素未齐、需要先理清发函目的/对方/事实/诉求/时限时使用本技能(即使未明说"需求收集")。
argument-hint: "[发函目的、对方主体信息、事实经过、拟主张诉求、时限要求]"
---

# /cn-litigation:demand-intake

【AI 辅助草稿，需律师复核】

收集起草中国法律师函（催告函/警告函/主张权利函）所需的全部需求要素，形成结构化需求记录，供后续起草使用。本记录为内部需求底稿，不是律师函本身，不得标注为可对外发送的文本。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate). 动手前另需确认：发函对象是否构成利益冲突已纳入冲突筛查，本次发函目的与承办范围一致，输出仅进入内部 review queue 而非直接对外。Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 确认发函主体与受函主体：委托人（发函方）名称与签署权限；对方主体名称、统一社会信用代码（如为单位）或自然人身份提示，记入 `parties`（role: client / counterparty / natural-person）。
2. 明确发函目的与性质：催告履行、警告侵权、主张权利、解除合同通知、诉前催告等；区分单纯通知与产生法律后果的意思表示。
3. 梳理事实依据：相关合同/法律关系、违约或侵权事实、时间线、关键证据是否在手。
4. 确定具体诉求：要求对方作为/不作为的内容、金额、履行期限、违约责任主张。
5. 确认时限与后果：回复期限、宽限期；不履行的后续措施（诉讼/仲裁/保全）是否预告。
6. 标注事实与法律来源 citationTag；缺核验来源的法律依据配 `source-record`（`status: source-needs-check`，`effectiveStatus` 写明待核验内容）。
7. 创建 review queue 条目，状态 `pending-review`。

## Output

- 顶部 Reviewer note 固定块（来源 / 审读范围 / 留待律师判断 / 时效 / 依赖前须完成事项）。
- 发函方与受函方主体信息表（含送达地址/方式建议）。
- 发函目的与性质。
- 事实依据与时间线。
- 诉求清单与履行期限。
- 不履行后果与拟采取措施。
- 缺失信息清单（intake gap）。
- 来源表。

## Next Steps

- 需求齐备：移交 `/cn-litigation:demand-draft` 起草律师函内部草稿。
- 主张涉及复杂法律依据核查：先行用 `/cn-litigation:claim-chart` 梳理主张-依据-证据。
- 涉及合同解除/效力的实体判断：升级至 `/cn-contract:review`。
