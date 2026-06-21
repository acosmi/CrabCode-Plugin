---
name: case-memo
description: 起草法律援助案件法律分析备忘,梳理法律关系、争议焦点、请求权/抗辩、证据与策略。当用户提到案件分析、法律意见备忘、争议焦点、办案思路、可行性分析,需要对援助案件做内部法律分析时使用本技能(即使未明说"备忘")。
argument-hint: "[受援人 matter id 与争议事实、诉求、已有证据]"
---

# /cn-legal-aid:case-memo

【AI 辅助草稿，需律师复核】

法律援助案件法律分析备忘底稿，按中国法（民法典、民事诉讼法/刑事诉讼法/行政诉讼法等）展开内部分析。本产出为内部工作底稿，不得标注为可签署、可对外发送或可作为正式法律意见书的最终版本。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate). 起草前额外确认：受援人=client、援助事项=matter（matterType=legal-aid）已建、冲突筛查通过；本分析落在援助事项范围内；产出目的地为内部审核队列（review queue）。Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 事实与法律关系：归纳基础事实，识别法律关系（如劳动关系、赡养扶养、买卖借贷、人身损害、刑事控辩等），区分有证据支持的事实与受援人主张。
2. 争议焦点提炼：列出本案核心法律争点与对方可能的抗辩。
3. 请求权/辩护要点分析：按相应实体法（民法典等）分析请求权基础或刑事辩护/代理要点，逐项标注法律依据三值。
4. 程序要点：核查管辖、诉讼时效/申请仲裁期限、起诉/上诉/申请再审期限、刑事诉讼阶段与辩护权行使节点；提示紧迫期限。
5. 证据分析：将待证事实与现有证据对应，识别证据缺口与取证方向（书证、物证、电子数据、证人、鉴定等）。
6. 策略与可行性：评估诉讼/非诉/调解等路径与可行性，给出倾向性建议但标注为待律师确认；不作确定性结果承诺。
7. 风险分级：对关键结论按 GREEN/YELLOW/RED 标注，不得静默降级上游 🔴/🟠。
8. 来源标注：每条法律断言按三值标注；无核验来源的法律点配 `source-record`（status: source-needs-check），`effectiveStatus` 说明待核内容。
9. 建立 `pending-review` 的 review queue item（sourcePlugin: cn-legal-aid）；识别明确期限的写入 `compliance-deadline`。

## Output

- 法律分析备忘摘要（reviewer note 置顶）。
- 事实与法律关系。
- 争议焦点。
- 请求权/辩护要点分析（含法律依据）。
- 程序要点与期限提示。
- 证据分析与缺口。
- 策略与可行性建议（待确认）。
- 风险分级表（GREEN/YELLOW/RED）。
- 来源表与待核项。
- 律师复核要点。

## Next Steps

- 需起草文书：移交 `/cn-legal-aid:document-draft`。
- 需补充法律检索：移交 `/cn-legal-aid:research-start`。
- 期限需纳入管理：移交 `/cn-legal-aid:deadlines`。
- 需向受援人通俗说明结论：移交 `/cn-legal-aid:plain-language-letter`。
