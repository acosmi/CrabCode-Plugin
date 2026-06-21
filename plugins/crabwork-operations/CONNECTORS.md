# 连接器

## 工具引用机制

插件文件用 `~~类别` 作为占位符,代表用户在该类别下连接的具体工具。例如 `~~ITSM` 可指 ServiceNow、Zendesk 或任何提供 MCP 服务的服务管理工具。

插件是**工具无关**的——它们以类别(ITSM、项目管理、知识库等)而非具体产品来描述工作流。`.mcp.json` 预配置了具体的 MCP 服务,但同类别下的任何 MCP 服务都可使用。

## 本插件的连接器

| 类别 | 占位符 | 内置服务 | 其它可选 |
|---|---|---|---|
| 日历 | `~~calendar` | Google Calendar | Microsoft 365 |
| 聊天 | `~~chat` | Slack | Microsoft Teams |
| 邮件 | `~~email` | Gmail、Microsoft 365 | — |
| ITSM | `~~ITSM` | ServiceNow | Zendesk、Freshservice、Jira Service Management |
| 知识库 | `~~knowledge base` | Notion、Atlassian(Confluence) | Guru、Coda |
| 项目管理 | `~~project tracker` | Asana、Atlassian(Jira) | Linear、monday.com、ClickUp |
| 采购 | `~~procurement` | — | Coupa、SAP Ariba、Zip |
| 办公套件 | `~~office suite` | Microsoft 365 | Google Workspace |
