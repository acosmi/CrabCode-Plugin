---
description: 抓取平台热点并生成选题候选 — 调 trends.search/cluster 取确定性数据，主 agent 提炼角度与卖点
argument-hint: [关键词/赛道] [--platform wechat|xiaohongshu|toutiao] [--window 24h|7d]
allowed-tools: [Read, Glob, Grep, Bash]
---

# /media-trends — 热点发现与选题候选

用户输入：$ARGUMENTS

本命令产出一份**可执行选题候选清单**。MCP 工具只做确定性的抓取与聚类，**选题角度、差异化卖点、与品牌的契合度判断由你（主 agent）完成**。

## 工作流

### 1. 环境与能力自检
- 先调 `mediaops.capabilities` 确认本机可用能力（哪些平台、是否处于 Gate A）。
- 调 `mediaops.doctor` 检查依赖与配置；若有缺项，向用户说明但不阻塞 Gate A 的选题流程。
- 调 `mediaops.policy_status` 了解当前限流/合规边界，作为后续选题与发布的硬约束。

### 2. 拉取热点信号（确定性）
- 解析 $ARGUMENTS 得到赛道关键词、目标平台、时间窗。缺省时间窗用 `7d`，缺省平台问用户或取品牌 profile 常用平台。
- 调 `mediaops.trends.search`，传入关键词与平台、时间窗，拿回原始热点条目（标题、热度、来源、时间）。
- 调 `mediaops.trends.cluster` 对结果做主题聚类，得到若干热点簇及其代表条目。

### 3. 主 agent 提炼选题（创作环节）
对每个热点簇，由你产出：
- **选题标题候选**（2-3 个角度，区分信息型/观点型/实用型）。
- **差异化角度**：为什么这条值得做、与同质内容的区别。
- **目标受众与平台匹配**：哪个平台、对应栏目（参考品牌 profile）。
- **可信来源**：列出 trends.search 返回的来源链接，标注哪些需在写稿阶段二次核查。
- **时效窗口**：建议发布时限（热点会过期）。

### 4. 输出
- 用 `output-styles/media-report.md` 的运营报表风格呈现选题候选表（簇 → 候选标题 → 角度 → 平台 → 来源 → 时效）。
- 询问用户挑选哪几条进入下一步；被选中的选题可直接交给 `/media-draft` 写主稿。

## 注意
- 热点数据有时效与噪声，**不要把 trends 返回的标题直接当成稿子标题**，必须经你提炼。
- 涉及敏感、争议、医疗、金融等领域的热点，标注合规风险，留待 `/media-review` 核查。
