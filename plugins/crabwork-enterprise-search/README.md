# CrabWork 企业搜索

> **MCP 安全暂停（2026-08-22）**：本版本不发布可执行 MCP 配置；安装不会启动该服务或发起网络请求。如果曾安装旧版，请先升级插件并重启 CrabCode；仅重载插件不能证明旧 MCP 客户端或进程已退出。下文任何 Connect、`.mcp.json`、端点、launcher 或启动描述均仅是历史配置/未来恢复审查参考，不代表本版本会生成配置、连接、启动或提供相应工具。

面向知识工作者的检索与综合方法插件。当前只能处理用户直接粘贴或上传的材料；跨邮件、聊天、文档和知识库检索是未来连接恢复后的目标能力。

> 基于上游开源知识工作插件(Apache-2.0)二次开发,已去品牌化并适配 CrabCode 生态;上游出处与许可信息见 [docs/legal/THIRD_PARTY_NOTICES.md](docs/legal/THIRD_PARTY_NOTICES.md)。

## 安装

在 CrabCode 插件市场中搜索「CrabWork 企业搜索」并安装,或通过 marketplace 添加 `crabwork-enterprise-search`。

---

## 工作原理

下文描述历史/未来的多来源工作流。当前没有已连接来源，不能执行跨源检索；仍可对用户直接提供的材料做拆解、去重与综合。

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

以上是历史/未来多来源愿景，当前不可执行。当前请直接提供要检索的材料。

---

## 检索范围

> 占位符仅是未来来源类别；当前连接数为 0，见 [CONNECTORS.md](CONNECTORS.md)。

以下来源仅为未来恢复目录，当前不可从本插件连接：

| 来源 | 可检索内容 |
|--------|---------------|
| **~~chat** | 消息、讨论串、频道、私信 |
| **~~email** | 邮件、附件、往来会话 |
| **~~cloud storage** | 文档、表格、幻灯片、PDF |
| 知识库 / Wiki | 内部文档、运维手册 |
| 项目管理 | 任务、工单、史诗、里程碑 |
| CRM | 客户、联系人、商机 |
| 工单系统 | 支持工单、客户问题 |

历史设计中每个来源对应一个 MCP 连接；当前不得在 MCP 设置中按本文添加来源。

---

## 命令

| 命令 | 作用 |
|---------|--------------|
| `/search` | 检索用户直接提供的材料；跨已连接来源当前不可用 |
| `/digest` | 汇总用户直接提供的材料；跨源活动摘要当前不可用 |

### 搜索

```
/crabwork-enterprise-search:search Project Aurora 现在进展如何?
/crabwork-enterprise-search:search from:sarah about:budget after:2025-01-01
/crabwork-enterprise-search:search 本周 #product 频道里做出的决策
```

过滤器当前只用于用户直接提供材料中的筛选，不映射外部来源原生语法。

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
| `search` | 检索用户直接提供的材料；外部来源 blocked |
| `digest` | 汇总用户直接提供的材料；外部活动摘要 blocked |
| `search-strategy` | 对用户材料做查询拆解；不调用外部来源 |
| `knowledge-synthesis` | 把多来源结果综合成连贯、去重、带来源标注的答案,并按时效与权威性评估置信度 |
| `source-management` | 仅整理 blocked 来源提案；不得引导连接或声称可用 |

---

## 历史多来源示例（当前不可执行）

以下仅展示未来目标体验，不是当前工具调用或连接声明。

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

# 2. 检索用户直接提供的材料
/crabwork-enterprise-search:search [你的问题]

# 3. 获取摘要
/crabwork-enterprise-search:digest --daily
```

当前不应连接任何 MCP 来源。未来只有在安全门、发布门和宿主 E2E 通过后，才可另行评估来源恢复顺序。

---

## 理念

知识工作者每周要花数小时在散落于各处的工具中翻找信息。答案确实存在于某个地方——一条聊天讨论串、一封邮件、一份文档、一个 Wiki 页面——但找到它意味着逐个工具检索、交叉比对结果,还得指望自己查对了地方。

未来愿景是把经审查的来源视作统一知识库；当前只综合用户直接提供的材料。
