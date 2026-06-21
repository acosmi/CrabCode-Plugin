---
name: fto-triage
description: 做自由实施(FTO)分析分流草稿,判断产品/技术是否落入他人专利权利要求保护范围,标注红线。当用户提到FTO/自由实施/侵权风险排查/产品上市前专利风险/会不会侵专利/落入权利要求,或新产品/新功能上线前评估专利风险时使用本技能(即使未明说"FTO")。
argument-hint: "[产品/技术方案描述、关键技术特征、目标市场、已知相关专利(如有)]"
---

# /cn-ip:fto-triage

【AI 辅助草稿，需律师复核】

Triage a Freedom-to-Operate(自由实施)question under PRC patent law. 本草稿为内部初步分流,不得标注为可签署、最终结论或"可自由实施";不接入境外专利数据库,权利要求比对结论须由律师复核。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate). Before analysis, additionally confirm: (a) the product/technical solution and its key features are described by the user; (b) FTO work fits the engagement scope; (c) output destination is the review queue. Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 拆解我方产品/技术的关键技术特征,形成特征清单。
2. 识别潜在障碍专利:用户提供的专利标 `[用户提供]`;模型知识提示的标 `[模型知识-待核]`;本技能不连接官方专利检索系统,完整检索须由律师在国家知识产权局途径完成。
3. 权利要求比对(中国法):
   - 发明/实用新型:以独立权利要求为准,适用全面覆盖原则;评估字面侵权与等同侵权(《最高人民法院关于审理侵犯专利权纠纷案件应用法律若干问题的解释》)。
   - 外观设计:以整体视觉效果、是否构成相同或近似判断。
   - 标注现有技术抗辩、专利权稳定性(可能可提无效)、专利法律状态(是否有效、是否欠缴年费)等不确定因素。
4. 风险分级:落入风险高/中/低;给出分流结论而非确定的"侵权/不侵权"定论。
5. 处置路径:设计规避(规避设计)、寻求许可、提专利无效、放弃功能、深入检索。
6. 每条比对依据配 `source-record`;无核验来源标 `[模型知识-待核]` 且配 status: source-needs-check。登记为 `diligence-finding`(category=risk,producedBy 按层级)。
7. 创建 review queue 项,status `pending-review`。

## Output

- Reviewer note 顶部固定块。
- 产品技术特征清单。
- 障碍专利与权利要求比对表(citationTag)。
- FTO 风险分级表(GREEN/YELLOW/RED)。
- 处置路径建议。
- 缺失信息与待官方检索/法律状态核验项。
- 来源表。

## Next Steps

- 需申请前清除分析(我方拟申请):转 `/cn-ip:clearance`。
- 已收到对方侵权指控:转 `/cn-ip:infringement-triage`(我方被指侵权分支)。
- 拟向对方发函或回应:转 `/cn-ip:cease-desist`(由律师决定是否发函)。
- 需正式 FTO 报告与无效检索:由律师统筹官方检索,本草稿不替代正式 FTO 结论。
