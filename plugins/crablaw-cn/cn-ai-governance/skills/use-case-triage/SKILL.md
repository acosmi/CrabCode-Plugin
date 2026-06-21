---
name: use-case-triage
description: 对 AI 用例做风险分级分流并判定备案路径,更新 ai-usecase 的 riskLevel 与 filingStatus。当用户提到 AI 用例/模型上线/算法应用风险/这个 AI 功能能不能用/要不要做算法备案、需要判断 AI 应用合规风险等级时使用本技能(即使未明说"分级")。
argument-hint: "[AI 用例事实或已登记的 ai-usecase id]"
---

# /cn-ai-governance:use-case-triage

【AI 辅助草稿，需律师复核】

Triage an AI use case for risk level and PRC filing posture. 本技能产出的是初步分流记录,不是最终合规审批,不得标注为可对外报送/备案提交的最终版本。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate: active matter, authorized scope, conflict-check status `no-hit` or `cleared-by-lawyer`, internal-only output destination, review queue item created, source records writable). Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 载入已登记的 `ai-usecase`(来自 `/cn-ai-governance:ai-inventory`)或采集用例事实。
2. 判定监管适用面(默认中国法):
   - 是否向中华人民共和国境内公众提供生成式人工智能服务(《生成式人工智能服务管理暂行办法》)。
   - 是否为具有舆论属性或社会动员能力的算法推荐服务(《互联网信息服务算法推荐管理规定》)。
   - 是否涉及深度合成(人脸/声音/图像/视频生成或显著改变,《互联网信息服务深度合成管理规定》)。
   - 是否涉及自动化决策、个人信息/敏感个人信息处理(《个人信息保护法》交叉)。
   - 是否涉及重要数据(《数据安全法》交叉)。
3. 判定 `riskLevel`(low/medium/high/unacceptable):结合部署场景、面向对象、数据敏感度、可能的人身/财产/社会影响;upstream 已有的 🔴/🟠 不得静默下调(cross-skill severity floor),下调须在输出中说明理由。
4. 判定 `filingStatus` 应然路径:
   - 算法备案(具有舆论属性或社会动员能力的算法推荐/深度合成服务提供者及技术支持者)。
   - 深度合成备案。
   - 生成式AI(大模型)上线登记/安全评估(向公众提供且具舆论属性或社会动员能力)。
   - 标识义务(深度合成内容显著标识与隐式标识)。
   - 评估并标注从 `not-required` 到 `required-not-filed` 的缺口。
5. 为每个判定标 `citationTag`;`[已核验-来源]` 须填 `sourceRef`。
6. Record verified sources in `sources.jsonl`. For any unverifiable point, mark it `[需核验]` AND write a paired `source-record` (`status: source-needs-check`; `effectiveStatus` describing the gap). The bundle check enforces that `[需核验]` and `source-needs-check` co-occur.
7. 更新 `ai-usecase` 的 `riskLevel` 与 `filingStatus`(并在 `notes` 记录分级理由),Create a review queue item。

## Output

Return:

- 风险分级结论(GREEN/YELLOW/RED 对应 low-medium / 须律师判断 / 停手待律师)与理由。
- `filingStatus` 应然路径与缺口(需备案未备案项)。
- 适用法规对照(标 `citationTag`)。
- 缺失事实清单。
- 来源状态表。
- Lawyer review points(severity floor 说明)。

## Next Steps

Route based on the triage:

- 需算法备案/安全评估/个人信息保护影响评估:hand off to `/cn-ai-governance:aia-generation` with the usecase id。
- 第三方/供应商提供的 AI 服务:hand off to `/cn-ai-governance:vendor-ai-review`。
- 需逐条对照法规找差距:hand off to `/cn-ai-governance:reg-gap-analysis`。
- 触及个人信息/重要数据处理:escalate to `/cn-data-compliance:data-activity-triage`。
