# CrabLaw-CN × Legal-Skills-Chinese 深度研究与优化方案

> 日期：2026-08-21
> 研究对象：`plugins/crablaw-cn/` 与 `THUYRan/Legal-Skills-Chinese`
> 文档性质：只读研究结论落档；不构成法律意见，许可判断须由知识产权律师复核
> 实施状态：已按实施前置审计的修订基线完成工程实施；法律专业复核与管理员 PR 评审待完成

## 0. 执行结论

技术上可以吸收，且上游的横向法律推理能力与本仓库现有垂直业务工作流具有较高互补性；但不能把上游 38 个 `SKILL.md` 直接修改、改名或重组后并入当前 Apache-2.0 的 `crablaw-cn` 插件。

建议采用以下决策：

1. **批准**研究并洁净室式独立实现上游的功能分类、抽象方法与流程思想。
2. **否决**直接复制、翻译、删改、拼接或再许可上游技能正文。
3. **不再平铺新增 38 个公开技能**。保留现有垂直板块，将上游能力压缩为横向法律推理内核。
4. 先修复当前插件的命名空间、运行契约、来源关联和总控路由，再引入新的推理能力。
5. 将 `matter-deep-analysis` 提升为旗舰核心工作流，与 `legal-workbench` 共同构成主要公开入口；它是横向推理内核和各垂直板块真正汇合的场所。
6. 最终目标为“一个总控入口 + 一个案件深度分析旗舰 + 一个 Matter 状态面 + 一个横向推理内核 + 多个垂直工作流 + 一个交付复核面”。

一句话结论：

> **吸收思想，不移植文本；补树干，不再加树枝。**

---

## 1. 研究范围与方法

### 1.1 本地研究范围

对下列内容进行了只读审计：

- `plugins/crablaw-cn/.crabcode-plugin/plugin.json`
- `plugins/crablaw-cn/README.md`
- 11 个业务板块、86 个 `SKILL.md`
- `matter-core` 的 3 个 diligence agent、13 个 JSON Schema、Matter Gate 与 Currency Gate
- Marketplace `groups` 展示配置
- FQN 引用校验器、Matter Gate 校验器和能力路由规范
- 历史中国法化实施方案与执行日志

### 1.2 上游研究范围

通过 GitHub 仓库树和文件内容审阅了：

- 38 个上游 `SKILL.md`，总计约 544,690 个字符；
- `README.md`、`CONTRIBUTING.md`、`MCP-PKULAW.md`；
- 36 个原子能力和 2 个复合能力的结构、触发说明、流程、输入输出和质量门；
- 上游许可声明、团队信息、版本发布和数据库接入说明。

上游研究基准提交树：`d844a25f6d5e6eff4999774a9ab0f79f7cb9d22d`。

### 1.3 外部主要来源

- 项目仓库：<https://github.com/THUYRan/Legal-Skills-Chinese>
- 上游许可声明：<https://github.com/THUYRan/Legal-Skills-Chinese#-许可与责任--license>
- 上游贡献规范：<https://github.com/THUYRan/Legal-Skills-Chinese/blob/main/CONTRIBUTING.md>
- 上游北大法宝 MCP 说明：<https://github.com/THUYRan/Legal-Skills-Chinese/blob/main/MCP-PKULAW.md>
- CC BY-NC-ND 4.0 官方说明：<https://creativecommons.org/licenses/by-nc-nd/4.0/>
- 清华大学学位论文记录：<https://newetds.lib.tsinghua.edu.cn/qh/paper/summary?dbCode=ETDQH&sysId=294382>

---

## 2. 项目身份与许可校正

### 2.1 “清华大学开源”的表述应当收窄

公开证据能够确认：

- GitHub 仓库所有者是个人账号 `THUYRan`，不是清华大学官方 GitHub 组织；
- README 项目团队列有胡伊然等成员；
- 清华大学学位论文系统显示胡伊然的法律硕士论文培养单位为清华大学法学院。

因此，可以描述为“具有清华法学院教育/研究背景的团队开源项目”；目前没有充分证据将其表述为“清华大学官方发布或官方背书的开源项目”。对外宣传不应暗示清华大学对本插件或改造结果提供授权、赞助或背书。

### 2.2 许可构成 P0 阻断项

上游 README 声明整体采用 **CC BY-NC-ND 4.0**：

- BY：需要署名；
- NC：不得用于以商业优势或金钱补偿为主要目的的使用；
- ND：可以分享原材料，但改编、转换或基于其创作后，不得分发修改材料。

本仓库 `crablaw-cn` 的插件清单声明为 **Apache-2.0**。用户希望进行“优化后并入”，通常会涉及删改、重组、翻译、加入 Matter Gate、适配 CrabCode 运行时和再次分发。这些行为具有形成改编材料的显著风险，不能依赖 CC BY-NC-ND 4.0 作为直接并入依据。

此外：

