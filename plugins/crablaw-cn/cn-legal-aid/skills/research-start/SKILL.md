---
name: research-start
description: 法律援助案件法律检索起步,拆解争点、确定检索路径与拟检索的法律法规/司法解释/案例方向。当用户提到法律检索、查法条、找案例、检索思路、研究某个法律问题,需要为援助案件开展法律研究时使用本技能(即使未明说"检索")。
argument-hint: "[受援人 matter id 与待检索的法律问题/争点]"
---

# /cn-legal-aid:research-start

【AI 辅助草稿，需律师复核】

法律援助案件法律检索起步底稿，拆解法律问题并规划中国法检索路径。本产出为内部工作底稿，不得标注为可签署、可对外发送或可作为最终检索结论的版本；检索结果须经核验与律师复核。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate). 检索前额外确认：受援人=client、援助事项=matter（matterType=legal-aid）已建、冲突筛查通过；检索问题落在援助事项范围内。仅使用合规的境内法律法规检索渠道，不接境外数据库/SaaS。Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 问题界定：把案件争点转化为可检索的法律问题，区分实体问题与程序问题，列出关键词与法律关系。
2. 法律层级规划：按法律—行政法规—部门规章/地方性法规—司法解释—指导性案例/参考案例的层级规划检索范围，明确优先位阶。
3. 检索词与同义表达：列出检索关键词、法律术语同义表达与上下位概念，便于全面检索。
4. 渠道说明：仅指向合规境内官方/权威法规检索渠道（如国家法律法规数据库、裁判文书公开渠道等的合规使用），不得使用境外法律数据库。
5. 检索清单产出：形成"待检索条目"清单（问题—拟查法律/司法解释/案例方向—预期用途），每条标注尚未核验。
6. 核验与标注纪律：本技能产出的是检索计划与待核线索，凡未在本次实际检索到原文的法律点一律 `[模型知识-待核]`，并配 `source-record`（status: source-needs-check），`effectiveStatus` 说明需核验内容。按 Currency Gate 提示高变动领域需复核时效。
7. 建立 `pending-review` 的 review queue item（sourcePlugin: cn-legal-aid）。

## Output

- 检索计划摘要（reviewer note 置顶）。
- 法律问题界定与关键词。
- 法律层级与优先位阶规划。
- 待检索条目清单（含预期用途）。
- 合规检索渠道说明（境内）。
- 待核线索与来源表（source-needs-check）。
- 律师复核要点。

## Next Steps

- 检索成果用于分析：移交 `/cn-legal-aid:case-memo`。
- 检索支撑文书起草：移交 `/cn-legal-aid:document-draft`。
- 检索涉及期限规则：移交 `/cn-legal-aid:deadlines`。
- 跨领域问题：联动相应专业板块（如 `/cn-labor-employment`、`/cn-litigation`）。
