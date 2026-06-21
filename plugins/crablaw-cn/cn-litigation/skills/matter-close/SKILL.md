---
name: matter-close
description: 结案归档,记录裁判结果、履行/执行情况、归档与资料留存期限。当用户提到结案/案件结束/归档/收尾/案卷留存,需要办理结案手续时使用本技能(即使未明说"结案归档")。
argument-hint: "[案件 caseId 与结案信息：裁判结果/履行情况]"
---

# /cn-litigation:matter-close

【AI 辅助草稿，需律师复核】

诉讼/仲裁案件结案归档底稿，记录裁判结果、履行与执行情况、归档清单与资料留存期限。本产出为内部工作底稿，不得标注为可签署、可对外发送或可向法院/仲裁机构提交的最终版本。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate). 额外确认：案件具备结案条件（生效裁判/调解/撤诉/执行终结）；存在对应 litigation-matter 记录。Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 确认结案方式：判决/裁定生效、仲裁裁决作出、调解书生效、撤诉、和解、驳回、执行终结或终本等；核对生效要件（上诉期/申请撤销期是否届满、是否已送达）。
2. 记录裁判结果：归纳判项/裁决主文、责任分担、给付内容与金额、诉讼/仲裁费用负担；标注来源文书（裁判文书编号）并按三值标注。
3. 履行与执行情况：记录义务人是否自动履行、履行期限、是否已申请强制执行及执行进展（到位金额、终本、和解执行等）；提示申请执行期间（一般 2 年 [模型知识-待核]）等剩余救济窗口。
4. 剩余救济与风险：评估是否仍有上诉、再审申请、申请撤销仲裁裁决或不予执行等可能与期限；对未了结风险按 GREEN/YELLOW/RED 标注，不得静默降级上游 🔴/🟠。
5. 更新 litigation-matter：status 置 concluded 或 archived（执行未完可暂置 enforcement），填写 concludedAt；将相关 compliance-deadline 中已无效的期限置 completed/superseded/cancelled。
6. 归档清单：列出应归档材料（委托手续、诉状/答辩状、证据卷、庭审笔录、裁判文书、送达回证、执行文书、收付款凭证等）与电子/纸质归档位置（仅本地或机构内部存储，不接境外数据库/SaaS）。
7. 资料留存期限：依据所适用的档案/留存要求拟定留存期限，并写入 `compliance-deadline`（obligationType: retention-expiry，含 dueDate、leadTimeDays、severity）；具体年限需以现行规定与机构制度核对（[模型知识-待核]）。
8. 无核验来源的法律点配 `source-record`（status: source-needs-check）。建立 `pending-review` 的 review queue item。

## Output

- 结案归档摘要（reviewer note 置顶）。
- 结案方式与生效要件核对。
- 裁判结果与费用负担。
- 履行/执行情况与剩余救济窗口。
- litigation-matter 状态变更与期限收尾。
- 归档材料清单与留存期限（retention-expiry）。
- 来源表与待核项。
- 律师复核要点。

## Next Steps

- 留存到期提醒：交由 matter-core 的 compliance-deadline-watcher 监测。
- 同类案件复盘或组合统计：移交 `/cn-litigation:portfolio-status`。
- 如执行尚未终结：在执行进展节点回到 `/cn-litigation:matter-update`。
