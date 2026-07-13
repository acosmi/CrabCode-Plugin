---
name: 并购后整合管理
short-description: 规划与跟踪中国法下的并购后整合法律事项,作为律师复核底稿(主体合并注销/合同移转/资质承继)
description: 规划与跟踪中国法下的并购后整合法律事项,作为律师复核底稿(主体合并注销/合同移转/资质承继)。当用户提到投后整合/并购后整合/主体合并或注销/合同移转/资质承继时使用本技能(即使未明说"整合")。
argument-hint: "[交易结构、整合范围或交割后资料路径]"
---

# /cn-corporate:integration-management

【AI 辅助草稿，需律师复核】

梳理并购后整合的法律事项，作为律师复核工作底稿。不得将本产出标注为可签署、可对外发送或最终结论。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate). Before producing output, additionally confirm: 交易已交割或拟整合范围已识别，相关主体已明确，输出目的地为内部 review queue。Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 确定整合结构：主体存续（控股）、吸收合并、新设合并或目标主体注销，及对应法律路径。
2. 主体合并/注销事项：合并协议、债权人通知与公告、异议债权人清偿或担保、合并/注销登记、清算（如注销）。
3. 合同移转：识别需移转或重新签署的合同，逐项核对变更控制/限制转让/同意条款，确定移转方式（概括承受、债权债务转让、重新签约）与第三方同意需求。
4. 员工安置：劳动关系承继或变更、经济补偿、社保公积金衔接、规章制度统一（涉及劳动专项时转交劳动板块）。
5. 资质承继：经营许可、行业资质、知识产权、特许经营权能否随主体或资产承继，识别需重新申请/变更的资质。
6. 为整合各节点创建 `compliance-deadline` 条目（合并登记、注销登记、资质变更/续展 license-renewal、合同移转 contract-renewal、监管申报 regulatory-filing 等）。
7. 每处引用标注 citationTag；`[模型知识-待核]` 法律点配套写入 `sources.jsonl` 的 `source-record`（status: source-needs-check）。
8. 创建 review queue 条目，status 为 `pending-review`。

## Output

- 顶部固定复核者提示块。
- 整合事项清单（主体 / 合同 / 员工 / 资质，含 GREEN / YELLOW / RED 与责任方）。
- 债权人通知公告与登记节点。
- `compliance-deadline` 期限台账摘要。
- 来源表与律师复核要点。

## Next Steps

- 合同移转条款审查：转交 `/cn-contract:review`；批量处理转交 `/cn-corporate:tabular-review`。
- 整合所需内部决议：转交 `/cn-corporate:board-minutes` 或 `/cn-corporate:written-consent`。
- 整合后存续合规：转交 `/cn-corporate:entity-compliance`。
- 员工安置劳动专项：转交劳动板块（如 `/cn-labor-employment:employment-contract-review`）。
