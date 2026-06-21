# CrabWork 产品管理

面向产品经理的 CrabCode 插件,覆盖完整的产品管理工作流:撰写功能规格、规划路线图、与干系人沟通、综合用户研究、分析竞品、跟踪产品指标。可独立使用(直接粘贴内容、描述问题、上传文件),连接项目管理与协作工具后能力更强。

> 基于 [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins)(Apache-2.0)二次开发,已去品牌化并适配 CrabCode 生态。

## 安装

在 CrabCode 插件市场中搜索「CrabWork 产品管理」并安装,或通过 marketplace 添加 `crabwork-product-management`。

## 功能概览

这个插件为你提供一位 AI 产品管理搭档,可协助完成:

- **功能规格与 PRD** — 从一个问题陈述或功能想法生成结构化的产品需求文档,包含用户故事、需求优先级、成功指标与范围管理。
- **路线图规划** — 创建、更新并重排产品路线图,支持 Now/Next/Later、季度主题、与 OKR 对齐的格式及依赖关系梳理。
- **干系人汇报** — 按受众(高管、研发、客户)生成状态汇报,从已连接工具拉取上下文,省去每周写汇报的负担。
- **用户研究综合** — 将访谈记录、问卷数据、支持工单转化为结构化洞察,识别主题、构建用户画像,并以证据支撑机会点。
- **竞品分析** — 调研竞争对手,生成含功能对比、定位分析与战略启示的简报。
- **指标评审** — 分析产品指标,识别趋势,对比目标,提炼可执行的洞察。
- **产品头脑风暴** — 探索问题空间、生成想法、用一位犀利的陪练伙伴压力测试产品思路。支持发散性构思、假设检验与战略探索,运用 How Might We、Jobs-to-be-Done、第一性原理、机会解决方案树等框架。

## 命令

| 命令 | 说明 |
|---|---|
| `/write-spec` | 从问题陈述撰写功能规格或 PRD |
| `/roadmap-update` | 更新、创建或重排你的路线图 |
| `/stakeholder-update` | 生成干系人汇报(周报、月报、发布) |
| `/synthesize-research` | 从访谈、问卷与工单综合用户研究 |
| `/competitive-brief` | 创建竞品分析简报 |
| `/metrics-review` | 评审与分析产品指标 |
| `/brainstorm` | 与思考伙伴一起头脑风暴产品想法、问题空间或战略议题 |

## 技能(按需自动触发)

CrabCode 会根据你的输入自动匹配以下技能:

| 技能 | 说明 |
|---|---|
| `competitive-brief` | 竞品分析简报:功能对比矩阵、定位分析、输赢分析 |
| `metrics-review` | 产品指标评审:趋势分析、对标目标、生成记分卡与行动建议 |
| `product-brainstorming` | 头脑风暴(问题探索、方案构思、假设检验、战略),PM 框架、会话结构、思考伙伴行为 |
| `roadmap-update` | 路线图管理:优先级框架(RICE、MoSCoW)、路线图格式、依赖梳理 |
| `sprint-planning` | 迭代规划:拆解工作、评估容量、设定目标、起草迭代计划 |
| `stakeholder-update` | 干系人沟通:按受众的汇报模板、风险沟通、决策记录 |
| `synthesize-research` | 用户研究综合:主题分析、亲和图、用户画像、机会量化 |
| `write-spec` | 功能规格:PRD 结构、用户故事、需求归类、验收标准 |

## 示例工作流

### 撰写 PRD

```
你: /write-spec
CrabCode: 你要为哪个功能或问题撰写规格?
你: 我们需要为企业客户增加 SSO 支持
CrabCode: [询问目标用户、约束条件、成功指标]
CrabCode: [生成完整 PRD,含问题陈述、用户故事、需求、成功指标、待解决问题]
```

### 准备干系人汇报

```
你: /stakeholder-update
CrabCode: 哪种类型的汇报?(周报、月报、发布、临时)
你: 给高管团队的周报
CrabCode: [从项目管理工具、聊天与文档拉取上下文]
CrabCode: [生成执行摘要,含进展、决策、风险与下一里程碑]
```

### 综合用户研究

```
你: /synthesize-research
CrabCode: 你想综合哪些研究?可以粘贴访谈记录、上传文件,或由我从已连接来源拉取。
你: [粘贴 8 份访谈记录]
CrabCode: [跨访谈识别主题、模式与洞察]
CrabCode: [生成综合结论,含关键发现、用户画像、机会点与证据]
```

### 头脑风暴产品想法

```
你: /brainstorm 我们要不要给产品加 AI 搜索?
CrabCode: 在跳到 AI 搜索之前 —— 用户今天在搜索上遇到的真正问题是什么?
你: 他们找不到东西。「找不到 X」的支持工单是我们的第二大类。
CrabCode: 这是一个发现性问题,不一定是搜索技术问题。让我继续往下推……
CrabCode: [探讨问题究竟在于搜索质量、信息架构,还是内容可发现性]
CrabCode: [生成 5 种不同方案,从优化分类法到 AI 搜索再到引导式导航]
CrabCode: [挑战假设,建议用成本最低的实验先验证风险最高的那个]
```

### 竞品分析

```
你: /competitive-brief
CrabCode: 你想分析哪个(些)竞争对手或哪块功能?
你: 把我们的上手流程和[竞品 A]、[竞品 B]做对比
CrabCode: [调研竞品的上手流程做法]
CrabCode: [生成简报,含功能对比、优劣势与战略启示]
```

## 数据源

> 如遇占位符或需确认已连接的工具,请参阅 [CONNECTORS.md](CONNECTORS.md)。

连接你的项目管理与协作工具体验最佳;未连接时,手动提供上下文即可。

**内置 MCP 连接:**
- 聊天(Slack):团队上下文与干系人讨论
- 项目管理(Linear、Asana、monday.com、ClickUp、Atlassian):路线图集成、工单上下文与状态跟踪
- 知识库(Notion):既有规格、研究与会议记录
- 设计(Figma):设计上下文与交付
- 产品分析(Amplitude、Pendo):使用数据、指标与行为分析
- 用户反馈(Intercom):支持工单、功能请求与用户对话
- 会议转录(Fireflies):会议记录与讨论上下文

**其它可选:**
- 各类别的可替代工具详见 [CONNECTORS.md](CONNECTORS.md)

## 个性化设置

在 `crabwork-product-management/.crabcode/settings.local.json` 创建本地设置文件:

```json
{
  "name": "你的名字",
  "title": "产品经理",
  "team": "你的团队",
  "company": "你的公司",
  "product": "你的产品名",
  "roadmapFormat": "Now/Next/Later"
}
```

未配置时,插件会在需要时主动询问相关信息。
