---
name: 产品上线合规审查
short-description: 产品上线前的中国法综合合规审查,汇总各专项板块结论,给出放行/有条件放行/整改清单
description: 产品上线前的中国法综合合规审查,汇总各专项板块结论,给出放行/有条件放行/整改清单。当用户提到产品要上线了/发版前合规检查/上线 checklist、新业务上线前过一遍法律风险、需要汇总数据广告资质 AI 各专项给放行结论时使用本技能(即使未明说"上线审查")。
argument-hint: "[产品/版本说明,及已有的各专项审查记录 id]"
---

# /cn-product:launch-review

【AI 辅助草稿，需律师复核】

产品上线前的综合合规审查,汇总各专项板块的结论,形成统一的放行 / 有条件放行 / 整改清单,产出 `diligence-finding` 汇总记录。本技能是协调与汇总层,不替代专项板块的实体审查;不得将本产出标注为已放行、可上线或最终结论,放行决定须律师作出。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate: active matter, authorized scope, conflict-check status `no-hit` or `cleared-by-lawyer`, internal-only output destination, review queue item created, source records writable). Before drafting any clearance view, additionally confirm: 上线审查事务与产品版本已识别,输出目的地为内部 review queue。各专项审查记录视为输入证据;凡上游已定 RED/YELLOW 的事项,本汇总不得静默下调,任何下调须在输出中写明理由(Shared Guardrail 4)。Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 锁定审查标的:产品/版本范围、上线时间、目标用户、功能清单与变更点。
2. 清点已完成的专项审查覆盖度,核对是否各风险域都有结论;缺口即列为待办,不以"未发现"代替"未审查":
   - 数据/个人信息(`/cn-data-compliance`)。
   - 算法/自动化决策/AI 生成内容(`/cn-ai-governance`)。
   - 宣传用语/营销(`/cn-product:marketing-claims-review`)。
   - 知识产权(`/cn-ip`)。
   - 资质许可与行业准入(`/cn-regulatory` 或对应资质审查)。
   - 消保/电商/不正当竞争横向事项(`/cn-product:feature-risk-assessment`)。
3. 汇总各专项结论,统一定级 GREEN / YELLOW / RED,并保留各专项原始定级与来源。
4. 形成放行视图:
   - 放行(全 GREEN)。
   - 有条件放行(YELLOW:列明上线前/上线后须办的具名条件与责任去向)。
   - 不放行(存在 RED:列明阻断项与解除条件)。
5. 生成整改清单:逐项写问题、依据 citationTag、整改建议、责任专项板块、建议时限;有明确法定/监管期限的事项,登记 `compliance-deadline`。
6. 每处法律点标注 citationTag;`[模型知识-待核]` 配套写入 `sources.jsonl` 的 `source-record`(status: source-needs-check)。bundle check 强制二者同时出现。
7. 对跨域综合性结论生成 `diligence-finding` 汇总记录,创建 review queue 条目,status 为 `pending-review`。

## Output

- 顶部固定复核者提示块(已用来源 / 实际审阅范围 / 留待人工判断 / 时效状态 / 依赖前须办事项)。
- 上线标的与功能/变更清单。
- 专项覆盖度矩阵(风险域、是否已审、来源记录 id、专项定级)。
- 综合定级与放行视图(放行 / 有条件放行 / 不放行)。
- 整改清单(问题、依据、建议、责任去向、时限、`compliance-deadline` 索引)。
- `diligence-finding` 汇总条目索引。
- 来源表与律师复核要点。

## Next Steps

按汇总结果转交:

- 覆盖度缺口的风险域:转交对应专项板块补审(数据 `/cn-data-compliance`、AI `/cn-ai-governance`、宣传 `/cn-product:marketing-claims-review`、知识产权 `/cn-ip`、资质 `/cn-regulatory`)。
- 单一功能需细化风险识别:转交 `/cn-product:feature-risk-assessment`。
- 临上线出现的零散拿不准做法:转交 `/cn-product:is-this-a-problem`。
- 整改后复核:回到本技能重新汇总,更新放行视图。
