---
name: AI 治理制度起草
short-description: 起草企业内部 AI 治理政策/制度草稿(AI 使用规范、算法/深度合成管理、生成内容标识与审核制度)
description: 起草企业内部 AI 治理政策/制度草稿(AI 使用规范、算法/深度合成管理、生成内容标识与审核制度)。当用户提到写 AI 使用管理制度/内部 AI 政策/员工用 AI 的规定/算法治理制度/生成内容标识办法、需要建 AI 内控文件时使用本技能(即使未明说"起草制度")。
argument-hint: "[制度类型、适用范围或已识别的合规义务]"
---

# /cn-ai-governance:policy-starter

【AI 辅助草稿，需律师复核】

Draft an internal AI governance policy/制度. 本技能产出内部制度草稿,不构成最终生效文件,不得标注为可对外报送的最终版本。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate: active matter, authorized scope, conflict-check status `no-hit` or `cleared-by-lawyer`, internal-only output destination, review queue item created, source records writable). Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 确认制度类型与适用范围:如《人工智能使用管理办法》《算法应用合规管理制度》《深度合成与生成内容标识管理办法》《AI 数据与语料管理规范》。
2. 载入已识别的合规义务来源:已登记的 `ai-usecase`、`reg-policy`、分流/评估/差距分析结论。
3. 按中国 AI 监管要求搭建制度条款(默认中国法):
   - 适用范围、角色与职责(算法/AI 治理责任人、审核与投诉受理)。
   - 用例准入与上线审批流程(对接分级分流与备案/上线登记要求)。
   - 训练数据/语料与个人信息处理合规(《个人信息保护法》《数据安全法》交叉)。
   - 内容安全与生成内容标识(《生成式人工智能服务管理暂行办法》《深度合成规定》)。
   - 算法机制透明与用户权益保障(《算法推荐管理规定》)。
   - 安全评估、备案与上线登记的内部对应流程。
   - 应急处置、违法不良信息处置、投诉举报与辟谣。
   - 员工使用 AI 工具行为红线与数据外泄防范(不接入境外数据库/SaaS)。
   - 监督、问责与制度复审周期。
4. 为每条引用法规标 `citationTag`;`[已核验-来源]` 须填 `sourceRef`。
5. Record verified sources in `sources.jsonl`. For any unverifiable point, mark it `[需核验]` AND write a paired `source-record` (`status: source-needs-check`; `effectiveStatus` describing the gap). The bundle check enforces that `[需核验]` and `source-needs-check` co-occur.
6. Create a review queue item。

## Output

Return:

- 内部 AI 治理制度草稿(按上述结构,带条款)。
- 制度对应的法规依据表(标 `citationTag`)。
- 需企业自行填充的空白项(责任人、审批层级、阈值)。
- 来源状态表。
- Lawyer review points。

## Next Steps

- 制度落地需逐条核对企业现状差距:hand off to `/cn-ai-governance:reg-gap-analysis`。
- 涉及个人信息处理制度:escalate to `/cn-data-compliance:privacy-policy-review` 或 `/cn-data-compliance:data-processing-review`。
- 涉及员工行为与劳动管理:escalate to `/cn-labor-employment` 相应技能。
