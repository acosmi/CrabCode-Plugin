---
name: 案件进展更新
short-description: 同步开庭、裁定和送达后的案件状态与关键合规期限
description: 案件进展更新,开庭/裁定/送达后同步 litigation-matter 状态与 compliance-deadline 期限。当用户提到案件有新进展/开庭了/收到裁定/送达回执/更新案件状态时使用本技能(即使未明说"进展更新")。
argument-hint: "[案件 caseId 与进展事件，如开庭/裁定/送达回执]"
---

# /cn-litigation:matter-update

【AI 辅助草稿，需律师复核】

诉讼/仲裁案件进展更新，在开庭、裁定、送达等节点后同步案件状态与期限记录。本产出为内部工作底稿，不得标注为可签署、可对外发送或可向法院/仲裁机构提交的最终版本。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate). 额外确认：存在待更新的 litigation-matter 记录；进展事件有来源依据（裁定书/笔录/送达回证/通知）。Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 识别进展事件类型：立案受理、举证通知、开庭传票、庭审、质证、裁定（如管辖权异议、保全、不予受理、驳回起诉）、判决/裁决、送达、上诉、申请执行等；记录事件来源文书并按 `[已核验-来源]`/`[用户提供]`/`[模型知识-待核]` 标注。
2. 送达与起算：依据送达方式（直接/留置/邮寄/公告/电子送达）确认送达完成日，作为上诉期、举证期等期限的起算点（民事诉讼法送达与期间规定 [模型知识-待核]）。
3. 更新 litigation-matter：按需更新 caseNumber、instance（一审→二审→再审→执行）、status（active/stayed/concluded/withdrawn/enforcement/archived）、preservation；status 转 concluded/archived 时填写 concludedAt。期限不写入此处。
4. 同步期限：对受影响的程序期限，新增或更新 `compliance-deadline`（obligationType: litigation-deadline），含 title、basis（法律依据/通知）、dueDate、leadTimeDays、severity；旧期限若被取代置 status: superseded，已完成置 completed 并填 completedAt。常见期限示例（需逐案核对）：
   - 一审判决上诉期 15 日、裁定上诉期 10 日；
   - 涉外/在境外当事人上诉期 30 日；
   - 举证期限以法院指定或当事人协商为准；
   - 申请执行期间 2 年；
   （以上为 [模型知识-待核]，须以法院/仲裁机构实际通知与现行法为准。）
5. 风险联动：评估本次进展引发的新风险（如败诉需上诉、保全到期需续保、对方上诉需应诉），按 GREEN/YELLOW/RED 标注，并提示临近期限。
6. 不得静默降级上游 🔴/🟠 结论；如有降级须在产出中说明理由。
7. 无核验来源的法律点配 `source-record`（status: source-needs-check）。建立 `pending-review` 的 review queue item。

## Output

- 进展更新摘要（reviewer note 置顶）。
- 事件与送达/起算认定。
- litigation-matter 字段变更前后对照。
- compliance-deadline 新增/更新/取代清单。
- 新增风险与临近期限提示（GREEN/YELLOW/RED）。
- 来源表与待核项。
- 律师复核要点。

## Next Steps

- 案件已审结/执行完毕：移交 `/cn-litigation:matter-close`。
- 需更新策略与简报：移交 `/cn-litigation:matter-briefing`。
- 期限集中管理：交由 matter-core 的 compliance-deadline-watcher 监测。
- 多案件总览：移交 `/cn-litigation:portfolio-status`。
