# CrabFin-CN 素材采集指南

> 本指南告诉你:**6 个中国子板块各需要哪些素材、每份素材是什么形态、放在仓库的哪个路径、怎么命名、怎么交给我**。
> 子板块当前是骨架(⏸️ 状态),通用建模/表格/演示能力已由 `fin-core` 底座提供。本指南只针对**中国市场特定**的内容采集。
>
> 红线:监管/会计口径**不可凭空编造,也不可照搬境外规则**(如美国 TLH、美国披露阈值)。口径错了比缺失更危险。

---

## 一、素材的 4 种形态(分级)

每份素材都归入下面 4 类之一。**给到第 1+2 类,我就能把某个子板块从骨架做成可用技能**;第 3、4 类是提质,可后补。

| 级别 | 形态 | 作用 | 我需要的最小信息 |
|---|---|---|---|
| **L1 法规/规则** | 法规原文、官方答记者问、权威摘要 | 决定口径对不对(硬骨架) | 文件全名 + 出处 + 生效/版本日期 + 关键条文 |
| **L2 口径映射** | 科目对照表、判定标准、阈值表 | 决定技能算得对不对 | 表格(列头清晰)+ 至少几行示例 |
| **L3 模板/范例** | 脱敏的研报、IC 备忘、底稿、披露函 | 决定产出格式像不像中国实务 | 真实结构(数据可脱敏/打码) |
| **L4 基准/惯例** | 估值倍数区间、行业分类、惯例数据 | 锦上添花 | 数据 + 来源 + 截止日期 |

---

## 二、通用存放约定

每个子板块下都已建好一个投放目录 `sources/`,结构统一如下:

```
plugins/crabfin-cn/<板块>/sources/
  README.md        ← 该板块的具体清单(已生成,照着放即可)
  laws/            ← L1 法规/规则原文或权威摘要
  mappings/        ← L2 口径映射表/对照表(.md / .csv / .xlsx 均可)
  templates/       ← L3 脱敏模板/范例
  benchmarks/      ← L4 行业基准/惯例数据(可选)
```

> `laws/ mappings/ templates/ benchmarks/` 这几个子目录**首次使用时你直接新建即可**(空目录 git 不跟踪,所以仓库里暂时只有 `README.md`)。把文件丢进对应目录就行。

**命名规范**(便于我溯源、也便于你日后核对):

```
<类别>_<主题>_<版本或日期>.<扩展名>
```

示例:
- `laws/资管新规_2018-04-27.pdf`
- `laws/重大资产重组管理办法_2023修订要点.md`
- `mappings/CAS科目映射_v1.csv`
- `mappings/适当性匹配矩阵_v1.xlsx`
- `templates/首次覆盖研报_脱敏样例.docx`

---

## 三、6 个子板块各需什么

下面每个板块给出:**定位 → L1+L2 最小起步素材(给了就能动)→ L3+L4 进阶素材 → 投放路径**。

### 1. cn-equity-research(中国股票研究)
A股/港股卖方与买方研究。通用 DCF/可比/三表已在 `fin-core`,本板块只承载中国特定口径。

- **最小起步(L1/L2)**
  - [ ] L2 **CAS 科目 → 财报行项映射表**:企业会计准则科目如何落到利润表/资产负债表/现金流量表行项
  - [ ] L2 **行业分类表**:证监会行业分类 和/或 申万行业分类(代码 + 名称 + 层级)
- **进阶(L3/L4)**
  - [ ] L1 沪深北/港交所信息披露规则要点(定期报告、业绩预告触发条件)
  - [ ] L4 A股/港股估值惯例与行业基准倍数
  - [ ] L3 脱敏研报模板(首次覆盖 / 晨报各一份)
- **投放**:`plugins/crabfin-cn/cn-equity-research/sources/`
- **覆盖技能**:catalyst-calendar / earnings-analysis / earnings-preview / idea-generation / initiating-coverage / model-update / morning-note / sector-overview / thesis-tracker

### 2. cn-investment-banking(中国投行并购)
A股并购重组、要约收购、交易流程。

- **最小起步(L1/L2)**
  - [ ] L1 **《上市公司重大资产重组管理办法》要点**(2023 修订版,重组认定标准、审核流程)
  - [ ] L2 **要约收购 + 权益变动披露阈值表**(5%/20%/30% 等触发点及义务)
- **进阶(L3/L4)**
  - [ ] L1 反垄断经营者集中申报口径(申报标准、不申报后果)
  - [ ] L1 国资交易 / 外资准入相关规则(如涉及)
  - [ ] L3 teaser / CIM 模板(脱敏)
- **投放**:`plugins/crabfin-cn/cn-investment-banking/sources/`
- **覆盖技能**:buyer-list / cim-builder / datapack-builder / deal-tracker / merger-model / pitch-deck / process-letter / strip-profile / teaser

### 3. cn-private-equity(中国私募股权)
私募基金搜寻、尽调、IC、组合监控。

