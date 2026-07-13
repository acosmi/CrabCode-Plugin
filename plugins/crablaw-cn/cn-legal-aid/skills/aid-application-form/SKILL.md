---
name: 法律援助申请表
short-description: 生成法律援助申请表/受理登记表草稿,汇总受援人、事项、经济困难与资格审查信息
description: 生成法律援助申请表/受理登记表草稿,汇总受援人、事项、经济困难与资格审查信息。当用户提到法律援助申请表、受理登记表、填表、出具援助申请材料,需要把受理与审查信息整理成表单时使用本技能(即使未明说"申请表")。
argument-hint: "[受援人 client/matter id 与已收集的受理/审查信息]"
---

# /cn-legal-aid:aid-application-form

【AI 辅助草稿，需律师复核】

法律援助申请表/受理登记表草稿，依据《中华人民共和国法律援助法》及受理登记要求汇总信息。本产出为内部工作底稿，不得标注为可签署、可对外发送或可向法律援助机构正式提交的最终版本。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate). 生成前额外确认：受援人=client、援助事项=matter（matterType=legal-aid）已建、冲突筛查通过；已完成或正在进行资格审查；产出目的地为内部审核队列（review queue），表单为内部草稿。Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 表单类型确认：判断生成法律援助申请表、受理登记表或两者；明确填表主体（受援人本人/法定代理人/近亲属代为申请人）。
2. 申请人信息：填入受援人姓名、身份证件、住所/经常居住地、联系方式、送达地址；代为申请的填代理人信息与代理关系。
3. 事项信息：填写援助事项类型（民事/行政/刑事）、对方当事人、争议事实摘要、诉求、所处诉讼/仲裁/办案阶段、是否涉及紧迫期限。
4. 经济困难与免审栏：依据 `/cn-legal-aid:eligibility-check` 结论，填入经济困难认定方式（经济困难证明/社会救助凭证/经济状况承诺）或免予审查经济困难的情形依据。
5. 受理与指派栏：填写拟受理的法律援助机构、申请日期、拟指派承办人/值班律师等栏目（具体由机构最终决定，本表仅为草稿）。
6. 附件清单：列出随表提交的身份证明、经济困难证明、争议相关材料、授权委托材料等及其缺口。
7. 承诺与告知：列出受援人应知悉的事项（如实陈述义务、如实提供材料、隐瞒/虚假申报的后果等），以中性、合规口径呈现，不替受援人作出承诺。
8. 来源标注：表中引用的法律依据按三值标注；无核验来源的法律点配 `source-record`（status: source-needs-check）。
9. 建立 `pending-review` 的 review queue item（sourcePlugin: cn-legal-aid）；如表单触发明确期限，写入 `compliance-deadline`。

## Output

- 申请/受理登记表草稿（reviewer note 置顶；明确标注"草稿，待律师复核与受援人签署确认前不得提交"）。
- 申请人/代为申请人信息栏。
- 事项与诉求栏。
- 经济困难/免审栏。
- 受理与指派栏（机构最终决定）。
- 附件清单与缺口。
- 告知与承诺栏（中性口径）。
- 来源表与待核项。
- 律师复核要点。

## Next Steps

- 信息有缺口：回到 `/cn-legal-aid:aid-intake` 或 `/cn-legal-aid:eligibility-check` 补充。
- 需向受援人通俗解释表单内容：移交 `/cn-legal-aid:plain-language-letter`。
- 受理后跟踪：移交 `/cn-legal-aid:case-status`。
- 提交前由督导复核：移交 `/cn-legal-aid:supervisor-review-queue`。