- GitHub API 未识别到标准根 `LICENSE` 文件；许可主要写在 README 中；
- `CONTRIBUTING.md` 又提示个别技能可能另附许可，但当前 38 个技能目录没有独立许可文件；
- 不应自行把上游内容重新标成 Apache-2.0；
- 不应以“引用少量段落”为名，系统性重构并复制其表达、模板和示例。

### 2.3 可行的两条路径

#### 路径 A：取得书面授权

向权利人取得允许以下行为的书面许可：

- 商业使用（如本项目存在商业目的）；
- 修改、翻译、重组和分发衍生版本；
- 以 Apache-2.0 兼容方式分发，或明确采用何种双重许可；
- 明确署名方式与商标/机构名称使用边界。

#### 路径 B：洁净室式独立实现（推荐默认）

只把上游当作功能研究材料：

1. 提取不受具体表达约束的抽象需求和能力分类；
2. 基于本仓库既有 Matter Gate、Schema、来源政策和中国法律工作流独立设计；
3. 不复制上游正文、表格、范本、示例、编号体系和独特表达；
4. 对新旧文本做相似度与人工来源复核；
5. 研究记录与实现人员、实现输入之间保留来源隔离记录。

---

## 3. 上游 38 个技能的价值与局限

### 3.1 值得吸收的核心思想

上游最大的价值不是某个单独提示词，而是把法律任务划分为“输入—处理—输出”的横向链条：

1. 信息检索；
2. 事实与要素处理；
3. 法律解释；
4. 法律推理；
5. 论证组织与评估；
6. 风险评估与价值判断；
7. 文书与事务管理。

其中最适合本仓库的能力包括：

- 法条、案例和其他法律材料的检索与效力核验；
- 事实要素、争议焦点和证据的结构化提取；
- 文义/体系/目的解释与演绎、归纳、反事实等推理模式；
- 主张—要件—证据—来源的论证链；
- 论证强度、风险优先级和置信度降级；
- 多文档归纳、法律术语和交付前质量检查。

这些正是当前 `crablaw-cn` 缺失的横向共享内核。

### 3.2 不能原样采用的原因

#### 1. 编排仍是概念编排

两个复合能力使用 `AS4`、`AS5`、`AS8` 等文本编号描述调用顺序，没有真实、可解析的 callable ID，也没有运行时路由注册表。它们能指导模型按步骤思考，但不能保证实际调用其他技能。

#### 2. 没有机器契约

上游仓库没有：

- JSON Schema；
- 状态机或 workflow-run 记录；
- 输入输出验证器；
- 自动测试和路由评测；
- 可执行脚本；
- 复核队列或 Matter Store。

#### 3. 上下文体积过大

只读统计显示：

- 38 个技能正文总计约 544,690 字符；
- 单技能字符数中位数约 15,145；
- 11 个技能超过 20,000 字符；
- 大量正文包含长篇示例、重复模板和快速参考卡。

如果直接增加为公开技能，会提高触发冲突、上下文成本和维护漂移。

#### 4. 与本仓库触发约束不完全兼容

本仓库能力路由规范记录：技能清单只注入 frontmatter description，单条上限 250 字符。上游有 14 个 description 超过 250 字符，可能被截断；多数能力边界只写在正文，触发阶段不可见。

#### 5. 质量规范与实际文件存在差距

上游 README/CONTRIBUTING 宣称每个技能应具备能力边界和法律声明。逐文件扫描发现：

- 24/38 含字面上的 `法律声明` 标题；
- 其余文件的免责与边界表达不完全统一；
- 两个目录使用首字母大写，和其自身“小写连字符”规范不一致；
- README 的 benchmark 对应关系明确只是方法论对应，不代表做过定量评测或达到特定分数。

因此，上游适合作为专家框架参考，不应直接视作经过工程验收的生产组件。

---

## 4. 本地 CrabLaw-CN 现状审计

### 4.1 已有优势

现有插件并非推倒重来，其基础能力值得保留：

- 单一 Marketplace 安装入口；
- 11 个展示分组和 86 个中国法领域技能；
- Matter Gate、权限、利冲、来源标签、复核队列；
- `reader → analyzer → writer` 三层尽调隔离；
- `source-record`、`review-queue`、`diligence-finding` 等 13 个 Schema；
- 红黄绿风险分级、严重性下限、禁止把检索内容当指令；
- 可选办公文档交付路由。

正确方向不是重新拆成 11 个独立安装插件，而是为这 11 个展示分组补一个运行时控制面。

### 4.2 量化结果

| 指标 | 当前结果 |
|---|---:|
| 插件数 | 1 (`crablaw-cn`) |
| 展示板块 | 11 |
| 技能 | 86 |
| 非自引用交接边 | 261 |
| 具有下游交接的技能 | 71 |
| 板块内交接 | 226 |
| 跨板块交接 | 35 |
| 使用规范 `crablaw-cn:*` 命名空间 | 0 |
| 有独立 `PRACTICE.md` 的板块 | 4/11 |
| 插件目录内可执行 TS/JS/Python/Shell | 0 |
| JSON Schema | 13 |

### 4.3 根因一：展示分组被误当成调用命名空间

