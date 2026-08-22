# CrabLaw-CN × Legal-Skills-Chinese 全量实施日志

> 日期：2026-08-21
> 分支：`codex/crablaw-legal-skills-research-plan`
> 目标版本：`crablaw-cn` 0.3.0
> 状态：工程实施与隔离验证完成；法律专业复核、用户评测反馈和管理员 PR 评审待完成

## 1. 实施依据

- 原始方案：`2026-08-21-crablaw-cn-Legal-Skills-Chinese-深度研究与优化方案.md`
- 前置门禁：`2026-08-21-crablaw-cn-Legal-Skills-Chinese-实施前置审计.md`

前置审计结论为“有条件通过”。实际实施遵守了以下裁减和兼容决定：

- 只新增一个公开技能 `legal-workbench`，没有新增九个领域入口；
- 原位升级 `matter-deep-analysis`，保留全部旧 basename；
- 只实现九个有真实消费者的深度分析 Schema；
- 不实现常驻服务或自动后台调度，只实现哈希、stale 和显式重跑；
- 不破坏旧 Matter Schema 的基础可读性，严格条件放在 run validator；
- 不复制外部研究仓库的正文、模板、示例或资产。

## 2. P0：来源与许可工程门

### 已完成

- 新增 `legal-core/references/source-governance.md`；
- 记录上游仓库、快照、公开许可和禁止复制范围；
- 新增 `scripts/check-crablaw-source-overlap.py`；
- 浅克隆公开上游到 `/tmp`，未提交上游文件；
- 以 96 个归一化字符 shingle 对完整 `plugins/crablaw-cn` 复扫。

### 结果

- 匹配文件对：0；
- 结果：PASS；
- 记录：`plugins/crablaw-cn/evals/source-overlap-result.json`。

该结果仅是工程来源预检，不替代知识产权律师的许可意见，也不构成清华大学官方授权或背书。

## 3. P1：路由、校验器与 Matter 运行契约

### Canonical 路由

- 89 份 CrabLaw 活动 Markdown 文件完成机械迁移；
- 旧 `/matter-core:*`、`/cn-contract:*` 等板块伪命名空间清零；
- 既有下游插件的 43 处 canonical CrabLaw 引用、10 个稳定 basename 全部保留。

### 引用与注册校验

- `referenceValidator` 可识别 manifest 显式声明的嵌套 agent；
- 只对 CrabLaw 阻断前导 `/crablaw-cn:*` 和旧板块命名空间，未改变其他插件的 slash-command 文档语义；
- 新增 `crabLawRegistryValidator`，校验 registry、manifest、Marketplace groups、agents、profiles 和 artifact schemas；
- 新增 `lint:crablaw-registry` 并接入 `validate-all`。

### Matter runtime

新增无第三方依赖的 Python 3.9+ 工具：

- `_matter_common.py`
- `schema_validation.py`
- `validate_json.py`
- `bootstrap_matter.py`
- `validate_run.py`
- `sync_run_manifest.py`

实现：ID/路径白名单、根目录 containment、符号链接阻断、私有权限、原子写、单 writer lock、拒绝覆盖、初步本地利冲命中、来源/事实/证据外键、artifact 哈希、stale 传播和严格 ready-for-review 门禁。

## 4. P2：案件深度分析旗舰

### 双链与五阶段

- 案件材料链：document → fact/evidence → issue；
- 法律研究链：issue → official source/validity → case comparison；
- 按 issue 汇合后进行 claim-element-evidence、专家回流、分析、红队和 Writer；
- 变更材料只标记依赖 issue/artifact stale，不后台自动运行。

### Agents

- 更新 `diligence-reader`：取消联网和写入，只处理一个不可信文档；
- 更新 `diligence-analyzer`：离线逐争点分析和外键要求；
- 更新 `diligence-writer`：只渲染 reviewer/validator 已通过的 findings；
- 新增 `legal-researcher`：按争点最小化法律来源检索；
- 新增 `diligence-reviewer`：Writer 前独立红队。

### 九个运行 Schema

- analysis plan
- document index
- fact chronology
- issue tree
- claim-evidence map
- case comparison
- analysis finding
- specialist findings
- run manifest

旧 source/review Schema 只做加法字段扩展，兼容规则见字段契约。

## 5. P3/P4：总控、横向内核与兼容入口

- 新增 `crablaw-cn:legal-workbench`；
- 新增 `legal-core/PRACTICE.md`；
- 新增官方来源、推理模式、论证质量策略；
- 新增 capability registry，覆盖 12 个展示分组、87 个 skill、10 个 substantive matter type、5 个 core mode 和 5 个 agent；
- `conflict-check` 成功后统一返回 workbench，再由 registry 选择全领域默认入口；
- Marketplace 和 manifest 同步升级 0.3.0；
- 旧 86 个 basename 和直接叶子调用保持兼容。

