---
name: subpoena-triage
description: 法院调查取证、调查令、协助调查通知的分流应对(对应中国民诉法院调查取证与律师调查令,非英美 subpoena)。当用户提到调查令/协助调查/法院取证/收到取证通知或要申请调取证据时使用本技能(即使未明说"分流应对")。
argument-hint: "[收到的调查令/协助调查通知/取证文书，或拟申请调取的证据需求]"
---

# /cn-litigation:subpoena-triage

【AI 辅助草稿，需律师复核】

对法院调查取证通知、律师调查令、协助调查通知进行分流应对，或评估向法院申请调查取证的可行性与路径。本分析为内部底稿，不得标注为可向人民法院提交的最终版本，也不得作为可对外发送的文书。

> 制度映射说明：英美法的 subpoena（传票/出示令）在中国并无对应制度。中国民事诉讼对应的是：人民法院依职权或依当事人申请进行的调查取证，以及人民法院签发给律师的调查令制度。收到的"协助调查通知/调查令"应依中国民诉法处理。下文不使用 subpoena/discovery 作为实体规则，仅作概念对照。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate). 动手前另需确认：本案已在 `litigation-matter` 登记，相关申请/回应期限以 `compliance-deadline`（obligationType=litigation-deadline）为准，输出仅进入内部 review queue。Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 判别文书类型与方向：
   - 入向（被要求配合）——收到法院调查取证通知 / 协助调查通知 / 持调查令的对方律师调取请求。
   - 出向（主动申请）——拟向法院申请依职权调查取证，或申请签发律师调查令。
2. 入向处置：核查文书的签发主体、案号、调取范围与法律依据是否适格；评估配合义务边界、可否提出异议、是否涉及涉密/隐私材料（联动不公开处理）；标注回应期限。
3. 出向评估：判断拟调取证据是否属当事人因客观原因不能自行收集的范围、是否符合申请法院调查取证或申请调查令的条件；准备申请要点（待证事实、证据线索、持有人）。
4. 范围与边界：标注超出合法调取范围、涉及国家秘密/商业秘密/个人隐私需特别处理的部分。
5. 法律依据按 citationTag 标注；`[模型知识-待核]` 配 `source-record`（`status: source-needs-check`）。
6. 创建 review queue 条目，状态 `pending-review`。

## Output

- 顶部 Reviewer note 固定块（来源 / 审读范围 / 留待律师判断 / 时效 / 依赖前须完成事项）。
- 制度映射说明（subpoena → 法院调查取证 / 律师调查令 / 协助调查）。
- 文书分类与方向判别（入向 / 出向）。
- 入向应对：适格性核查、配合义务边界、异议空间、期限。
- 出向评估：申请条件、申请要点、证据线索。
- 涉密/隐私材料处理提示。
- GREEN / YELLOW / RED 定级与来源表。
- 律师复核要点。

## Next Steps

- 调取的材料涉及涉密/隐私分级：移交 `/cn-litigation:privilege-log-review`。
- 调取证据将用于质证：移交 `/cn-litigation:deposition-prep`。
- 需起草调查取证申请书分段：移交 `/cn-litigation:brief-section-drafter`。
- 调取的证据需纳入争点对照：回到 `/cn-litigation:claim-chart`。
