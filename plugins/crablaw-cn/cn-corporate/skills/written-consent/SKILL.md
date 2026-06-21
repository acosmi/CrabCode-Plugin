---
name: written-consent
description: 起草或审查中国不开会的股东会/董事会书面决议,作为律师复核底稿。当用户提到书面决议/不召开会议/书面表决/股东或董事书面同意,需要在不开会情形下形成有效决议文件时使用本技能(即使未明说"书面决议")。
argument-hint: "[拟决议事项、书面决议草稿文件路径或粘贴文本]"
---

# /cn-corporate:written-consent

【AI 辅助草稿，需律师复核】

起草或审查不召开会议而以全体一致同意作出的股东会/董事会书面决议，作为律师复核工作底稿。不得将本产出标注为可签署、可对外发送或最终结论。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate). Before reading the document body, additionally confirm: 公司主体与现行章程已识别，拟以书面形式作出决议的机关（股东会或董事会）已明确，且输出目的地为内部 review queue。Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 确认书面决议的法律前提：核对公司章程是否允许该机关以不召开会议、由全体股东/董事一致表示同意的方式作出决议；章程未授权或法律要求必须开会的事项不得以书面决议替代。
2. 逐项判断决议事项是否属于该机关的法定/章程职权（股东会职权如修改章程、增减注册资本、合并分立解散、利润分配方案、选举更换非由职工代表担任的董事监事等；董事会职权见 `/cn-corporate:board-minutes`）。
3. 核查签署主体与表决权：股东会书面决议须全体股东签署（自然人股东本人或授权代表、法人股东加盖印章并由签署代表签字）；按出资比例/章程确认表决权，并标注关联股东回避要求（如涉关联交易）。
4. 校验决议内容完整性：事项、表决结果（全体一致同意）、生效条件、决议日期、附件（如修改后章程、出资协议）。
5. 提示后续登记/备案衔接：涉及修改章程、增减资本、董监高变更等需办理工商变更登记的，列明触发事项。
6. 每处引用法律或事实时标注 citationTag；`[模型知识-待核]` 法律点配套写入 `sources.jsonl` 的 `source-record`（status: source-needs-check）。
7. 创建 review queue 条目，status 为 `pending-review`。

## Output

- 顶部固定复核者提示块。
- 书面决议适用前提核查结论（章程授权 + 事项职权归属）。
- 签署主体与表决权核查表（GREEN / YELLOW / RED）。
- 书面决议草稿正文与签署页。
- 触发登记/备案事项清单。
- 缺失事实清单、来源表与律师复核要点。

## Next Steps

- 若事项更宜召开会议或需会议记录：转交 `/cn-corporate:board-minutes`（董事会）或提示安排股东会。
- 若决议触发工商变更登记或存续合规：转交 `/cn-corporate:entity-compliance`。
- 若决议支撑交易交割：转交 `/cn-corporate:closing-checklist`。