未使用 `plugin-creator` 的个人 `.codex-plugin` cachebuster/reinstall 脚本，因为本仓库使用
`.crabcode-plugin` 与仓库级 Marketplace；套用个人插件流程会修改错误的配置面。结构和版本改由本仓库原生 validator 验收。

## 6. P5：测试与评测

### 确定性测试

新增/覆盖：

- 本地冲突命中与 matter 状态；
- 私有权限和拒绝覆盖；
- concurrent lock；
- 完整 synthetic run 严格验收；
- required client party；
- 路径逃逸；
- 来源标签/状态不一致；
- 文档哈希变化和 stale 传播；
- registry profile containment 与 10 matter type 路由；
- trigger/eval 合同；
- 来源重叠正反例。

### Skill-creator 对照评测

- 10 个合成 eval；
- 当前技能版：36/36 assertions；
- 提交态旧版/无总控基线：31/36 assertions；
- 宏平均 pass rate：100% vs 87.5%；
- 增益集中在 canonical 路由和深度分析的双链、四类结构化产物、ID 外键、Writer 前 reviewer/validator；
- 当前技能输出字符代理平均 4200.1，基线 6954.9，减少约 39.6%。这不是 token 或算力结论。

限制：

- 每个配置只有一次运行，不能评估随机波动；
- 合成评测未实际打开案卷、调用外部来源或写 Matter Store；
- 8/10 eval 的基线已满分，主要区分度集中在 eval 1/2；
- 工具、路径和存储安全由独立确定性测试覆盖；
- 法律实体准确性仍需律师样本复核。

产物：

- `plugins/crablaw-cn/evals/results/benchmark.json`
- `plugins/crablaw-cn/evals/results/benchmark.md`
- `plugins/crablaw-cn/evals/results/benchmark-notes.json`
- `docs/audit/2026-08-21-crablaw-cn-v0.3.0-eval-review.html`

`skill-creator` 自带 quick validator 只接受通用 Agent Skills frontmatter，而本仓库的 CrabCode
presentation contract 还要求 `short-description` 和 `argument-hint`，两者格式不兼容。本次保留仓库原生字段，并以 presentation/manifest/完整性测试为准。

## 7. 最终验证

共享工作区同时存在另一个 `crabcopyright-cn` 在途任务，直接全仓命令会读取其未完成文件并产生与本任务无关的版本/layout 错误。本任务没有覆盖或纳入这些文件。

为排除交叉污染，基于当前 HEAD 建立临时隔离树，只叠加本任务文件：

- `bun run validate`：PASS（仅既有非阻断 warning）；
- `bun test ./tests/`：204 pass / 7 skip / 0 fail；
- assertions：2493；
- `bun run typecheck`：PASS（隔离树链接仓库现有 `node_modules`）；
- `git diff --check`：PASS；
- source overlap：0 match pairs。

七项 skip 是 CrabCode Security 上游对象/部分检出测试的既有环境跳过，不是 CrabLaw 失败。

## 8. 交付边界

- 工程实施完成；
- 用户真实 Matter Store 未修改；
- 未自动安装或更新个人插件缓存；
- 未发送、提交或发布任何法律材料；
- 法律专业复核和外发批准仍为人工门；
- PR 必须由管理员复核，自动化不得合并。

## 9. CI 触发策略补充

根据用户追加决策，仓库 CI 已从自动 `pull_request` / `push main` 改为仅
`workflow_dispatch`。完整影响分析、人工 API、关联方和本机测试基线见：

- `docs/audit/2026-08-21-全仓CI自动触发暂停与本机验证补充审计.md`

镜像发布和镜像健康审计不是 CI 测试，原触发方式保持不变；镜像审计对 CI 运行记录的
查询已取消 `event=push` 限定，以兼容人工调度和历史运行。

本机最终验收已覆盖根仓库、Security 锁定上游差分、HTML Video、Media Ops、
Media Publisher 和 actionlint；详细计数、环境差异及本机依赖修复均记录在上述补充
审计文档。合并前因旧 required checks 与人工调度事件不兼容，最终工程 HEAD 通过
全局 API 人工运行 CI，run `32579055627` 为 8/8 success；没有恢复自动 CI。

交付后最终复核结论：

- `docs/audit/2026-08-22-crablaw-cn-v0.3.0-交付后复核审计.md`
