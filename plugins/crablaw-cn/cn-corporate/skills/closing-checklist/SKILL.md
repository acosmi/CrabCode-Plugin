---
name: 交易交割清单
short-description: 编制中国股权收购/增资交易的交割清单,作为律师复核底稿
description: 编制中国股权收购/增资交易的交割清单,作为律师复核底稿。当用户提到交割清单/closing/交割条件/交割文件/股权收购或增资落地、需要梳理交割前置与待办事项时使用本技能(即使未明说"清单")。
argument-hint: "[交易类型、交易文件路径或交易要点]"
---

# /cn-corporate:closing-checklist

【AI 辅助草稿，需律师复核】

为股权收购/增资交易编制交割清单，作为律师复核工作底稿。不得将本产出标注为可签署、可对外发送或最终结论。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate). Before reading the document body, additionally confirm: 交易主体与标的公司已识别，交易结构（股权转让 / 增资）已明确，且输出目的地为内部 review queue。Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 识别交易结构：股权转让或增资扩股、是否涉及国有股权、外商投资、特殊行业许可或经营者集中申报触发点。
2. 梳理交割先决条件（CP）：内部决议（标的公司股东会/董事会、转让方/受让方有权机关决议）、第三方同意（合同变更控制条款、债权人同意、其他股东优先购买权放弃）、政府审批/备案（外商投资信息报告、行业许可、必要时反垄断申报）、陈述与保证持续真实、无重大不利变化。
3. 列付款安排：价款支付节点、共管账户/分期、价款调整与对赌（业绩补偿）安排的触发与计算。
4. 列工商变更登记事项：股权转让/增资的市场监督管理部门变更登记、章程修改备案、董监高变更、注册资本变更，以及登记所需文件（决议、转让协议/增资协议、修改后章程、验资或出资证明等）。
5. 列文件交付清单：原始股东名册更新、出资证明书/股权证、印章证照交接、财务与业务资料移交。
6. 为交割相关期限创建 `compliance-deadline` 条目（obligationType 视情形取 regulatory-filing 用于工商/监管登记备案、contract-renewal 等）；标明触发日、法定/约定期限与责任人。
7. 每处引用法律或事实时标注 citationTag；`[模型知识-待核]` 法律点配套写入 `sources.jsonl` 的 `source-record`（status: source-needs-check）。
8. 创建 review queue 条目，status 为 `pending-review`。

## Output

- 顶部固定复核者提示块。
- 交割先决条件清单（含状态：未满足 / 进行中 / 已满足，及 GREEN / YELLOW / RED 风险标注）。
- 付款安排表与价款调整/对赌要点。
- 工商变更登记与文件交付清单。
- `compliance-deadline` 期限台账摘要。
- 缺失事实清单、来源表与律师复核要点。

## Next Steps

- 各方内部决议起草/审查：转交 `/cn-corporate:board-minutes` 或 `/cn-corporate:written-consent`。
- 交易文件条款审查：转交 `/cn-contract:review`。
- 尽调缺口转化为交割条件时：转交 `/cn-corporate:diligence-issue-extraction`。
- 交割后整合：转交 `/cn-corporate:integration-management`。

## 产出物路由

- 需要将交割清单交付为 Excel 成品时,调用 `crabcode-office-suite:crabcode-spreadsheets` 生成 .xlsx;
- 若触发时报 Unknown skill,说明办公套件未安装:引导用户通过 `/plugin` 安装 `crabcode-office-suite` 后重试;安装完成前先以 markdown 表格呈现内容供用户确认。
