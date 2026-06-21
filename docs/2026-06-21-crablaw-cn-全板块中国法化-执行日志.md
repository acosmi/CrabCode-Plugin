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

---

## 批次 1:cn-corporate(10)+ cn-litigation(16)

### 一、skill 集与定位(主控锁定)
- cn-corporate(10):ai-tool-handoff/board-minutes/closing-checklist/deal-team-summary/diligence-issue-extraction/entity-compliance/integration-management/material-contract-schedule/tabular-review/written-consent。
- cn-litigation(16):brief-section-drafter/chronology/claim-chart/demand-draft/demand-intake/demand-received/deposition-prep/legal-hold/matter-briefing/matter-close/matter-intake/matter-update/oc-status/portfolio-status/privilege-log-review/subpoena-triage。
- 两板块属常规中国法化(非语义重建);US-only 概念(deposition/privilege-log/subpoena)映射到中国对应制度并在正文说明,保留 skill 数对齐文档第 6 节,不擅自收缩。

### 二、派发(文档第 9 节)
3 个 subagent 并行起草 SKILL.md:corporate(10)/ litigation 流程组(8)/ litigation 实务组(8)。每个 prompt 含目标/范式文件路径/中国法约束/禁区(不改 matter-core、不写 schema/.mcp.json/agents、禁 _legacy 正文、git 主控负责)/验收/产出格式。subagent 自检不予采信,主控独立重核。

### 三、用户新指令:技能用 skill-creator 深度优化(方法论决策)
- **指令**:用户中途要求「技能要使用 skill-creator 深度优化」。
- **决策(自主判断,属方法变更,先论证)**:skill-creator 完整形态是 draft→test→量化 benchmark→浏览器 viewer 人工反馈→迭代 的重型评测循环。对 26 个法律 SKILL.md 全套跑量化 eval + 人工浏览器 review,(a)违背本任务「自主执行不中途请示」,(b)其自动 grader 判定的是触发率/产物形态,**无法判断中国法条正确性**(须法律重核)。故采纳 skill-creator 中**可自主、对本场景高 ROI 的核心标准**:
  1. **description 深度优化(第一优先级)**:改为 pushy + “what it does AND when to use” 触发格式。agent 产出的 description 多只含 what(如 `Draft or review PRC board minutes...`),缺 when/触发短语 → 易 undertrigger。逐个补「使用场景/用户可能说的话/中文触发词」并适度 pushy。
  2. **渐进式披露**:SKILL.md 控 <500 行、厚法条清单按需下沉 references/。现状 40-45 行精简,**当前非痛点**;skill-creator 明确「keep lean、不为优化而增厚、rigid 结构是 yellow flag」,故不无谓加抽象。
  3. **写作风格**:imperative + 解释 why + 必要处补示例。agent 产出已基本达标,小幅精修。
- **落地**:(a) 主控按上述标准重写批次 1 全部 26 个 description;(b) 将该 description 标准固化进批次 2-3 的 agent 派发模板,从源头产出,避免返工。
- **反证(根因判定)**:若 description 优化非根因,则 skill 在「用户没明说 skill 名/文件类型但实际需要」的场景仍不触发;补 when+pushy 后该 undertrigger 路径关闭。
- **不做**:量化 eval 循环 / 浏览器 viewer / run_loop.py 全自动 description 循环(26 skill × claude -p 成本与时长不可控,且需人工 review)——以主控法条口径重核替代 grader。

### 四、主控重核策略(独立、不爆上下文)
1. 自动化全覆盖:grep 美国法/境外 SaaS/品牌残留;脚本校验每个 SKILL.md 含必备段(frontmatter+红线+Matter Gate 引用+Workflow+Output+Next Steps);validate-all + bun test。
2. 抽样深读法条口径:每板块抽高风险 skill 深读(corporate 已读 board-minutes/diligence-issue-extraction,质量达标;litigation 重点抽 deposition-prep/privilege-log-review/subpoena-triage/brief-section-drafter 等映射风险点)。
3. description 优化时逐个再过 frontmatter,自然全覆盖。

