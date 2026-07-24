# 连接器

## 工具引用机制

插件文件用 `~~category` 作为占位符,代表用户在该类别下连接的具体工具。例如 `~~data warehouse` 可指 Snowflake、BigQuery 或任何提供 MCP 服务的数据仓库。

插件是**工具无关**的——它们以类别(数据仓库、笔记本、产品分析等)而非具体产品来描述工作流。`.mcp.json` 预配置了具体的 MCP 服务,但同类别下的任何 MCP 服务都可使用。

## 本插件的连接器

| 类别 | 占位符 | 内置服务 | 其它可选 |
|---|---|---|---|
| 数据仓库 | `~~data warehouse` | Snowflake\*、Databricks\*、BigQuery、Definite | Redshift、PostgreSQL、MySQL |
| 笔记本 | `~~notebook` | Hex | Jupyter、Deepnote、Observable |
| 产品分析 | `~~product analytics` | Amplitude | Mixpanel、Heap |
| 项目管理 | `~~project tracker` | Atlassian(Jira/Confluence) | Linear、Asana |

\* 租户型连接器——首次使用需填写自己的账号/工作区标识,填完即可用。启用插件时会弹出填写框,也可在设置页 → MCP 里点「配置」。Snowflake 另需先在自己账号内创建 MCP 服务器对象(厂商未提供公共端点)。

## 租户型连接器的 URL 形态约束

`.mcp.json` 是严格 JSON、放不下注释,因此把约束记在这里。

`${user_config.X}` 可以出现在 URL 的 **host 段、path 段或 query 段**,但**不能整段替换 `url`**:
宿主先校验 URL 合法性、后做变量替换,`"url": "${user_config.mcp_url}"` 会被直接判非法。

已对宿主真 schema 实测(2026-07-24):host 中段、host 整段、path 段、query 段全部通过,仅"整段变量"失败。
改这两条 URL 时保持变量嵌在合法 URL 骨架内即可。
