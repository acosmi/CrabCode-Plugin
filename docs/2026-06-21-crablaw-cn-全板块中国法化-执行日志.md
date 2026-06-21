# CrabLaw-CN 全板块中国法化 — 执行日志

> 配套背景文档:`docs/2026-06-21-crablaw-cn-全板块中国法化-实施方案存档.md`(唯一目标基准)。
> 本日志记录主控的判断依据、前置审计、偏离论证、验证输出。按批次追加。
> 任务分支:`task/crablaw-cn-localize-all-20260621`(从 `main` 切出,工作区原本干净)。

---

## 批次 0:matter-core 底座扩展

### 一、前置审计(主控独立核实,不照搬背景文档第 4 节)

对照背景文档第 7 节的 schema 假设,主控通读底座基础设施后,实证发现 4 个结构性事实:

**事实 A — Matter Gate 无自动化强制(底座契约文本偏差)**
- 问题:`matter-core/PRACTICE.md` 第 7 行自称「每个非 intake skill 由 `scripts/lint-tool-scope.ts` 强制要求含 `## Matter Gate` 段」。
- 根因:该脚本在本仓库**不存在**(`ls scripts/` 无此文件;`grep "Matter Gate" --include=*.ts` 全仓零命中)。`validate-all.ts` 只串联 brand / manifest / marketplace / layout 四个校验器。该句系从上游 CrabLaw 继承、在本仓库不成立。
- 影响面:新板块 SKILL.md 的 Matter Gate 段**无 CI 兜底**,只能靠主控 grep 验收;PRACTICE.md 正文存在一处失实自述。
- 是否症状级:若新板块照搬「依赖 lint 强制」的预期 → 会在验收时误以为有自动保护而漏检。复发点:任何后续板块若不写 Matter Gate 段,CI 不会报错。
- 同类变体:背景文档第 8 节步骤 2 写「验证:Matter Gate 引用检查」——须明确为**主控人工 grep**,非脚本。
- 处置:批次 0 **不静默改 PRACTICE.md 正文**(改底座契约属架构边界,需独立论证)。验收改为主控 grep `## Matter Gate`。失实自述单独记为已知缺陷,留待用户决定是否补脚本(见「偏离与已知缺陷」)。

**事实 B / D — schema 无机器消费者**
- 问题:背景文档第 8 节称有「schema 校验脚本」。
- 根因:`tests/` 仅 layout/manifest/marketplace 三个 validator 测试 + analysis 测试;`grep schema tests/` 零命中;validate-all 不校验 schema 内容。schema 文件是**数据契约设计资产**(供 SKILL.md/尽调智能体引用),无运行时/CI 消费者。
- 影响面:新增 schema 不需要也无法配 schema 单元测试;但其**文件名与正文内容仍受 brand+layout 校验**(不得含 claude/anthropic/旧品牌)。
- 是否症状级:若批次 0 预造一堆无板块引用的 schema → 死文件(过度工程)。复发点:每个无 SKILL.md 引用的 schema。
- 处置(根因级):批次 0 **只造有 ≥2 个下游板块复用论证**的 schema;板块专属、单板块用的小对象留给该板块自带,不上提底座。

**事实 C — matterType enum 缺类型(实证缺口,背景文档第 7 节未列)**
- 问题:`matter.schema.json` 的 `matterType` enum 缺 `regulatory`/`product`/`legal-aid`。
- 根因:enum 在 4 板块 MVP 时定稿,未前瞻后续板块。`additionalProperties:false` + enum 封闭 → 这三类 matter 只能落 `other`,丧失类型路由与统一审计能力。
- 影响面:cn-regulatory / cn-product / cn-legal-aid 三板块的 matter 归类。
- 是否症状级:落 `other` 是症状级回避。复发点:跨板块复核队列/归档按 matterType 分类时,这三类不可辨识。
- 处置(根因级):批次 0 补 enum。

### 二、审计三问

1. **架构偏差**:有但已被背景文档第 5 节决策 C 覆盖(先扩底座)。新增偏差仅事实 A(底座自述失实),按保守处置不动正文。
2. **过度工程**:风险点在事实 D。已用「≥2 板块复用」硬门槛遏制——deal/entity 等单板块对象不上提。
3. **遗漏同类/低估关联方**:关联方已识别——根 marketplace.json、brand/layout 校验、SKILL.md 引用方、尽调智能体。schema 改动**不影响**现有 4 板块(纯增量:enum 加值不破坏既有实例;新增文件无人引用即中性)。

### 三、字段需求矩阵(9 板块核心数据对象 → schema 决策)

