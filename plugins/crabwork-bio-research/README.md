# CrabWork 生命科学研究

> **MCP 安全暂停（2026-08-22）**：本版本不发布可执行 MCP 配置；安装不会启动该服务或发起网络请求。如果曾安装旧版，请先升级插件并重启 CrabCode；仅重载插件不能证明旧 MCP 客户端或进程已退出。下文任何 Connect、`.mcp.json`、端点、launcher 或启动描述均仅是历史配置/未来恢复审查参考，不代表本版本会生成配置、连接、启动或提供相应工具。

提供可独立使用的生命科学分析方法；历史目标包括文献检索、基因组学分析与靶点优先级排序等外部数据能力，当前均未连接。

> 基于上游开源知识工作插件(Apache-2.0)二次开发,已去品牌化并适配 CrabCode 生态;上游出处与许可信息见 [docs/legal/THIRD_PARTY_NOTICES.md](docs/legal/THIRD_PARTY_NOTICES.md)。

本版本保留 5 个分析技能；下列 11 个 MCP 服务仅为历史/未来能力目录，当前不集成、不连接。

## 包含内容

### 历史 MCP 服务目录（当前不可用）

> 下列占位符仅帮助理解未来能力分类；当前连接数为 0。

| 提供方 | 功能 | 类别/占位符 |
|---|---|---|
| 美国国家医学图书馆 | 检索生物医学文献与研究论文 | `~~literature` |
| deepsense.ai | 访问 bioRxiv 与 medRxiv 预印本 | `~~literature` |
| Consensus | AI 驱动的同行评审研究检索与综述 | `~~literature` |
| John Wiley & Sons | 访问学术研究与出版物 | `~~journal access` |
| Sage Bionetworks | 协作式研究数据管理 | `~~data repository` |
| deepsense.ai | 生物活性类药化合物数据库 | `~~chemical database` |
| OpenTargets | 药物靶点发现与优先级排序 | `~~drug targets` |
| deepsense.ai | NIH/NLM 临床试验注册库 | `~~clinical trials` |
| BioRender | 科研插图创作 | `~~scientific illustration` |
| Owkin | 面向生物学的 AI——组织病理与药物发现 | `~~AI research` |
| Benchling\* | 实验室数据管理平台 | `~~lab platform` |

### 历史二进制候选（当前不可下载或启动）

以下项目曾作为候选记录；不要按本插件下载或启动：

- **10X Genomics txg-mcp**(`~~genomics platform`)——云端分析数据与工作流([GitHub](https://github.com/10XGenomics/txg-mcp/releases))
- **ToolUniverse**(`~~tool database`)——哈佛 MIMS 出品的科学发现 AI 工具集([GitHub](https://github.com/mims-harvard/ToolUniverse/releases))

### 技能(分析工作流)

#### 单细胞 RNA 质控(Single-Cell RNA QC)
遵循 scverse 最佳实践的 scRNA-seq 数据自动质控。支持 `.h5ad` 与 `.h5` 文件,采用基于 MAD 的过滤并提供完整可视化。

#### scvi-tools
单细胞组学深度学习工具包。覆盖 scVI、scANVI、totalVI、PeakVI、MultiVI、DestVI、veloVI 与 sysVI 等模型,用于数据整合、批次校正、标签迁移与多模态分析。

#### Nextflow 流程(Nextflow Pipelines)
在本地或公共 GEO/SRA 测序数据上运行 nf-core 生信流程:
- **rnaseq**——基因表达与差异表达分析
- **sarek**——胚系与体细胞变异检测(WGS/WES)
- **atacseq**——染色质可及性分析

#### 仪器数据转 Allotrope(Instrument Data to Allotrope)
将实验室仪器输出文件(PDF、CSV、Excel、TXT)转换为 Allotrope Simple Model(ASM)格式。支持 40 多种仪器类型,包括细胞计数仪、分光光度计、酶标仪、qPCR 与色谱系统。

#### 科研选题(Scientific Problem Selection)
基于 Fischbach & Walsh 框架的系统化研究选题方法。包含 9 个子技能,覆盖创意发想、风险评估、优化函数、决策树、逆境规划与综合整合。

## 快速上手

在 CrabCode 插件市场中搜索「CrabWork 生命科学研究」并安装,或通过 marketplace 添加 `crabwork-bio-research`。

安装后只能使用随包技能处理用户直接提供的材料；不要期待 `/start` 初始化 MCP 工具。

## 常用工作流

**文献综述**
在 `~~literature` 数据库检索论文,通过 `~~journal access` 获取全文,并用 `~~scientific illustration` 制作图表。

**单细胞分析**
对 scRNA-seq 数据运行质控,再用 scvi-tools 进行整合、批次校正与细胞类型注释。

**测序流程**
从 GEO/SRA 下载公开数据,运行 nf-core 流程(RNA-seq、变异检测、ATAC-seq)并核验输出。

**药物发现**
在 `~~chemical database` 检索生物活性化合物,用 `~~drug targets` 数据库进行靶点优先级排序,并查阅临床试验数据。

**研究策略**
提出新想法、为受阻项目排障,或借助科研选题框架评估战略决策。

## 许可

技能采用 Apache 2.0 许可。MCP 服务由各自作者提供——相关条款请参阅对应服务的文档。
