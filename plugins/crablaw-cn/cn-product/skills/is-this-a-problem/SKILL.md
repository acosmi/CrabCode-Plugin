---
name: 产品合规快速研判
short-description: 对某一具体产品/运营做法做快速中国法合规研判,给初步定级与是否升级到专项板块的建议
description: 对某一具体产品/运营做法做快速中国法合规研判,给初步定级与是否升级到专项板块的建议。当用户提到这个做法有没有问题/这样做合不合规/能不能这么搞、想快速判断某个运营动作或产品细节风险、要不要找专人深入看时使用本技能(即使未明说"合规研判")。
argument-hint: "[一句话描述拟做的做法或拿不准的细节]"
---

# /cn-product:is-this-a-problem

【AI 辅助草稿，需律师复核】

对单个做法做快速中国法合规研判,给出初步风险定级,以及"是否需要升级到专项板块深入审查"的建议。这是轻量分诊技能,不是完整合规结论;不得将本产出标注为放行、可上线或最终结论。重大或不确定事项一律建议升级,不在本技能内给定论。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate: active matter, authorized scope, conflict-check status `no-hit` or `cleared-by-lawyer`, internal-only output destination, review queue item created, source records writable). 注意 matter-core "Who Is Using This":非律师用户即使做法看似简单,凡触及高风险也只给初步研判+须律师决定清单,不给可行动定论。Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 用一两句话复述待研判的做法,补齐关键事实:涉及谁(用户/竞品/平台)、做什么、是否收费、是否对外宣传、是否动用数据。事实不足时先列待补问题,不臆测。
2. 快速比对中国法横向风险点,逐项给"无关 / 可能相关 / 明显相关":
   - 《广告法》:是否构成宣传、是否含绝对化用语、是否虚假或引人误解。
   - 《反不正当竞争法》:刷单炒信、虚假交易、混淆、商业诋毁、流量劫持、不当有奖销售。
   - 《消费者权益保护法》《电子商务法》:自动续费、默认勾选、格式条款、价格欺诈、知情权与选择权、平台义务、退换货。
   - 数据与个人信息:是否处理个人信息/敏感信息、是否超范围采集、是否需单独同意或跨境。
   - 资质许可:该做法是否需特定行政许可/备案。
   - 算法与 AI:是否涉推荐算法、自动化决策、生成式内容。
   - 知识产权:是否使用他人商标、作品、商业素材。
3. 给初步定级 GREEN / YELLOW / RED,并写明定级理由与不确定点。RED/YELLOW 不得静默下调(Shared Guardrail 4)。
4. 判定是否升级:任一领域为"明显相关"或定级 RED,即建议升级到对应专项板块;说明升级理由与待专项确认的问题。
5. 每处法律点标注 citationTag;`[模型知识-待核]` 配套写入 `sources.jsonl` 的 `source-record`(status: source-needs-check)。bundle check 强制二者同时出现。
6. 创建 review queue 条目,status 为 `pending-review`。

## Output

- 顶部固定复核者提示块。
- 做法复述与已补事实。
- 横向风险点速判表(领域、相关性、一句话理由、citationTag)。
- 初步定级 GREEN / YELLOW / RED 与理由。
- 是否升级的结论与升级去向。
- 待补事实/待律师判断清单。

## Next Steps

按研判结果决定:

- 需系统识别该功能全部风险:转交 `/cn-product:feature-risk-assessment`。
- 宣传用语问题:转交 `/cn-product:marketing-claims-review`。
- 数据/个人信息问题:转交 `/cn-data-compliance:data-activity-triage`。
- 算法/自动化决策/AI 生成内容问题:转交 `/cn-ai-governance`(对应 AI 用例评估技能)。
- 知识产权问题:转交 `/cn-ip`(对应侵权/权属审查技能)。
- 做法属上线前整体审查的一部分:并入 `/cn-product:launch-review`。
