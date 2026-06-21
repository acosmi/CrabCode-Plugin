# 连接器

## 工具引用机制

插件文件用 `~~category` 作为占位符,代表用户在该类别下连接的具体工具。例如 `~~project tracker` 可指 Asana、Linear、Jira 或任何提供 MCP 服务的项目管理工具。

插件是**工具无关**的——它们以类别(聊天、项目管理、知识库等)而非具体产品来描述工作流。`.mcp.json` 预配置了具体的 MCP 服务,但同类别下的任何 MCP 服务都可使用。

## 本插件的连接器

| 类别 | 占位符 | 内置服务 | 其它可选 |
|---|---|---|---|
| 聊天 | `~~chat` | Slack | Microsoft Teams、Discord |
| 邮件 | `~~email` | —(连接你的邮件 MCP 服务) | — |
| 日历 | `~~calendar` | —(连接你的日历 MCP 服务) | — |
| 知识库 | `~~knowledge base` | Notion | Confluence、Guru、Coda |
| 项目管理 | `~~project tracker` | Asana、Linear、Atlassian(Jira/Confluence)、monday.com、ClickUp | Shortcut、Basecamp、Wrike |
| 办公套件 | `~~office suite` | —(连接你的办公套件 MCP 服务) | — |
