---
name: 知识产权资产管理
short-description: 盘点知识产权注册状态、续展期限与资产组合，形成管理台账
description: 管理知识产权资产组合草稿(注册号/状态/续展总览),用 ip-asset 与 compliance-deadline。当用户提到IP资产盘点/商标专利组合、注册号台账、续展/年费提醒、资产到期、权利状态总览或要建知识产权管理台账时使用本技能(即使未明说"组合管理")。
argument-hint: "[资产清单或来源(商标/专利/著作权/域名)、需总览或新增/更新的项]"
---

# /cn-ip:portfolio

【AI 辅助草稿，需律师复核】

Manage an IP portfolio overview under PRC law using `ip-asset` and `compliance-deadline`. 本草稿为内部管理台账与提醒草案,不得标注为可签署或最终结论;权利状态与期限须以官方记录与律师复核为准。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate). Before producing the overview, additionally confirm: (a) the asset source or list is available; (b) portfolio management fits the engagement scope; (c) output destination is the review queue and records are internal. Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 归集资产:逐项建立/更新 `ip-asset`(ipType、holder、registrationNumber、territory、niceClasses、status、expiryDate、licensing、citationTag)。用户提供的状态标 `[用户提供]`;未核验的标 `[模型知识-待核]` 配 `source-record`(status: source-needs-check)。
2. 状态总览:按权利类型与法律状态(申请中/已注册/驳回/届满/被无效/已转让/已许可)汇总,识别异常(状态不明、权利人不一致、欠缴年费迹象)。
3. 续展/年费等期限:这些任务唯一来源是 `compliance-deadline`(obligationType=license-renewal),不写入 `ip-asset`;为到期前需处理项建立 compliance-deadline 草案(dueDate、leadTimeDays、severity、recurrenceMonths),由 watcher 统一跟踪。
4. 重点关注(中国法):商标续展(有效期满前的续展窗口与宽展期)、专利年费、撤三/连续不使用风险、域名到期、马德里/巴黎途径指定国(如涉及)以 territory 标注,仍以中国法为本位说明。
5. 风险分级:即将到期、状态存疑、许可冲突等。
6. 创建 review queue 项,status `pending-review`。

## Output

- Reviewer note 顶部固定块。
- 资产总览表(`ip-asset` 字段化,含 citationTag)。
- 续展/年费等期限草案表(`compliance-deadline` 字段化)。
- 风险与异常清单(GREEN/YELLOW/RED)。
- 缺失信息与待官方核验项。
- 来源表。

## Next Steps

- 期限跟踪交由合规期限 watcher(读取 `compliance-deadline`,本技能不重复跟踪)。
- 新增发明/创意拟纳入组合:转 `/cn-ip:invention-intake`。
- 申请前清除:转 `/cn-ip:clearance`。
- 发现疑似侵权或权利被侵:转 `/cn-ip:infringement-triage`。
