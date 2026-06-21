---
name: aia-generation
description: 起草算法影响评估/生成式AI安全评估报告草稿,交叉个人信息保护影响评估,并按需登记备案期限。当用户提到算法安全自评估/生成式AI安全评估/算法备案材料/上线登记报告/AI 影响评估、需要写 AI 评估报告时使用本技能(即使未明说"评估")。
argument-hint: "[AI 用例事实、已登记的 ai-usecase id 或前序分流记录]"
---

# /cn-ai-governance:aia-generation

【AI 辅助草稿，需律师复核】

Draft an algorithm/generative-AI impact and safety self-assessment workpaper. 本技能产出内部评估草稿,不构成最终合规审批,不得标注为可对外报送/备案提交的最终版本。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate: active matter, authorized scope, conflict-check status `no-hit` or `cleared-by-lawyer`, internal-only output destination, review queue item created, source records writable). Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 载入已登记的 `ai-usecase` 与前序分流(`/cn-ai-governance:use-case-triage`),或采集用例事实。
2. 确认评估类型(可叠加,默认中国法):
   - 算法安全自评估 / 算法备案材料(《互联网信息服务算法推荐管理规定》)。
   - 生成式AI安全评估(向公众提供且具舆论属性或社会动员能力,《生成式人工智能服务管理暂行办法》)。
   - 深度合成自评估与标识方案(《互联网信息服务深度合成管理规定》)。
   - 个人信息保护影响评估交叉(自动化决策/处理敏感个人信息时,《个人信息保护法》;PIA 本体由 `/cn-data-compliance:pia-generation` 出具,本技能仅做交叉引用)。
3. 搭建评估报告草稿结构:
   - 服务/算法基本情况与提供方式。
   - 语料/训练数据与数据来源合法性、个人信息处理合法性基础。
   - 算法机制机理、模型基本原理、安全风险与防范措施。
   - 内容安全(违法不良信息防范、生成内容标识、用户投诉与辟谣机制)。
   - 个人信息与权益影响、自动化决策影响及救济。
   - 安全管理制度、应急处置、向用户的告知。
   - 残余风险与改进项、评估人/复核人签署栏。
4. 为每条法律点标 `citationTag`;`[已核验-来源]` 须填 `sourceRef`。
5. Record verified sources in `sources.jsonl`. For any unverifiable point, mark it `[需核验]` AND write a paired `source-record` (`status: source-needs-check`; `effectiveStatus` describing the gap). The bundle check enforces that `[需核验]` and `source-needs-check` co-occur.
6. 如评估确认存在备案/上线登记/重新申报义务,登记 `compliance-deadline`(如 `obligationType: regulatory-filing` 或 `security-assessment-refile`,填 `basis`/`dueDate`/`leadTimeDays`)。
7. Create a review queue item。

## Output

Return:

- 评估报告草稿(按上述结构)。
- 缺失事实清单。
- 来源状态表。
- 风险整改项与责任人列表。
- 登记的 `compliance-deadline` 摘要(若有)。
- Lawyer review points。

## Next Steps

- 报告暴露需逐条对照法规的差距:hand off to `/cn-ai-governance:reg-gap-analysis`。
- 涉及个人信息保护影响评估本体:hand off to `/cn-data-compliance:pia-generation`。
- 涉及数据出境:escalate to `/cn-data-compliance:cross-border-transfer-check`。
- 备案/复评期限登记后:由 `/matter-core:compliance-deadline-watcher` 跟踪。
