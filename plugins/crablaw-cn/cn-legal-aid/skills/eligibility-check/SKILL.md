---
name: 法律援助资格审查
short-description: 法律援助资格审查,核对经济困难标准、事项范围与依法免予审查经济困难的情形
description: 法律援助资格审查,核对经济困难标准、事项范围与依法免予审查经济困难的情形。当用户提到资格审查、是否符合法律援助条件、经济困难认定、事项范围判断、免审情形,需要判断能否给予法律援助时使用本技能(即使未明说"资格")。
argument-hint: "[受援人 client/matter id、经济状况、事项类型与诉求]"
---

# /cn-legal-aid:eligibility-check

【AI 辅助草稿，需律师复核】

法律援助资格审查底稿，依据《中华人民共和国法律援助法》关于经济困难标准、事项范围与免审情形的规定。本产出为内部工作底稿，不得标注为可签署、可对外发送或可作为正式准予/不予援助决定的最终版本。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate). 审查前额外确认：受援人=client、援助事项=matter（matterType=legal-aid）已建、冲突筛查通过；本次审查落在援助事项范围内；产出目的地为内部审核队列（review queue），不形成对外决定。Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 事项范围审查：对照法律援助法关于民事、行政、刑事援助事项范围的规定，判断本事项是否属于可申请法律援助的情形，并标注具体依据条款 [模型知识-待核]。
2. 经济困难标准审查：核对受援人经济状况是否符合所在地法律援助经济困难标准；记录所依据的地方经济困难标准来源（地方标准由省、自治区、直辖市规定，须以现行地方规定核对 [模型知识-待核]）；区分以经济困难证明、社会救助/低保凭证认定还是以经济状况承诺认定。
3. 免予审查经济困难情形：识别依法免予审查经济困难的情形（如英雄烈士近亲属为维护英雄烈士人格权益、特定刑事案件被告人/犯罪嫌疑人、请求支付劳动报酬或工伤事故人身损害赔偿的特定情形等），逐项对照法律援助法及相关规定 [模型知识-待核]。
4. 刑事援助特别情形：对应当通知/指定辩护的情形（如盲、聋、哑人，尚未完全丧失辨认或控制能力的精神病人，未成年人，可能判处无期徒刑、死刑的人，缺席审判等），按刑事诉讼法及法律援助法核对，标记是否属于不受经济困难限制的法律援助 [模型知识-待核]。
5. 管辖与受理机关：核查应向哪一法律援助机构申请/由哪一机构指派，避免错送。
6. 证明材料充分性：评估经济困难证明、身份证明、事项相关材料是否齐备；缺口标记为补正事项。
7. 来源标注：每条法律或事实断言按三值标注。无核验来源的法律点配 `source-record`（status: source-needs-check），`effectiveStatus` 说明待核内容；地方经济困难标准属高变动项，默认 `[模型知识-待核]` 并提示按 Currency Gate 复核。
8. 形成审查结论草案（符合/不符合/需补正，逐要件 GREEN/YELLOW/RED），不得静默降级上游 🔴/🟠；建立 `pending-review` 的 review queue item（sourcePlugin: cn-legal-aid）。

## Output

- 资格审查摘要（reviewer note 置顶）。
- 事项范围结论与依据。
- 经济困难标准结论（含所依据地方标准与待核提示）。
- 免审/不受经济困难限制情形认定。
- 刑事援助特别情形核对。
- 受理机关与管辖。
- 证明材料缺口与补正清单。
- 逐要件结论表（GREEN/YELLOW/RED）。
- 来源表与待核项。
- 律师复核要点。

## Next Steps

- 资格符合：移交 `/cn-legal-aid:aid-application-form` 生成申请/受理登记表。
- 需补正材料：回到 `/cn-legal-aid:aid-intake` 补充收集。
- 拟向受援人通俗告知结论：移交 `/cn-legal-aid:plain-language-letter`。
- 涉具体法律分析：移交 `/cn-legal-aid:case-memo`。
