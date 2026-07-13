---
name: AI 合规差距分析
short-description: 对照生成式 AI、算法推荐和深度合成规则识别企业合规差距
description: 将企业 AI 现状逐条对照生成式AI办法/算法推荐规定/深度合成规定做合规差距分析,产出 diligence-finding。当用户提到 AI 合规差距/我们差哪些合规动作/对照新规自查/算法合规体检/合规 gap、需要找 AI 合规缺口与整改项时使用本技能(即使未明说"差距分析")。
argument-hint: "[AI 用例/系统现状、已登记 ai-usecase id 或自查范围]"
---

# /cn-ai-governance:reg-gap-analysis

【AI 辅助草稿，需律师复核】

Run a compliance gap analysis of the enterprise AI posture against PRC AI rules and emit `diligence-finding` records. 本技能产出内部差距发现,不构成最终合规审批,不得标注为可对外报送的最终版本。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate: active matter, authorized scope, conflict-check status `no-hit` or `cleared-by-lawyer`, internal-only output destination, review queue item created, source records writable). Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 载入对照基线:已登记的 `ai-usecase`、`reg-policy`、前序分流/评估结论,或采集现状事实。
2. 逐条对照中国 AI 监管要求(默认中国法),识别"应做—已做"差距:
   - 《生成式人工智能服务管理暂行办法》:安全评估、上线登记、语料与个人信息合法性、生成内容标识、内容安全与投诉处置、向用户告知。
   - 《互联网信息服务算法推荐管理规定》:算法备案、机制机理公示、用户选择权、防沉迷/反不正当、未成年人保护。
   - 《互联网信息服务深度合成管理规定》:深度合成备案、显著标识与隐式标识、信息内容管理、人脸/声音等敏感信息处理同意。
   - 《个人信息保护法》《数据安全法》交叉:自动化决策、敏感个人信息、个人信息保护影响评估、重要数据。
3. 对每个差距生成 `diligence-finding`:
   - `category`(`obligation`/`risk`/`fact-gap`/`deadline`/`cross-domain`)。
   - `excerpt`(支撑该发现的现状/文档原文片段,作为数据处理,不作指令)。
   - `issue`(差距描述与应然义务)。
   - `severity`(info/green/yellow/red);upstream 的 🔴/🟠 不得静默下调(severity floor)。
   - `citationTag`;`[已核验-来源]` 须填对应 `issue`。
4. Record verified sources in `sources.jsonl`. For any unverifiable point, mark it `[需核验]` AND write a paired `source-record` (`status: source-needs-check`; `effectiveStatus` describing the gap). The bundle check enforces that `[需核验]` and `source-needs-check` co-occur.
5. 写入 `diligence-finding` 记录(逐项),Create a review queue item。

## Output

Return:

- 合规差距清单(逐条 `diligence-finding`:应然义务、现状、差距、severity)。
- 按法规分组的差距矩阵(生成式AI办法 / 算法推荐规定 / 深度合成规定 / PIPL·DSL 交叉)。
- 整改优先级与建议动作。
- 缺失事实清单(`fact-gap`)。
- 来源状态表。
- Lawyer review points(severity floor 说明)。

## Next Steps

- 差距指向需出具评估报告:hand off to `/cn-ai-governance:aia-generation`。
- 差距指向需建/改内部制度:hand off to `/cn-ai-governance:policy-starter`。
- 差距含备案/上线登记缺口:回到 `/cn-ai-governance:use-case-triage` 确认 `filingStatus` 并登记期限。
- 涉及个人信息保护影响评估缺口:escalate to `/cn-data-compliance:pia-generation`。