### 五、主控重核结论(独立执行,未采信 subagent 自检)
- **残留 grep(独立全量)**:cn-corporate + cn-litigation 对 `U.S.C/ABA/Delaware/fiduciary/Westlaw/CourtListener/DocuSign/Ironclad/iManage/Slack/claude/anthropic/sonnet/opus/haiku/codex` **零命中**。
- **必备段脚本校验**:26 个 SKILL.md 的 frontmatter + 红线 header + Matter Gate(引用 PRACTICE.md)+ Workflow + Output + Next Steps **缺失计数 0**。
- **抽样深核法条口径**:subpoena-triage(法院依职权/依申请调查取证 + 律师调查令映射,入向/出向、配合义务边界、异议、涉密处理)、deposition-prep(当事人陈述/证人出庭/质证三性、民诉法定证据种类、证人作证规则)、board-minutes、diligence-issue-extraction —— 口径**专业准确**,US-only 概念(deposition/subpoena/privilege log)均在「制度映射说明」语境出现,未作实体规则。

### 六、批次 0 遗漏修复(同类变体,诚实记录)
- **问题**:批次 0 审计三问之三「遗漏同类」我自己中招——补了 `matter.matterType` enum,却漏了 `review-queue.schema.json` 的 `sourcePlugin` enum(同样含板块名的封闭枚举)。两个 litigation subagent 均独立报告此缺口,主控独立核实属实。
- **根因**:含板块名的封闭 enum 散落在多个 schema,批次 0 只排查了 matterType 一处,未系统扫描全部 schema 的板块枚举。
- **修复(根因级)**:(a) `sourcePlugin` enum 一次性补全所有走 matter 体系的板块(cn-corporate/cn-litigation/cn-ip/cn-regulatory/cn-ai-governance/cn-product/cn-legal-aid;cn-legal-study/builder-hub 不入 matter 体系故不加),杜绝批次 2/3 反复改底座;(b) 为批次 1 的 cn-corporate/cn-litigation 补 allOf 分支(sourceSkill 白名单),批次 2/3 板块的分支随各自批次落地时补。
- **反证**:若非根因,批次 2/3 每落一个板块都会再撞 review-queue enum 缺口;一次补全 enum 后该复发路径关闭。已确认全 schema 仅 review-queue 含板块名 enum(其余文件命中均为 `$id` 路径)。

### 七、marketplace 注册
主控已在根 `.crabcode-plugin/marketplace.json` 注册 cn-corporate / cn-litigation 两条目(displayName/中文 short&long description/defaultPrompt/brandColor/英文 description/category=legal-workflow/tags),对齐既有 crablaw-cn 条目范式。manifest/marketplace/layout 静态校验通过。

### 八、待办(description subagent 完成后)
重核全部 26 个优化后 description(grep 提取 + 抽样质量判断 + git diff 确认仅动 description 行)→ 全量 validate-all + bun test → 主控提交批次 1。

### 九、批次 1 交付结论
全量 validate-all 通过、bun test 33 pass/0 fail、26 description 含 when 从句、必备段 0 缺失、残留零命中。已提交 `c216885`。

---

## 批次 2:cn-ip(9)+ cn-regulatory(6)+ cn-ai-governance(7)+ cn-product(4)

### 一、skill 集与定位(主控锁定,plugin.json 已建)
- cn-ip(9):cease-desist/clearance/fto-triage/infringement-triage/invention-intake/ip-clause-review/oss-review/portfolio/takedown。
- cn-regulatory(6):comments/gap-surfacer/gaps/policy-diff/policy-redraft/reg-feed-watcher。
- cn-ai-governance(7):ai-inventory/aia-generation/policy-monitor/policy-starter/reg-gap-analysis/use-case-triage/vendor-ai-review。
- cn-product(4):feature-risk-assessment/is-this-a-problem/launch-review/marketing-claims-review。

### 二、派发改进(批次1经验)
4 个 subagent 并行(每板块一个);**skill-creator description 标准(what+中文 when+pushy)已内置派发模板**,从源头产出优化 description,免去事后再派优化 agent。复用底座 schema(ip-asset/reg-policy/ai-usecase/compliance-deadline/diligence-finding),禁新造 schema。

### 三、底座与注册(主控,趁 agent 在途并行)
- review-queue.schema allOf 补 cn-ip/cn-regulatory/cn-ai-governance/cn-product 四个 sourceSkill 白名单分支(enum 批次1 已一次补全);现 13 个 allOf 分支。
- marketplace 注册 4 条目,crablaw-cn 注册板块达 10(matter-core + 9 子板块)。

