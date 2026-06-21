# 中国股票研究(cn-equity-research)· 实务手册

> ✅ **状态：已就绪。** 全部 L1-L4 素材到位，9 个技能已内置 CAS 科目映射、申万行业分类、A股/港股信息披露规则、估值惯例等中国监管内容。通用建模(DCF、可比公司、三表)由 `fin-core` 底座提供。

## 定位

面向 A股 / 港股的卖方与买方股票研究子板块。通用建模(DCF、可比公司、三表)已由 `fin-core` 底座提供;本板块承载**中国市场特定**的研究流程与口径。

## 已建技能

| 技能 | 作用 | 中国监管素材引用 |
|---|---|---|
| catalyst-calendar | 催化剂/事件日历 | 沪深北港交所信息披露规则 |
| earnings-analysis | 财报分析 | CAS科目映射_v1.csv |
| earnings-preview | 财报前瞻 | 申万行业分类_2021.csv |
| idea-generation | 选股思路生成 | 申万行业分类 + A股港股估值惯例 |
| initiating-coverage | 首次覆盖报告 | 首次覆盖研报_脱敏模板.md |
| model-update | 模型更新 | CAS科目映射 + 估值惯例 |
| morning-note | 晨报 | 晨报_脱敏模板.md |
| sector-overview | 行业概览 | 申万行业分类_2021.csv |
| thesis-tracker | 投资逻辑跟踪 | 信息披露规则要点 |

## 已补齐中国权威素材

- [x] 企业会计准则(CAS)科目映射与财报科目口径 → `sources/mappings/CAS科目映射_v1.csv`
- [x] 交易所(上交所/深交所/北交所/港交所)信息披露规则 → `sources/laws/沪深北港交所信息披露规则要点.md`
- [x] A股 / 港股估值惯例与行业基准 → `sources/benchmarks/A股港股估值惯例与基准倍数.md`
- [x] 行业分类标准(证监会行业分类 / 申万行业) → `sources/mappings/申万行业分类_2021.csv`

> 内容须基于上述权威素材编写,**不可凭空编造或照搬美国市场规则**。
