# 连接器

## 工具引用机制

插件文件用 `~~类别` 作为占位符,代表用户在该类别下连接的具体工具。例如 `~~literature` 可指 PubMed、bioRxiv 或任何提供 MCP 服务的文献来源。

插件是**工具无关**的——它们以类别(文献、临床试验、化合物数据库等)而非具体产品来描述工作流。`.mcp.json` 预配置了具体的 MCP 服务,但同类别下的任何 MCP 服务都可使用。

## 本插件的连接器

| 类别 | 占位符 | 内置服务 | 其它可选 |
|---|---|---|---|
| 文献 | `~~literature` | PubMed、bioRxiv、Consensus | Google Scholar、Semantic Scholar |
| 科研绘图 | `~~scientific illustration` | BioRender | — |
| 临床试验 | `~~clinical trials` | ClinicalTrials.gov | EU Clinical Trials Register |
| 化合物数据库 | `~~chemical database` | ChEMBL | PubChem、DrugBank |
| 药物靶点 | `~~drug targets` | Open Targets | UniProt、STRING |
| 数据仓库 | `~~data repository` | Synapse | Zenodo、Dryad、Figshare |
| 期刊访问 | `~~journal access` | Wiley Scholar Gateway | Elsevier、Springer Nature |
| AI 研究 | `~~AI research` | Owkin | — |
| 实验室平台 | `~~lab platform` | Benchling\* | — |

\* 租户型连接器——首次使用需填写自己的 Benchling 租户名,填完即可用。启用插件时会弹出填写框,也可在设置页 → MCP 里点「配置」。

## 租户型连接器的 URL 形态约束

`.mcp.json` 是严格 JSON、放不下注释,因此把约束记在这里。

`${user_config.X}` 可以出现在 URL 的 host 段、path 段或 query 段,但**不能整段替换 `url`**:
宿主先校验 URL 合法性、后做变量替换,`"url": "${user_config.mcp_url}"` 会被直接判非法。
改这条 URL 时保持变量嵌在合法 URL 骨架内即可。
