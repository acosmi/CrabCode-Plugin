# 连接器

> **MCP 安全暂停**：当前版本没有可执行 MCP 配置、内置服务或已连接来源；不得按本文下载、安装、填写凭证、修改设置或连接服务。以下内容仅是历史/未来能力分类，恢复前必须另行通过安全、宿主、发布与升级重启审查。

## 工具引用机制

插件文件用 `~~category` 标记未来能力类别；当前它不解析为已连接工具。

插件以工具类别而非具体产品描述工作流。历史版本曾预配置 MCP；当前对应配置已删除，同类别产品名仅用于未来能力盘点，不代表可用或可连接。

## 历史/未来能力目录（当前不可用）

| 类别 | 占位符 | 历史示例 | 未来候选 |
|---|---|---|---|
| 数据仓库 | `~~data warehouse` | Snowflake\*、Databricks\*、BigQuery、Definite | Redshift、PostgreSQL、MySQL |
| 笔记本 | `~~notebook` | Hex | Jupyter、Deepnote、Observable |
| 产品分析 | `~~product analytics` | Amplitude | Mixpanel、Heap |
| 项目管理 | `~~project tracker` | Atlassian(Jira/Confluence) | Linear、Asana |

\* 这些是历史租户候选；当前不要填写账号/工作区、进入 MCP 设置或创建服务器对象。

## 历史租户配置说明

旧版本的变量/URL 试验仅保留为事故背景。当前不要创建 MCP JSON、填写
租户变量或编辑端点；未来恢复需重新按当时宿主 schema 与供应商 E2E 审查。
