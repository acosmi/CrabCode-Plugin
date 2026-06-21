# 连接器

## 工具引用机制

插件文件用 `~~类别` 作为占位符,代表用户在该类别下连接的具体工具。例如 `~~source control` 可指 GitHub、GitLab 或任何提供 MCP 服务的版本控制系统。

插件是**工具无关**的——它们以类别(源码管理、CI/CD、监控等)而非具体产品来描述工作流。`.mcp.json` 预配置了具体的 MCP 服务,但同类别下的任何 MCP 服务都可使用。

## 本插件的连接器

| 类别 | 占位符 | 内置服务 | 其它可选 |
|---|---|---|---|
| 聊天 | `~~chat` | Slack | Microsoft Teams |
| 源码管理 | `~~source control` | GitHub | GitLab、Bitbucket |
| 项目管理 | `~~project tracker` | Linear、Asana、Atlassian(Jira/Confluence) | Shortcut、ClickUp |
| 知识库 | `~~knowledge base` | Notion | Confluence、Guru、Coda |
| 监控 | `~~monitoring` | Datadog | New Relic、Grafana、Splunk |
| 事故管理 | `~~incident management` | PagerDuty | Opsgenie、Incident.io、FireHydrant |
| CI/CD | `~~CI/CD` | — | CircleCI、GitHub Actions、Jenkins、BuildKite |
