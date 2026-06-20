# CrabCode 金融插件套件 —— 审计评估与改造实施方案

- **日期**: 2026-06-20
- **性质**: 审计评估 + 实施方案存档(本轮**不实施**改造,仅出方案)
- **上游来源**: [`anthropics/financial-services`](https://github.com/anthropics/financial-services)(Apache-2.0,owner: Matt Piccolella / Anthropic FSI)
- **拉取位置**: `vendor/anthropics-financial-services/`(浅克隆,3.4 MB;已加入 `.gitignore`,作为转换前的参考暂存,不入版本库)
- **目标**: 复核并改造为 **CrabCode 原生金融插件**,符合本仓 `.crabcode-plugin/` 约定与"主插件工作流 + 子板块按需带入"模型

> 上游署名(Anthropic / Apache-2.0)按 `CRABCODE.md` 规定仅出现在本类规划/法律文档中,产品面向文案须全部 CrabCode 原生化。

---

## 一、上游内容清单评估

上游一份源码、多种交付(Cowork 插件 / Claude Code 插件 / Managed Agent 模板 / M365 加载项)。与 CrabCode 插件市场相关的只有 `plugins/` 一支。

### 1.1 三类插件(共 19 个 marketplace 条目 + 1 个安装器)

| 区块 | 数量 | 角色 | 与 CrabCode 的关系 |
|---|---|---|---|
| `vertical-plugins/` | 7 | **领域技能源**(skills 真源 + commands + MCP) | ✅ 核心,对应"子板块" |
| `agent-plugins/` | 10 | **具名工作流智能体**(1 个 agent.md + 从 vertical 同步来的技能副本) | ⚠️ 技能是副本,存在重复 |
| `partner-built/` | 2 | 合作方插件(LSEG / S&P Global,各含 MCP) | 🔶 可选,依赖第三方数据源 |
| `claude-for-msft-365-install/` | 1 | M365 加载项的云端开通工具 | ❌ 与 CrabCode 无关,排除 |
| `managed-agent-cookbooks/` | (10 套 YAML) | Managed Agents API 部署模板 | ❌ 不同交付形态,排除 |

### 1.2 七个垂直域(子板块真源,55 个唯一技能)

| 垂直域 | 技能 | 命令 | MCP | 说明 |
|---|---|---|---|---|
| **financial-analysis** | 13 | 7 | ✅(11 连接器) | 核心:DCF/comps/LBO/三表模型/Excel/deck QC |
| **investment-banking** | 9 | 7 | ✅ | CIM/teaser/并购模型/交易跟踪 |
| **equity-research** | 9 | 9 | - | 财报分析/首次覆盖/模型更新 |
| **private-equity** | 10 | 10 | ✅ | 项目搜寻/筛选/尽调/IC 备忘/组合监控 |
| **wealth-management** | 6 | 6 | - | 客户回顾/理财规划/再平衡/TLH |
| **fund-admin** | 6 | 0 | - | GL 对账/计提/滚存/NAV 勾稽 |
| **operations** | 2 | 0 | - | KYC 文档解析/规则栅格 |

### 1.3 十个具名智能体(agent-plugins)

pitch-agent / market-researcher / earnings-reviewer / meeting-prep-agent / model-builder / gl-reconciler / kyc-screener / valuation-reviewer / month-end-closer / statement-auditor。

每个 = `agents/<slug>.md`(权威系统提示)+ `skills/`(**从 vertical 同步的副本**)。上游用 `scripts/sync-agent-skills.py` 保持副本与真源一致——这是上游的"双封装、单源"机制,迁移到 CrabCode 后应避免把副本也带进来。

### 1.4 组件总量(去重前)

- SKILL.md:117(含 agent 副本)→ **唯一约 55**
- commands:47 ·  agents:10 ·  .mcp.json:5(financial-analysis / investment-banking / private-equity / lseg / spglobal)
- MCP 连接器(均在 financial-analysis):Daloopa、Morningstar、S&P Global、FactSet、Moody's、MT Newswires、LSEG、PitchBook、Chronograph、Egnyte、Box —— **第三方数据商产品名,非品牌违规词,保留**。

---

## 二、健康度评估(以 CrabCode 约定为标尺)

上游**自身质量高**(统一清单、有 `check.py` 校验、版本门控、人审签字原则"outputs staged for human sign-off, never auto-executed"——与本仓只读/人审取向一致)。但**直接放进 CrabCode 市场不可用**,差距集中在约定层:

| 维度 | 上游现状 | CrabCode 要求 | 差距 |
|---|---|---|---|
| 清单目录 | `.claude-plugin/` | `.crabcode-plugin/` | ❌ 全部需改名 |
| marketplace 必填字段 | name/source/description | + `version` `category` `tags`(校验器强制) | ❌ 缺 3 个必填 |
| 市场展示字段 | 仅 displayName/description | 全仓约定还含 shortDescription/longDescription/defaultPrompt/brandColor | ⚠️ 需补齐(对齐 59 个存量) |
| plugin.json 元数据 | name/version/description/author | 约定含 `license`/`keywords`(参 office-suite) | ⚠️ 需补 |
| author | "Anthropic FSI" | "CrabCode" | ❌ |
| 品牌词 | claude 73 文件 / anthropic 37 / opus 41 / sonnet 1 | brandGuard 禁词:claude、anthropic、sonnet、opus、haiku、codex、`.claude`… | ❌ 改造主战场 |
| 语言 | 全英文 | 全仓中文化展示(displayName/描述/defaultPrompt) | ⚠️ 需中文化 |
| 技能重复 | agent 内技能是 vertical 副本 | 应单源 | ⚠️ 去重 |

> ⚠️ brandGuard 按**子串**匹配:`opus` 会误命中 `corpus` 等词;41 个"opus"文件需逐一甄别"模型名 vs 普通词",不能盲替。

---

## 三、与"主插件工作流 + 子板块按需带入"模型的契合度 🔑

**高度契合——这套金融插件天然就是用户设想的伞形结构:**

- 7 个 vertical = 天然的"子板块"(每个是一组按需触发的 skills)
- financial-analysis(13 技能 + 11 MCP)= 天然的"核心主插件工作流"
- 10 个 agent = 预置的"具名工作流"快捷入口

照搬上游"19 个并列 marketplace 条目"会重蹈早期 `crablaw-cn` 的覆辙(下游要一个个挑装)。落地须有"底座/主工作流 + 子板块"的层级——见第五节。

---

## 四、已锁定决策(2026-06-20,用户拍板)

| # | 决策点 | 结论 |
|---|---|---|
| 1 | 上游范围 | ✅ **排除** `partner-built`(LSEG / S&P,强依赖第三方付费数据 + 含合作方品牌)、`claude-for-msft-365-install`、`managed-agent-cookbooks`。**仅参考** `plugins/`(7 vertical + 10 agent)。 |
| 2 | 形态 | ✅ **底座主工作流 + 子板块按需带入**(沿用 `crablaw-cn` 的容器范式:`fin-core` 作底座/主插件,子板块独立) |
| 3 | 子板块展示 | ✅ **子板块在市场单独登记展示**(每个子板块一个 marketplace 条目,可单独安装;`fin-core` 为推荐先装入口) |
| 4 | 本地化版本 | ✅ **只做中国本地化版 `crabfin-cn`**(类比 `crablaw-cn`)。**不建**国际版 `crabcode-finance`。 |
| 5 | 分类 | ✅ **新设 `finance` 分类**,优先处理金融。 |

**由决策 4 引出的关键边界:**
- 上游为美国/国际市场金融套件。`crabfin-cn` 面向中国市场,上游仅作**通用方法论与结构参考**。
- **通用方法论全球通用**(DCF、LBO、三表模型、comps、Excel/PPT 制作、模型审计),可直接改造进 `fin-core`,本轮**实建**。
- **中国监管/会计/市场惯例**(企业会计准则 CAS、证监会/交易所规则、A股估值惯例、资管新规、反洗钱实名等)属权威领域内容,**不可凭空编造**,需用户提供素材。本轮中国子板块**只搭骨架**,深度内容**暂缓**(同 `crablaw-cn` 现状)。

---

## 五、目标落地架构:`crabfin-cn`(容器,类比 crablaw-cn)

```
plugins/crabfin-cn/
  fin-core/                ← 【底座/主工作流·本轮实建】通用财务建模:DCF / LBO / 三表 / comps /
      .crabcode-plugin/plugin.json (skills[] 模式A,license,keywords)
      skills/  …            Excel(xlsx)/PPT(pptx)制作、模型审计、竞品分析
  cn-equity-research/      ← 【子板块·本轮骨架】A股/港股股票研究(待补:CAS、披露规则、估值惯例)
  cn-investment-banking/   ← 【子板块·本轮骨架】中国投行与并购(待补:重组办法、要约规则)
  cn-private-equity/       ← 【子板块·本轮骨架】中国私募股权(待补:基金业协会备案、尽调口径)
  cn-wealth/               ← 【子板块·本轮骨架】中国财富管理(待补:资管新规、理财规则)
  cn-fund-admin/           ← 【子板块·本轮骨架】基金行政与估值/NAV(待补:中基协估值指引)
  cn-kyc-ops/              ← 【子板块·本轮骨架】KYC 与运营(待补:反洗钱、实名、受益所有人)
```

- **底座 vs 子板块**:`fin-core` 是"先装的主工作流"(提供通用建模能力);6 个 `cn-*` 是按需带入的中国领域子板块。等同 `crablaw-cn` 里 `matter-core`(底座)+ `cn-*`(领域板块)的层级。
- **通用方法论复用映射**:上游 `financial-analysis` 的通用技能(dcf-model / lbo-model / 3-statement-model / comps-analysis / competitive-analysis / xlsx-author / pptx-author / audit-xls / clean-data-xls 等)→ 迁入 `fin-core`(品牌清洗 + 中文展示,正文保留英文,同 office-suite)。
- **市场登记**:`fin-core` + 6 子板块共 **7 条** marketplace 条目,均 `category: finance`,中文展示字段对齐存量 59 个。
- **暂不纳入**:上游 10 个 agent-plugins(其技能为 vertical 副本)、合作方 MCP——待 `fin-core` 稳定且中国子板块有内容后再评估。

---

## 六、实施方案(分阶段,本轮仅做到阶段 1 文档/骨架,**不做改造**)

> 本轮范围已被用户限定为"**先讲文档完善,不要实施**"。以下为后续执行蓝图。

### 阶段 0 —— 准备
1. vendor 暂存就位并 gitignore(✅ 已完成)。许可:Apache-2.0,保留上游 `LICENSE` 与变更说明,在 `docs/legal/THIRD_PARTY_NOTICES.md` 增金融套件来源署名。
2. 锁定范围(✅ 见第四节)。

### 阶段 1 —— 骨架
3. 建 `plugins/crabfin-cn/` 容器;为 `fin-core` + 6 子板块各建 `.crabcode-plugin/plugin.json`(补 `license`/`keywords`,**避免重蹈 crablaw-cn 缺字段**)。
4. 每个 `cn-*` 子板块放 `PRACTICE.md` 占位 + `schemas/` 骨架,正文标注"⏸️ 待补充中国监管内容"。

### 阶段 2 —— fin-core 通用技能改造(本轮唯一"实建"内容)
5. 从 `vendor/.../financial-analysis/skills/` 复制通用技能 → `fin-core/skills/`。
6. 品牌清洗:claude→CrabCode、Anthropic→CrabCode、author→CrabCode、`.claude-plugin`→`.crabcode-plugin`;模型名(opus/sonnet/haiku)逐个甄别(注意 `opus` 子串会误中 `corpus` 等,不可盲替)。
7. 技能正文保留英文(同 office-suite),仅 marketplace 展示字段中文化;SKILL.md frontmatter 加 `license` 署名行。

### 阶段 3 —— 中国子板块内容(**暂缓,待用户素材**)
8. 待用户提供 CAS / 证监会·交易所规则 / A股惯例 / 资管新规 / 反洗钱口径后,逐域充实 `cn-*`。本轮不动内容。

### 阶段 4 —— 注册与校验
9. marketplace.json 增 7 条 `crabfin-cn` 条目(`category: finance`,展示字段中文)。
10. 跑 `bun run lint:brand` / `lint:manifest` / `lint:marketplace` / `lint:layout` / `validate` + `crabcode plugin validate`,全绿。
11. 全部转换完成后删除 `vendor/` 暂存。

---

## 七、风险

- **不可凭空编造监管内容**:中国会计/监管细则错误会带来实务风险,`cn-*` 内容必须基于用户提供的权威素材,本轮仅骨架。
- **品牌子串误伤**:opus/sonnet 子串匹配,须逐一甄别。
- **第三方依赖**:fin-core 的 Excel/PPT 技能依赖 python 库(requirements.txt),需在文案标注环境要求;上游 MCP 数据源本轮不纳入。
- **合规取向**:金融建模/估值输出保留"人审签字、不自动执行"语义,勿弱化。
- **与第一份审计协同**:`finance` 为新增分类,纳入"22→8 归并"总盘子统一管理。

---

## 八、本轮产出小结

- ✅ 已拉取上游到 `vendor/anthropics-financial-services/` 并 gitignore 隔离。
- ✅ 已完成清单 / 健康度 / 契合度审计。
- ✅ 已锁定 5 项决策:**只做中国版 `crabfin-cn`**,容器范式,fin-core 底座 + 6 中国子板块,finance 分类。
- ✅ 已出分阶段实施蓝图(fin-core 实建 / 中国子板块骨架待素材)。
- ⏸️ **未做任何代码/插件改造**(按"先讲文档完善,不要实施")。下一步:用户确认本方案后再进入阶段 1 骨架搭建。

---

# 附录(可直接执行的完整规格)

> 以下为"能在文档层定死的全部内容",执行阶段直接据此落地,无需再做设计决策。

## 附录 A —— `fin-core` 技能清单(本轮实建,12 个通用技能)

来源:上游 `financial-analysis`(13 个,**剔除 `skill-creator`** —— 本仓已有同名 `skill-creator` 插件,避免重复)。正文方法论全球通用,可直接改造;正文保留英文,仅展示字段中文化。

| 子目录(改造后) | 上游来源 | 作用 | 改造动作 |
|---|---|---|---|
| `dcf-model` | dcf-model | DCF 估值建模(含 `scripts/validate_dcf.py`、`requirements.txt`、`TROUBLESHOOTING.md`) | 品牌清洗 |
| `lbo-model` | lbo-model | LBO 杠杆收购模型 | 品牌清洗(1 处命中) |
| `comps-analysis` | comps-analysis | 可比公司分析 | 品牌清洗(1 处命中) |
| `three-statement-model` | 3-statement-model | 三表联动模型(IS/BS/CF) | 重命名(数字开头→英文词)+ 品牌清洗 |
| `competitive-analysis` | competitive-analysis | 竞品格局分析 deck | 品牌清洗 |
| `xlsx-author` | xlsx-author | 无头生成 .xlsx | 品牌清洗 |
| `pptx-author` | pptx-author | 无头生成 .pptx | 品牌清洗 |
| `ppt-template-creator` | ppt-template-creator | 从模板生成 PPT 技能 | 品牌清洗 |
| `deck-refresh` | deck-refresh | 演示数据刷新(季度/财报/comps roll) | 品牌清洗 |
| `audit-xls` | audit-xls | 电子表格公式审计 | 品牌清洗 |
| `clean-data-xls` | clean-data-xls | 表格脏数据清洗 | 品牌清洗 |
| `ib-check-deck` | ib-check-deck | 投行 deck 质量检查(含 `scripts/extract_numbers.py`) | 品牌清洗 |

> 注:`3-statement-model` 以数字开头,部分校验/技能发现机制对目录名敏感,建议改造时统一为 `three-statement-model`(展示名仍用"三表模型")。

---

## 附录 B —— plugin.json 草案(fin-core + 6 子板块)

**`plugins/crabfin-cn/fin-core/.crabcode-plugin/plugin.json`**(模式 A,skills[] 全列)
```json
{
  "name": "crabfin-core",
  "version": "0.1.0",
  "description": "Universal financial modeling foundation for CrabFin-CN: DCF, LBO, 3-statement, comps, competitive analysis, and headless Excel/PowerPoint authoring with deck QC.",
  "author": { "name": "CrabFin" },
  "license": "Apache-2.0",
  "keywords": ["finance","valuation","dcf","lbo","comps","3-statement","xlsx","pptx","modeling"],
  "skills": [
    "./skills/dcf-model",
    "./skills/lbo-model",
    "./skills/comps-analysis",
    "./skills/three-statement-model",
    "./skills/competitive-analysis",
    "./skills/xlsx-author",
    "./skills/pptx-author",
    "./skills/ppt-template-creator",
    "./skills/deck-refresh",
    "./skills/audit-xls",
    "./skills/clean-data-xls",
    "./skills/ib-check-deck"
  ]
}
```

**6 个子板块**(本轮仅骨架,统一带齐 license/keywords —— 修正 crablaw-cn 缺字段的旧问题):

| 目录 | name | description(英文,plugin.json) | keywords |
|---|---|---|---|
| `cn-equity-research` | `crabfin-cn-equity-research` | China equity research: A-share/HK earnings analysis, initiating coverage, model updates, morning notes (pending CN disclosure & CAS materials). | finance, equity-research, a-share, cas |
| `cn-investment-banking` | `crabfin-cn-investment-banking` | China IB & M&A: teasers, CIMs, merger models, deal tracking (pending CSRC restructuring/tender rules). | finance, investment-banking, m&a, csrc |
| `cn-private-equity` | `crabfin-cn-private-equity` | China private equity: sourcing, screening, diligence, IC memos, portfolio monitoring (pending AMAC filing norms). | finance, private-equity, diligence, amac |
| `cn-wealth` | `crabfin-cn-wealth` | China wealth management: client reviews, financial plans, rebalancing (pending new asset-management rules). | finance, wealth, planning, rebalance |
| `cn-fund-admin` | `crabfin-cn-fund-admin` | China fund administration: GL recon, accruals, roll-forwards, NAV tie-out (pending AMAC valuation guidance). | finance, fund-admin, nav, valuation |
| `cn-kyc-ops` | `crabfin-cn-kyc-ops` | China KYC & operations: document parsing, rules grid (pending AML/real-name/UBO rules). | finance, kyc, aml, operations |

每个子板块骨架内含:`.crabcode-plugin/plugin.json` + `PRACTICE.md`(标注"⏸️ 待补充中国监管内容")+ `schemas/`(占位)。

---

## 附录 C —— marketplace.json 条目草案(7 条,category=finance,展示字段中文)

```jsonc
// 1) 底座/主工作流(推荐先装)
{
  "name": "crabfin-core",
  "source": "./plugins/crabfin-cn/fin-core",
  "version": "0.1.0",
  "displayName": "CrabFin 财务建模底座",
  "shortDescription": "通用财务建模主工作流:DCF、LBO、三表模型、可比公司,以及 Excel/PPT 自动生成与 deck 质检",
  "longDescription": "CrabFin-CN 的底座工作流,提供全球通用的财务建模能力:DCF 估值、LBO、三表联动、可比公司与竞品分析,配合无头 Excel/PowerPoint 生成与投行 deck 质量检查。先装此底座,再按需带入中国领域子板块。",
  "defaultPrompt": ["帮我搭一个 DCF 估值模型","对这份财务模型做公式审计","把这组可比公司做成对比表"],
  "brandColor": "#0ea5e9",
  "description": "Universal financial modeling foundation: DCF, LBO, 3-statement, comps, and headless Excel/PPT authoring.",
  "category": "finance",
  "tags": ["valuation","dcf","lbo","comps","modeling","excel"]
}
// 2) cn-equity-research —— 中国股票研究(骨架)
{ "name":"crabfin-cn-equity-research","source":"./plugins/crabfin-cn/cn-equity-research","version":"0.1.0",
  "displayName":"中国股票研究","shortDescription":"A股/港股研究子板块:财报分析、首次覆盖、模型更新、晨报(待补监管素材)",
  "longDescription":"面向 A股/港股的卖方/买方研究子板块。骨架已就位,深度内容(企业会计准则、信息披露规则、估值惯例)待补充。","defaultPrompt":["分析这家A股公司的最新财报","为这只股票起草首次覆盖报告"],
  "brandColor":"#0ea5e9","description":"China equity research skills (scaffold; pending CN disclosure & CAS materials).","category":"finance","tags":["equity-research","a-share","earnings"] }
// 3) cn-investment-banking —— 中国投行并购(骨架)
{ "name":"crabfin-cn-investment-banking","source":"./plugins/crabfin-cn/cn-investment-banking","version":"0.1.0",
  "displayName":"中国投行并购","shortDescription":"中国投行与并购子板块:teaser、CIM、并购模型、交易跟踪(待补监管素材)",
  "longDescription":"面向中国市场的投行与并购子板块。骨架已就位,深度内容(重组管理办法、要约收购规则)待补充。","defaultPrompt":["为这单交易起草 teaser","搭一个并购对价测算模型"],
  "brandColor":"#0ea5e9","description":"China IB & M&A skills (scaffold; pending CSRC rules).","category":"finance","tags":["investment-banking","m&a","csrc"] }
// 4) cn-private-equity —— 中国私募股权(骨架)
{ "name":"crabfin-cn-private-equity","source":"./plugins/crabfin-cn/cn-private-equity","version":"0.1.0",
  "displayName":"中国私募股权","shortDescription":"私募股权子板块:项目搜寻、筛选、尽调、IC备忘、组合监控(待补监管素材)",
  "longDescription":"面向中国市场的私募股权子板块。骨架已就位,深度内容(基金业协会备案、尽调口径)待补充。","defaultPrompt":["生成一份尽调清单","为这个标的写 IC 备忘录"],
  "brandColor":"#0ea5e9","description":"China PE skills (scaffold; pending AMAC norms).","category":"finance","tags":["private-equity","diligence","amac"] }
// 5) cn-wealth —— 中国财富管理(骨架)
{ "name":"crabfin-cn-wealth","source":"./plugins/crabfin-cn/cn-wealth","version":"0.1.0",
  "displayName":"中国财富管理","shortDescription":"财富管理子板块:客户回顾、理财规划、组合再平衡(待补监管素材)",
  "longDescription":"面向中国市场的财富管理子板块。骨架已就位,深度内容(资管新规、理财规则)待补充。","defaultPrompt":["为客户做一份组合回顾","起草一份理财规划方案"],
  "brandColor":"#0ea5e9","description":"China wealth management skills (scaffold; pending new AM rules).","category":"finance","tags":["wealth","planning","rebalance"] }
// 6) cn-fund-admin —— 中国基金行政(骨架)
{ "name":"crabfin-cn-fund-admin","source":"./plugins/crabfin-cn/cn-fund-admin","version":"0.1.0",
  "displayName":"中国基金行政","shortDescription":"基金行政子板块:总账对账、计提、滚存、NAV 勾稽(待补监管素材)",
  "longDescription":"面向中国市场的基金行政与估值子板块。骨架已就位,深度内容(中基协估值指引)待补充。","defaultPrompt":["对这期 NAV 做勾稽核对","排一张计提表"],
  "brandColor":"#0ea5e9","description":"China fund admin skills (scaffold; pending AMAC valuation guidance).","category":"finance","tags":["fund-admin","nav","valuation"] }
// 7) cn-kyc-ops —— 中国KYC与运营(骨架)
{ "name":"crabfin-cn-kyc-ops","source":"./plugins/crabfin-cn/cn-kyc-ops","version":"0.1.0",
  "displayName":"中国KYC与运营","shortDescription":"KYC 与运营子板块:开户文档解析、规则栅格评估(待补监管素材)",
  "longDescription":"面向中国市场的 KYC 与运营子板块。骨架已就位,深度内容(反洗钱、实名、受益所有人识别)待补充。","defaultPrompt":["解析这份开户材料并校验","按规则栅格做 KYC 缺口检查"],
  "brandColor":"#0ea5e9","description":"China KYC & ops skills (scaffold; pending AML/UBO rules).","category":"finance","tags":["kyc","aml","operations"] }
```

---

## 附录 D —— 各子板块技能映射 + 待补素材清单(用户提供后即可充实)

| 子板块 | 上游参考技能(可作结构样板) | 需用户提供的中国权威素材 |
|---|---|---|
| **cn-equity-research** | catalyst-calendar, earnings-analysis, earnings-preview, idea-generation, initiating-coverage, model-update, morning-note, sector-overview, thesis-tracker | 企业会计准则(CAS)科目映射、交易所信息披露规则、A股/港股估值惯例与行业基准 |
| **cn-investment-banking** | buyer-list, cim-builder, datapack-builder, deal-tracker, merger-model, pitch-deck, process-letter, strip-profile, teaser | 《上市公司重大资产重组管理办法》、要约收购规则、反垄断申报口径 |
| **cn-private-equity** | ai-readiness, dd-checklist, dd-meeting-prep, deal-screening, deal-sourcing, ic-memo, portfolio-monitoring, returns-analysis, unit-economics, value-creation-plan | 基金业协会(AMAC)备案要求、私募尽调口径、对赌/回购条款惯例 |
| **cn-wealth** | client-report, client-review, financial-plan, investment-proposal, portfolio-rebalance, tax-loss-harvesting | 资管新规、理财产品销售规则、个人所得税与税务筹划口径 |
| **cn-fund-admin** | accrual-schedule, break-trace, gl-recon, nav-tieout, roll-forward, variance-commentary | 中基协估值指引、基金会计核算规则、份额登记规则 |
| **cn-kyc-ops** | kyc-doc-parse, kyc-rules | 《反洗钱法》、客户身份识别/实名制、受益所有人识别规则 |

> 上游对应技能仅作"结构与流程样板",**内容须以中国素材重写**,不可照搬美国规则。

---

## 附录 E —— 品牌清洗替换表(brandGuard 禁词)

| 原词 | 替换为 | 备注 |
|---|---|---|
| Claude / claude | CrabCode | 产品名 |
| Claude Code / claude-code | CrabCode | |
| Anthropic / anthropic / @anthropic | CrabCode | author 一并改 `CrabFin` |
| `.claude-plugin` | `.crabcode-plugin` | 目录约定 |
| sonnet / opus / haiku | 删除或改中性表述 | ⚠️ `opus` 子串会误中 `corpus`/`opus` 普通词,**逐处人工甄别**,不可全局替换 |
| codex / `.codex` | 删除 | fin-core 通用技能命中应为 0,以扫描为准 |

**保留(非品牌违规,客观第三方产品名)**:FactSet、Bloomberg、Morningstar、PitchBook、S&P Global、LSEG、Moody's、Daloopa、Egnyte、Box、SEC、Excel、PowerPoint。

校验:`bun run lint:brand plugins/crabfin-cn`(只扫目标目录,绕开未忽略的 `vendor/`)。

---

## 附录 F —— `docs/legal/THIRD_PARTY_NOTICES.md` 追加署名草案

```
## CrabFin-CN finance suite

Portions of plugins/crabfin-cn/fin-core/ are derived from
anthropics/financial-services (https://github.com/anthropics/financial-services),
licensed under the Apache License, Version 2.0.
Modifications: rebranded to CrabCode/CrabFin, localized display copy to Chinese,
restructured into the CrabFin-CN container layout. Original NOTICE retained.
```

> `docs/legal/` 已在 `.gitignore` 与 brandGuard 忽略列表中,署名(含上游名)放此处符合 `CRABCODE.md` 规定。
