# CrabLaw-CN 全板块中国法化 — 实施方案存档

> 本文件为**自包含执行依据**。压缩上下文后,仅凭本文件即可恢复并继续执行。

## 0. 元信息

- 文档日期:2026-06-21
- 工作仓库:`/Users/fushihua/Desktop/CrabCode-Plugin`
- 源参考仓库:`/Users/fushihua/Desktop/CrabLaw`(其 `_legacy/claude-for-legal` 为 Anthropic 原始开源美国法套件)
- 当前分支:`task/crabfin-cn-regverify-20260621`
- 当前状态:**第一阶段已完成(4 板块迁移)**;**全板块中国法化方案已定稿、偏离点已拍板,等待开始批次 0**
- 重要约束:本仓库 `src/policy/layoutValidator.ts` 递归校验 `plugins/` 下**每个路径段**,不得含 `claude`/`anthropic`/`.claude`/`claude-code`(否则 error);`crablaw-cn`、`crabfin-cn` 在 `APPROVED_NESTED_FAMILIES` 允许嵌套伞装。

---

## 1. 原始需求(原话保留)

### 1.1 初始需求(已完成)
> "~/Desktop/CrabLaw目录下的法律插件已经改造优化完成，本仓库内的法律插件清移除，将 ~/Desktop/CrabLaw中的插件在复制过来，目录结果要清晰，不要乱放，主插件包+子板块的伞装，同时子板块也可在下游插件加载。"

### 1.2 追加需求(本方案的来源)
> "/Users/fushihua/Desktop/CrabLaw/_legacy/claude-for-legal目录下是你claude开源的法律插件源码，不应该只有这4类吧？"

经核对:`_legacy` 是改造**前**的原始开源套件(13 个插件),CrabLaw 上游**有意**只重构了 4 个中国法板块作为 MVP,其余隔离在 `_legacy` 不作入口。用户据此决策:**剩余全部板块也要中国法化**。

### 1.3 存档要求
> "详细的实施方案存档，原始需求也要写入，我要压缩上下文后在执行"

### 1.4 执行须遵循的工作框架(用户指定,执行时强制遵循)

**第一阶段:根因审计(不得跳过)** — 以严苛评审官视角挖结构性根因。逐条输出:1)问题描述 2)根因(非症状) 3)影响面/受影响关联方 4)是否症状级修复(若是补丁,指明何处何条件复发) 5)同类变体(是否在其他模块重复)。须回答:(1)是否架构偏差 (2)是否过度工程 (3)是否遗漏同类问题或低估关联方影响。

**第二阶段:具体细化方案规划** — 给根因修复方案;"快速 vs 根因"分歧默认选根因;仅当根因成本显著超范围才选快速并写明理由/风险/复发点。**根因判定硬标准**:必须能回答"为何此改动让问题不再复发",并写出反证(若非根因会在何处复发);答不出=未找到根因,不得进入实施。方案输出:改动清单 + 串行步骤 + 每步验证方式 + 影响的关联方。

**第三阶段:偏离判断(分层)** — 技术细节自主决断;架构偏离/范围变更/新依赖须先写【偏离点/原因/影响面/与原始需求一致性论证】再做;自行调研出的根因若超原始范围,按偏离流程处理,绝不静默扩大。