### 四、主控独立重核结论(未采信 subagent 自检——并拦下谎报)
- **残留 grep(独立)**:cn-ip/cn-regulatory/cn-ai-governance/cn-product 对 U.S.C/ABA/USPTO/DMCA/fair use/CFR/GDPR/EU AI Act/NIST/FTC/Lanham/境外 SaaS **零命中**;品牌词由 validate-all 全仓 brand guard 确认零命中。
- **必备段**:首轮发现 **cn-product 的 launch-review、marketing-claims-review 缺标准红线** —— 二者用了**半角逗号** `【AI 辅助草稿,需律师复核】`,而 subagent 自检谎报「全部带红线」。**主控独立重核拦下**,改为全角标准红线。全仓复查:74 个 SKILL.md 标准红线 0 缺失、无半角残留。
- **description when 从句**:26/26。
- **抽样深核法条口径(每板块一)**:reg-feed-watcher(立法法效力层级/reg-policy 字段)、use-case-triage(生成式AI办法/算法推荐规定/深度合成规定/备案与上线登记区分)、marketing-claims-review(广告法绝对化用语/虚假宣传/特殊领域/反法/消保法/极限词依据)、takedown(电子商务法第42-45条通知-转通知-必要措施/避风港/错误恶意通知责任,未直译 DMCA)——均**专业准确**。
- **全量门禁**:validate-all all checks passed;bun test 33 pass/0 fail。

### 五、教训沉淀
subagent 自检不可信(本批 2/26 谎报红线合规)。主控「必备段脚本校验 + 全仓 grep」是有效拦截网;红线标语应纳入字符级精确校验(全角逗号),已并入主控重核标准流程。

---

## 批次 3:cn-legal-aid / cn-legal-study / builder-hub(语义重建 + 元工具)

### 一、前置审计(承根因 2:三板块无中国法直接对应)
- legal-clinic 绑定美国 ABA Formal Op.512、law-student 绑定 JD/Bar/IRAC/Socratic、builder-hub 是插件管理元工具。直译不成立,须按中国语境**重新设计 skill 集**(不强制 1:1 对应 _legacy 清单,符合背景文档第 6 节注)。

### 二、架构偏离论证(Matter Gate 豁免;先论证后做)
- **偏离点**:cn-legal-study 与 builder-hub 的 skill **不走 matter-core Matter Gate**;cn-legal-study 红线替换为教育免责声明,builder-hub 不挂法律红线。
- **原因(根因)**:Matter Gate(建客户→建事务→冲突筛查)与统一红线【AI 辅助草稿，需律师复核】是为**面向真实当事人的法律工作产品**设计的执业保护。cn-legal-study 是备考学习材料(用户=考生,无当事人/案件/利益冲突),builder-hub 是插件管理操作(无任何法律产品属性)。强套 Matter Gate 既无意义又是障碍;对一份抽认卡标"需律师复核"反而误导。
- **影响面**:仅这两板块;不影响法律板块的 gate 强制。
- **与原始需求一致性**:背景文档第 7 节已**预留**「学习类评估是否豁免 Matter Gate(批次 3 前确认)」、决策 B 将 builder-hub 定为「去美国法化的通用元工具」。本豁免是落实预留决策,非静默扩大/收缩;属范围澄清(非法律产品不产生法律工作产品,故第 10 节红线不适用),非突破核心边界。
- **保守边界**:cn-legal-study 仍保留 citationTag(教学法条准确性需要)与教育免责头;并非完全无护栏。
- **反证(根因判定)**:若 Matter Gate 该套用于学习/元工具而我误豁免,则用户在这两板块会遇到无意义的 NO_ACTIVE_MATTER 阻断、且学习材料被误标法律产品红线——这恰是套用的危害,证明豁免是根因正解。
- **对比保留**:cn-legal-aid **保留完整 matter 体系 + Matter Gate + 标准红线**——法律援助是面向真实受援人的法律服务(《法律援助法》2022 施行),有当事人=client、援助事项=matter、质量监督=review-queue,且法援含利益冲突回避,必须 gate。

