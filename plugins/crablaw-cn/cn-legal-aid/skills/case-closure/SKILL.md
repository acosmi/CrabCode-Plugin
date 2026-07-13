---
name: 法律援助结案
short-description: 法律援助案件结案小结与质量评估归档,记录办案结果、受援人权益实现情况、归档清单与留存期限
description: 法律援助案件结案小结与质量评估归档,记录办案结果、受援人权益实现情况、归档清单与留存期限。当用户提到结案、援助案件结束、办案小结、质量评估、归档、收尾,需要办理援助结案手续时使用本技能(即使未明说"结案")。
argument-hint: "[受援人 matter id 与结案信息:办案结果/履行情况]"
---

# /cn-legal-aid:case-closure

【AI 辅助草稿，需律师复核】

法律援助案件结案小结与质量评估归档底稿，依据《中华人民共和国法律援助法》及结案归档要求。本产出为内部工作底稿，不得标注为可签署、可对外发送或可作为正式结案报告的最终版本。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate). 结案前额外确认：受援人=client、援助事项=matter（matterType=legal-aid）已建、冲突筛查通过；案件具备结案条件（生效裁判/调解/撤诉/刑事程序终结/终止援助等）。Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 结案方式确认：判决/裁定生效、调解、撤诉、和解、刑事程序终结、依法终止法律援助或受援人自行终止委托等；核对生效/终止要件并标注来源文书。
2. 办案结果与受援人权益：归纳办案结果与受援人诉求实现情况（胜诉/部分支持/调解金额、刑事辩护意见采纳情况等），如实记录，不夸大成效。
3. 履行/执行与后续救济：记录义务履行、是否申请执行及进展，提示剩余救济窗口与期限（如上诉、再审、申请执行期间 [模型知识-待核]）。
4. 质量评估：按质量监督维度自评（事实清楚程度、法律适用、程序合规、文书质量、受援人沟通与满意度线索），标记需督导关注事项；不静默降级上游 🔴/🟠。
5. 更新记录：将 `matter.status` 置 closed（填 closedAt）；将相关 `compliance-deadline` 中已无效期限置 completed/superseded/cancelled。
6. 归档清单：列出应归档材料（受理登记表/申请表、资格审查材料、授权委托手续、文书与证据卷、庭审记录、裁判/调解文书、送达回证、沟通记录、结案小结等）与本地/机构内部归档位置（不接境外数据库/SaaS）。
7. 资料留存期限：依据所适用的档案/留存要求拟定留存期限，写入 `compliance-deadline`（obligationType: retention-expiry，含 dueDate、leadTimeDays、severity）；具体年限须以现行规定与机构制度核对（[模型知识-待核]，按 Currency Gate 复核）。
8. 来源标注：无核验来源的法律点配 `source-record`（status: source-needs-check）。建立 `pending-review` 的 review queue item（sourcePlugin: cn-legal-aid）。

## Output

- 结案小结摘要（reviewer note 置顶）。
- 结案方式与生效/终止要件核对。
- 办案结果与受援人权益实现情况。
- 履行/执行与剩余救济窗口。
- 质量评估（自评+需督导关注项）。
- matter 状态变更与期限收尾。
- 归档材料清单与留存期限（retention-expiry）。
- 来源表与待核项。
- 律师/督导复核要点。

## Next Steps

- 结案质量需督导把关：移交 `/cn-legal-aid:supervisor-review-queue`。
- 留存到期提醒：交由 matter-core 的 compliance-deadline-watcher 监测。
- 受援人尚有后续救济需告知：移交 `/cn-legal-aid:plain-language-letter`。
- 如执行尚未终结：回到 `/cn-legal-aid:case-status` 跟踪。