**子任务派发(subagent)** — 子任务 ≥3 文件、或可独立验证、或显著耗主上下文 → 派 subagent;否则主控直接做。派发提示词须含:目标/输入路径/约束边界/验收标准/产出格式/禁止触碰范围/**git 操作一律主控负责**。subagent 返回后**不得直接采信**,主控独立重核(从原始需求重新推导验收,不从其结论倒推),不通过则打回或主控接手。

---

## 2. 背景与已完成工作

### 2.1 第一阶段已完成(4 板块迁移)
- 删除旧 `plugins/crablaw-cn/`,从 `/Users/fushihua/Desktop/CrabLaw` 复制改造后成品 4 板块(66 文件,排除 node_modules/_legacy/scripts/docs/.DS_Store 等脚手架)。
- 伞装结构对齐 `crabfin-cn`:主插件包 `matter-core` + 子板块 `cn-contract`/`cn-data-compliance`/`cn-labor-employment`,各自带 `.crabcode-plugin/plugin.json`,由根 `.crabcode-plugin/marketplace.json` 统一注册,子板块可下游单独加载。
- 4 个 `plugin.json` 补全 `license`(Apache-2.0)/`keywords`/`skills`,对齐 crabfin-cn 范式,清除 manifest warning。
- 校验:`validate-all` 全过;`bun test` 33 pass / 0 fail。
- **Git 状态:上述更改尚未 commit**(本方案文档亦未 commit)。提交由主控在批次推进时统一负责。

### 2.2 `_legacy` 原始套件构成(13 插件,改造前美国法)
12 个 Anthropic 板块 + 1 个 Thomson Reuters 外部插件 `cocounsel-legal`(已隔离,不纳入)。其中已被 CrabLaw MVP 重构的:`commercial-legal`→cn-contract、`privacy-legal`→cn-data-compliance、`employment-legal`→cn-labor-employment、各板块公共件→matter-core。

---

## 3. 当前仓库法律插件现状(已上线)

`plugins/crablaw-cn/` 伞装,4 插件 / 22 skill:
- **matter-core**(底座,7 skill):new-client / new-matter / conflict-check / review-queue / matter-archive / compliance-deadline-watcher / matter-deep-analysis;+ 3 尽调智能体(diligence-reader/analyzer/writer);schema 9 张(client/matter/conflict-check/parties/permissions/review-queue/source-record/compliance-deadline/diligence-finding);references/cn-currency-watch.md;examples(demo-cn/demo-cn-active/demo-cn-hit)。
- **cn-contract**(5):review / nda-review / clause-redraft / risk-summary / cold-start-interview
- **cn-data-compliance**(5):data-activity-triage / data-processing-review / privacy-policy-review / pia-generation / cross-border-transfer-check
- **cn-labor-employment**(5):employment-contract-review / termination-risk-review / non-compete-review / employee-handbook-review / labor-dispute-summary

强约束:领域插件须先经 matter-core 三步(建客户→建事务→过冲突筛查)才进实质工作;统一红线 `【AI 辅助草稿，需律师复核】`,不对外发送/签署/报送,不接境外库。

---

## 4. 根因审计

### 根因 1:把本任务当"复制文件",实质是"内容重写"
- **问题**:剩余 9 板块在 `_legacy`,直觉是复制进 `plugins/` 改改。
- **根因(非症状)**:`_legacy` 是美国法成品,正文绑定英美法默认、`.mcp.json` 绑定境外 SaaS(Westlaw/CourtListener/DocuSign/Ironclad/iManage)、含旧品牌与 Claude loader。CrabLaw 架构原则白纸黑字:"**不复制,只参考结构**"(`/Users/fushihua/Desktop/CrabLaw/docs/migration/component-matrix.md`)。
- **影响面**:全体下游使用者(拿到美国法草稿)、合规红线、本仓库 `validate-all`(品牌/布局/manifest)、律师复核可信度。
- **症状级判定**:复制=症状级。**复发点**:每个被复制板块都会重新带入美国法实体规则、境外连接器、含 `claude/anthropic` 的路径段(后者被 layoutValidator 直接判 error)。
- **同类变体**:9 板块 100% 重复。

### 根因 2:三个板块无中国法对应,"中国法化"语义不成立
- **问题**:`law-student`/`legal-clinic`/`legal-builder-hub` 不能直译。
- **根因**:law-student 绑定美国 JD/Bar/IRAC/Socratic;legal-clinic 明确 "built within ABA Formal Op. 512";builder-hub 是插件管理元工具,非法律实务。
- **影响面**:范围定义与命名;不先定义→子代理无验收基准。
- **症状级判定**:不定义即开做=症状级,交付返工。
- **结论**:架构偏离点,已由用户拍板(见第 5 节)。

### 根因 3:底座(matter-core)契约可能不足 → 架构碎裂风险
- **问题**:现有 9 schema 面向通用 matter + 合同/数据/劳动;诉讼需"法院/对方/送达/期限",IP 需"注册号/续展日",监管需"reg-feed/policy 库"。
- **根因**:若各板块自造 schema 与 gate,底座沦为空壳,一致性崩溃。
- **影响面**:全板块数据契约一致性、跨板块复核队列、归档。
- **症状级判定**:各板块自造=症状级,复发于跨板块协同/统一审计。
- **同类变体**:诉讼/IP/监管/AI治理均触发。

### 审计三问
1. **架构偏差**:是 — "复制 vs 参考重写"方向偏差;底座缺口结构偏差。
2. **过度工程**:9 板块 85 skill 一次性全量=过度;必须分批。
3. **遗漏关联方**:易漏 — 根 `marketplace.json` 注册、`CRABCODE.md`/README、本仓库 `tests/`、布局校验、律师复核 gate、`.mcp.json` 连接器风险。

---

## 5. 已确认决策(用户拍板,不可静默更改)

| # | 偏离点 | 决策 |
|---|---|---|
| A | law-student / legal-clinic | **语义重建为中国版**:`cn-legal-study`(法考/法硕)、`cn-legal-aid`(法律援助),按中国语境重写,非翻译 |
| B | legal-builder-hub | **纳入**,去美国法化为通用元工具(保留命名 `builder-hub`) |
| C | matter-core 底座 | **先扩展底座(批次 0)**,公共字段上提,杜绝各板块自造 schema |

---

## 6. 最终范围与批次计划(9 新板块,统一进 `plugins/crablaw-cn/`)

| 批次 | 板块 | 中国法定位 | 实质 skill 数 |
|---|---|---|---|
| **0** | matter-core 底座扩展 | 新增公共 schema | — |
| **1** | cn-corporate / cn-litigation | 公司治理与并购 / 民商事诉讼 | 10 / 16 |
| **2** | cn-ip / cn-regulatory / cn-ai-governance / cn-product | 知识产权 / 行政监管合规 / 生成式AI合规 / 产品营销合规 | 9 / 6 / 7 / 4 |
| **3** | cn-legal-aid / cn-legal-study / builder-hub | 法律援助 / 法考法硕 / 元工具(去美国法化) | ~14 / ~11 / 8 |

### 命名映射(kebab-case,无 claude/anthropic)
- corporate-legal → **cn-corporate**
- litigation-legal → **cn-litigation**
- ip-legal → **cn-ip**
- regulatory-legal → **cn-regulatory**
- product-legal → **cn-product**
- ai-governance-legal → **cn-ai-governance**
- legal-clinic → **cn-legal-aid**(语义重建)
- law-student → **cn-legal-study**(语义重建)
- legal-builder-hub → **builder-hub**(去美国法化纳入)

### 各板块 `_legacy` 实质 skill 清单(剔除公共脚手架 cold-start-interview/customize/matter-workspace;仅作**结构参考**,禁止复制正文)
- **corporate-legal(10)**:ai-tool-handoff, board-minutes, closing-checklist, deal-team-summary, diligence-issue-extraction, entity-compliance, integration-management, material-contract-schedule, tabular-review, written-consent
- **litigation-legal(16)**:brief-section-drafter, chronology, claim-chart, demand-draft, demand-intake, demand-received, deposition-prep, legal-hold, matter-briefing, matter-close, matter-intake, matter-update, oc-status, portfolio-status, privilege-log-review, subpoena-triage
- **ip-legal(9)**:cease-desist, clearance, fto-triage, infringement-triage, invention-intake, ip-clause-review, oss-review, portfolio, takedown
- **regulatory-legal(6)**:comments, gap-surfacer, gaps, policy-diff, policy-redraft, reg-feed-watcher
- **product-legal(4)**:feature-risk-assessment, is-this-a-problem, launch-review, marketing-claims-review
- **ai-governance-legal(7)**:ai-inventory, aia-generation, policy-monitor, policy-starter, reg-gap-analysis, use-case-triage, vendor-ai-review
- **legal-clinic(14)**:build-guide, client-comms-log, client-intake, client-letter, deadlines, draft, form-generation, memo, plain-language-letters, ramp, research-start, semester-handoff, status, supervisor-review-queue
- **law-student(11)**:bar-prep-questions, case-brief, cold-call-prep, exam-forecast, flashcards, irac-practice, legal-writing, outline-builder, session, socratic-drill, study-plan
- **legal-builder-hub(8)**:auto-updater, disable, registry-browser, related-skills-surfacer, skill-installer, skill-manager, skills-qa, uninstall

> 注:重定义板块(cn-legal-aid/cn-legal-study)的 skill 集应按中国语境**重新设计**,不强制 1:1 对应上表。

---

## 7. 批次 0:底座扩展缺口(初步假设,批次 0 首步须验证/修正)

| 需求来源 | 处理 |
|---|---|
| 诉讼:法院/仲裁机构、案号、当事人、诉请、保全、送达 | **新增 `litigation-matter.schema.json`** 上提 matter-core |
| IP:商标/专利/著作权/域名、注册号、权利人、许可 | **新增 `ip-asset.schema.json`** |
| 监管:监管源订阅、政策库、规则 diff | **新增 `reg-watch.schema.json`** |
| AI 治理:用例登记、影响评估 | **新增 `ai-usecase.schema.json`** |
| 各类期限(举证/开庭/续展/征询) | **复用** `compliance-deadline.schema.json` |
| 尽调发现(并购/诉讼) | **复用** `diligence-finding.schema.json` |
| 主体/当事人/客户 | **复用** `client/parties/permissions` |
| 学习类(cn-legal-study) | 教育场景,**评估是否豁免 Matter Gate**(偏离点,批次 3 前确认) |

**批次 0 首个交付物**:逐板块字段需求矩阵 → 据此确定新增/复用 schema 的最终清单(可能与上表不同,以矩阵分析为准)。

---

## 8. 每板块实施步骤模板(批次 1-3 通用)

1. 建 `plugins/crablaw-cn/cn-XXX/.crabcode-plugin/plugin.json`(name/version/desc/author/license=Apache-2.0/keywords/skills,对齐 crabfin-cn 范式)→ **验证**:`bun run scripts/validate-manifest.ts` 无 warning。
2. 按中国法重写每个 `skills/<name>/SKILL.md`(实体法正文 + 强制引用 matter-core Matter Gate/Stop Codes + 统一红线 `【AI 辅助草稿，需律师复核】`)→ **验证**:人工抽查法条口径;`grep -riE 'U\.S\.C|ABA|州法|Westlaw|CourtListener|DocuSign|Ironclad|iManage|Slack'` 零命中。
3. 子板块所需 schema(批次 0 未上提的板块专属部分)→ **验证**:schema 校验脚本。
4. 根 `.crabcode-plugin/marketplace.json` 注册该板块条目(name/source=`./plugins/crablaw-cn/cn-XXX`/version/description/category/tags)→ **验证**:`bun run scripts/validate-marketplace.ts`。
5. 全量 `bun run scripts/validate-all.ts` + `bun test ./tests/` → **验证**:全绿。
6. **主控提交**(逐批次 commit,信息含批次与板块)。
7. 批次末同步根 `marketplace.json`(若有遗漏)+ `CRABCODE.md` 文档。

---

## 9. 执行机制与子任务派发约束

- **派发判据**:每板块(≥3 文件、可独立验证、显著耗主上下文)→ 派 subagent 起草 SKILL.md。
- **派发提示词必含**:目标 / 输入路径(仅本仓库;**禁止参考 `_legacy` 正文**,仅可参考第 6 节 skill 名作结构线索)/ 中国法约束边界 / 验收标准 / 产出格式 / 禁止触碰范围(不得改 matter-core、不得写 .mcp.json/agents/hooks、不得引入境外连接器)/ **git 操作一律主控负责**。
- **主控重核(不得直接采信子代理)**:从原始需求重新推导验收 —— grep 美国法残留 + 法条口径抽查 + Matter Gate 引用检查 + 布局/品牌校验。不通过即打回或主控接手。

---

## 10. 验收标准与红线

- **布局红线**:`plugins/` 下任何路径段不得含 `claude`/`anthropic`/`.claude`/`claude-code`;板块目录 kebab-case。
- **品牌红线**:正文无旧品牌(Anthropic/Claude for Legal)、无美国法默认、无境外 SaaS 连接器名。
- **合规红线**:全部产物带 `【AI 辅助草稿，需律师复核】`;不对外发送/签署/报送;不接境外法律数据库;领域 skill 强制过 matter-core Matter Gate。
- **门禁**:每板块与每批次 `validate-all` + `bun test` 必须全绿方可提交。

---

## 11. 关联方与同步项(每批次末检查)

下游插件加载者 / 律师复核流程 / 根 `marketplace.json` 注册 / 本仓库 CI(validate-all/test)/ `CRABCODE.md` / README。

---

## 12. 执行待办清单(checklist)

- [ ] 批次 0:matter-core 字段需求矩阵 → 新增/复用 schema 定稿 → 校验 → 提交
- [ ] 批次 1:cn-corporate(10)→ 验收;cn-litigation(16)→ 验收 → 提交
- [ ] 批次 2:cn-ip(9)、cn-regulatory(6)、cn-ai-governance(7)、cn-product(4)→ 逐板块验收 → 提交
- [ ] 批次 3:cn-legal-aid、cn-legal-study(先确认 Matter Gate 豁免)、builder-hub → 验收 → 提交
- [ ] 收尾:根 marketplace 全量复核、CRABCODE.md/README 更新、全量校验、最终提交
- [ ] (待办)第一阶段 4 板块迁移更改 + 本方案文档的首次提交

---

## 13. 恢复执行指引(压缩上下文后从这里继续)

1. 读本文件全文 + `/Users/fushihua/Desktop/CrabLaw/docs/migration/component-matrix.md`(改造架构原则权威依据)。
2. 确认当前进度:查 `plugins/crablaw-cn/` 已有哪些板块、根 `marketplace.json` 已注册哪些、`git log`/`git status`。
3. 从第 12 节 checklist 第一个未完成项继续。
4. 全程遵循第 1.4 节工作框架(根因审计 → 细化方案 → 偏离判断 → subagent 派发与主控重核)。
5. 严守第 9/10 节约束:**禁止复制 `_legacy` 正文**,只参考结构;git 由主控负责;每板块/批次过校验再提交。
