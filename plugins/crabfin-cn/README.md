# CrabFin-CN 中国金融工作台

面向中国金融从业场景的 CrabCode 伞形插件:财务建模核心、行业研究、投行、私募股权、财富管理、基金运营与 KYC 合规,共 7 个板块 54 个技能。

## 安装

在 CrabCode 插件市场中添加 `crabfin-cn`,或通过 `/plugin` 安装。

## 板块与技能

| 板块 | 技能数 | 覆盖 |
|---|---|---|
| `fin-core` | 12 | 财务建模核心:DCF、LBO、三表联动、可比公司、xlsx/pptx 制作、数据清洗与审计 |
| `cn-equity-research` | 9 | 行业与个股研究:首次覆盖、业绩点评/前瞻、晨会纪要、催化剂日历 |
| `cn-investment-banking` | 9 | 投行执行:CIM、路演材料、买方名单、并购模型、交易跟踪 |
| `cn-private-equity` | 11 | 私募股权:项目筛选、尽调清单、投委会备忘录、组合监控、回报分析 |
| `cn-wealth` | 6 | 财富管理:理财规划、投资建议书、组合再平衡、客户报告 |
| `cn-fund-admin` | 6 | 基金运营:净值核对、总账调节、差异说明、滚动结转 |
| `cn-kyc-ops` | 2 | KYC 合规:证件解析、规则核查 |

## 办公文档产出路由

财务建模与交付类技能(模型、报表、路演材料)需要产出 .xlsx/.pptx/.docx 文件时,统一路由到 `crabcode-office-suite` 插件的对应技能(如 `crabcode-office-suite:crabcode-spreadsheets`),详见仓库根 `docs/capability-routing.md`。**使用本插件的建模技能前建议先安装 `crabcode-office-suite`**;若未安装,技能会引导你通过 `/plugin` 安装。

## 使用入口

直接描述任务(如"给这家公司搭一个 DCF 模型""写一份业绩点评"),CrabCode 会自动匹配技能。
