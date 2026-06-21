---
name: legal-hold
description: 证据保全与留存,覆盖诉前/诉中证据保全申请、证据固定与内部留存通知(中国民诉证据保全制度)。当用户提到证据保全/证据固定/防止灭失/留存通知、需要申请或安排证据保全时使用本技能(即使未明说"保全")。
argument-hint: "[案件 caseId、待固定证据或灭失风险情形]"
---

# /cn-litigation:legal-hold

【AI 辅助草稿，需律师复核】

诉讼/仲裁证据保全与留存底稿，依据中国民事诉讼法证据保全制度处理证据固定与内部留存通知。本产出为内部工作底稿，不得标注为可签署、可对外发送或可向法院/仲裁机构提交的最终版本。

注：本 skill 处理的是中国民事诉讼法上的「证据保全」与内部证据留存，而非英美法的 legal hold；英美 discovery（证据开示）、deposition（证言录取）、subpoena、privilege log 等在中国民事诉讼中均无对应制度，不予套用，证据获取须通过当事人举证、申请法院调查取证或申请证据保全等中国法定途径。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate). 额外确认：存在对应 litigation-matter 或拟立案事项；证据获取途径合法（不得以侵害他人合法权益或违反法律禁止性规定的方式取证）。Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 识别灭失风险：判断证据是否可能灭失或以后难以取得（如电子数据、易腐物证、证人将出境、现场即将变动），评估证据保全的必要性与紧迫性（民事诉讼法证据保全规定、相关证据规则 [模型知识-待核]）。
2. 选择保全路径：
   - 诉前证据保全——情况紧急、证据可能灭失或难以取得时，向证据所在地/被申请人住所地/对案件有管辖权的法院申请；仲裁中可经仲裁机构向法院转交申请。
   - 诉中证据保全——立案后由当事人申请或法院依职权采取。
   - 区分证据保全与财产保全（财产保全属 `/cn-litigation:matter-update`/litigation-matter 的 preservation 范畴），勿混用。
3. 申请要件：梳理需准备的材料——保全申请书、待保全证据及证明对象、灭失风险说明、担保（如法院要求）；标注法律依据并按三值标注。
4. 自行证据固定：对己方掌握的证据，指导通过合法方式固定——电子数据的完整性留存（哈希校验、原始载体保存）、公证保全证据、时间戳等；记录固定方式与保管链（chain of custody），保管限于本地/机构内部，不接境外数据库/SaaS。
5. 内部留存通知：向相关业务/IT/保管人员发出内部书面通知，要求暂停删改与争议相关的文件、邮件、电子数据与实物，明确范围、起止与责任人；该通知为内部管理文件，非对外法律文书。
6. 期限管理：诉前证据保全后须在法定期限内起诉/申请仲裁，否则保全可能解除——将该起诉期限及证据留存到期写入 `compliance-deadline`（litigation-deadline / retention-expiry，含 dueDate、leadTimeDays、severity）。
7. 风险标注：对取证合法性、证据真实性完整性、保全被驳回或解除等风险按 GREEN/YELLOW/RED 标注。无核验来源的法律点配 `source-record`（status: source-needs-check）。建立 `pending-review` 的 review queue item。

## Output

- 证据保全/留存摘要（reviewer note 置顶）。
- 灭失风险与保全必要性评估。
- 保全路径建议（诉前/诉中、法院/仲裁转交）。
- 申请材料要件清单。
- 证据固定方式与保管链记录。
- 内部留存通知范围与责任人（内部文件）。
- 相关期限（litigation-deadline / retention-expiry）。
- 风险（GREEN/YELLOW/RED）、待核项与来源表。
- 律师复核要点。

## Next Steps

- 固定的证据并入事实脉络：移交 `/cn-litigation:chronology`。
- 保全后进展（起诉/裁定）：移交 `/cn-litigation:matter-update`。
- 涉财产保全：在 `/cn-litigation:matter-update` 更新 litigation-matter 的 preservation。
- 期限监测：交由 matter-core 的 compliance-deadline-watcher。