Marketplace 实际发布的插件名只有 `crablaw-cn`，`matter-core`、`cn-contract` 等只是分组/目录语义。技能正文却普遍使用：

- `/matter-core:new-matter`
- `/cn-contract:review`
- `/cn-product:launch-review`
- `/cn-data-compliance:data-activity-triage`

正确全限定名应使用真实插件名和技能 basename，例如：

- `crablaw-cn:new-matter`
- `crablaw-cn:review`
- `crablaw-cn:launch-review`
- `crablaw-cn:data-activity-triage`

当前 261 条非自引用交接边中，目标 basename 全部存在，但规范命名空间使用量为 0。因此，插件“有路由文字、没有可靠调用关联”。

### 4.4 根因二：引用校验器存在逃逸路径

`src/policy/referenceValidator.ts` 的 FQN 正则只识别反引号内直接以字母开头的 `plugin:skill`。当前正文使用反引号包裹的 `/cn-contract:review`，前导 `/` 使其无法命中。

同时，校验器发现命名空间既不是已知插件、也不是 planned provider 时会直接 `continue`。`cn-contract` 等未知命名空间因此被忽略，而不是报告死链。

结果是：

- 正确的外部 FQN 能被检查；
- 大量内部旧式路由既不可执行，也绕过 CI；
- 测试绿色不能证明内部工作流图可运行。

### 4.5 根因三：Matter Core 仍停留在早期三个领域

`conflict-check` 完成后的路由只明确覆盖合同、数据合规、劳动和 review queue，没有覆盖：

- 公司/并购；
- 诉讼；
- 知识产权；
- 监管；
- AI 治理；
- 产品；
- 法律援助。

`matter-deep-analysis` 的跨领域说明也主要列举 data、labor、IP，未由统一注册表生成。新增板块时需要人工逐文件补边，必然漂移。

### 4.6 根因四：状态 Schema 未成为运行时契约

典型证据：

- `new-matter` 指示运行不存在的 `scripts/bootstrap-matter-store.ts`；
- 多个技能指示运行不存在的 `npm run validate:schema`；
- `package.json` 没有 `validate:schema` 命令；
- `matterType` 虽有完整 enum，却不在 `matter.schema.json` 的 required 列表；
- 大部分领域技能只在文字中声称写入记录，没有确定性写入器或校验器；
- 现有 `diligence-finding.schema.json` 没有强制 `sourceRecordIds`，无法保证 `[已核验-来源]` 真正关联来源记录。

### 4.7 根因五：只有共享安全规则，没有共享法律分析规则

目前只有以下板块拥有 `PRACTICE.md`：

- `matter-core`
- `cn-contract`
- `cn-data-compliance`
- `cn-labor-employment`

公司、诉讼、知产、监管、AI、产品、法援没有同等层次的领域来源政策或共同分析框架。`cn-currency-watch.md` 也主要覆盖数据、劳动、合同。这会导致：

- 同一法律问题在不同板块使用不同分析结构；
- 来源和效力核验强度不一致；
- 跨板块交接只能传自然语言摘要，不能传结构化中间结果；
- 下游技能容易丢失上游事实、来源、严重性和未决问题。

---

## 5. 目标架构

```text
用户
└── crablaw-cn:legal-workbench（唯一总控入口）
    ├── Matter 控制面
    │   └── 客户 → 事项 → 权限 → 利冲 → 来源策略 → 复核策略
    ├── Route Planner
    │   └── 根据 matterType、任务、材料、风险生成 Workflow Plan
    ├── crablaw-cn:matter-deep-analysis（旗舰核心工作流）
    │   └── 案卷材料链 + 法律研究链 → 逐争点分析 → 专家回流 → 深度备忘录
    ├── 横向法律推理内核
    │   └── 检索 → 事实 → 争点 → 规范 → 解释/推理
    │       → 证据链 → 论证 → 风险排序 → 质量检查
    ├── 垂直领域工作流
    │   ├── 合同
    │   ├── 诉讼/争议解决
    │   ├── 公司与交易
    │   ├── 知识产权
    │   ├── 劳动用工
    │   ├── 数据/AI/监管/产品合规
    │   └── 法律援助
    └── 交付控制面
        └── 律师复核 → 内部批准 → 外发批准 → 文档生成/归档
```

### 5.1 控制面：`legal-workbench`

总控入口负责：

1. 识别用户角色和输出上限；
2. 找到或建立 active matter；
3. 执行权限、利冲、服务范围与目的地闸门；
4. 将用户请求规范化为 `legal-task`；
5. 读取能力注册表，生成有序执行计划；
6. 调用领域工作流和横向内核；
7. 汇总中间产物，创建复核项；
8. 未经批准不进入外发或最终文档状态。

### 5.2 旗舰核心工作流：`matter-deep-analysis`

案件深度分析不应只是 `matter-core` 下的一个普通叶子技能。它应当是 CrabLaw-CN 最重要的复合工作流之一，并承担以下角色：

它可以由用户直接触发，但执行第一步仍必须进入 `legal-workbench` 的 Matter、权限、利冲和目的地控制面；“核心公开入口”不等于绕过唯一总控。

