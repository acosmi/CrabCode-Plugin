---
name: client-comms-log
description: 受援人沟通记录整理,结构化记录每次沟通的时间、方式、内容、受援人诉求与告知事项。当用户提到与受援人沟通、谈话记录、通话/会见记录、回访、沟通台账,需要把与受援人的交流留痕时使用本技能(即使未明说"沟通记录")。
argument-hint: "[受援人 matter id 与本次沟通的时间/方式/内容]"
---

# /cn-legal-aid:client-comms-log

【AI 辅助草稿，需律师复核】

受援人沟通记录底稿，用于法律援助办案过程留痕。本产出为内部工作底稿，不得标注为可签署、可对外发送或可作为正式笔录的最终版本。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate). 记录前额外确认：受援人=client、援助事项=matter（matterType=legal-aid）已建、冲突筛查通过；本次沟通落在援助事项范围内；产出目的地为内部审核队列（review queue）。Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 沟通基本信息：记录沟通时间、方式（面谈/电话/书面）、地点、参与人（承办人/值班律师、受援人/代理人）。
2. 沟通事项与内容：客观记录受援人陈述、提出的问题与诉求、提供或承诺补充的材料；区分受援人陈述与承办人意见。
3. 告知与建议：记录向受援人作出的法律告知、风险提示、下一步建议及受援人的反馈/选择；不替受援人作出处分性决定（如是否和解、是否撤诉）。
4. 待办与责任：列出本次沟通形成的待办事项、责任人与时限；如涉明确期限，写入 `compliance-deadline`。
5. 敏感信息处理：标记涉及个人隐私、案情敏感信息，按内部保密要求处理；提示送达地址、联系方式变更需更新。
6. 来源标注：受援人陈述标 `[用户提供]`，引用法律点标三值；无核验来源的法律点配 `source-record`（status: source-needs-check）。
7. 建立 `pending-review` 的 review queue item（sourcePlugin: cn-legal-aid）。

## Output

- 沟通记录条目（reviewer note 置顶）。
- 沟通基本信息（时间/方式/参与人）。
- 受援人陈述与诉求。
- 告知、风险提示与受援人反馈。
- 待办、责任人与时限。
- 敏感信息与变更提示。
- 来源标注与待核项。
- 律师复核要点。

## Next Steps

- 形成新待办期限：移交 `/cn-legal-aid:deadlines`。
- 需向受援人发出通俗告知：移交 `/cn-legal-aid:plain-language-letter`。
- 沟通触及案件状态变化：移交 `/cn-legal-aid:case-status`。
- 出现法律分析需求：移交 `/cn-legal-aid:case-memo`。
