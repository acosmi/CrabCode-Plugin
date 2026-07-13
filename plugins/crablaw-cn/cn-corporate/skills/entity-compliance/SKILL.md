---
name: 公司存续合规
short-description: 审查中国公司存续期合规并建立带期限的合规台账(章程/工商变更登记/年报/出资/印章)
description: 审查中国公司存续期合规并建立带期限的合规台账(章程/工商变更登记/年报/出资/印章)。当用户提到公司合规/工商变更/年报/出资到位/章程/印章管理、需要排查存续期合规义务与期限时使用本技能(即使未明说"合规台账")。
argument-hint: "[公司主体信息、章程或合规资料路径]"
---

# /cn-corporate:entity-compliance

【AI 辅助草稿，需律师复核】

审查公司存续期合规事项，产出合规台账与期限，作为律师复核工作底稿。不得将本产出标注为可签署、可对外发送或最终结论。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate). Before reading the document body, additionally confirm: 公司主体与现行章程已识别，输出目的地为内部 review queue。Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 核对主体基础合规：营业执照载明事项与实际经营/章程一致性、住所、经营范围、注册资本及出资进度。
2. 章程合规：现行章程是否与公司法及历次决议一致，是否存在应修改未修改事项。
3. 工商变更登记：识别已发生但未办理变更登记/备案的事项（名称、住所、法定代表人、注册资本、股东、董监高、经营范围等）。
4. 年度报告：核对企业年度报告公示义务的履行情况与时点。
5. 股东出资到位：核对认缴与实缴、出资方式、出资证明，识别出资瑕疵与抽逃风险。
6. 印章与证照管理：核对公章、合同章、法定代表人章、证照的保管与用章授权制度。
7. 为各项合规义务创建 `compliance-deadline` 条目：年度报告（obligationType: regulatory-filing）、需续展的行政许可（license-renewal）、章程/登记变更（regulatory-filing）等，标明触发日与期限。
8. 每处引用标注 citationTag；`[模型知识-待核]` 法律点配套写入 `sources.jsonl` 的 `source-record`（status: source-needs-check）。
9. 创建 review queue 条目，status 为 `pending-review`。

## Output

- 顶部固定复核者提示块。
- 合规台账表（事项、现状、缺口、GREEN / YELLOW / RED、整改建议）。
- `compliance-deadline` 期限台账摘要。
- 出资到位与印章管理专项结论。
- 来源表与律师复核要点。

## Next Steps

- 需作出决议办理变更的：转交 `/cn-corporate:board-minutes` 或 `/cn-corporate:written-consent`。
- 涉及许可续展或行政申报的具体合规期限管理可在本 skill 内迭代。
- 并购重组后的存续合规衔接：转交 `/cn-corporate:integration-management`。