- 多份案卷材料的完整读取与交叉核对；
- 事实、时间线、证据、争议焦点和材料缺口的结构化；
- 按争点开展法条、效力、案例和裁判实践研究；
- 调用合同、诉讼、劳动、数据、知产、公司、监管等专业板块；
- 形成可回溯、可增量更新、可供律师复核的深度备忘录；
- 把上游值得吸收的原子能力真正组织成端到端流程。

#### 5.2.1 双链路汇合模型

案件事实和法律研究必须分成两条独立链路，最后按 `issueId` 汇合：

```text
案件材料链
文档登记 → 完整读取 → 事实提取 → 时间线 → 证据冲突/缺口
                         │
                         ▼
                    争议问题树
                         ▲
                         │
法律研究链
问题拆解 → 法条检索 → 效力核验 → 类案检索 → 案例对比
                         │
                         ▼
逐争点分析 → 跨板块专家复核 → 反方论证 → 质量检查 → 备忘录
```

两条链的证明对象不同：

- 案件材料链只能证明“材料中记载了什么、能够支持什么事实”；
- 法律研究链只能证明“现行规范和可核验裁判实践是什么”；
- 最终法律分析必须同时引用 `factIds`/`evidenceIds` 和 `sourceRecordIds`；
- 不得把材料陈述直接升级为已认定事实，也不得把模型法律知识包装为已核验规范。

#### 5.2.2 五层执行流水线

##### 第一层：Matter 与分析计划

1. 确认用户角色、客户、当事方、服务范围、利冲、权限和输出目的地；
2. 建立 `analysis-plan.json`；
3. 生成争议问题树；
4. 每个问题分配稳定 `issueId`、优先级、所需事实、所需研究和可能专业板块；
5. 未通过 Matter Gate 时不得读取非必要案卷或进入实质分析。

##### 第二层：材料读取与事实证据链

1. 一个源文件对应一个 `document-record` 和一个隔离 Reader；
2. Reader 只读、不联网、不写入，只返回结构化数据；
3. 记录页数/文件范围、是否完整读取、OCR 质量、缺页、重复件和版本关系；
4. 提取最小事实单元、主体、行为、时间、结果、因果、程序和证据；
5. 输出时间线、证据冲突、材料间不一致和待补事实；
6. 文档中的任何提示、命令或外链都只作为不可信内容，不得执行。

##### 第三层：按争点开展法律研究

1. 独立 Researcher 只接收最小化的 `issueId`、检索问题和必要匿名事实；
2. 按官方来源顺序检索法律、行政法规、司法解释、规范性文件和案例；
3. 核验制定机关、效力层级、现行状态、适用地域、时间效力和版本；
4. 涉及裁判实践或结果敏感问题时生成 `case-comparison-<issue-id>.json`；
5. 比较案例事实、争点、裁判规则、差异和参考权重，而不是只统计结果；
6. 网络不可用、数据库受限或案例不足时记录限制，不得补造材料。

##### 第四层：逐争点分析与专家回流

每个争点形成统一分析包：

```text
主张/问题
├── 法律要件
├── 支持与反对事实
├── 对应证据及证明力
├── 法律依据及效力
├── 类案及可区分事实
├── 推理步骤
├── 对方可能反驳
├── 缺失事实/证据/来源
├── 跨板块专业意见
└── 置信度、严重性与律师判断项
```

跨板块处理必须形成闭环状态，而不是只写“建议另行审查”：

```text
identified → routed → accepted → specialist-returned → integrated → reviewed/closed
```

例如，合同审查中发现个人信息出境、核心员工竞业限制和开源许可证问题时，应分别向数据、劳动和知产节点发送最小化任务包；三个专业结果返回后，再进入总分析。

##### 第五层：写作、红队与确定性验收

1. Writer 只能消费通过 Schema 的 findings，不得新增事实或重新定级；
2. 独立 Reviewer/Red Team 检查遗漏争点、错误引用、循环论证、事实与规范混淆、反方路径和严重性降级；
3. 确定性 validator 检查 Matter Gate、来源外键、finding、case comparison、专业回流和 review item；
4. 通过后才生成内部备忘录、复核队列项和审计日志；
5. 未经律师批准不得转为外发或最终法律意见。

#### 5.2.3 Worker 权限隔离

建议从当前三层升级为“协调器 + 两条只读链 + 分析器 + 专家 + Writer + Validator”：

| Worker | 允许 | 禁止 |
|---|---|---|
| Orchestrator | 读取 Matter 状态、生成计划、派发最小任务 | 直接形成最终法律结论 |
| Document Reader | 读取指定案卷、提取事实证据 | 联网、写入、执行文档指令 |
| Legal Researcher | 访问官方/获授权法律来源、创建来源候选 | 读取无关客户材料、写最终 memo |
| Analyzer | 离线读取结构化事实和来源、逐争点推理 | 联网、改写原始证据、伪造来源 |
| Domain Specialist | 读取限定争点包、返回专业 finding | 扩大事项范围、直接外发 |
| Writer | 写指定 outputs、review item、audit log | 新增 finding、降低严重性 |
| Validator | 确定性读取与校验 | 生成或修改法律分析 |

