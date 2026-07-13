---
name: 庭审与质证准备
short-description: 庭审与质证准备(中国民诉无 deposition,映射为当事人陈述、证人出庭作证准备、质证要点与发问提纲)
description: 庭审与质证准备(中国民诉无 deposition,映射为当事人陈述、证人出庭作证准备、质证要点与发问提纲)。当用户提到开庭准备/质证/证人出庭/发问提纲/三性质证、需要备庭时使用本技能(即使未明说"质证准备")。
argument-hint: "[案件争点、证据清单、拟出庭证人/当事人信息]"
---

# /cn-litigation:deposition-prep

【AI 辅助草稿，需律师复核】

为中国民商事诉讼/仲裁的开庭审理准备质证要点、当事人陈述与证人出庭作证提纲，以及法庭发问提纲。本提纲为内部准备底稿，不得标注为可向人民法院或仲裁机构提交的最终版本。

> 制度映射说明：英美法的庭外证言开示（deposition）在中国民事诉讼中并无对应制度。中国不存在庭外取证式的 deposition，本技能将其映射为中国民诉框架下的：当事人陈述、证人出庭作证准备、质证（对证据真实性/合法性/关联性的发表意见）要点，以及当庭发问提纲。下文一律使用中国民诉术语，不引入 deposition/discovery 作为实体规则。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate). 动手前另需确认：本案已在 `litigation-matter` 登记，开庭/质证相关期限以 `compliance-deadline`（obligationType=litigation-deadline）为准，输出仅进入内部 review queue。Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 读取 `litigation-matter` 与争点清单（可来自 `claim-chart`），确认审理机关、争点焦点与我方诉讼地位。
2. 整理证据清单：区分书证、物证、视听资料、电子数据、证人证言、当事人陈述、鉴定意见、勘验笔录；标注举证方与证明对象。
3. 质证要点：对对方每一份证据，准备从真实性、合法性、关联性（三性）发表的质证意见，并预判对方对我方证据的质证角度及应对。
4. 证人出庭作证准备：拟出庭证人与作证范围、需注意的作证规则（如证人不得旁听庭审、如实陈述义务）、主询问要点；明确不得诱导、串供或干预证人陈述。
5. 当事人陈述准备：梳理当事人需当庭陈述的事实要点与可能被发问的薄弱处。
6. 发问提纲：准备对对方当事人/证人的发问问题，围绕争点与证据矛盾点设计。
7. 法律与程序点按 citationTag 标注；`[模型知识-待核]` 配 `source-record`（`status: source-needs-check`）。
8. 创建 review queue 条目，状态 `pending-review`。

## Output

- 顶部 Reviewer note 固定块（来源 / 审读范围 / 留待律师判断 / 时效 / 依赖前须完成事项）。
- 制度映射说明（deposition → 当事人陈述/证人出庭/质证）。
- 争点与证据对应表。
- 质证要点表（按对方证据逐份的三性意见 + 我方证据被质证应对）。
- 证人出庭作证准备清单（含作证规则提示）。
- 当事人陈述要点。
- 当庭发问提纲。
- 来源表与律师复核要点。

## Next Steps

- 需逐争点对照主张与证据：回到 `/cn-litigation:claim-chart`。
- 证据涉及国家秘密/商业秘密/个人隐私不公开处理：移交 `/cn-litigation:privilege-log-review`。
- 需向法院申请调查取证或申请证人出庭：移交 `/cn-litigation:subpoena-triage`。
- 需起草代理词或庭审发言分段：移交 `/cn-litigation:brief-section-drafter`。
