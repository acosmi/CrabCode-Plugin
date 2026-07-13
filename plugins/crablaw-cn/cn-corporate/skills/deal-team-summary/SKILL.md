---
name: 并购交易摘要
short-description: 基于审查/尽调成果,生成面向业务团队的中国并购或股权交易法律摘要
description: 基于审查/尽调成果,生成面向业务团队的中国并购或股权交易法律摘要。当用户提到给业务团队/管理层汇报交易、交易摘要/法律要点提炼、需要把尽调与审查结论转成易读摘要时使用本技能(即使未明说"摘要")。
argument-hint: "[review queue / diligence-finding 条目 id 或尽调摘要]"
---

# /cn-corporate:deal-team-summary

【AI 辅助草稿，需律师复核】

面向业务团队生成交易法律摘要，由既有尽调/审查结论汇总而成，仅供内部使用。不得将本产出标注为可签署、可对外发送或最终结论。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate). Before producing the summary, additionally confirm: 摘要来源（review queue 条目、diligence-finding 链结论）已存在且属本事务，受众为内部业务团队，输出目的地为内部。Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 收集来源条目：本事务下相关 `review-queue` 结论、`diligence-finding`（reader→analyzer→writer 链）结论及 `compliance-deadline` 期限。
2. 提炼交易概况：交易结构、标的、主要主体、关键商业条款（价款、支付、对赌、锁定期）。
3. 汇总法律风险要点，保留上游严重度：上游 🔴/🟠（RED/YELLOW）结论不得在本摘要中被默默下调；如确需调整须在文中说明理由（Shared Guardrail 4）。
4. 列示尚未满足的交割先决条件与待办事项，标明责任方与时间节点。
5. 用业务语言改写，但每个法律结论保留 citationTag 标注，便于业务团队识别确定性程度；`[模型知识-待核]` 法律点配套写入 `sources.jsonl` 的 `source-record`（status: source-needs-check）。
6. 发送目的地核查：明确本摘要为内部文件，如业务团队拟转发客户/对方，须先警示并提供脱敏版与完整版选择（Shared Guardrail 1）。
7. 创建 review queue 条目，status 为 `pending-review`。

## Output

- 顶部固定复核者提示块，并显著标注「内部使用，非签署、非对外」。
- 交易一页纸概览。
- 法律风险要点（按 GREEN / YELLOW / RED，附上游来源条目 id）。
- 未决项与待办清单（责任方、时点）。
- 来源表与律师复核要点。

## Next Steps

- 风险点需深入审查时：回溯 `/cn-corporate:diligence-issue-extraction` 或 `/cn-contract:review`。
- 交割推进：转交 `/cn-corporate:closing-checklist`。
- 拟对外发送的客户版材料：先经律师复核并明确发送目的地，再考虑脱敏处理。
