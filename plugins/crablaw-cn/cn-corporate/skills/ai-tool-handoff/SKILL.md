---
name: ai-tool-handoff
description: 生成事务的结构化交接说明包(已读范围/未决项/红线/citationTag 现状),供其他工具或 AI 接手。当用户提到交接/移交/handoff/把事务转给别的工具或助手、需要打包当前进度与未决事项时使用本技能(即使未明说"交接包")。
argument-hint: "[拟交接的事务范围或接收方说明]"
---

# /cn-corporate:ai-tool-handoff

【AI 辅助草稿，需律师复核】

生成将当前事务交接给其他工具/助手的结构化说明包，作为内部工作底稿。不得将本产出标注为可签署、可对外发送或最终结论。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate). Before producing the handoff, additionally confirm: 交接范围属本事务且在用户授权范围内，输出目的地为内部，且不向境外数据库或外部 SaaS 导出事务数据。Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 汇总已读范围：列明本事务中已审阅的文件、`review-queue` 条目与 `diligence-finding` 结论的覆盖面与边界。
2. 列未决项：尚未审查的文件、待补事实、待客户/对方确认事项、未满足的交割先决条件。
3. 红线提示：汇总上游 🔴/🟠（RED/YELLOW）结论，明确其严重度不得被接收方默默下调（Shared Guardrail 4）；列出必须由律师判断的事项。
4. citationTag 现状：盘点关键法律结论的标注分布（`[已核验-来源]`/`[用户提供]`/`[模型知识-待核]`），并列出待核验清单（对应 `sources.jsonl` 中 `source-needs-check` 条目）。
5. 边界与禁区声明：本说明包仅供内部协作；不得据此对外发送、签署或作出最终结论；接收方须沿用 Matter Gate 与 Shared Guardrails。
6. 发送目的地核查：确认接收方为内部/受控环境；如涉及对外传递，先警示并提供脱敏版与完整版选择（Shared Guardrail 1）。
7. 创建 review queue 条目，status 为 `pending-review`。

## Output

- 顶部固定复核者提示块。
- 事务概况与已读范围。
- 未决项清单。
- 红线提示与须律师判断事项。
- citationTag 现状盘点与待核验清单。
- 边界与禁区声明。

## Next Steps

- 待核验法律点：回溯对应来源核验后更新 citationTag。
- 未读文件：转交 `/cn-corporate:diligence-issue-extraction` 或 `/cn-corporate:tabular-review`。
- 业务团队沟通：转交 `/cn-corporate:deal-team-summary`。