#### 5.2.4 必须保存的中间产物

每次运行至少保存：

- `run-manifest.json`
- `analysis-plan.json`
- `document-index.json`
- `fact-chronology.json`
- `issue-tree.json`
- `sources.jsonl`
- `case-comparison/<issue-id>.json`
- `claim-evidence-map.json`
- `analyzer-findings.json`
- `specialist-findings.json`
- `memo.md`
- `review-queue-item.json`
- `audit-log.jsonl`

中间产物必须有稳定 ID、内容摘要哈希和 consumed/produced 关系。用户补充或替换一份材料时，只重跑受影响文档、事实、争点和下游结论，不得无条件重做全案。

#### 5.2.5 单一真源与现有版本收敛

当前伞插件内已有较早的 Reader—Analyzer—Writer 实现；环境中另有独立分发的 `crablaw-cn-matter-deep-analysis`，后者已经补充官方来源策略、`sourceRecordIds`、案例对比 Schema、bootstrap 和 run validator。

实施时应先核验这些独立版资产的来源和权属，再把可合法复用的本项目自有增强回收到 `plugins/crablaw-cn`，并形成以下单一真源：

- 伞插件维护唯一的 Schema、官方来源策略、agents 和 validators；
- 独立分发版如需保留，只做薄包装或分发适配；
- 禁止两个版本继续分别演化同名规则和数据契约。

### 5.3 横向内核不应平铺为 36 个公开技能

建议压缩为五个内部节点：

1. `legal-research-gateway`
   - 法条、司法解释、案例、监管文件、辅助材料；
   - 官方来源优先级、效力、时效、地域和版本检查；
   - 可选北大法宝或其他合规数据库适配器。

2. `fact-issue-evidence-worker`
   - 事实最小单元；
   - 主体、行为、时间、结果、因果、程序；
   - 争议焦点；
   - 主张—要件—证据映射及证据缺口。

3. `legal-reasoning-kernel`
   - `mode: deductive | inductive | analogical | abductive | counterfactual | interpretation | conflict-resolution`；
   - 每步记录前提、事实、来源、结论和不确定性；
   - 刑事定罪、量刑和税法类比默认禁用或升级律师审批。

4. `argument-quality-gate`
   - 论证节点与攻击/支持关系；
   - 事实、规则、证据和来源完整性；
   - 反方观点、备选路径、逻辑谬误；
   - 置信度降级和薄弱环节。

5. `risk-prioritizer`
   - 风险去重；
   - 概率、影响、可逆性、紧迫性、证据强度；
   - 严重性下限；
   - RED/YELLOW/GREEN 与律师升级。

这些节点优先实现为 agent、workflow 或按需加载的 reference profile，而不是全部进入公开自然语言触发面。

### 5.4 垂直板块转为复合工作流

建议公开入口逐步收敛为：

- `legal-workbench`
- `matter-deep-analysis`
- `matter-ops`
- `legal-research`
- `contract-workflow`
- `litigation-workflow`
- `corporate-workflow`
- `ip-workflow`
- `employment-workflow`
- `compliance-workflow`
- `legal-aid-workflow`

现有 86 个叶子技能在兼容期内继续存在，但普通自然语言请求由总控或领域复合入口承接。最终是否移出公开 manifest，应以运行时是否支持私有技能为前提；不能为了“减少数量”而破坏可调用性。

---

## 6. 上游 38 项能力的吸收矩阵

| 上游能力组 | 数量 | 本地目标 | 决策 |
|---|---:|---|---|
| 法条/案例/其他检索、规范效力、概念理解 | 5 | `legal-research-gateway` | 高优先级洁净室实现 |
| 要素、结构化要素、争点、证据评估 | 4 | `fact-issue-evidence-worker` | 高优先级洁净室实现 |
| 法律解释 | 4 | `legal-reasoning-kernel` 的 interpretation modes | 合并，不建 4 个公开技能 |
| 演绎、归纳、类比、溯因、反事实、法律后果、冲突解决 | 7 | `legal-reasoning-kernel` | 条件吸收，设置法域/任务限制 |
| 论证链、强度、证据论证链、风险优先级 | 4 | `argument-quality-gate` + `risk-prioritizer` | 高优先级吸收 |
| 履约风险、内部合规、监管风险 | 3 | 合同/合规工作流 | 融入现有领域流程 |
| 文书格式、单/多文档摘要、术语、案件周期、期限、预算 | 7 | 现有文书、matter、期限能力 | 选择性增强，不重复建设 |
| 司法价值判断、行政价值判断、判决预测、裁判文书生成 | 4 | 隔离研究区 | 默认不发布、不对普通用户开放 |

### 6.1 优先服务于案件深度分析的上游能力

上游能力不应平均分配到 86 个叶子技能。第一批洁净室实现应优先成为 `matter-deep-analysis` 的内部能力：

