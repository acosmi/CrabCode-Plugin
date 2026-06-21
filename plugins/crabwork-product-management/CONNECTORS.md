# 连接器

## 工具引用机制

插件文件用 `~~category` 作为占位符,代表用户在该类别下连接的具体工具。例如 `~~project tracker` 可指 Linear、Asana、Jira 或任何提供 MCP 服务的项目管理工具。

插件是**工具无关**的——它们以类别(项目管理、设计、产品分析等)而非具体产品来描述工作流。`.mcp.json` 预配置了具体的 MCP 服务,但同类别下的任何 MCP 服务都可使用。

## 本插件的连接器

| 类别 | 占位符 | 内置服务 | 其它可选 |
|---|---|---|---|
| 日历 | `~~calendar` | Google Calendar | Microsoft 365 |
| 聊天 | `~~chat` | Slack | Microsoft Teams |
| 竞争情报 | `~~competitive intelligence` | Similarweb | Crayon、Klue |
| 设计 | `~~design` | Figma | Sketch、Adobe XD |
| 邮箱 | `~~email` | Gmail | Microsoft 365 |
| 知识库 | `~~knowledge base` | Notion | Confluence、Guru、Coda |
| 会议转录 | `~~meeting transcription` | Fireflies | Gong、Dovetail、Otter.ai |
| 产品分析 | `~~product analytics` | Amplitude、Pendo | Mixpanel、Heap、FullStory |
| 项目管理 | `~~project tracker` | Linear、Asana、monday.com、ClickUp、Atlassian(Jira/Confluence) | Shortcut、Basecamp |
| 用户反馈 | `~~user feedback` | Intercom | Productboard、Canny、UserVoice |
