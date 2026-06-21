# 连接器

## 工具引用机制

插件文件用 `~~category` 作为占位符,代表用户在该类别下连接的具体工具。例如 `~~marketing automation` 可指 HubSpot、Marketo 或任何提供 MCP 服务的营销平台。

插件是**工具无关**的——它们以类别(设计、SEO、邮件营销等)而非具体产品来描述工作流。`.mcp.json` 预配置了具体的 MCP 服务,但同类别下的任何 MCP 服务都可使用。

## 本插件的连接器

| 类别 | 占位符 | 内置服务 | 其它可选 |
|---|---|---|---|
| 聊天 | `~~chat` | Slack | Microsoft Teams |
| 设计 | `~~design` | Canva、Figma | Adobe Creative Cloud |
| 营销自动化 | `~~marketing automation` | HubSpot | Marketo、Pardot、Mailchimp |
| 产品分析 | `~~product analytics` | Amplitude | Mixpanel、Google Analytics |
| 知识库 | `~~knowledge base` | Notion | Confluence、Guru |
| SEO | `~~SEO` | Ahrefs、Similarweb | Semrush、Moz |
| 邮件营销 | `~~email marketing` | Klaviyo | Mailchimp、Brevo、Customer.io |
| 营销分析 | `~~marketing analytics` | Supermetrics | Google Analytics、Mailchimp、Semrush |
