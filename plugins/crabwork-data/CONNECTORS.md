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

\* 占位符——MCP URL 尚未配置
