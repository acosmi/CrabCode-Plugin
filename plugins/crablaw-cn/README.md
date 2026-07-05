# CrabLaw-CN 中国法律执业工作台

面向中国法执业场景的 CrabCode 伞形插件:案件管理、合同、诉讼、知识产权、公司、劳动、数据合规、AI 治理、监管、产品与法律援助,共 11 个板块 86 个技能。

## 安装

在 CrabCode 插件市场中添加 `crablaw-cn`,或通过 `/plugin` 安装。

## 板块与技能

| 板块 | 技能数 | 覆盖 |
|---|---|---|
| `matter-core` | 7 | 案件系统核心:立卷、利冲检索、归档、复核队列、深度分析、合规期限 |
| `cn-contract` | 5 | 合同:审查、条款改写、NDA、风险摘要、冷启动访谈 |
| `cn-litigation` | 16 | 诉讼:案件简报、时间线、争点图、催告函、证据保全、庭前准备 |
| `cn-corporate` | 10 | 公司/并购:董事会纪要、交割清单、尽调问题提取、表格化审查 |
| `cn-ip` | 9 | 知识产权:检索排查、侵权分诊、警告函、开源审查、组合管理 |
| `cn-labor-employment` | 5 | 劳动用工:劳动合同/员工手册/竞业限制审查、解除风险 |
| `cn-data-compliance` | 5 | 数据合规:处理活动分诊、PIA、跨境传输、隐私政策审查 |
| `cn-ai-governance` | 7 | AI 治理:AI 清单、影响评估、政策监测、供应商 AI 审查 |
| `cn-regulatory` | 6 | 监管:政策差异比对、意见反馈、缺口排查、监管动态跟踪 |
| `cn-product` | 4 | 产品法务:功能风险评估、上线审查、营销宣称审查 |
| `cn-legal-aid` | 12 | 法律援助:受理、资格审查、文书起草、平实语言函件、结案 |

## Matter Gate 执业约束

除元工具与教育板块外,实体技能统一带 `## Matter Gate` 开场闸门,要求先具备客户/案件/利冲筛查前提(规则见 `matter-core/PRACTICE.md`,由仓库校验器强制)。

## 办公文档产出路由

文书交付类技能(备忘录、尽调报告、表格化审查等)需要交付 Word/Excel/PDF 成品时,统一路由到 `crabcode-office-suite` 插件(如 `crabcode-office-suite:crabcode-documents`),详见仓库根 `docs/capability-routing.md`。需要成品文书交付时建议同时安装 `crabcode-office-suite`;若未安装,技能会引导你通过 `/plugin` 安装。

## 使用入口

直接描述法律任务(如"审查这份采购合同""起草一份催告函"),CrabCode 会自动匹配技能;新案件先经 `new-client`/`new-matter`/`conflict-check` 建立前提。
