---
description: 检索、中文聚类并形成带来源与时效判断的选题候选
argument-hint: "[关键词/赛道] [--window 24h|7d] [--brand brandId]"
allowed-tools: [Read, Glob, Grep, Bash, WebSearch, WebFetch, Task]
---

# /media-trends

按 `media-topic-research` 执行。先检查 capabilities/doctor，再用 `mediaops.trends.search` 与 `mediaops.trends.cluster` 发现线索；聚类结果不是可信来源。必须 WebSearch/WebFetch 打开页面并提交 `mediaops.research.complete`。零结果、全部失败、页面未打开或摘录无法在快照定位时返回 action_required，不能伪装成研究完成。

每个候选输出事实来源、发布日期、访问日期、新信息、独立判断、最强反方、证据缺口和旧闻风险。选中的 brief 用结构化 citations 保存，不把热点标题直接当成文章标题。
