---
name: AI 用例盘点
short-description: 盘点并登记企业 AI 用例/算法系统,逐条产出 ai-usecase 台账记录
description: 盘点并登记企业 AI 用例/算法系统,逐条产出 ai-usecase 台账记录。当用户提到 AI 盘点/算法清单/我们都用了哪些 AI/建 AI 资产台账/排查 AI 系统、需要梳理生成式AI与算法应用底数时使用本技能(即使未明说"盘点")。
argument-hint: "[AI 用例/系统清单、产品线或部门范围]"
---

# /cn-ai-governance:ai-inventory

【AI 辅助草稿，需律师复核】

Inventory AI/algorithmic use cases and register each as an `ai-usecase` record. 本技能只产出内部盘点台账,不构成合规结论,也不得标注为可对外报送/备案提交的最终版本。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate: active matter, authorized scope, conflict-check status `no-hit` or `cleared-by-lawyer`, internal-only output destination, review queue item created, source records writable). Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 划定盘点范围:产品线、业务部门、对内/对外系统,以及第三方/供应商提供的 AI 服务。
2. 逐个用例采集事实,对应 `ai-usecase` 字段:
   - `name` / `description` — 用例名称与功能描述。
   - `deploymentContext` — 部署场景(内部工具/面向客户/向公众提供服务/嵌入产品/第三方提供/研究测试)。
   - `aiCategory` — AI 类型(生成式文本/生成式图像音视频/决策辅助/自动化决策/算法推荐/生物识别)。
   - `dataTypes` — 处理的数据类别(个人信息/敏感个人信息/重要数据/公开数据等)。
   - `filingStatus` — 现有备案状态(无需备案/需备案未备案/算法备案/深度合成备案/生成式AI上线登记)。
3. 对每条用例先填 `riskLevel: unassessed`,正式分级分流交由 `/cn-ai-governance:use-case-triage`,本技能不下风险结论。
4. 识别中国监管触发信号(向公众提供生成式AI服务、具有舆论属性或社会动员能力的算法、深度合成/换脸换声、自动化决策、生物识别),记入 `notes` 供后续分级。
5. 为每条记录标 `citationTag`(`[已核验-来源]`/`[用户提供]`/`[模型知识-待核]`);`[已核验-来源]` 须填 `sourceRef`。
6. Record verified sources in `sources.jsonl`. For any unverifiable point, mark it `[需核验]` AND write a paired `source-record` (`status: source-needs-check`; `effectiveStatus` describing the gap). The bundle check enforces that `[需核验]` and `source-needs-check` co-occur.
7. 写入 `ai-usecase` 记录(每用例一条),并 Create a review queue item。

## Output

Return:

- AI 用例台账(逐条 `ai-usecase` 摘要:名称、部署场景、AI 类型、数据类别、备案状态、监管触发信号)。
- 缺失事实清单。
- 待分级用例列表(`riskLevel: unassessed`)。
- 来源状态表。
- Lawyer review points。

## Next Steps

- 对已登记用例做风险分级分流:hand off to `/cn-ai-governance:use-case-triage` with the usecase id。
- 第三方/供应商提供(`deploymentContext: vendor-provided`):hand off to `/cn-ai-governance:vendor-ai-review`。
- 涉及个人信息/敏感个人信息处理:escalate to `/cn-data-compliance:data-activity-triage`。