| 板块 | 核心数据对象 | 复用现有 | 需新增底座 schema |
|---|---|---|---|
| cn-corporate | 主体登记、并购 deal、尽调发现 | parties / compliance-deadline / diligence-finding | 否(deal/entity 单板块用,留板块内) |
| cn-litigation | **诉讼/仲裁案件**(机构/案号/诉讼地位/审级) | parties / compliance-deadline(litigation-deadline)/ diligence-finding | **litigation-matter** |
| cn-ip | **IP 资产**(类型/注册号/权利人/有效期) | compliance-deadline(license-renewal)/ diligence-finding | **ip-asset** |
| cn-regulatory | **政策/法规条目**(机关/文号/效力层级) | compliance-deadline(regulatory-filing) | **reg-policy** |
| cn-ai-governance | **AI 用例登记**(风险/数据/备案) + 政策监控 | diligence-finding / reg-policy(复用) | **ai-usecase** |
| cn-product | 功能/营销主张风险评估 | matter + diligence-finding | 否(仅补 matterType=product) |
| cn-legal-aid | 受援人/援助事项/期限/督导队列 | client / matter / compliance-deadline / review-queue | 否(仅补 matterType=legal-aid) |
| cn-legal-study | 学习计划/真题/知识点(教育场景) | —(批次 3 确认豁免 Matter Gate,不入 matter 体系) | 否 |
| builder-hub | 插件元数据(非法律实务) | —(不入 matter 体系) | 否 |

**4 个新增 schema 的「≥2 板块复用」论证**:
- `litigation-matter`:cn-litigation(主)+ cn-corporate(并购争议解决)+ cn-ip(侵权诉讼)引用。
- `ip-asset`:cn-ip(主)+ cn-corporate(并购 IP 尽调)+ cn-product(产品 IP 风险)引用。
- `reg-policy`:cn-regulatory(主)+ cn-ai-governance(policy-monitor)引用。
- `ai-usecase`:cn-ai-governance(主)+ cn-product(产品 AI 功能)+ cn-corporate(供应商 AI 评估)引用。

均满足门槛 → 上提底座成立,非过度工程。

### 四、批次 0 终稿(改动清单)

1. `matter.schema.json`:`matterType` enum 增补 `regulatory`、`product`、`legal-aid`(事实 C 根因修复)。
2. 新增 `litigation-matter.schema.json`、`ip-asset.schema.json`、`reg-policy.schema.json`、`ai-usecase.schema.json`,全部对齐现有 schema 范式(draft 2020-12 / `$id` crablaw.local / matterId 关联 / citationTag 三值枚举 + sourceRef 条件必填 / date pattern / severity 四值 / `additionalProperties:false` / allOf 条件约束),字段语义全部 PRC 化。

**根因判定反证**:若上述非根因 ——(C)matterType 仍会在跨板块复核队列按类型分类时让 regulatory/product/legal-aid 三类不可辨识;(矩阵)若不先上提共享 schema,批次 1-3 各板块会自造诉讼/IP/政策对象,在统一审计与复核队列处字段不一致复发。补 enum + 上提 4 schema 后,该两类复发路径被消除。

### 五、偏离与已知缺陷

- **偏离(技术细节级)**:背景文档第 7 节命名 `reg-watch.schema.json` → 实改为 `reg-policy.schema.json`。理由:核心数据对象是「政策/法规条目」(被 policy-diff/gap/monitor 消费),而 reg-feed 订阅是配置非数据契约;reg-policy 命名更贴合对象。影响面:仅命名,无下游已引用(全新文件)。与原始需求一致(仍是「监管源/政策库」schema)。
- **已知缺陷(不在批次 0 范围,留用户决定)**:PRACTICE.md 自述的 `lint-tool-scope.ts` 不存在 → Matter Gate 无 CI 强制。批次 0 按保守原则不改底座契约正文;是否补该脚本属新增基础设施,需独立论证后再定。

- **偏离(改核心策略 brandGuard.ts,先论证后做)**:
  - 偏离点:`src/policy/brandGuard.ts` 的 `DEFAULT_IGNORES` 增补 `docs/**实施方案*.md`、`docs/**执行日志*.md` 两条;`tests/analysis.test.ts` 加对应回归断言。
  - 原因(根因):验证时 validate-all 与 bun test 失败,命中 `docs/...实施方案存档.md`(c693ea3 pre-existing,上一会话提交方案文档时门禁已红)与本批次新建的执行日志。根因是 brand ignore 仅有英文镜像 `docs/**implementation-plan*.md`,未覆盖本仓库实际使用的中文规划文档命名 → 凡讨论品牌红线的中文规划/日志文档必被误判。
  - 影响面:本仓库 CI(brand 校验/test)。**不放松对产品文件的检查**——`plugins/` 下所有文件仍全检;仅豁免 `docs/` 下「实施方案/执行日志」类记录性文档,与既有 `docs/audit/**`、`docs/huibao/**`、`docs/legal/**`、`implementation-plan` 豁免完全同质。
  - 与原始需求一致性:背景文档第 10 节品牌红线针对「正文/产品」;规划文档合法引用品牌词讨论红线本就应豁免,此修复对齐设计意图,未扩大或收缩实质范围。
  - 反证(根因判定):若非根因,下一份中文规划文档仍会让门禁变红;补中文镜像 ignore 后,该类复发被消除。回归测试锁定该行为防止再退化。
