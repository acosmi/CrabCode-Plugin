# CrabLaw-CN × Legal-Skills-Chinese 实施前置审计

> 日期：2026-08-21
> 审计对象：`docs/audit/2026-08-21-crablaw-cn-Legal-Skills-Chinese-深度研究与优化方案.md`
> 审计范围：方案合理性、遗漏项、过度设计、关联方影响、运行时可行性、许可与交付边界
> 门禁结论：**有条件通过；下列修正纳入实施基线后允许全量实施**

## 1. 执行摘要

方案对当前问题的根因判断基本正确：CrabLaw-CN 的核心缺陷不是物理目录过多，而是只有垂直技能、缺少统一总控和横向法律分析内核；大量板块内移交又使用不可执行的旧命名空间，导致“文字上关联、运行时断链”。将 `matter-deep-analysis` 提升为旗舰工作流、以案件材料链和法律研究链按争点汇合，也符合高风险法律工作的证据与来源分离要求。

方案不能原样照单实施。前置审计发现四类必须先修正的问题：

1. **兼容与迁移遗漏**：已有 86 个技能、43 处外部插件引用和既存 Matter Store 不能因新总控或 Schema 收紧而失效；
2. **过度设计**：原案列出约 10 个新公开入口和多组通用 Schema，若全部公开会把触发面从 86 个继续放大，违背“补树干、不加树枝”；
3. **运行时与数据安全遗漏**：脚本运行环境、路径逃逸、文件权限、原子写入、并发锁、增量状态和旧记录读取策略未明确；
4. **来源与权属证明不足**：可以实现抽象功能，但当前会话已阅读上游材料，不能把严格意义上的“洁净室”当作已证明事实；必须按本仓库独立规格原创实现，并禁止复制上游表达、模板、示例和资产。

上述问题均可在本次仓库范围内用加法兼容和确定性校验闭环，不要求扩大到外部系统或修改用户真实案卷。因此门禁结论为“有条件通过”，实施按本审计修订后的基线执行。

## 2. 基线证据

### 2.1 当前仓库基线

- `crablaw-cn` 为一个 Marketplace 插件，含 11 个展示分组和 86 个技能；
- manifest 与 Marketplace groups 目前 86/86 完整对齐，无遗漏、重复或未知技能；
- CrabLaw-CN 内部存在 261 条非自引用移交边，规范 `crablaw-cn:*` 命名空间使用量为 0；
- 仓库其他插件目前存在 43 处 `crablaw-cn:*` 引用，涉及 10 个稳定技能 basename，全部可解析；
- `matter-core` 有 13 个 Schema，但没有通用 Schema 校验脚本和完整 run validator；
- 当前 `bun run validate` 退出码为 0；输出仅含已有、与本任务无关的基线 warning；
- 工作区存在一个与本任务无关的未跟踪 `crabcopyright-cn-CodeSucker...` 审计文件，本任务禁止触碰。

### 2.2 关键关联方

| 关联方 | 当前依赖 | 潜在影响 | 保护措施 |
|---|---|---|---|
| `crabwork-small-business` | 43 处跨插件法律路由，10 个 skill basename | 重命名/移除叶子技能会产生死链 | 保留所有既有 basename；只修 CrabLaw 内部旧命名空间 |
| 既有 CrabLaw 用户 | 本地 Matter Store、JSONL、旧 Schema | 新 required 字段会使历史记录失效 | Schema 加法兼容；严格要求放在 run validator，不破坏旧 Schema 读取 |
| Marketplace/能力区 | 11 groups、86 skill 展示 | 大量新增公开技能造成认知和触发膨胀 | 仅新增 `legal-workbench`；保留既有 `matter-deep-analysis`；其余作为 reference/agent/mode |
| Review Queue 消费者 | `sourcePlugin` 实际存板块名，`sourceSkill` 存 basename | 直接改名为 canonical FQN 会破坏历史项 | 保留旧字段，新增可选 `sourceCapability`；新旧并存并由 validator 对照 |
| 独立深度分析插件用户 | 已安装 `crablaw-cn-matter-deep-analysis` | 伞插件和独立版继续漂移 | 伞插件成为仓库内唯一真源；独立版不在本任务中就地修改，只记录重装/薄包装迁移路径 |
| 通用深度调研能力 | `crabcode-deep-research` 仍为 planned | 法律检索与通用 Web 调研职责重叠 | `legal-research` 只负责法律来源/效力/案例门；不复制通用调研插件 |
| 办公文档插件 | Word/Excel/PDF 可选交付 | 强依赖会导致未安装用户整个法律插件降级 | 继续使用正文可选路由，不新增 manifest 强依赖 |
| 仓库 CI/维护者 | manifest、presentation、references、Matter Gate、version gates | 新嵌套 agent/skill 可能被校验器漏索引或误索引 | 同步扩展校验器与回归测试，不降低既有规则 |

