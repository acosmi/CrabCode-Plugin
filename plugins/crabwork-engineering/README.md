# CrabWork 工程研发

面向工程研发团队的 CrabCode 插件:日常站会、代码评审、架构决策、事故响应、调试与技术文档。可独立使用(直接粘贴代码、描述系统、上传文件),连接源码管理、项目管理与监控工具后能力更强。

> 基于 [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins)(Apache-2.0)二次开发,已去品牌化并适配 CrabCode 生态。

## 安装

在 CrabCode 插件市场中搜索「CrabWork 工程研发」并安装,或通过 marketplace 添加 `crabwork-engineering`。

## 技能(按需自动触发)

CrabCode 会根据你的输入自动匹配以下技能:

| 技能 | 说明 |
|---|---|
| `architecture` | 创建/评估架构决策记录(ADR),含权衡与后果分析 |
| `code-review` | 审查代码的安全、性能、正确性与可维护性 |
| `debug` | 结构化调试:复现、隔离、定位、修复 |
| `deploy-checklist` | 上线前核对清单:测试、变更、依赖、回滚预案 |
| `documentation` | 编写与维护技术文档(README、API 文档、运维手册、上手指南) |
| `incident-response` | 事故响应工作流:分级、沟通、缓解、复盘 |
| `standup` | 从近期提交/PR/工单生成站会汇报 |
| `system-design` | 系统与服务设计:架构图、API 设计、数据建模 |
| `tech-debt` | 识别、归类、排序技术债并制定偿还计划 |
| `testing-strategy` | 测试策略与测试计划:单元/集成/E2E 覆盖 |

## 独立使用 + 连接增强

每个技能无需任何集成即可使用;连接 MCP 工具后体验更佳:

| 能力 | 独立使用 | 连接增强 |
|---|---|---|
| 站会汇报 | 描述你的工作 | 源码管理、项目管理、聊天工具 |
| 代码评审 | 粘贴 diff 或代码 | 源码管理(自动拉取 PR) |
| 调试 | 描述问题 | 监控(拉取日志与指标) |
| 架构决策 | 描述系统 | 知识库(查阅既往 ADR) |
| 事故响应 | 描述事故 | 监控、事故管理、聊天工具 |
| 上线核对 | 描述发布 | CI/CD、源码管理 |

## MCP 连接器

> 如遇占位符或需确认已连接的工具,请参阅 [CONNECTORS.md](CONNECTORS.md)。

| 类别 | 示例 | 启用能力 |
|---|---|---|
| 源码管理 | GitHub、GitLab | PR diff、提交历史、分支状态 |
| 项目管理 | Linear、Jira、Asana | 工单状态、迭代数据、分配情况 |
| 监控 | Datadog、New Relic | 日志、指标、告警、看板 |
| 事故管理 | PagerDuty、Opsgenie | 值班排期、事故跟踪、呼叫 |
| 聊天 | Slack、Teams | 团队讨论、站会频道 |
| 知识库 | Notion、Confluence | ADR、运维手册、上手文档 |

详见 [CONNECTORS.md](CONNECTORS.md) 获取完整的受支持集成列表。

## 个性化设置

在 `crabwork-engineering/.crabcode/settings.local.json` 创建本地设置文件:

```json
{
  "name": "你的名字",
  "title": "软件工程师",
  "team": "你的团队",
  "company": "你的公司",
  "techStack": ["Python", "TypeScript", "PostgreSQL", "AWS"],
  "defaultBranch": "main",
  "deployProcess": "canary"
}
```

未配置时,插件会在需要时主动询问相关信息。