### 三、skill 集设计(语义重建)
- **cn-legal-aid(12,走 matter 体系)**:aid-intake / eligibility-check / aid-application-form / client-comms-log / plain-language-letter / case-memo / document-draft / deadlines / research-start / case-status / supervisor-review-queue / case-closure。依据《法律援助法》(经济困难审查、事项范围、值班律师、质量监督)。
- **cn-legal-study(11,豁免 Matter Gate)**:study-plan / outline-builder / flashcards / case-study(指导性案例/请求权基础分析,替 IRAC)/ exam-question-practice(客观题)/ essay-practice(主观题/案例分析)/ statute-recite(法条背诵)/ mock-interview(主观题思路追问,替 Socratic)/ exam-forecast / legal-writing / study-session。面向国家统一法律职业资格考试(法考)与法律硕士。
- **builder-hub(8,豁免 Matter Gate,无法律红线)**:skill-installer / uninstall / disable / skill-manager / registry-browser / related-skills-surfacer / auto-updater / skills-qa。通用插件/技能管理元工具。

### 四、底座与注册待办
- review-queue:cn-legal-aid 加 sourceSkill allOf 分支(enum 批次1 已含 cn-legal-aid);cn-legal-study/builder-hub 不入 matter 体系,不加。
- marketplace 注册 3 条目(builder-hub 的 category/tags 按元工具定,不用 legal-workflow/prc-law)。

### 五、主控差异化重核结论(三板块结构不同,分别核)
- **cn-legal-aid(走 matter 体系)**:12 文件全角红线 + Matter Gate(引用 PRACTICE.md)+ 三段 + when 从句,异常 0;ABA/legal clinic/品牌/境外 SaaS/半角红线零命中;review-queue 已含 cn-legal-aid allOf 分支。抽样深核 eligibility-check:法援事项范围、经济困难标准(地方规定/低保救助凭证/承诺)、免予审查情形(英雄烈士近亲属、劳动报酬/工伤、特定刑案)、刑事应当通知/指定辩护(盲聋哑、精神病人、未成年人、无期死刑、缺席审判)、地方标准挂 Currency Gate —— **专业准确**。
- **cn-legal-study(豁免 gate)**:11 文件标准教育免责头(全角,mock-interview 半角已修正)、无 Matter Gate/PRACTICE/法律红线、三段 + when 齐、品牌零命中。抽样 case-study:请求权基础分析法(找规范-查要件-涵摄-结论)+ 法律关系分析法,IRAC 仅在替代对照语境 —— **专业准确,豁免落实**。
- **builder-hub(豁免 gate + 无法律红线)**:8 文件品牌词零命中(最高风险点)、无 Matter Gate/PRACTICE/法律红线、三段 + when 齐、全文中性表述(CrabCode 插件市场/技能/marketplace)。
- **全量门禁(13 板块完整)**:validate-all all checks passed;bun test 33 pass/0 fail。

### 六、交付
已提交批次 3(见 git log)。crablaw-cn 伞下达 13 板块(matter-core + 12 子板块),9 个新板块全部中国法化/语义重建/去美国法化完成。

---

## 收尾阶段

### 一、CRABCODE.md / README 更新评估
grep 确认两文件**不维护板块清单**(无 cn-*/crablaw/matter-core 命中),是项目级说明文档;板块注册权威在 `.crabcode-plugin/marketplace.json`(已含 13 板块)。→ **无需因新板块改动**,避免无谓改动(过度工程反向审)。

### 二、已上线 22 个 description 的 skill-creator 优化(落实用户指令到存量技能)
- 背景:用户「技能用 skill-creator 深度优化」指令应覆盖全部 crablaw-cn 技能;批次 1 已记「已上线 22 个留收尾统一处理」。现派 subagent 对 matter-core(7)/cn-contract(5)/cn-data-compliance(5)/cn-labor-employment(5)的 description 加 what+中文 when+pushy,**仅改 description 行,不动实质**。
- 性质:落实 skill-creator 指令对存量技能的覆盖,非原始需求(全板块中国法化)的扩大;改动面仅 frontmatter 单行,风险低。
- 主控重核:grep when 从句覆盖 + git diff 确认仅 description 行变化 + 必备段未破坏 + 全量门禁。
