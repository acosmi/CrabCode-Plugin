---
name: 法律援助受理
short-description: 收集法律援助申请与受援人信息，建立受援人档案和法律援助事项
description: 法律援助申请受理与受援人信息收集,产出受援人(client)与援助事项(matter,matterType=legal-aid)草案。当用户提到法律援助申请、接待受援人、援助接案、收集受援人身份与争议信息,要新开一个法律援助事项时使用本技能(即使未明说"受理")。
argument-hint: "[受援人身份、争议事实、诉求或已有材料]"
---

# /cn-legal-aid:aid-intake

【AI 辅助草稿，需律师复核】

法律援助申请受理与受援人信息收集底稿，依据《中华人民共和国法律援助法》流程控制。本产出为内部工作底稿，不得标注为可签署、可对外发送或可作为正式受理决定的最终版本。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate). 受理前额外确认：受援人已按 `client` 建档、援助事项已按 `matter`（matterType=legal-aid）建立、利益冲突筛查通过（status 为 no-hit 或 cleared-by-lawyer）；本次信息收集落在援助事项范围内；产出目的地为内部审核队列（review queue）。Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 受援人身份核查：收集受援人姓名、身份证件、住所/经常居住地、联系方式与送达地址；如为单位或特定群体（如农民工、残疾人、未成年人、老年人）记录其身份属性，作为后续资格审查的事实基础（法律援助法关于受援人的规定 [模型知识-待核]）。
2. 申请方式与代为申请：记录申请系本人提出还是由法定代理人、近亲属代为提出，或由法院指定、值班律师转介；核查代为申请人的资格与授权材料。
3. 争议与诉求采集：按时间顺序梳理基础事实、法律关系（如劳动报酬、工伤、赡养扶养、人身损害、刑事辩护/代理等）与核心诉求，区分已有材料支持的事实与仅为受援人陈述。
4. 事项类型与紧迫性：初步判断事项属民事、行政还是刑事援助，是否涉及诉讼时效、起诉/上诉期限、申请仲裁期限或刑事诉讼阶段等紧迫节点，需提示尽快处置。
5. 事项范围线索：初步对照法律援助法关于援助事项范围的规定，标记本事项是否属于可申请援助的情形（详细判断移交 `/cn-legal-aid:eligibility-check`）。
6. 经济状况线索：收集受援人经济困难相关信息（收入、家庭人口、是否享受社会救助/最低生活保障等），作为经济困难审查的事实基础；是否属于依法免予审查经济困难的情形一并标记（详细判断移交 eligibility-check）。
7. 材料盘点：列出已有/待补材料（身份证明、经济困难证明或承诺、争议相关证据、授权委托材料等）及缺口。
8. 来源标注：每条法律或事实断言按 `[已核验-来源]`/`[用户提供]`/`[模型知识-待核]` 标注。无核验来源的法律点写入 `sources.jsonl` 的 `source-record`，`status: source-needs-check`，`effectiveStatus` 说明待核内容。
9. 形成草案：补全 `client`（受援人）与 `matter`（matterType=legal-aid、engagementScope、status: active）字段；如已识别明确期限，分别写入 `compliance-deadline`（obligationType: litigation-deadline 或 other）；建立 `pending-review` 的 review queue item（sourcePlugin: cn-legal-aid）。

## Output

- 受理信息摘要（reviewer note 置顶：所用来源 / 实际收集范围 / 留待律师判断事项 / currency / 依赖前须办事项）。
- 受援人身份与申请方式（含代为申请）核查。
- 争议事实与诉求梳理。
- 事项类型、紧迫节点与事项范围线索（GREEN/YELLOW/RED）。
- 经济困难线索与免审情形标记。
- 材料清单与缺口。
- client/matter 草案字段表。
- 缺失事实与来源表。
- 律师复核要点。

## Next Steps

- 资格是否符合：移交 `/cn-legal-aid:eligibility-check`。
- 生成申请表/受理登记表：移交 `/cn-legal-aid:aid-application-form`。
- 已识别明确期限需管理：移交 `/cn-legal-aid:deadlines`。
- 需冲突检查或新建事项：移交 matter-core 相应流程。