- **最小起步(L1/L2)**
  - [ ] L1 **AMAC 私募基金备案必备事项清单**(中基协登记备案要求)
  - [ ] L2 **合格投资者认定标准**(金额/资产/收入门槛)
- **进阶(L3/L4)**
  - [ ] L2 私募尽职调查必查事项清单
  - [ ] L1 对赌(估值调整)/ 回购条款惯例与可执行性要点
  - [ ] L3 IC 备忘录模板(脱敏)
- **投放**:`plugins/crabfin-cn/cn-private-equity/sources/`
- **覆盖技能**:ai-readiness / dd-checklist / dd-meeting-prep / deal-screening / deal-sourcing / ic-memo / portfolio-monitoring / returns-analysis / unit-economics / value-creation-plan

### 4. cn-wealth(中国财富管理)
客户回顾、理财规划、组合再平衡。

- **最小起步(L1/L2)**
  - [ ] L1 **资管新规核心条款**(关于规范金融机构资产管理业务的指导意见,刚兑/嵌套/期限匹配)
  - [ ] L1 **投资者适当性管理办法要点**(风险等级与产品匹配)
- **进阶(L3/L4)**
  - [ ] L1 理财产品销售管理规则与适当性匹配要求
  - [ ] L2 **中国个人所得税口径** ← 决定 `tax-loss-harvesting` 技能是按中国税制**改写**还是**删除**(美国 TLH 规则不适用)
  - [ ] L3 客户报告 / 投资方案模板(脱敏)
- **投放**:`plugins/crabfin-cn/cn-wealth/sources/`
- **覆盖技能**:client-report / client-review / financial-plan / investment-proposal / portfolio-rebalance / tax-loss-harvesting

### 5. cn-fund-admin(中国基金行政)
总账对账、计提、滚存、NAV 勾稽、估值。

- **最小起步(L1/L2)**
  - [ ] L1 **中基协(AMAC)基金估值指引**
  - [ ] L2 **公允价值估值层级判定标准**(三层级划分 + 流动性受限资产处理)
- **进阶(L3/L4)**
  - [ ] L2 基金会计核算科目体系
  - [ ] L1 基金份额登记与确认规则
  - [ ] L3 NAV 勾稽底稿模板(脱敏)
- **投放**:`plugins/crabfin-cn/cn-fund-admin/sources/`
- **覆盖技能**:accrual-schedule / break-trace / gl-recon / nav-tieout / roll-forward / variance-commentary

### 6. cn-kyc-ops(中国 KYC 与反洗钱)
开户文档解析、KYC 规则评估。

- **最小起步(L1/L2)**
  - [ ] L1 **《反洗钱法》及客户身份识别管理办法要点**
  - [ ] L2 **受益所有人识别规则**(穿透标准、判定阈值)
- **进阶(L3/L4)**
  - [ ] L1 客户尽职调查 / 可疑交易报告口径
  - [ ] L2 开户文档必备字段清单
- **投放**:`plugins/crabfin-cn/cn-kyc-ops/sources/`
- **覆盖技能**:kyc-doc-parse / kyc-rules

---

## 四、怎么把素材交给我(任选一种)

1. **直接放仓库**:按上面路径把 PDF/Word/Excel/Markdown/链接清单丢进对应 `sources/` 子目录,然后告诉我"cn-xxx 素材已就位",我来抽取并写成 SKILL.md。
2. **只给出处清单**:你给法规全名 + 你信任的版本/链接,由我去检索原文再编写——**但我检索的结果必须经你核对后才算数**(监管口径不容我自行拍板)。
3. **贴给我**:直接把文本/表格粘进对话,我落盘到对应 `sources/` 再加工。

---

## 五、建议的推进节奏

**单点突破,先跑通一个再复制方法论。**

推荐从 **cn-equity-research** 起步:它复用 `fin-core` 建模能力最多,只差"CAS 科目映射 + 行业分类"两张表就能立刻可用,投入产出比最高,还能验证整套"骨架 → 可用技能"的流程。

每个板块的转化流程:

```
你投放 L1+L2 素材
  → 我据此重写该板块技能的 SKILL.md(中国口径)
  → 我跑校验:bun run validate / bun test
  → 我把该板块从 ⏸️ 状态切换为可用,更新 PRACTICE.md 与 marketplace 描述
  → 你核对监管口径是否准确
  → 通过后进入下一个板块
```

---

## 六、进度跟踪

| 子板块 | L1 法规 | L2 映射 | 状态 |
|---|---|---|---|
| cn-equity-research | ☐ | ☐ | ⏸️ 骨架 |
| cn-investment-banking | ☐ | ☐ | ⏸️ 骨架 |
| cn-private-equity | ☐ | ☐ | ⏸️ 骨架 |
| cn-wealth | ☐ | ☐ | ⏸️ 骨架 |
| cn-fund-admin | ☐ | ☐ | ⏸️ 骨架 |
| cn-kyc-ops | ☐ | ☐ | ⏸️ 骨架 |

> 我会在每个板块素材到位、技能落地后,把对应行更新为 ✅ 可用。
