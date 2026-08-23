# 连接器

> **MCP 安全暂停**：当前版本没有可执行 MCP 配置、内置服务或已连接来源；不得按本文下载、安装、填写凭证、修改设置或连接服务。以下内容仅是历史/未来能力分类，恢复前必须另行通过安全、宿主、发布与升级重启审查。

## 工具引用机制

插件文件用 `~~类别` 标记未来能力类别；当前它不解析为已连接工具。

插件以工具类别而非具体产品描述工作流。历史版本曾预配置 MCP；当前对应配置已删除，同类别产品名仅用于未来能力盘点，不代表可用或可连接。

## 历史/未来能力目录（当前不可用）

| 类别 | 占位符 | 历史示例 | 未来候选 |
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

\* Benchling 仅是历史候选；当前不要填写租户名或进入 MCP 设置。

## 历史租户配置说明

旧版本的租户 URL 规则不再是配置指引。当前不要创建 MCP JSON、填写
租户变量或编辑端点；未来恢复需重新按当时宿主 schema 与供应商 E2E 审查。
