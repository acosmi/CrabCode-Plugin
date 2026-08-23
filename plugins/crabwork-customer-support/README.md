# CrabWork 客户支持

> **MCP 安全暂停（2026-08-22）**：本版本不发布可执行 MCP 配置；安装不会启动该服务或发起网络请求。如果曾安装旧版，请先升级插件并重启 CrabCode；仅重载插件不能证明旧 MCP 客户端或进程已退出。下文任何 Connect、`.mcp.json`、端点、launcher 或启动描述均仅是历史配置/未来恢复审查参考，不代表本版本会生成配置、连接、启动或提供相应工具。

面向客户支持团队的 CrabCode 插件：当前通过直接粘贴工单、描述问题和上传记录完成工作；工单系统、CRM 与知识库 MCP 连接均暂停。

> 基于上游开源知识工作插件(Apache-2.0)二次开发,已去品牌化并适配 CrabCode 生态;上游出处与许可信息见 [docs/legal/THIRD_PARTY_NOTICES.md](docs/legal/THIRD_PARTY_NOTICES.md)。

## 安装

在 CrabCode 插件市场中搜索「CrabWork 客户支持」并安装,或通过 marketplace 添加 `crabwork-customer-support`。

## 技能(按需自动触发)

CrabCode 会根据你的输入自动匹配以下技能:

| 技能 | 说明 |
|---|---|
| `ticket-triage` | 工单分流:分类、优先级(P1–P4)、路由规则、重复/已知问题检测 |
| `customer-research` | 多来源客户调研:来源分级、置信度评分、答案综合与归因 |
| `draft-response` | 撰写面向客户的专业回复:语气把控、场景模板、质量自检 |
| `customer-escalation` | 打包结构化升级简报:影响评估、复现步骤、升级层级与跟进节奏 |
| `kb-article` | 从已解决问题生成知识库文章:文章结构、可搜索性优化、维护节奏 |

## 独立使用 + 连接增强

每个技能无需任何集成即可使用。下表仅列历史/未来目标能力；当前 MCP 连接全部暂停，不可连接或调用：

| 能力 | 独立使用 | 连接增强 |
|---|---|---|
| 工单分流 | 粘贴工单内容 | 工单系统、知识库、项目管理(查重与已知问题) |
| 客户调研 | 描述问题 | 知识库、CRM、聊天、邮件、云存储(多来源检索) |
| 回复撰写 | 描述场景 | 邮件、CRM、工单系统(历史与上下文) |
| 问题升级 | 描述事故 | 工单系统、CRM、项目管理、聊天 |
| 知识库文章 | 描述已解决问题 | 工单系统、知识库、项目管理 |

## 历史 MCP 连接器目录（当前不可用）

> 如遇占位符或需确认已连接的工具,请参阅 [CONNECTORS.md](CONNECTORS.md)。

| 类别 | 示例 | 启用能力 |
|---|---|---|
| 聊天 | Slack、Microsoft Teams | 内部讨论、客户沟通频道上下文 |
| 邮件 | Microsoft 365 | 客户往来邮件、历史承诺 |
| 云存储 | Microsoft 365 | 内部文档、规范、既往调研 |
| 工单系统 | Intercom、Zendesk | 工单历史、客户会话、SLA 状态 |
| CRM | HubSpot、Salesforce | 账户详情、联系人、升级记录 |
| 知识库 | Guru、Notion | 内部文档、运维手册、已有 KB 文章 |
| 项目管理 | Atlassian(Jira/Confluence)、Linear | Bug 报告、需求与工程状态 |

详见 [CONNECTORS.md](CONNECTORS.md) 获取完整的受支持集成列表。

## 个性化设置

在 `crabwork-customer-support/.crabcode/settings.local.json` 创建本地设置文件:

```json
{
  "name": "你的名字",
  "title": "客户支持工程师",
  "team": "你的团队",
  "company": "你的公司",
  "product": "你的产品名",
  "tiers": ["Tier 1", "Tier 2", "Engineering"],
  "slaPolicy": "P1 1 小时 / P2 4 小时 / P3 1 个工作日 / P4 2 个工作日"
}
```

未配置时,插件会在需要时主动询问相关信息。
