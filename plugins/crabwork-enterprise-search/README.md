# CrabWork 企业搜索

面向知识工作者的 CrabCode 插件:一次提问,跨邮件、聊天、文档、知识库等所有已连接工具同时检索,自动归并去重并附带来源标注地综合成一个答案——不必在多个应用之间来回切换。

> 基于上游开源知识工作插件(Apache-2.0)二次开发,已去品牌化并适配 CrabCode 生态;上游出处与许可信息见 [docs/legal/THIRD_PARTY_NOTICES.md](docs/legal/THIRD_PARTY_NOTICES.md)。

## 安装

在 CrabCode 插件市场中搜索「CrabWork 企业搜索」并安装,或通过 marketplace 添加 `crabwork-enterprise-search`。

---

## 工作原理

一次查询同时检索所有已连接的工具。CrabCode 会拆解你的问题,在每个来源上分别执行有针对性的检索,再把结果综合成一个连贯、带来源标注的答案。

```
你:「关于 API 重构我们最后定的是什么?」
              ↓ CrabCode 检索
~~chat:周二 #engineering 频道里包含决策的讨论串
~~email:Sarah 后续发来的含规格说明的邮件
~~cloud storage:更新过的 API 设计文档(昨天修改)
              ↓ CrabCode 综合
「团队周二决定采用 REST 而非 GraphQL。
 Sarah 周四发来了更新后的规格说明。设计文档
 已据此反映最终方案。」
```

无需切换标签页,也不必记住哪份资料在哪个工具里。提出问题,直接得到答案。

---

## 检索范围

> 如遇占位符或需确认已连接的工具,请参阅 [CONNECTORS.md](CONNECTORS.md)。

可连接任意组合的来源。连接得越多,答案越完整。

| 来源 | 可检索内容 |
|--------|---------------|
| **~~chat** | 消息、讨论串、频道、私信 |
| **~~email** | 邮件、附件、往来会话 |
| **~~cloud storage** | 文档、表格、幻灯片、PDF |
| 知识库 / Wiki | 内部文档、运维手册 |
| 项目管理 | 任务、工单、史诗、里程碑 |
| CRM | 客户、联系人、商机 |
| 工单系统 | 支持工单、客户问题 |

每个来源都是一个 MCP 连接。在 MCP 设置中添加更多来源,即可扩展 CrabCode 的检索范围。

---

## 命令

| 命令 | 作用 |
|---------|--------------|
| `/search` | 在一次查询中跨所有已连接来源检索 |
| `/digest` | 跨所有来源生成每日或每周的活动摘要 |

### 搜索

```
/crabwork-enterprise-search:search Project Aurora 现在进展如何?
/crabwork-enterprise-search:search from:sarah about:budget after:2025-01-01
/crabwork-enterprise-search:search 本周 #product 频道里做出的决策
```

支持过滤器:`from:`、`in:`、`after:`、`before:`、`type:`——会智能地映射到各来源的原生查询语法。

### 摘要

```
/crabwork-enterprise-search:digest --daily      # 今天各来源发生了什么
/crabwork-enterprise-search:digest --weekly     # 按项目/主题归类的每周汇总
```

突出显示行动项、决策与对你的提及,并按主题归类,方便你快速浏览要点。

---

## 技能(按需自动触发)

支撑搜索体验的核心技能:

| 技能 | 说明 |
|---|---|
| `search` | 跨所有已连接来源的一站式检索 |
| `digest` | 生成每日/每周活动摘要,突出行动项与决策 |
| `search-strategy` | 查询拆解与多来源检索编排:将自然语言问题拆成各来源专属的检索,翻译为原生语法,并处理歧义与回退 |
| `knowledge-synthesis` | 把多来源结果综合成连贯、去重、带来源标注的答案,并按时效与权威性评估置信度 |
| `source-management` | 识别可用 MCP 来源,引导连接新来源,管理来源优先级与限流感知 |

---

## 示例工作流

### 查找某个决策

```
你:/crabwork-enterprise-search:search 我们什么时候决定切换到 Postgres 的?

CrabCode 检索:
  ~~chat → 在 #engineering、#infrastructure 搜「postgres」「切换」「决策」
  ~~email → 主题含「postgres」的邮件串
  ~~cloud storage → 提及数据库迁移的文档

结果:「决定于 3 月 3 日在 #infrastructure 做出(链接)。
       Sarah 3 月 4 日的邮件确认了时间线。
       迁移方案文档于 3 月 5 日更新。」
```

### 休假后快速跟进

```
你:/crabwork-enterprise-search:digest --weekly

CrabCode 扫描:
  ~~chat → 你所在频道、私信、提及
  ~~email → 收件箱动态
  ~~cloud storage → 与你共享或被修改的文档

结果:按项目归类的摘要,标记出行动项并突出决策。
```

### 找到合适的专家

```
你:/crabwork-enterprise-search:search 谁熟悉我们的 Kubernetes 配置?

CrabCode 检索:
  ~~chat → 关于 Kubernetes、k8s、集群的消息
  ~~cloud storage → 关于基础设施的文档作者
  Wiki → 运维手册与架构文档

结果:「根据消息记录与文档作者信息,
       Alex 和 Priya 是 k8s 的对口人选。
       这是主运维手册(链接)。」
```

---

## 快速上手

```text
# 1. 安装
在 CrabCode 插件市场搜索并安装「CrabWork 企业搜索」

# 2. 跨所有来源检索
/crabwork-enterprise-search:search [你的问题]

# 3. 获取摘要
/crabwork-enterprise-search:digest --daily
```

通过 MCP 连接的来源越多,检索结果越完整。建议先连接 ~~chat、~~email、~~cloud storage,再按需添加 Wiki、项目管理工具与 CRM。

---

## 理念

知识工作者每周要花数小时在散落于各处的工具中翻找信息。答案确实存在于某个地方——一条聊天讨论串、一封邮件、一份文档、一个 Wiki 页面——但找到它意味着逐个工具检索、交叉比对结果,还得指望自己查对了地方。

CrabWork 企业搜索把你所有的工具视作一个可统一检索的知识库。一次查询、所有来源、综合结果。公司的知识不该被锁在一个个孤岛里——一次把所有地方都搜遍。