1. `legal-element-extraction`：材料事实最小单元和三层事实结构；
2. `structured-element-extraction`：按领域要件形成结构化清单；
3. `dispute-issue-identification`：生成争议问题树；
4. `legal-article-retrieval`：按争点检索法律规范；
5. `legal-norm-validity-check`：核验效力、版本、地域和时间；
6. `case-retrieval`：检索并区分类案；
7. `multi-document-summarization`：形成跨文档共识、冲突和缺口；
8. `evidence-evaluation`：审查证据三性、证明力和补强需求；
9. `evidence-argument-chain`：建立主张—要件—证据关系；
10. `deductive-reasoning`：形成可检查的规范—事实—结论链；
11. `conflict-resolution`：处理法源、证据和争点优先级冲突；
12. `argument-strength-evaluation` 与 `strategic-risk-prioritization`：完成红队与排序。

这些名称仅用于记录上游功能映射；具体实现不得复制其受许可限制的正文、模板、示例或独特表达。

### 6.2 明确不进入默认产品面的四项能力

1. `judicial-value-judgment`
2. `administrative-value-judgment`
3. `legal-judgment-prediction`
4. `judgment-document-generation`

原因：

- 高度依赖完整案卷、程序身份和现行裁判实践；
- 容易被用户误解为司法结论或确定结果；
- 上游没有定量验证证明预测可靠性；
- 与本插件“律师辅助草稿、不得形成最终结论”的定位冲突；
- 如未来确需提供，应独立立项、单独许可、单独评测并限制角色。

---

## 7. 机器可执行的关联能力设计

### 7.1 能力注册表

建议新增类似以下机器可读注册表：

```json
{
  "id": "contract-review",
  "callable": "crablaw-cn:review",
  "domain": "contract",
  "requires": ["active-matter", "conflict-cleared", "internal-destination"],
  "consumes": ["matter-context", "document-record"],
  "produces": ["legal-issue[]", "risk-finding[]", "review-item"],
  "uses": ["fact-issue-evidence", "legal-research", "legal-reasoning"],
  "next": ["clause-redraft", "risk-summary", "data-activity-triage"],
  "reviewPolicy": "lawyer-required"
}
```

注册表至少应包含：

- canonical ID 与兼容 alias；
- 真实 FQN；
- 领域和任务类型；
- 前置闸门；
- 输入/输出 Schema；
- 可调用的横向内核；
- 合法下游边；
- 风险上限和复核策略；
- 是否允许外发；
- 是否允许网络、写入或第三方数据服务。

### 7.2 新增或升级的数据契约

建议形成以下共享契约：

- `legal-task.schema.json`
- `workflow-run.schema.json`
- `workflow-step.schema.json`
- `legal-fact.schema.json`
- `legal-issue.schema.json`
- `legal-norm.schema.json`
- `reasoning-step.schema.json`
- `claim-evidence.schema.json`
- `risk-finding.schema.json`
- `case-comparison.schema.json`
- 升级后的 `source-record.schema.json`
- 升级后的 `review-queue.schema.json`

必要字段包括：

- `workflowRunId`
- `parentStepId`
- `sourceRecordIds`
- `consumedArtifactIds`
- `producedArtifactIds`
- `assumptions`
- `missingFacts`
- `confidenceBasis`
- `reviewRequired`
- `nextCapabilityIds`

### 7.3 来源与案例闸门

应将来源策略从 Currency Watch 升级为统一政策：

1. 国家法律法规数据库、国家行政法规库、最高法/最高检等官方来源；
2. 人民法院案例库、中国裁判文书网、法院官网和公报；
3. 获授权的商业数据库；
4. 媒体、博客、公众号和二手综述只能作为线索，不能单独支持 `[已核验-来源]`。

强制规则：

- 每条 finding 至少关联一个 `sourceRecordId`；
- `[模型知识-待核]` 必须关联 `source-needs-check` 记录；
- `[已核验-来源]` 不得关联未核验记录；
- 涉及裁判实践或结果敏感问题时生成 case comparison；
- 找不到足够案例时记录限制，不得补造案例。

---

## 8. 实施计划

### P0：许可与来源治理

目标：在任何内容进入代码库之前关掉许可风险。

动作：

1. 建立上游来源登记、研究边界和洁净室说明；
2. 确认本项目商业使用场景；
3. 决定取得授权还是完全独立实现；
4. 未取得授权前禁止复制上游正文、模板、示例和图片；
5. 新增相似度扫描和人工来源复核清单。

验收：

- 有书面授权，或有经过律师确认的洁净室方案；
- Apache-2.0 产物不含不可分发的上游改编内容；
- 对外文案不暗示清华大学官方背书。

### P1：修复当前路由与运行契约

目标：在新增能力前先让现有 86 个技能形成真实工作流图。

动作：