## 3. 合理性审计

### 3.1 通过项

以下设计合理，应按原方向保留：

1. 单一伞插件继续作为安装边界，不重新拆成 11 个强依赖包；
2. `legal-workbench` 作为统一控制面，`matter-deep-analysis` 作为旗舰复合工作流；
3. 案件材料链与法律研究链分离，最后按稳定 `issueId` 汇合；
4. Document Reader、Legal Researcher、Analyzer、Writer、Validator 权限分离；
5. 法律结论关联来源，事实判断关联材料/证据，跨板块意见形成返回闭环；
6. 现有 Matter Gate、利冲、权限、复核队列和严重性下限继续作为硬边界；
7. 高风险司法预测、裁判文书生成和价值判断不进入默认产品面；
8. 上游能力以功能映射方式吸收，不复制具体文本。

### 3.2 需要校正的架构表述

“`legal-workbench` 为唯一总控”应理解为控制面唯一，而不是强制所有用户只能显式调用一个技能。用户仍可直接调用现有叶子技能或 `matter-deep-analysis`；这些入口必须引用同一 Matter Gate 和同一能力注册表，不能各自创建第二套状态。

## 4. 遗漏项审计

### 4.1 历史数据兼容与迁移

原方案要求把 `matterType`、负责人、复核人等直接设为 Schema required，可能使既有 Matter JSON 失效。修正为：

- v0.3 不破坏既有 Schema 的基础可读性；
- 新增 run validator，在进入实质工作时强制这些字段；
- 缺字段时返回明确 stop code 和补正清单，不自动猜测 matterType 或负责人；
- 新字段采取 optional-additive 方式加入旧 Schema；
- 新深度分析产物使用独立 v1 Schema，不覆盖旧 finding 语义。

### 4.2 本地存储安全

必须增加：

- 对 `matter-id`、`client-id` 和相对路径进行白名单校验；
- 所有受管文件必须解析后仍位于配置根目录内，拒绝 `..` 和符号链接逃逸；
- 新目录/文件按本地敏感数据设置收紧权限；
- JSON 使用临时文件 + `os.replace` 原子写入；
- JSONL 写入使用跨平台锁文件或明确单写者策略；
- destructive migration 默认禁止，迁移/重写必须显式 `--apply` 并先备份；
- 不打印案卷正文、凭证或个人信息到校验日志。

### 4.3 并发与恢复

方案只提到增量重跑，未定义并发和中断恢复。v0.3 应实现：

- `runId`、`revision`、`status`、`startedAt`、`updatedAt`；
- 单 Matter 单 writer lock；
- 中断后从最后一个已验证 step 恢复；
- 输入哈希变化只标记受影响 issue/step 为 `stale`；
- **不实现自动后台调度器**，由 orchestrator 根据 stale 集合显式重跑。

### 4.4 Agent 可发现性

当前引用校验器只索引插件根 `agents/`，而 `crablaw-cn` 的 agents 通过 manifest 显式声明在嵌套路径。实施必须让校验器按 manifest 声明索引 agent，不能通过把文件复制到两处规避。

### 4.5 人工法律质量门

自动化测试只能证明结构、来源和流程约束，不能证明实体法律结论正确。交付状态需区分：

- 工程验证通过；
- 法律专业复核待完成；
- 外发批准待完成。

没有律师样本复核时，不得声称“法律准确性已验收”。

## 5. 过度设计审计

### 5.1 新公开技能数量

原方案列出约 10 个公开入口。前置审计裁决：

- 本批只新增一个公开技能：`legal-workbench`；
- `matter-deep-analysis` 使用现有 basename 原位升级；
- `matter-ops`、`legal-research`、各领域 workflow 先实现为 registry mode/reference profile；
- 等触发评测证明需要独立入口后，再在后续版本升级为公开技能。

这样既实现完整能力，又不会把 86 个触发项继续扩张到近百个。

### 5.2 Schema 数量

原方案提出多组通用 `legal-task/workflow-step/legal-norm/reasoning-step` Schema，存在抽象先行。v0.3 只实现旗舰流程实际消费的契约：

1. `analysis-plan.schema.json`
2. `document-index.schema.json`
3. `fact-chronology.schema.json`
4. `issue-tree.schema.json`
5. `claim-evidence-map.schema.json`
6. `case-comparison.schema.json`
7. `analysis-finding.schema.json`
8. `specialist-findings.schema.json`
9. `run-manifest.schema.json`

