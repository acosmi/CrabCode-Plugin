---
name: demand-draft
description: 起草中国法律师函(催告/警告/主张权利)内部草稿,标注红线与法律风险,严禁自动对外发送。当用户提到发律师函/写催告函/警告函/主张权利的函件、需要拟一份对外函件初稿时使用本技能(即使未明说"律师函")。
argument-hint: "[demand-intake 需求记录 id，或目的/对方/事实/诉求/时限]"
---

# /cn-litigation:demand-draft

【AI 辅助草稿，需律师复核】

基于已收集的需求起草中国法律师函（催告函/警告函/主张权利函）内部草稿，标注用语红线与法律风险点。本草稿仅为内部底稿，不得标注为可对外发送的定稿，不得自动寄送或投递任何收件人；对外发送须经律师定稿并由委托人决定。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate). 动手前另需确认：已有 `demand-intake` 需求记录或等效要素，发函对象冲突筛查通过，本草稿 send-destination 默认为 internal（绝不自动指向对方）。Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 读取 `demand-intake` 需求记录（或现场补齐目的、主体、事实、诉求、时限五要素）。
2. 选择函件类型与语气：催告履行 / 侵权警告 / 主张权利 / 解除通知 / 诉前催告；语气与法律后果相匹配。
3. 起草正文结构：
   - 抬头与受函主体。
   - 委托关系与发函身份说明。
   - 事实与法律关系陈述。
   - 明确主张与诉求（金额、期限、作为/不作为）。
   - 法律依据（民法典及相关司法解释、合同条款）。
   - 不履行的法律后果与拟采取措施（诉讼/仲裁/保全）。
   - 回复期限与联系方式。
4. 标红线：剔除可能构成威胁、诽谤、虚假陈述、不当施压或超出委托范围的表述；提示可能被对方反用为证据的措辞；提示意思表示（如解除）一经送达即生效的风险。
5. 法律依据按 citationTag 标注；`[模型知识-待核]` 法律点配 `source-record`（`status: source-needs-check`）。
6. 在文末固定加注："本件为内部草稿，未经律师定稿与委托人确认不得对外发送"。
7. 创建 review queue 条目，状态 `pending-review`（默认 internal，发送须经审批升级）。

## Output

- 顶部 Reviewer note 固定块（来源 / 审读范围 / 留待律师判断 / 时效 / 依赖前须完成事项）。
- send-destination 声明（internal，禁止自动对外）。
- 律师函正文草稿。
- 红线与风险标注（逐处说明）。
- GREEN / YELLOW / RED 风险定级。
- 来源表。
- 律师定稿前须确认事项。

## Next Steps

- 律师定稿后如需对外：通过 matter-core review queue 升级审批（approved-external / sent 需记录 externalDestination），由律师与委托人决定，本技能不执行发送。
- 预判对方可能回函：可预先用 `/cn-litigation:demand-received` 推演应对。
- 若发函后转入诉讼：移交 `/cn-litigation:brief-section-drafter` 起草起诉状分段。

## 产出物路由

- 需要将催告函/律师函交付为 Word 成品时,调用 `crabcode-office-suite:crabcode-documents` 生成 .docx;
- 若触发时报 Unknown skill,说明办公套件未安装:引导用户通过 `/plugin` 安装 `crabcode-office-suite` 后重试;安装完成前先以 markdown 呈现全文供用户确认。
