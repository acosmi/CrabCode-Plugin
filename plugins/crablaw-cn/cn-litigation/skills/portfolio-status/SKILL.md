---
name: 案件组合总览
short-description: 批量案件组合状态总览,汇总多案件的审级、进展、临近期限与风险
description: 批量案件组合状态总览,汇总多案件的审级、进展、临近期限与风险。当用户提到所有案件/案件清单/批量看进展/哪些快到期/组合总览,需要跨多案件汇总时使用本技能(即使未明说"组合总览")。
argument-hint: "[筛选条件：客户/承办律师/审级/状态，或案件 caseId 列表]"
---

# /cn-litigation:portfolio-status

【AI 辅助草稿，需律师复核】

诉讼/仲裁案件组合（portfolio）状态总览底稿，跨多个案件汇总进展、期限与风险。本产出为内部工作底稿，不得标注为可签署、可对外发送或可向法院/仲裁机构提交的最终版本。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate). 额外确认：跨案件读取仅限授权范围内的案件（避免跨案越权，触发 CROSS_MATTER_DENIED 时停止）；产出目的地为内部审核队列。Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 确定范围：按筛选条件（客户、承办律师、审级、status、forumType）或指定 caseId 列表确定纳入统计的案件，逐一确认在授权范围内。
2. 汇总登记信息：从各 litigation-matter 取 caseNumber、forumName、causeOfAction、partyRole、instance、claimAmount/claimSummary、status，形成案件清单。
3. 进展概览：按审级（一审/二审/再审/执行/仲裁/保全）与状态（active/stayed/concluded/withdrawn/enforcement/archived）分组统计，标明各案最近一次进展节点。
4. 期限聚合：从 `compliance-deadline`（obligationType: litigation-deadline）聚合各案临近与逾期期限，按 dueDate 排序，突出 leadTimeDays 内或已逾期项；期限以该记录为唯一真实来源，本 skill 仅读取不另存。
5. 风险热力：按 GREEN/YELLOW/RED 汇总各案风险等级与未了结的 🔴/🟠 项；不得静默降级上游严重度，跨案汇总须保留单案最高严重度。
6. 标的与回款视角：在执行/给付类案件中汇总诉请/标的金额与已执行到位情况（金额以文本保留，不强制转数值），提示回款风险集中度。
7. 异常清单：标记缺少承办人、缺少最新进展、期限缺失或来源待核（`[模型知识-待核]`）的案件，列为需补登项。
8. 比例原则：高标的/高风险案件给出更细颗粒度，低风险案件可合并概述。建立 `pending-review` 的 review queue item。

## Output

- 组合总览（reviewer note 置顶）。
- 案件清单表（案号/法院或仲裁委/案由/诉讼地位/审级/状态）。
- 进展与审级分组统计。
- 临近与逾期期限聚合（来源于 compliance-deadline）。
- 风险热力（GREEN/YELLOW/RED 与未了结 🔴/🟠）。
- 标的/回款集中度（如适用）。
- 异常与补登清单。
- 待核项与来源表。
- 律师复核要点。

## Next Steps

- 针对单案深入：移交 `/cn-litigation:matter-briefing` 或 `/cn-litigation:matter-update`。
- 期限集中监测：交由 matter-core 的 compliance-deadline-watcher。
- 可结案案件：移交 `/cn-litigation:matter-close`。