通用 norm/reasoning-step 先嵌入 issue/finding；出现第二个真实消费者后再抽离，避免“一份字段只服务一个对象”的伪复用。

### 5.3 增量执行范围

不实现常驻服务、后台队列或自动 watcher。只实现：

- SHA-256 输入摘要；
- document → issue → artifact 依赖；
- stale 计算；
- 显式 apply；
- run validator。

这满足可恢复和增量能力，不引入长期进程、数据库和新的运行依赖。

## 6. 许可与来源门禁

### 6.1 审计裁决

- 本次不复制 `THUYRan/Legal-Skills-Chinese` 的技能正文、范本、示例、图片或独特编号；
- 新文件根据本仓库现有 Matter Gate、已落档功能规格和通用软件工程原则原创编写；
- 文件中仅以功能名称记录研究来源，不宣称获得清华大学官方授权或背书；
- “洁净室”改称“仓库原生独立实现/来源隔离实现”，除非后续能提供独立团队和书面流程证据；
- 独立安装版 `crablaw-cn-matter-deep-analysis` 的 manifest/README 明确说明其来源于本仓库且采用 Apache-2.0，可作为本仓库自有增强的对照；仍需逐项复核后重写/整合，不做盲复制。

### 6.2 P0 通过条件

在仓库增加来源治理说明，并由校验/评审确认没有大段上游相似文本后，P0 视为工程实施通过；最终许可意见仍由律师负责。

## 7. 修订后的实施基线

### 7.1 P0/P1

- 新增来源隔离与权属说明；
- 修复全部 CrabLaw 内部旧 FQN；
- 修复引用校验器的前导 `/` 和 legacy board namespace 逃逸；
- 让引用校验器按 manifest 识别嵌套 agents；
- 新增 Matter bootstrap、Schema 校验和 run validator；
- 保留 86 个既有 basename 和所有外部引用；
- review queue 加法增加 canonical `sourceCapability`，不删除旧字段。

### 7.2 P2

- 原位升级 `matter-deep-analysis`；
- 新增 Legal Researcher 和 Red-Team Reviewer；
- Reader 取消联网；
- 落地 9 个工作流 Schema；
- 落地官方来源策略、推理模式和论证质量策略；
- 落地输入哈希、stale 标记、专家回流和严格 run 验收。

### 7.3 P3/P4

- 只新增 `legal-workbench` 公开技能；
- 新建 capability registry，覆盖 11 个板块、86 个 callable 和核心 mode；
- 领域复合流程由 workbench mode 驱动；
- 保留叶子技能直接调用兼容；
- Marketplace 仅增加总控到 matter-core/control-plane 分组，不创建 8 个新组或 9 个新技能。

### 7.4 P5

- 静态 FQN/registry/agent/Schema 校验；
- Python runtime 的路径、锁、原子写、冲突命中、来源外键和 stale 测试；
- 至少 20 条触发近邻评测；
- 至少 5 条 synthetic end-to-end 黄金路径；
- 文档提示注入、伪造来源、跨 Matter 访问和未授权外发负向测试；
- 不使用真实客户数据。

## 8. 版本、发布与回滚

- 维持所有既有 skill basename；
- 功能为向后兼容的较大增量，版本从 `0.2.1` 升至 `0.3.0`；
- 同步插件 manifest 与根 Marketplace 版本、描述、groups 和技能计数；
- 不使用个人 Codex marketplace cachebuster 脚本修改本仓库的 `.crabcode-plugin/marketplace.json`；该流程与 CrabCode 仓库格式不同；
- 需要本地安装验证时使用仓库自身的 CrabCode 校验/安装流程，不手改用户个人 marketplace；
- 回滚以本任务分支提交为边界，不修改或删除用户现有 Matter Store。

## 9. 门禁结论

### 9.1 是否合理

**合理。** 总控 + 旗舰深度分析 + 横向内核 + 垂直能力的方向能解决当前结构性根因。

### 9.2 是否有遗漏

**原方案有遗漏，现已在本审计中补齐。** 重点为兼容迁移、存储安全、并发恢复、agent 索引、人工法律复核和回滚。

### 9.3 是否过度设计

**原方案部分过度。** 已裁减为 1 个新增公开技能、9 个真实消费 Schema、无常驻调度器、无新第三方依赖。

### 9.4 关联方影响是否可控

**可控。** 通过保留 86 个 basename、加法 Schema、外部引用回归和版本同步，可避免破坏下游插件与旧 Matter 数据。

### 9.5 最终决定

> **前置审计有条件通过。上述修正即为实施约束；按 P0 → P1 → P2 → P3/P4 → P5 顺序继续全量实施。**
