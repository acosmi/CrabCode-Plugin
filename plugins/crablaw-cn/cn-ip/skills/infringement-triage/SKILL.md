---
name: infringement-triage
description: 对知识产权侵权线索做分流草稿,分别处置"我方权利被侵"与"我方被指侵权"两种情形,标注红线。当用户提到发现被侵权/有人抄袭/盗用商标专利著作权、收到侵权指控/律师函/侵权投诉,或问"这算不算侵权/该怎么办"时使用本技能(即使未明说"分流")。
argument-hint: "[线索方向:我方被侵 或 我方被指侵;涉案权利、对方主体、已知事实]"
---

# /cn-ip:infringement-triage

【AI 辅助草稿，需律师复核】

Triage an IP infringement lead under PRC law, routing 我方权利被侵 vs 我方被指侵权 into separate handling. 本草稿为内部初步分流,不得标注为可签署、可对外发送或最终结论;不对争议事实下确定性侵权/不侵权定论。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate). Before triage, additionally confirm: (a) the lead direction (被侵 / 被指侵) is identified; (b) the relevant right or accused activity is described; (c) output destination is the review queue. Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 判定方向并分支处理:
   - 我方权利被侵:核对我方权利基础(`ip-asset`:类型、注册号、状态、有效期),固定侵权事实与证据(是否需公证/时间戳保全),评估法律定性与赔偿可能。
   - 我方被指侵权:固定对方主张(权利基础、被诉行为、证据),评估抗辩空间(不落入保护范围、现有技术/在先权利抗辩、合法来源、权利稳定性、超诉讼时效等),并评估对方权利稳定性。
2. 法律定性(中国法,按权利类型):《商标法》第五十七条 / 《专利法》权利要求保护范围 / 《著作权法》专有权利 / 《反不正当竞争法》第九条商业秘密。
3. 紧急度与时效:证据灭失风险、诉前保全必要性、诉讼时效、平台投诉时限。
4. 处置路径分流:取证保全、发警告函、平台通知删除、协商/许可、行政投诉、提起诉讼/仲裁、提无效;不替用户作发函或起诉决定。
5. 将关键发现登记为 `diligence-finding`(category=risk/conflict-signal);每条法律依据配 `source-record`,无核验来源标 `[模型知识-待核]` 且配 status: source-needs-check。
6. 创建 review queue 项,status `pending-review`。

## Output

- Reviewer note 顶部固定块。
- 方向判定与事实摘要。
- 法律定性与抗辩/主张要点表(citationTag)。
- 风险与紧急度分级(GREEN/YELLOW/RED,含时效/保全提示)。
- 处置路径分流(决策树:取证/发函/投诉/协商/诉讼/提无效/补充事实)。
- 缺失事实清单。
- 来源表。

## Next Steps

- 拟发警告函:转 `/cn-ip:cease-desist`。
- 走平台投诉/通知删除:转 `/cn-ip:takedown`。
- 我方被指专利侵权需比对权利要求:转 `/cn-ip:fto-triage`。
- 涉合同项下侵权担保/权属争议:转 `/cn-ip:ip-clause-review`。
- 进入诉讼/仲裁:升级至诉讼板块由律师评估。
