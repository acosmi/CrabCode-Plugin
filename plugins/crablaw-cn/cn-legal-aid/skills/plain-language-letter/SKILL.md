---
name: plain-language-letter
description: 起草面向受援人的通俗语言法律告知书,把法律意见、风险与下一步用受援人能懂的话说明。当用户提到给受援人写告知书、通俗解释、用大白话讲法律、风险提示信、让当事人看得懂,需要把专业意见转成通俗表述时使用本技能(即使未明说"告知书")。
argument-hint: "[受援人 matter id 与要告知的结论/风险/下一步]"
---

# /cn-legal-aid:plain-language-letter

【AI 辅助草稿，需律师复核】

面向受援人的通俗语言法律告知书底稿，用受援人能理解的语言说明事项进展、法律意见、风险与下一步。本产出为内部工作底稿，不得标注为可签署、可对外发送的最终版本，向受援人发出前须经律师复核。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate). 起草前额外确认：受援人=client、援助事项=matter（matterType=legal-aid）已建、冲突筛查通过；本告知落在援助事项范围内。本件为对外（受援人方向）文本：按 Shared Guardrails 的发送目的地规则先警示，提供可发版与内部完整版的明确选择，不得自动对外发送。Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 抓取要告知的核心内容：事项当前进展、关键法律意见或资格结论、主要风险、受援人需要配合或决定的事项。
2. 通俗化改写：用简短句子和日常用语解释法律概念，必要时举例；避免堆砌法条编号，确需引用的法律名称用括注简释。
3. 风险与不确定性如实表达：把 YELLOW/RED 事项明确告知，不淡化、不夸大；不得静默降级上游 🔴/🟠 结论。
4. 受援人选择项：列出需要受援人决定的事项（如是否同意调解、是否补充材料）并说明各选项后果，但由受援人自行决定，不替其作出处分。
5. 配合与时限提示：说明需受援人提供的材料、配合事项及时间要求；涉明确期限的与 `compliance-deadline` 对应。
6. 边界声明：写明本告知书为援助承办人意见、最终以生效法律文书为准、如有疑问可联系承办人；不作出确定性胜诉/结果承诺。
7. 来源标注：内部版保留三值标注与法律依据；通俗版可隐去标注但内部留底须可追溯。无核验来源的法律点配 `source-record`（status: source-needs-check）。
8. 建立 `pending-review` 的 review queue item（sourcePlugin: cn-legal-aid）。

## Output

- 通俗告知书草稿（reviewer note 置顶；标注"草稿，律师复核前不得向受援人发出"）。
- 进展与核心意见（通俗表述）。
- 风险与不确定性提示。
- 受援人需决定/配合事项与时限。
- 边界声明（非结果承诺）。
- 内部留底：对应法律依据与来源表。
- 律师复核要点。

## Next Steps

- 受援人需作出选择后留痕：移交 `/cn-legal-aid:client-comms-log`。
- 涉及具体期限：移交 `/cn-legal-aid:deadlines`。
- 背后法律分析需展开：移交 `/cn-legal-aid:case-memo`。
- 发出前由督导复核：移交 `/cn-legal-aid:supervisor-review-queue`。

## 产出物路由

- 需要将平实语言函件交付为 Word 成品时,调用 `crabcode-office-suite:crabcode-documents` 生成 .docx;
- 若触发时报 Unknown skill,说明办公套件未安装:引导用户通过 `/plugin` 安装 `crabcode-office-suite` 后重试;安装完成前先以 markdown 呈现全文供用户确认。