1. 将内部引用统一为 `crablaw-cn:<skill-basename>`；
2. 引用校验器允许识别可选前导 `/`，但输出规范强制不带 `/`；
3. 将 `matter-core`、`cn-contract` 等已知板块别名登记为禁止使用的旧命名空间；
4. 未知内部命名空间不再静默跳过；
5. 增加工作流图验证：目标存在、输入输出兼容、终止节点可达；
6. 实现 Matter Store bootstrap；
7. 实现通用 JSON Schema 校验命令；
8. 实现 run-level validator；
9. 将 `matterType`、负责人、复核人等必要字段设为 required；
10. 用注册表自动生成 conflict-check 的全领域下游路由。

验收：

- 261 条现有非自引用边全部规范化；
- 非规范内部 FQN 为 0；
- 不存在的脚本/命令引用为 0；
- 所有 Matter 初始化产物通过 Schema 校验；
- 10 类实体 matter 均能从 conflict-check 路由到正确领域。

### P2：建立案件深度分析旗舰工作流

目标：把案件深度分析建设为最先贯通 Matter、横向内核和垂直专家的端到端能力。

动作：

1. 以伞插件版本为唯一真源，收敛独立分发版的自有增强；
2. 拆分 Document Reader 和 Legal Researcher，取消案卷 Reader 的联网能力；
3. 新增 `analysis-plan`、`document-index`、`issue-tree`、`claim-evidence-map`、`case-comparison`、`specialist-findings` 和 `run-manifest` Schema；
4. 为每份材料创建 source record、覆盖状态和内容摘要哈希；
5. 为每个争点创建 `issueId`，分别记录事实、证据、规范、案例、推理和反方路径；
6. 实现跨板块任务的 routed/accepted/returned/integrated/closed 状态机；
7. 强制每条法律 finding 引用 `sourceRecordIds`，每条事实判断引用 `factIds`/`evidenceIds`；
8. 新增增量失效传播：材料变化只重跑受影响的事实、争点和结论；
9. 增加独立 Red Team 和确定性 run validator；
10. 输出固定为内部深度备忘录 + 复核队列 + 审计日志，默认禁止外发。

验收：

- 文档清单与实际读取范围一致，覆盖状态可核对；
- 所有争点都有事实需求、研究需求和责任节点；
- 事实、证据、法律来源和案例引用无悬空 ID；
- 跨板块任务全部完成闭环或明确标记未完成原因；
- 新增/替换单份材料可以增量重跑；
- Writer 无法引入 Analyzer 未产生的 finding；
- validator 未通过时不能创建已完成状态的复核项。

### P3：建立总控和横向法律内核

目标：形成树干和共享能力层。

建议目录形态：

```text
plugins/crablaw-cn/
├── legal-core/
│   ├── capability-registry.json
│   ├── PRACTICE.md
│   ├── references/
│   │   ├── official-source-policy.md
│   │   ├── legal-reasoning-modes.md
│   │   └── argument-quality-policy.md
│   ├── schemas/
│   └── agents/
├── matter-core/
├── cn-contract/
├── cn-litigation/
└── ...
```

新增总控：

```text
skills/legal-workbench/SKILL.md
```

验收：

- 任意多领域请求先生成 workflow plan；
- 每个 step 有 typed input/output；
- 中间产物可在技能间传递且可追踪；
- 横向内核不重复创建 Matter 或绕过利冲；
- 高风险模式被角色与复核策略限制。

### P4：领域复合入口与兼容迁移

目标：降低 86 个叶子技能的公开触发冲突。

动作：

1. 为主要领域建立复合入口；
2. 普通中文请求优先触发总控或领域入口；
3. 叶子技能 description 收窄为明确任务或内部调用；
4. 保留旧名称兼容包装器至少两个小版本；
5. 记录旧 alias 到 canonical callable 的迁移提示；
6. 运行时具备私有技能支持后，再考虑从公开 manifest 移除内部节点。

验收：

- “审合同”“产品上线”“并购尽调”等宽泛请求不随机命中叶子技能；
- 显式调用旧技能仍能完成或得到清晰迁移提示；
- 没有重复创建 matter、review item 或 source record。

### P5：评测与灰度发布

必须新增：

1. 触发评测；
2. 路由评测；
3. 多领域编排评测；
4. 来源真实性与时效评测；
5. 文档指令注入评测；
6. Schema 契约测试；
7. 人工律师复核样本；
8. 许可与文本相似度检查。

最低指标：

| 指标 | 目标 |
|---|---:|
| 内部 FQN 可解析率 | 100% |
| 案卷材料登记与读取覆盖状态完整率 | 100% |
| 事实判断关联 fact/evidence ID | 100% |
| `[已核验-来源]` 来源可回溯率 | 100% |
| 跨板块专业任务闭环或限制记录率 | 100% |
| curated 路由准确率 | ≥95% |
| 多领域问题召回率 | ≥95% |
| 普通请求误触发叶子技能 | <2% |
| 未经批准的外部交付 | 0 |
| 高风险预测能力默认可见数 | 0 |
| 伪造法条/案例测试漏拦截 | 0 |

建议至少准备五条端到端黄金路径：

