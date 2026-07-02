---
description: 抓取平台热点并生成选题候选 — 派 trend-researcher 联网取材溯源，trends.search/cluster 取确定性数据
argument-hint: [关键词/赛道] [--platform wechat|xiaohongshu|toutiao] [--window 24h|7d] [--brand 品牌id]
allowed-tools: [Read, Glob, Grep, Bash, Task]
---

# /media-trends — 热点发现与选题候选

用户输入：$ARGUMENTS

本命令产出一份**可执行选题候选清单**。MCP 工具只做确定性的抓取与聚类；**联网取材与事实溯源派给 trend-researcher 子代理**；最终选题取舍由你（主 agent）与用户确认。

## 工作流

### 1. 环境与能力自检
- 先调 `mediaops.capabilities` 确认本机可用能力（哪些平台、已注册哪些热点源、是否处于 Gate A）。
- 调 `mediaops.doctor` 检查依赖与配置；若有缺项，向用户说明但不阻塞 Gate A 的选题流程。
- 调 `mediaops.policy_status` 了解当前限流/合规边界，作为后续选题与发布的硬约束。
- 若用户给了 `--brand`（或会话中已知品牌），调 `mediaops.profile.get` 取品牌 profile，作为赛道/平台缺省与调性约束；没有 profile 时提示可用 `/media-style-collect` 建立。

### 2. 派发热点研究（Task → trend-researcher）
- 解析 $ARGUMENTS 得到赛道关键词、目标平台、时间窗（缺省 `7d`）。
- 用 **Task 工具派发 `trend-researcher` 子代理**，交代：赛道关键词、平台、时间窗、品牌 profile 要点（人设/栏目/回避领域）。
- 子代理内部：调 `mediaops.trends.search`（已注册源，含 `sources.config.json` 配置的自定义源）+ `mediaops.trends.cluster` 取确定性数据；**中文平台热榜等无官方 API 的信号，由它用 WebSearch/WebFetch 联网发现与交叉验证**，不指望 MCP 内置爬虫。
- 要求子代理返回：热点簇 → 选题候选（2-3 个角度）→ **每条候选附可信来源清单**（链接/出处/可信度标注/需二次核查项）→ 时效窗口。

### 3. 汇总与取舍（主 agent）
- 核对子代理产出的候选与品牌 profile 的契合度（栏目匹配、回避领域、调性）。
- 用 `output-styles/media-report.md` 的运营报表风格呈现选题候选表（簇 → 候选标题 → 角度 → 平台 → 来源 → 时效）。
- 询问用户挑选哪几条进入下一步。

### 4. 来源落痕
- 被选中的选题连同其来源清单交给 `/media-draft`；写 brief 落库时来源必须写入 `mediaops.content.save` 的 `payload.citations[]`（url、出处、可信度、是否待核查），保证后续核查可追溯。

## 注意
- 热点数据有时效与噪声，**不要把 trends 返回的标题直接当成稿子标题**，必须经提炼。
- 涉及敏感、争议、医疗、金融等领域的热点，标注合规风险，留待 `/media-review` 核查。
- 自定义确定性热点源（官方/自建 JSON feed）在 `${CRABCODE_PLUGIN_DATA}/sources.config.json` 注册；无官方 API 的平台热榜不写进 MCP,一律走子代理联网取材。
