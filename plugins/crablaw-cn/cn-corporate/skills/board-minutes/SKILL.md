---
name: board-minutes
description: 起草或审查中国公司董事会会议纪要与决议,作为律师复核底稿。当用户提到董事会决议/会议纪要/董事会职权/关联董事回避/议事规则,或需要拟定、审查公司治理类董事会文件时使用本技能(即使未明说"会议纪要")。
argument-hint: "[会议事项、决议草稿文件路径或粘贴文本]"
---

# /cn-corporate:board-minutes

【AI 辅助草稿，需律师复核】

起草或审查董事会会议纪要与董事会决议，作为律师复核工作底稿。不得将本产出标注为可签署、可对外发送或最终结论。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate). Before reading the document body, additionally confirm: 公司主体（含章程现行版本）已识别，决议事项属本次事务授权范围，且输出目的地为内部 review queue。Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 识别公司类型（有限责任公司 / 股份有限公司）并核对公司章程现行版本中关于董事会的条款。
2. 提取决议事项，逐项判断其是否属于《公司法》规定的董事会法定职权或章程授予的职权（如经营计划与投资方案、内部管理机构设置、聘任高级管理人员、利润分配预案等）；超越职权的事项标红并提示应提交股东会。
3. 审查议事规则要素：召集与通知（通知期限、议程、出席方式）、出席与表决人数门槛、表决方式（一人一票或章程另有规定）、表决结果记载。
4. 审查关联董事回避：识别决议事项是否涉及董事关联关系，确认关联董事是否就关联交易表决事项回避，并核对剩余有表决权董事是否满足法定/章程门槛。
5. 核对法定代表人、签署主体与会议记录签字要求（出席董事应在会议记录上签名），以及是否需加盖公司印章。
6. 形成纪要/决议结构：会议基本信息、出席情况、审议事项、表决情况、决议内容、附件。
7. 每处引用法律或事实时按 `[已核验-来源]`/`[用户提供]`/`[模型知识-待核]` 标注 citationTag；凡 `[模型知识-待核]` 的法律点，须在 `sources.jsonl` 配套写入一条 `source-record`（status: source-needs-check），其 `effectiveStatus` 说明需核验内容。
8. 创建 review queue 条目，status 为 `pending-review`。

## Output

- 顶部固定复核者提示块（已用来源 / 实际审阅范围 / 留待人工判断项 / 时效状态 / 依赖前须办事项）。
- 决议事项职权与议事合规性表（GREEN / YELLOW / RED）。
- 关联董事回避核查结论。
- 纪要/决议草稿正文。
- 缺失事实清单与来源表。
- 律师复核要点。

## Next Steps

- 若决议事项实为股东会法定职权：转交 `/cn-corporate:written-consent`（如拟以书面决议方式）或提示改提股东会。
- 若决议指向股权收购/增资交割：转交 `/cn-corporate:closing-checklist`。
- 若涉及工商变更登记或存续合规义务：转交 `/cn-corporate:entity-compliance`。
- 决议涉及重大合同审批时：转交 `/cn-contract:review`。

## 产出物路由

- 需要将董事会纪要交付为 Word 成品时,调用 `crabcode-office-suite:crabcode-documents` 生成 .docx;
- 若触发时报 Unknown skill,说明办公套件未安装:引导用户通过 `/plugin` 安装 `crabcode-office-suite` 后重试;安装完成前先以 markdown 呈现全文供用户确认。
