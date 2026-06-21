# 连接器

## 工具引用机制

插件文件用 `~~类别` 作为占位符,代表用户在该类别下连接的具体工具。例如 `~~design tool` 可指 Figma、Sketch 或任何提供 MCP 服务的设计工具。

插件是**工具无关**的——它们以类别(设计工具、项目管理、用户反馈等)而非具体产品来描述工作流。`.mcp.json` 预配置了具体的 MCP 服务,但同类别下的任何 MCP 服务都可使用。

## 本插件的连接器

| 类别 | 占位符 | 内置服务 | 其它可选 |
|---|---|---|---|
| 聊天 | `~~chat` | Slack | Microsoft Teams |
| 设计工具 | `~~design tool` | Figma | Sketch、Adobe XD、Framer |
| 知识库 | `~~knowledge base` | Notion | Confluence、Guru、Coda |
| 项目管理 | `~~project tracker` | Linear、Asana、Atlassian(Jira/Confluence) | Shortcut、ClickUp |
| 用户反馈 | `~~user feedback` | Intercom | Productboard、Canny、UserVoice、Dovetail |
| 产品分析 | `~~product analytics` | — | Amplitude、Mixpanel、Heap、FullStory |
