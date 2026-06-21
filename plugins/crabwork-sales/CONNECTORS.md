# 连接器

## 工具引用机制

插件文件用 `~~category` 作为占位符,代表用户在该类别下连接的具体工具。例如 `~~CRM` 可指 Salesforce、HubSpot 或任何提供 MCP 服务的 CRM 系统。

插件是**工具无关**的——它们以类别(CRM、聊天、邮件等)而非具体产品来描述工作流。`.mcp.json` 预配置了具体的 MCP 服务,但同类别下的任何 MCP 服务都可使用。

## 本插件的连接器

| 类别 | 占位符 | 内置服务 | 其它可选 |
|---|---|---|---|
| 日历 | `~~calendar` | Google Calendar、Microsoft 365 | — |
| 聊天 | `~~chat` | Slack | Microsoft Teams |
| 竞争情报 | `~~competitive intelligence` | Similarweb | Crayon、Klue |
| CRM | `~~CRM` | HubSpot、Close | Salesforce、Pipedrive、Copper |
| 数据增强 | `~~data enrichment` | Clay、ZoomInfo、Apollo | Clearbit、Lusha |
| 邮件 | `~~email` | Gmail、Microsoft 365 | — |
| 知识库 | `~~knowledge base` | Notion | Confluence、Guru |
| 会议转录 | `~~conversation intelligence` | Fireflies | Gong、Chorus、Otter.ai |
| 项目管理 | `~~project tracker` | Atlassian(Jira/Confluence) | Linear、Asana |
| 销售触达 | `~~sales engagement` | Outreach | Salesloft、Apollo |
