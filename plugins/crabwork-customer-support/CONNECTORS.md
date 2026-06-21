# 连接器

## 工具引用机制

插件文件用 `~~类别` 作为占位符,代表用户在该类别下连接的具体工具。例如 `~~support platform` 可指 Intercom、Zendesk 或任何提供 MCP 服务的工单系统。

插件是**工具无关**的——它们以类别(工单系统、CRM、聊天等)而非具体产品来描述工作流。`.mcp.json` 预配置了具体的 MCP 服务,但同类别下的任何 MCP 服务都可使用。

## 本插件的连接器

| 类别 | 占位符 | 内置服务 | 其它可选 |
|---|---|---|---|
| 聊天 | `~~chat` | Slack | Microsoft Teams |
| 邮件 | `~~email` | Microsoft 365 | — |
| 云存储 | `~~cloud storage` | Microsoft 365 | — |
| 工单系统 | `~~support platform` | Intercom | Zendesk、Freshdesk、HubSpot Service Hub |
| CRM | `~~CRM` | HubSpot | Salesforce、Pipedrive |
| 知识库 | `~~knowledge base` | Guru、Notion | Confluence、Help Scout |
| 项目管理 | `~~project tracker` | Atlassian(Jira/Confluence) | Linear、Asana |
