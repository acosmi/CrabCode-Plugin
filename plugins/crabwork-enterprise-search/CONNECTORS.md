# 连接器

## 工具引用机制

插件文件用 `~~类别` 作为占位符,代表用户在该类别下连接的具体工具。例如 `~~chat` 可指 Slack、Microsoft Teams,或任何提供 MCP 服务的聊天工具。

插件是**工具无关**的——它们以类别(聊天、邮件、云存储等)而非具体产品来描述工作流。`.mcp.json` 预配置了具体的 MCP 服务,但同类别下的任何 MCP 服务都可使用。

本插件大量使用 `~~类别` 引用作为检索输出中的来源标签(如 `~~chat:`、`~~email:`)。这是有意为之——它们是动态的类别标记,会解析为实际连接的工具。

## 本插件的连接器

| 类别 | 占位符 | 内置服务 | 其它可选 |
|----------|-------------|-----------------|---------------|
| 聊天 | `~~chat` | Slack | Microsoft Teams、Discord |
| 邮件 | `~~email` | Microsoft 365 | — |
| 云存储 | `~~cloud storage` | Microsoft 365 | Dropbox |
| 知识库 | `~~knowledge base` | Notion、Guru | Confluence、Slite |
| 项目管理 | `~~project tracker` | Atlassian(Jira/Confluence)、Asana | Linear、monday.com |
| CRM | `~~CRM` | *(未预配置)* | Salesforce、HubSpot |
| 办公套件 | `~~office suite` | Microsoft 365 | Google Workspace |
