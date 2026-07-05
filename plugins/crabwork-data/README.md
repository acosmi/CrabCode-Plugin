# CrabWork 数据分析

面向数据分析师的 CrabCode 插件:编写 SQL、探索数据集、生成洞察,构建可视化图表与交互式看板,把原始数据变成面向干系人的清晰叙事。可独立使用(粘贴 SQL 结果、上传 CSV/Excel),连接数据仓库与分析工具后能力更强。适配任意数据仓库、任意 SQL 方言与任意分析技术栈。

> 基于上游开源知识工作插件(Apache-2.0)二次开发,已去品牌化并适配 CrabCode 生态;上游出处与许可信息见 [docs/legal/THIRD_PARTY_NOTICES.md](docs/legal/THIRD_PARTY_NOTICES.md)。

## 安装

在 CrabCode 插件市场中搜索「CrabWork 数据分析」并安装,或通过 marketplace 添加 `crabwork-data`。

## 技能(按需自动触发)

CrabCode 会根据你的输入自动匹配以下技能:

| 技能 | 说明 |
|---|---|
| `analyze` | 回答数据问题:从单指标查询到完整分析报告 |
| `explore-data` | 剖析数据集,了解其规模、质量与分布模式 |
| `write-query` | 按你的方言编写优化的 SQL,遵循最佳实践 |
| `sql-queries` | 跨方言的 SQL 最佳实践、常见模式与性能优化 |
| `create-viz` | 用 Python 生成出版级可视化图表 |
| `data-visualization` | 图表选型、Python 绘图模式与设计原则(可访问性、配色) |
| `build-dashboard` | 构建带筛选器与图表的交互式 HTML 看板 |
| `statistical-analysis` | 描述统计、趋势分析、异常检测与假设检验 |
| `validate-data` | 交付前 QA:方法论、准确性与偏差核查 |
| `data-context-extractor` | 提取公司专属数据知识,生成定制化数据分析技能 |

## 独立使用 + 连接增强

每个技能无需任何集成即可使用;连接 MCP 工具后体验更佳:

| 能力 | 独立使用 | 连接增强 |
|---|---|---|
| 数据分析 | 粘贴 SQL 结果 | 数据仓库(直连查询) |
| 数据探索 | 上传 CSV/Excel | 数据仓库(读取 schema 与元数据) |
| SQL 编写 | 描述数据需求 | 数据仓库(按结果迭代查询) |
| 可视化 | 提供数据 | 笔记本、数据仓库 |
| 看板构建 | 粘贴数据 | 数据仓库、产品分析 |
| 分析校验 | 提供分析文档 | 数据仓库(交叉核对) |

## MCP 连接器

> 如遇占位符或需确认已连接的工具,请参阅 [CONNECTORS.md](CONNECTORS.md)。

| 类别 | 示例 | 启用能力 |
|---|---|---|
| 数据仓库 | Snowflake、Databricks、BigQuery、Definite | 直连查询、schema 探索、端到端分析 |
| 笔记本 | Hex、Jupyter | 笔记本协作、查询迭代 |
| 产品分析 | Amplitude、Mixpanel | 行为数据、留存与漏斗分析 |
| 项目管理 | Atlassian(Jira/Confluence)、Linear | 工单状态、需求文档 |

详见 [CONNECTORS.md](CONNECTORS.md) 获取完整的受支持集成列表。

## 个性化设置

在 `crabwork-data/.crabcode/settings.local.json` 创建本地设置文件:

```json
{
  "name": "你的名字",
  "title": "数据分析师",
  "team": "你的团队",
  "company": "你的公司",
  "warehouse": "Snowflake",
  "sqlDialect": "snowflake",
  "biTool": "Hex"
}
```

未配置时,插件会在需要时主动询问相关信息。
