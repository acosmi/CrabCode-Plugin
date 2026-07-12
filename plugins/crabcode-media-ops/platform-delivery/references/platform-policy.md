# 平台规则与时效

规则由 `mediaops.platform.rules.get` 提供，包含 `sourceUrl / verifiedAt / scope / ruleType / maxAgeDays`。

- `hard-limit`：法规或稳定硬约束；
- `platform-dynamic`：平台后台当前约束，发布当天复查；
- `editorial-guidance`：保守运营建议，超出时提示，不冒充官方硬限制。

微信原创声明是平台比对功能，不是通用原创率分数。小红书和头条的编辑数字在没有稳定官方公开文档时按建议处理。任何 stale 规则都阻断“符合最新规则”的结论。
