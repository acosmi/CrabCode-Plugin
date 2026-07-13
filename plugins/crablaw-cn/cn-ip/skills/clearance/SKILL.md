---
name: 在先权利检索
short-description: 在商标/专利申请前做在先权利检索与可注册性/侵权清除分析草稿,标注红线
description: 在商标/专利申请前做在先权利检索与可注册性/侵权清除分析草稿,标注红线。当用户提到商标能不能注册/专利申请前查新/在先权利检索/近似查询/可注册性/clearance,或要起新品牌名、新标识、新外观前评估时使用本技能(即使未明说"清除分析")。
argument-hint: "[拟申请标的:商标文字图样及尼斯类别 / 技术方案 / 外观;以及业务场景]"
---

# /cn-ip:clearance

【AI 辅助草稿，需律师复核】

Produce a pre-filing 在先权利检索与清除分析草稿(可注册性 / 侵权清除)under PRC law. 本草稿为内部初步分析,不得标注为可签署、最终结论或"可安全使用";不接入境外数据库或 SaaS,所有检索结果须由律师在官方途径复核。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate). Before analysis, additionally confirm: (a) the subject matter (标识/技术方案/外观) and its 尼斯分类 or 技术领域 are specified by the user; (b) clearance work fits the engagement scope; (c) output destination is the review queue. Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 界定检索标的与范围:商标(文字/图形/组合、尼斯类别、指定商品服务)、专利(技术方案、所属技术领域、关键特征)、外观设计(产品类别、设计要点)。
2. 在先权利识别(中国法语境):
   - 商标:《商标法》第三十条、第三十一条在先注册/申请,第三十二条在先权利(字号、著作权、姓名权等)及在先使用有一定影响商标;第十条、第十一条绝对禁注与显著性。
   - 专利:《专利法》新颖性、创造性的现有技术比对(申请前评估,非实质审查结论)。
   - 外观设计:与现有设计/现有设计特征组合的明显区别。
3. 标注检索局限:本技能不连接官方商标/专利检索系统,结果均为 `[模型知识-待核]`;必须由律师在国家知识产权局等官方途径复核。每条须配 `source-record`(status: source-needs-check)。
4. 风险评分:冲突等级、近似度、可注册性、被异议/无效风险;给出可注册性/清除结论的置信区间而非确定结论。
5. 提出处置建议:调整标识/类别、规避设计、寻求共存/许可、放弃。
6. 创建 review queue 项,status `pending-review`;命中可登记为 `diligence-finding`(category=risk)。

## Output

- Reviewer note 顶部固定块。
- 检索标的与范围说明。
- 在先权利/冲突清单(citationTag,逐项标注检索局限)。
- 可注册性/清除风险表(GREEN/YELLOW/RED)。
- 处置建议与备选方案。
- 缺失事实与待官方核验项清单。
- 来源表。

## Next Steps

- 命中疑似侵权风险且涉及已上市产品:转 `/cn-ip:fto-triage`(专利)或 `/cn-ip:infringement-triage`。
- 拟登记内部 IP 资产:转 `/cn-ip:invention-intake`(发明)或 `/cn-ip:portfolio`。
- 需正式检索报告:由律师在官方途径完成,本草稿不替代官方检索结论。

## 调研升级路径
<!-- capability-route: deep-research=pending(通用调研插件立项中,法律域需保留境内合规渠道约束) -->

- 本技能的检索与调研以国家知识产权局专利检索及分析系统、商标网上检索系统、版权登记公告等境内官方检索渠道为边界,不经由不合规的境外检索渠道;
- 需要联网深度调研时,优先请用户提供检索结果材料;在具备 WebSearch/WebFetch 工具的会话中,按上述渠道边界直接检索并逐条留存出处;
- 通用深度调研插件(crabcode-deep-research,支持域约束参数化)就位后,本段改为全限定名路由并传入本域渠道白名单(设计稿见仓库 docs/audit/2026-07-04-crabcode-deep-research-设计稿.md)。
