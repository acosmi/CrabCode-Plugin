# CrabWork 效率助手

面向个人工作流的 CrabCode 插件:任务管理、工作记忆与可视化看板。CrabCode 会逐步记住你身边的人、项目和术语,像同事一样理解你的需求,而不只是一个聊天机器人。

> 基于 [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins)(Apache-2.0)二次开发,已去品牌化并适配 CrabCode 生态。

## 安装

在 CrabCode 插件市场中搜索「CrabWork 效率助手」并安装,或通过 marketplace 添加 `crabwork-productivity`。

## 能做什么

本插件让 CrabCode 对你的工作建立起持续的理解:

- **任务管理** —— 一个 Markdown 任务清单(`TASKS.md`),CrabCode 可读、可写、可据此执行。用自然语言添加任务,CrabCode 会跟踪状态、清理过期项,并与外部工具同步。
- **工作记忆** —— 两层记忆系统,让 CrabCode 掌握你的简称、人物、项目与术语。说一句「让 todd 给 oracle 出 PSR」,CrabCode 就能精确知道是谁、做什么、对应哪个交易。
- **可视化看板** —— 一个本地 HTML 文件,以看板形式展示任务,并实时呈现 CrabCode 对你工作环境的认知。无论在看板还是文件中编辑,两者始终保持同步。

## 命令

| 命令 | 作用 |
|---|---|
| `/start` | 初始化任务与记忆,并打开看板 |
| `/update` | 清理过期项、检查记忆缺口、(如可用)从外部工具同步 |
| `/update --comprehensive` | 深度扫描邮件、日历、聊天 —— 发现遗漏待办并建议新的记忆条目 |

## 技能(按需自动触发)

CrabCode 会根据你的输入自动匹配以下技能:

| 技能 | 说明 |
|---|---|
| `memory-management` | 两层记忆系统 —— `CRABCODE.md` 作为工作记忆,`memory/` 目录作为完整知识库 |
| `task-management` | 基于共享 `TASKS.md` 文件的 Markdown 任务跟踪 |
| `start` | 初始化效率系统并打开看板(同 `/start` 命令) |
| `update` | 同步任务并刷新记忆(同 `/update` 命令) |

## 示例工作流

### 快速上手

```
你: /start

CrabCode: [创建 TASKS.md、CRABCODE.md、memory/ 目录与 dashboard.html]
          [在浏览器中打开看板]
          [询问你的角色、团队与当前优先事项以初始化记忆]
```

### 用自然语言添加任务

```
你: 我得在周五前帮 Sarah 评审预算方案,跟 Greg 对齐后起草 Q2 路线图,
    再跟进平台团队的 API 规范

CrabCode: [将三项任务连同上下文加入 TASKS.md]
          [看板自动更新]
```

### 晨间同步

```
你: /update --comprehensive

CrabCode: [扫描邮件、日历与聊天中的新行动项]
          [提示:「预算方案评审明天到期 —— 仍未完成」]
          [建议:「有位新成员在 3 个会话中被提及:Jamie Park,
           设计负责人 —— 是否加入记忆?」]
          [更新过期任务并填补记忆缺口]
```

### 工作简称

记忆建立后,CrabCode 能即时解码你的简称:

```
你: 让 todd 给 oracle 出 PSR

CrabCode:「让 Todd Martinez(财务负责人)为 Oracle Systems 交易
          (230 万美元,Q2 结单)准备 Pipeline Status Report(管道状态报告)」
```

无需反复追问,一步到位。

## 数据源

> 如遇占位符或需确认已连接的工具,请参阅 [CONNECTORS.md](CONNECTORS.md)。

连接你的沟通与项目管理工具可获得最佳体验;没有它们时,也可手动管理任务与记忆。

**内置 MCP 连接:**
- 聊天(Slack):团队上下文与消息扫描
- 邮件与日历:行动项发现
- 知识库(Notion):参考文档
- 项目管理(Asana、Linear、Atlassian、monday.com、ClickUp):任务同步
- 办公套件:文档

**更多可选项:**
- 各类别的替代工具详见 [CONNECTORS.md](CONNECTORS.md)

## 个性化设置

在 `crabwork-productivity/.crabcode/settings.local.json` 创建本地设置文件。未配置时,插件会在需要时主动询问相关信息。
