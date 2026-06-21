---
name: matter-intake
description: 诉讼/仲裁立案前信息收集,产出 litigation-matter 草案。当用户提到新案件/接案/立案前准备/收集当事人与争议信息、要开一个新诉讼或仲裁事项时使用本技能(即使未明说"立案信息")。
argument-hint: "[当事人、争议事实、诉讼请求或已有材料]"
---

# /cn-litigation:matter-intake

【AI 辅助草稿，需律师复核】

诉讼/仲裁案件立案前的信息收集与案件登记草案，按中国民事诉讼法/仲裁法流程控制。本产出为内部工作底稿，不得标注为可签署、可对外发送或可向法院/仲裁机构提交的最终版本。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate). 立案前额外确认：本次信息收集落在委托范围内；产出目的地为内部审核队列（review queue）；尚未形成对外诉讼文书。Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 主体核查：确认我方当事人与对方当事人的主体资格（自然人/法人/非法人组织）、名称、统一社会信用代码或身份证件、住所、法定代表人/负责人、送达地址与联系方式；判断主体适格（民事诉讼法关于当事人能力的规定 [模型知识-待核]）。
2. 诉讼地位与人数：确定我方拟担任的诉讼地位（原告/被告/第三人/申请人/被申请人/仲裁申请人），核查是否存在共同诉讼、代表人诉讼或追加当事人需要。
3. 争议事实采集：按时间顺序梳理基础事实、法律关系（如买卖、借贷、租赁、侵权等）与争议焦点，区分已有证据支持的事实与仅为当事人主张。
4. 诉讼请求/仲裁请求：拟列具体请求（给付/确认/形成）、标的金额或标的物、是否含利息/违约金/迟延履行金，确认请求与事实、法律关系对应。
5. 管辖审查：审查级别管辖与地域管辖（一般地域、特殊地域、专属管辖），核查是否存在有效的管辖协议或仲裁协议/仲裁条款；若约定仲裁则确认仲裁机构与仲裁规则，排除向法院起诉的路径（民事诉讼法管辖规定、仲裁法第四条至第二十一条 [模型知识-待核]）。
6. 诉讼时效/申请仲裁期限：核查请求权是否在诉讼时效期间内（一般三年，自权利人知道或应当知道权利受损害及义务人之日起算），识别时效中止、中断、最长二十年的情形，并提示时效抗辩风险（民法典第一百八十八条至第一百九十九条 [模型知识-待核]）。
7. 证据线索盘点：列出已有/待取证据（书证、物证、电子数据、证人、鉴定、勘验等）及缺口；标记可能需要诉前证据保全或申请调取的证据，移交 `/cn-litigation:legal-hold`。
8. 保全需求：评估是否需要诉前/诉中财产保全或行为保全，记录被申请人财产线索与担保能力（litigation-matter 的 `preservation` 字段）。
9. 来源标注：每条法律或事实断言按 `[已核验-来源]`/`[用户提供]`/`[模型知识-待核]` 标注。无核验来源的法律点写入 `sources.jsonl` 的 `source-record`，`status: source-needs-check`，`effectiveStatus` 说明待核内容。
10. 形成 `litigation-matter` 草案（forumType、forumName、causeOfAction、partyRole、instance、claimAmount/claimSummary、preservation、status: active、citationTag），并建立 `pending-review` 的 review queue item。期限不写入 litigation-matter；如已识别明确期限，分别写入 `compliance-deadline`（obligationType: litigation-deadline）。

## Output

- 立案信息摘要（reviewer note 置顶：所用来源 / 实际收集范围 / 留待律师判断事项 / currency / 依赖前须办事项）。
- 当事人与主体适格分析。
- 管辖与诉讼时效/申请仲裁期限结论（GREEN/YELLOW/RED）。
- 诉讼请求草拟与对应法律关系。
- 证据线索与缺口清单。
- litigation-matter 草案字段表。
- 缺失事实与来源表。
- 律师复核要点。

## Next Steps

- 需固定或保全证据：移交 `/cn-litigation:legal-hold`。
- 需形成案件简报与策略：移交 `/cn-litigation:matter-briefing`。
- 需冲突检查或新建案件：移交 matter-core 相应流程。
- 涉合同效力/条款争议：可联动 `/cn-contract:review`。
