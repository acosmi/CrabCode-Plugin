# CrabWork 生命科学研究

连接临床前研究工具与数据库(文献检索、基因组学分析、靶点优先级排序),加速生命科学早期研发。可独立使用,也可在 CrabCode 中直接安装使用。

> 基于 [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins)(Apache-2.0)二次开发,已去品牌化并适配 CrabCode 生态。

本插件将 11 个 MCP 服务集成与 5 个分析技能整合到一个面向生命科学研究者的统一包中。

## 包含内容

### MCP 服务(数据源与工具)

> 如遇陌生占位符或需确认已连接的工具,请参阅 [CONNECTORS.md](CONNECTORS.md)。

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

### 可选二进制 MCP 服务

以下服务需单独下载二进制文件:

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

安装后运行 `/start` 命令,查看可用工具并完成环境初始化。

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