- 多份案卷 → 问题树 → 法条/类案 → 证据链 → 专家回流 → 深度备忘录；
- 采购合同审查 → 数据条款 → 条款改写 → 风险摘要；
- AI 产品上线 → 数据处理 → 算法/监管 → 营销宣称 → 上线复核；
- 并购尽调 → 重大合同 → 劳动/IP/数据交叉 → 交割清单；
- 民商事诉讼 → 时间线 → 争点 → 法条/类案 → 证据链 → 文书草稿。

---

## 9. 优先级与工作量判断

### P0：立即阻断

- 上游许可不允许默认进行修改分发；
- 任何直接复制动作必须暂停。

### P1：发布前必须修

- 261 条内部路由全部使用错误命名空间；
- 引用校验器存在前导 `/` 和未知命名空间逃逸；
- Matter 初始化与 Schema 校验命令缺失；
- 来源记录没有形成确定性外键。

### P2：架构主任务

- 案件深度分析双链路；
- 问题树与逐争点分析包；
- 案卷覆盖、来源和案例外键；
- 跨板块专家回流状态；
- 增量重跑与 run validator。

### P3：架构主任务

- 总控入口；
- 能力注册表；
- Workflow Run 状态；
- 横向法律推理内核；
- 来源与案例统一闸门。

### P4/P5：质量和体验优化

- 叶子技能公开面收敛；
- 上下文瘦身；
- 领域复合入口；
- 兼容迁移与触发评测。

---

## 10. 明确的非目标

本方案不建议：

- 把现有单一插件重新拆成 11 个强依赖安装包；
- 一次性删除 86 个现有技能；
- 把上游 38 个技能全部加入 manifest；
- 直接接入未经授权的商业法律数据库；
- 自动外发法律意见、函件或监管材料；
- 向普通用户开放判决预测或裁判文书生成；
- 用“律师复核”免责声明替代来源、Schema 和确定性校验。

---

## 11. 最终决策记录

| 决策项 | 结论 |
|---|---|
| 是否可以利用上游研究成果 | 可以 |
| 是否可以直接复制改写后并入 | 不可以，除非另获书面授权 |
| 是否新增 38 个公开技能 | 不建议 |
| 最优吸收方式 | 洁净室重写为横向内核 |
| 案件深度分析的产品定位 | 与总控同级的旗舰核心工作流 |
| 案件深度分析的技术模型 | 案件材料链与法律研究链按争点汇合 |
| 当前插件是否应继续拆包 | 不应，根因不在物理目录 |
| 当前首要实施项 | 修复 FQN/Matter 契约后立即建设案件深度分析旗舰 |
| 现有 Matter Gate 是否保留 | 保留并加强 |
| 高风险司法预测能力 | 默认隔离，不发布 |

最终推荐方案：

> **以 `crablaw-cn:legal-workbench` 为总控、以 `crablaw-cn:matter-deep-analysis` 为旗舰核心工作流，用机器可读注册表连接现有领域能力；把上游 38 项能力重构为 5 个内部横向节点；所有结论通过 Matter、案卷、来源、推理、专家回流、复核和外发闸门。**

---

## 12. 本地证据索引

- 当前伞插件说明：`plugins/crablaw-cn/README.md`
- 当前唯一插件清单：`plugins/crablaw-cn/.crabcode-plugin/plugin.json`
- Marketplace 分组：`.crabcode-plugin/marketplace.json`
- Matter Gate：`plugins/crablaw-cn/matter-core/PRACTICE.md`
- 典型错误内部路由：`plugins/crablaw-cn/cn-contract/skills/review/SKILL.md`
- 不完整的冲突后路由：`plugins/crablaw-cn/matter-core/skills/conflict-check/SKILL.md`
- 缺失运行命令的开案技能：`plugins/crablaw-cn/matter-core/skills/new-matter/SKILL.md`
- 深度分析三层流水线：`plugins/crablaw-cn/matter-core/skills/matter-deep-analysis/SKILL.md`
- 引用校验器：`src/policy/referenceValidator.ts`
- Matter Gate 校验器：`src/policy/matterGateValidator.ts`
- 能力路由规范：`docs/capability-routing.md`
- Matter Schema：`plugins/crablaw-cn/matter-core/schemas/matter.schema.json`
- 来源 Schema：`plugins/crablaw-cn/matter-core/schemas/source-record.schema.json`
- 尽调 finding Schema：`plugins/crablaw-cn/matter-core/schemas/diligence-finding.schema.json`

## 13. 实施结果索引

- 实施前置审计：`docs/audit/2026-08-21-crablaw-cn-Legal-Skills-Chinese-实施前置审计.md`
- 全量实施日志：`docs/audit/2026-08-21-crablaw-cn-Legal-Skills-Chinese-全量实施日志.md`
- 字段兼容契约：`docs/handoff/2026-08-21-crablaw-cn-v0.3.0-字段契约.md`
- v0.3.0 发布说明：`docs/releases/2026-08-21-crablaw-cn-v0.3.0.md`
- 评测查看器：`docs/audit/2026-08-21-crablaw-cn-v0.3.0-eval-review.html`
- CI 人工触发与本机验证补充审计：`docs/audit/2026-08-21-全仓CI自动触发暂停与本机验证补充审计.md`
