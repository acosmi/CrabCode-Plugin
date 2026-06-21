# 连接器

## 工具引用机制

插件文件用 `~~类别` 作为占位符,代表用户在该类别下连接的具体工具。例如 `~~HRIS` 可指 Workday、BambooHR 或任何提供 MCP 服务的 HRIS。

插件是**工具无关**的——它们以类别(HRIS、ATS、email 等)而非具体产品来描述工作流。`.mcp.json` 预配置了具体的 MCP 服务,但同类别下的任何 MCP 服务都可使用。

## 本插件的连接器

| 类别 | 占位符 | 内置服务 | 其它可选 |
|---|---|---|---|
| ATS | `~~ATS` | — | Greenhouse、Lever、Ashby、Workable |
| 日历 | `~~calendar` | Google Calendar | Microsoft 365 |
| 聊天 | `~~chat` | Slack | Microsoft Teams |
| 邮件 | `~~email` | Gmail、Microsoft 365 | — |
| HRIS | `~~HRIS` | — | Workday、BambooHR、Rippling、Gusto |
| 知识库 | `~~knowledge base` | Notion、Atlassian(Confluence) | Guru、Coda |
| 薪酬数据 | `~~compensation data` | — | Pave、Radford、Levels.fyi |
