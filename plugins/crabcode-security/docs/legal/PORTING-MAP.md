# CrabCode Security 全源码移植来源与映射说明

## 1. 审计结论与边界

本移植的源码基线不是分支名、标签或 `main` 的浮动快照，而是下列不可变 Git 对象：

- 上游仓库：`https://github.com/anthropics/claude-plugins-official.git`
- 固定提交：`4b3d2a2a965ce1a36eb4b03078db891ab46bc257`
- 提交根树：`0961f052c654edbaf6d5f5c1da676920ddc38706`
- 上游插件子树：`plugins/claude-security`
- 插件子树对象：`e6d006720d46909dd1295a03c41efe11957ec5ec`
- 上游声明版本：`0.10.0`；CrabCode 分叉版本：`0.10.0-crabcode.1`
- 源文件：25 个，共 246,940 字节
- 源文件清单 SHA-256：`c1273995451841d9ae9f1015683920efdd47c4006ab31589b04e62b35ca88a7d`

这里的“100% 源码移植”先回答源码集合与可重放派生是否完整，并把行为结论分层：

1. **集合完整性**：固定子树中的 25 个文件全部有且仅有一个目标文件，不允许漏文件、用摘要替代源码、把多个文件合并后声称已迁移，或用新增测试抵消缺失源码。
2. **确定性宿主合同**：品牌、命名空间、宿主契约和打包格式可以适配，但扫描算法、常量、结构化数据格式、安全边界和失败语义不得借适配之名被删减；这一层由差分、host simulator 和脚本测试证明。
3. **模型行为等价**：Agent 输出质量具有随机性，不能由文件哈希、patch 重放或确定性测试推导，必须另经固定 corpus 的配对评估；当前仍是 promotion 开放项。

上游根市场文件不属于 25 个插件子树文件，但它决定插件的上架身份，因此单独锁定了完整市场文件及唯一匹配条目。`docs/legal/` 下的来源锁、条目快照、映射说明和重放 patch 都是移植证据，不计入上游 25 文件，也不替代其中任何一个目标文件。

机器可读的唯一事实源是 [SOURCE-LOCK.json](./SOURCE-LOCK.json)；上游市场条目的语义快照是 [UPSTREAM-MARKETPLACE-ENTRY.json](./UPSTREAM-MARKETPLACE-ENTRY.json)，待发布的 CrabCode 条目是 [TARGET-MARKETPLACE-ENTRY.json](./TARGET-MARKETPLACE-ENTRY.json)，逐字节适配重放载体是 [FULL-PORT.patch](./FULL-PORT.patch)。

## 2. 哈希口径

源文件清单摘要按以下方式复算：

1. 枚举固定提交的 `plugins/claude-security` 子树内全部 blob。
2. 使用仓库相对路径按 UTF-8 升序排序。
3. 每个文件编码为 `sourcePath<TAB>decimalSize<TAB>lowercaseSha256<LF>`。
4. 无表头拼接 25 条记录后计算 SHA-256。

该口径故意同时绑定路径、字节数和内容；只改文件名、只换同尺寸内容或只保留部分文件都会使摘要失效。每个文件还记录 Git blob SHA-1、Git mode 和独立 SHA-256，可与 `git ls-tree -r -l`、`git cat-file` 及本地哈希工具交叉验证。

市场来源采用两级证据：

- 固定提交中的 `.claude-plugin/marketplace.json`：158,611 字节，SHA-256 为 `f313d12222ef9e33b132d01ae2bae674fbe540bfbe18c5fa1d14d5977618d1b7`，Git blob 为 `4469f32a4ac74d846d20e556a99bbd28509b2bf6`。
- 在 `/plugins` 数组中以 `name == "claude-security"` 选择，预期且实得恰好 1 条。对该对象递归按键名排序、移除无意义空白并保留一个尾随换行后的 594 字节规范形式，其 SHA-256 为 `648dadb6149a4d98bc8dd1b17218129eb4d10409ee037b85d327580dff0b894f`。

选择器的“恰好一个”是完整性条件：零条意味着来源不再存在，多条意味着名称已不再能唯一标识来源；两种情况都必须失败，不能任选一条继续。

目标本地可复现 seal 的实证值为：

- 25 个目标产品文件共 `361113` 字节；目标清单 SHA-256 为 `ec70515a65b70c370669ac710eacdd8f18b7193757b574262fc06926544e4bea`。
- `FULL-PORT.patch` 为 `475580` 字节，SHA-256 为 `da912e2ca5e002816ccb9ee3818ea30ff46fe6a9788a0df17fbe05894b99ba08`。重放不是“对空目录只应用一个 patch”：校验器先在空临时目录按锁定路径和 mode materialize 固定上游的 25 个 blob，再以 `git apply -p2` 重建目标的 25 个路径、mode 和字节。
- 活动 `.crabcode-plugin/marketplace.json` 中 `crabcode-security` 实得 `0` 条；这个 selector 零匹配只作为 promotion 快照，不绑定无关的 Marketplace 元数据版本。候选条目仅保存在 `TARGET-MARKETPLACE-ENTRY.json`，状态为 `staged-not-active`，其规范 SHA-256 为 `32cdc33f271035c5e418214e7d9dccaf58058fce7d8804e0303e676ebcafe090`。
- patch generator、sealer 和 verifier 的版本、字节数、SHA-256，显式 normalization 规则及 seal 环境均已写入 `SOURCE-LOCK.json`；`bun run scripts/build-crabcode-security-port-patch.ts --check <完整上游 checkout>` 可复算 patch，`bun run scripts/verify-crabcode-security-port.ts <完整上游 checkout>` 已执行 `505` 项检查。
- 当前证据尚未进入最终公开 commit，因此是“本地可复现 seal”，不是不可变发布封存；commit/CI Gate 仍开放。

## 3. 允许的改动轴

`SOURCE-LOCK.json` 对每个目标文件声明 `changeAxes`。轴是允许审查的变化类别，不是任意改写授权：

- `brandRename`：上游产品、厂商和模型家族品牌改为 CrabCode 安全术语。
- `namespaceRename`：插件、技能、代理、工作流、命令及内部标识改为 `crabcode-security`。
- `pluginPackageLayout`：`.claude-plugin` 适配为 `.crabcode-plugin`。
- `manifestMetadata`：适配 CrabCode 必填字段、分叉版本、作者、许可证和关键词。
- `hostContract`：适配工具名、指令文件、配置路径、命令语法和宿主生命周期。
- `modelPolicy`：把上游模型别名及推理强度改为 CrabCode 的动态语义能力 `best` / `inherit` 与 `max`，不写死具体模型 ID。
- `presentationMetadata`：仅适配 CrabCode Marketplace/Skill 的中文展示字段；调用身份仍由目录名稳定提供，模型核心工作流正文不借此改写。
- `environmentVariables`：把插件根目录等宿主环境变量改为 CrabCode 变量。
- `artifactNamespace`：改写报告、运行目录、元数据和补丁产物前缀，格式保持不变。
- `documentationLinks`：移除不真实的上游安装、沙箱、产品和仓库链接，改为真实的 CrabCode 指引。
- `supportChannel`：替换上游厂商联系方式与漏洞报告渠道。
- `legalBrandText`：按本次要求对复制的法律文本执行品牌文本替换；此项只描述来源差异，不作法律判断。
- `hookEvent`：把 `UserPromptExpansion` 适配为 CrabCode 的 `UserPromptSubmit` 输入过滤。
- `bannerPresentation`：替换品牌文案与字符画，不改变“仅展示、不作权限决策”的性质。
- `securityHardening`：增加目标侧 fail-closed 校验、不可变快照归属、路径 containment、并发/生命周期和 prompt 边界控制；不得删除任何上游扫描阶段或结果合同。

任何不落在目标文件已声明轴内的变化，都应被视为未解释差异。即使落在某个轴内，只要造成能力减少、分支遗漏、常量变化或失败策略改变，也不能据此通过审计。

## 4. 25 文件一一映射

| # | 上游路径（相对插件根） | CrabCode 目标路径（相对插件根） | 允许改动轴 |
|---:|---|---|---|
| 1 | `.claude-plugin/plugin.json` | `.crabcode-plugin/plugin.json` | `brandRename`, `namespaceRename`, `pluginPackageLayout`, `manifestMetadata`, `presentationMetadata`, `supportChannel`, `securityHardening` |
| 2 | `LICENSE` | `LICENSE` | `brandRename`, `legalBrandText` |
| 3 | `README.md` | `README.md` | `brandRename`, `namespaceRename`, `pluginPackageLayout`, `hostContract`, `environmentVariables`, `artifactNamespace`, `documentationLinks`, `supportChannel`, `securityHardening` |
| 4 | `SECURITY.md` | `SECURITY.md` | `brandRename`, `pluginPackageLayout`, `hostContract`, `artifactNamespace`, `documentationLinks`, `supportChannel`, `securityHardening` |
| 5 | `agents/claude-security.md` | `agents/crabcode-security.md` | `brandRename`, `namespaceRename`, `hostContract`, `modelPolicy`, `environmentVariables` |
| 6 | `agents/explore.md` | `agents/explore.md` | `brandRename`, `hostContract`, `modelPolicy`, `securityHardening` |
| 7 | `agents/patch-generator.md` | `agents/patch-generator.md` | `brandRename`, `namespaceRename`, `hostContract`, `modelPolicy` |
| 8 | `agents/patch-verifier.md` | `agents/patch-verifier.md` | `namespaceRename`, `hostContract`, `modelPolicy` |
| 9 | `agents/scan-inventory.md` | `agents/scan-inventory.md` | `brandRename`, `hostContract`, `modelPolicy`, `securityHardening` |
| 10 | `agents/scan-researcher.md` | `agents/scan-researcher.md` | `brandRename`, `namespaceRename`, `hostContract`, `modelPolicy`, `securityHardening` |
| 11 | `agents/scan-verifier.md` | `agents/scan-verifier.md` | `brandRename`, `namespaceRename`, `hostContract`, `modelPolicy` |
| 12 | `hooks/banner_hook.sh` | `hooks/banner_hook.sh` | `environmentVariables`, `hostContract`, `hookEvent` |
| 13 | `hooks/banner_notice.py` | `hooks/banner_notice.py` | `brandRename`, `namespaceRename`, `hostContract`, `hookEvent`, `bannerPresentation` |
| 14 | `hooks/hooks.json` | `hooks/hooks.json` | `brandRename`, `namespaceRename`, `environmentVariables`, `hookEvent` |
| 15 | `scripts/patch_artifacts.py` | `scripts/patch_artifacts.py` | `brandRename`, `namespaceRename`, `artifactNamespace`, `securityHardening` |
| 16 | `scripts/render_report.py` | `scripts/render_report.py` | `brandRename`, `namespaceRename`, `artifactNamespace`, `securityHardening` |
| 17 | `scripts/write_scan_meta.py` | `scripts/write_scan_meta.py` | `brandRename`, `namespaceRename`, `artifactNamespace`, `securityHardening` |
| 18 | `skills/claude-security/SKILL.md` | `skills/crabcode-security/SKILL.md` | `brandRename`, `namespaceRename`, `hostContract`, `presentationMetadata`, `environmentVariables`, `artifactNamespace`, `documentationLinks`, `securityHardening` |
| 19 | `skills/claude-security/jobs/scan-changes.md` | `skills/crabcode-security/jobs/scan-changes.md` | `brandRename`, `namespaceRename`, `hostContract`, `environmentVariables`, `artifactNamespace`, `securityHardening` |
| 20 | `skills/claude-security/jobs/scan-codebase.md` | `skills/crabcode-security/jobs/scan-codebase.md` | `brandRename`, `namespaceRename`, `hostContract`, `environmentVariables`, `artifactNamespace`, `securityHardening` |
| 21 | `skills/claude-security/jobs/suggest-patches.md` | `skills/crabcode-security/jobs/suggest-patches.md` | `brandRename`, `namespaceRename`, `hostContract`, `environmentVariables`, `artifactNamespace`, `securityHardening` |
| 22 | `skills/claude-security/role.md` | `skills/crabcode-security/role.md` | `brandRename`, `namespaceRename`, `hostContract`, `securityHardening` |
| 23 | `skills/claude-security/specs/patch-spec.md` | `skills/crabcode-security/specs/patch-spec.md` | `brandRename`, `namespaceRename`, `artifactNamespace`, `securityHardening` |
| 24 | `skills/claude-security/specs/report-spec.md` | `skills/crabcode-security/specs/report-spec.md` | `brandRename`, `namespaceRename`, `artifactNamespace`, `securityHardening` |
| 25 | `workflows/scan.js` | `workflows/scan.js` | `brandRename`, `namespaceRename`, `securityHardening` |

每一行的完整 mode、size、SHA-256、Git blob SHA-1、仓库相对源路径和仓库相对目标路径见 `SOURCE-LOCK.json`。上表必须与其中的 `files` 数组保持 25/25 同构；任何一边单独更新都应使校验失败。

## 5. 逐文件改动、证据与残余账本

“改名”按相对插件根的完整路径判断；父目录改名也记为“是”。“具体修改点”说明实际差异，而不是重复抽象改动轴。三个 Python 脚本和 `scan.js` 进一步列出主要逻辑 hunk，避免以品牌替换掩盖目标侧安全加固。表中未带目录的插件测试名均位于 `tests/crabcode-security/`，Core 测试名位于私有 Core 的 `tests/unit/` 或 `apps/agent-worker/tests/`；不使用模糊通配符代替证据定位。“完整 patch 人审”与自动测试分开命名，不能把人工阅读冒充机器证明。Core 相关项只标记为未提交 preview 旁证，绑定私有审计归档 SHA256 `ac44903283333577424e09f817e8b31a1de1701a5ba7b723ce0b209193b399d3`，不与插件仓内可重放证据混称稳定发布证明。机器证据只证明确定性合同；“未关闭”栏保留不能从源码重放、人工差异复核或单元测试推出的事项。

| # | 改名 | 具体修改点 | 审计证据 / preview 旁证 | 尚未关闭 |
|---:|:---:|---|---|---|
| 1 | 是 | `.claude-plugin`→`.crabcode-plugin`；名称、派生版本、描述、作者、许可证字段、关键词和 Skill 声明适配 CrabCode；描述补充可信仓库和模型提供方边界。 | `source-integrity.test.ts`；manifest/presentation validators；505 项 verifier | 正式最低 Core 版本 Gate、真实安装/升级路径 |
| 2 | 否 | 仅对复制法律文本中的产品/主体品牌执行逐处文本替换；段落结构和条款次序保留。 | `source-integrity.test.ts`；完整 patch 重放 | 不产生运行时行为；最终发布审阅仍需绑定实际 commit |
| 3 | 否 | README 品牌、命令、路径、变量和产物前缀适配；新增 runtime 未发布警告、可信仓库/已加载项目配置边界、模型推理数据去向、原子 snapshot/owner marker、scratch 非沙箱及不自动 apply/commit/push 说明。 | `source-integrity.test.ts`；brand/reference validators | 用户理解度、真实安装器和 CLI/GUI 体验 |
| 4 | 否 | 私密披露入口改为真实 CrabCode Security Advisory；版本路径、in/out-of-scope、可信仓库、模型数据和“不可信仓库需 OS 隔离 + clean profile”边界重写。 | `source-integrity.test.ts`；brand/reference validators | Security/Privacy owner 签署与事故演练 |
| 5 | 是 | 主 Agent 与命令/Workflow/子 Agent namespace 全量改名；`opus/xhigh` 映射为 `best/max`；把上游既有 `initialPrompt`、插件根变量和显式可调用 Agent allowlist 适配到 CrabCode，保留固定启动确认和不自动提交合同。 | `source-integrity.test.ts`；完整 patch 人审；Core `workflow-agent-contract`、main-agent scope 为 preview 旁证 | AppServer 动态 `--agents` 定义合同；模型端到端质量 |
| 6 | 否 | `sonnet/xhigh` 映射为 `inherit/max`；把已在会话建立时加载的配置与工具新读到的文件副本明确分层，保留绝对 `SCAN_ROOT` 和只读探索。 | `source-integrity.test.ts`；完整 patch 人审；Core 嵌套 Agent/权限测试为 preview 旁证 | 提示注入防护的模型统计效果；hostile repository 不受支持 |
| 7 | 否 | effort 与 `explore` namespace 适配；生成器职责、scratch 内编辑、单 finding 和不得写 live checkout 的合同保持。 | `source-integrity.test.ts`；patch 脚本状态机测试；完整 patch 人审 | 真实项目测试的 OS 级隔离只属于未来不可信仓库范围 |
| 8 | 否 | effort 与 `explore` namespace 适配；独立 verifier、三项 confidence claim、测试与 reviewed paths 合同保持。 | `source-integrity.test.ts`；patch 脚本状态机测试；完整 patch 人审 | 随机 verifier 判断质量和真实项目测试覆盖 |
| 9 | 否 | 产品品牌与模型别名适配；把仓库工具新读内容限定为数据，同时承认已加载项目配置；保留上游按顶层目录分区和列账的 Agent 职责。根文件也进入覆盖账本的扩展实际发生在第 17、20、24 行，不归功于本文件。 | `source-integrity.test.ts`；完整 patch 人审；`workflow.test.ts`、`workflow-edge-cases.test.ts` 仅作为跨文件调度旁证 | 模型组件划分质量；不可信仓库 clean profile |
| 10 | 否 | 品牌、effort、`explore` namespace 适配；提示注入文字改为“新读数据”口径，保留漏洞类别、证据门槛和结构化返回。 | `source-integrity.test.ts`；完整 patch 人审；`workflow.test.ts`、`workflow-edge-cases.test.ts` 仅作为跨文件调用旁证 | 与锁定上游的发现率/误报率配对评估 |
| 11 | 否 | 品牌、effort、`explore` namespace 适配；独立反证、三票 panel 和结构化 vote 合同保持。 | `source-integrity.test.ts`；完整 patch 人审；`workflow.test.ts`、`workflow-edge-cases.test.ts` 仅作为跨文件调用旁证 | 模型投票校准与统计非劣性 |
| 12 | 否 | 保留 `100755`；入口改为 CrabCode banner helper。因 CrabCode 无上游的预过滤 matcher，目标把命令识别集中到 Python；若 `python3` 不存在，shell 必须静默 fail-open，避免对每次 `UserPromptSubmit` 全局误报。这是显式宿主能力差异，不冒充等价。 | `banner.test.ts` 覆盖目标/非目标命令、无 Python 静默和 Python `<3.9` 分支；shell syntax；mode verifier | 无 Python 时不能像上游一样只对目标命令显示缺失提示；未测试平台的 shell 启动行为 |
| 13 | 否 | manifest 路径、品牌和字符画适配；新增 stdin Hook payload 解析，只对白名单 slash command 及其参数输出；非目标/畸形输入静默成功，版本不足仍只提示不决策。 | `banner.test.ts`；Python syntax；mode verifier | 未测试终端的显示宽度/编码 |
| 14 | 否 | `UserPromptExpansion`→`UserPromptSubmit`；变量改为 `CRABCODE_PLUGIN_ROOT`；移除宿主不支持的 matcher，交由 helper 精确筛选；保持 display-only。 | `banner.test.ts` 精确断言 `hooks.json` 事件、命令和行为；manifest/layout validators 仅作包结构旁证 | 真实打包 Core 的 Hook 事件 E2E |
| 15 | 否 | 品牌/产物前缀适配；新增 regular/no-follow 输入、canonical containment、严格 finding path、报告/HEAD/revision/results 哈希校验、128-bit nonce 双 owner、单位全集预检、Git diff header 与 `numstat -z` 路径集合对账、碰撞/并发拒绝及 marker-bound allowlist 清理。真实双进程补测曾发现 losing contender 会回滚 winning lease 的 TOCTOU；现以 `run_root_created` 所有权标志约束回滚，仅创建者能清理自己的 lease，已覆盖全新及既有 products owner 两种竞争。 | `scripts.test.ts`；`scripts-edge-cases.test.ts`（并发、results/owner 篡改）；`upstream-differential.test.ts` | portable Python 路径检查仍有同用户 TOCTOU；rename/copy/C-quoted/non-UTF8/`.git` diff 与中途 I/O/SIGKILL 尚无完整故障注入 |
| 16 | 否 | 品牌/产物前缀适配；新增 bounded regular-file 读取、analysis snapshot digest、严格仓库相对路径/行号、精确三票与 ledger 算术、confidence clamp、canonical report/run 双 owner、dirty/unversioned revision 命名及受控旧 stamp 清理。 | `scripts.test.ts`；`scripts-edge-cases.test.ts`；`write-scan-meta.test.ts`（非空 snapshot digest 双向篡改）；`upstream-differential.test.ts` | 模型 finding 真伪不由 renderer 证明；64 MiB 上限及产物写入后删除失败/SIGKILL 尚无完整故障注入 |
| 17 | 否 | 品牌/产物前缀适配；由“写入既有 run”升级为原子 nonce run 分配；创建 report/run 双 owner 与 `.gitignore`，锁定 source 后构建 clean/dirty/non-Git analysis snapshot，拒绝逃逸 symlink/special file，记录 source/analysis revision、snapshot kind、内容摘要和包含根文件的 top-level entries，并检测复制期间源变化。 | `write-scan-meta.test.ts`（含普通 clean-HEAD 全库 snapshot）；`scripts-edge-cases.test.ts`；`upstream-differential.test.ts` | compatibility 模式仍是 live source；复制中 source 突变、gitlink 和 SIGKILL 尚无完整故障注入；非 Git copy 不是 OS 沙箱 |
| 18 | 是 | Skill 身份、Workflow/Agent allowlist、命令、路径变量和报告前缀适配；增加中文 `name`/`short-description`；安全说明区分已加载配置与新读数据，披露模型提供方，并明确不支持不可信仓库。 | `source-integrity.test.ts`；presentation/reference validators；完整 patch 人审 | 真实菜单、权限提示和旧 Core 拒绝 UX |
| 19 | 是 | Workflow/品牌适配；Git 读增加 `GIT_OPTIONAL_LOCKS=0`；branch/PR/commit 先冻结完整 ENDPOINT，不在后续偷换 HEAD；改用 helper 原子创建 run 与 endpoint snapshot，Workflow 只读 analysis root，并沿用严格 renderer。 | `source-integrity.test.ts`；`scripts.test.ts`；`scripts-edge-cases.test.ts`；`write-scan-meta.test.ts`；完整 patch 人审；`workflow.test.ts`、`workflow-edge-cases.test.ts` 为跨文件间接证据 | branch/PR/commit 三路径真实 CLI/GUI E2E |
| 20 | 是 | Workflow/品牌适配；Git 读禁止 index refresh；由手工 `mkdir` 改为 helper 原子 owner-bound run；clean/dirty/non-Git 均读取冻结 analysis root；覆盖账本由目录扩展到所有 immediate root entries。 | `source-integrity.test.ts`；`scripts.test.ts`；`scripts-edge-cases.test.ts`；`write-scan-meta.test.ts`；完整 patch 人审；`workflow.test.ts`、`workflow-edge-cases.test.ts` 为跨文件间接证据 | 全库/限定范围/非 Git 的真实制品 E2E |
| 21 | 是 | 品牌/Agent namespace 适配；在选 finding 前执行 `--validate-report`，由 `--prepare-run` 返回 nonce/owner-bound 路径；固定 PATCH BASE 和 validated paths，在 scratch checkout 顺序生成/验证；renderer 对 diff/REVIEWED_PATHS/owner/hash 做全量预检并只清理 marker-bound 路径。 | `scripts.test.ts`；`scripts-edge-cases.test.ts`；Core 嵌套 Agent/取消测试仅为 preview 旁证 | 真实大型仓项目测试、崩溃恢复和磁盘压力 |
| 22 | 是 | 团队/Workflow 品牌适配；信任文字区分会话已加载配置与工具新读数据；披露模型 provider；保持单命令 Bash、用户沟通和不自动执行报告内容。 | `source-integrity.test.ts`；reference validator；完整 patch 人审 | 用户交互和长任务真实 E2E |
| 23 | 是 | 从两层产物合同扩展为“owner records + decision record + byte-faithful products”；逐项记录 nonce、报告/仓库/revision/results 绑定、路径/diff 对账、全量预检、受控清理和同用户 TOCTOU 残余。 | `source-integrity.test.ts`；`scripts.test.ts`；`scripts-edge-cases.test.ts`；完整 patch 人审 | 文档合同仍需真实制品消费方 E2E |
| 24 | 是 | 品牌/文件名适配；报告首段区分 source root 与 analysis root/snapshot；coverage 从顶层目录扩展到所有根条目；同步严格 path/line、panel/ledger、dirty/unversioned 和不可夸大验证状态的合同。 | `scripts.test.ts`；`scripts-edge-cases.test.ts`；`write-scan-meta.test.ts`；`workflow.test.ts`；`workflow-edge-cases.test.ts` | 人类报告可读性与模型叙述质量 |
| 25 | 否 | 精确差异为 3 处展示品牌、3 处 slash command、3 个 `agentType` namespace，以及 XML escaper 增加 `&/< />` 实体编码并在 whole-tree context、inventory、threat model、sweep、panel、max red-team 共 6 个 `scanRoot` 插值点调用；没有独立 runtime API 或算法 hunk。逆品牌并撤销这两类 escaping 加固后与固定上游逐字节相等，5 文件/300 行阈值、12/24 component cap、400/45 candidate cap、8s/25s retry、三票、2/3 quorum 与 max adversarial 控制流均未改变。 | `workflow.test.ts`；`workflow-edge-cases.test.ts` 覆盖六阶段和原始 `&`；`workflow-host.ts`；`upstream-differential.test.ts` 的精确逆变换；Core runtime/预算/调度仅为 preview 旁证 | provider 随机输出等价、真实制品时延/成本/取消表现；当前产品把宿主给出的 canonical `scanRoot` 纳入可信会话边界，escaping 只是纵深防御而非 hostile-input 沙箱。若未来把路径也视为不可信，仍需结构化/围栏通道并验证特殊字符路径的模型识别 |

## 6. 分组交叉复核

下表把上面的 25 行全部纳入至少一个测试组。它不把“有测试文件”夸大为模型质量等价；测试编号采用仓库内稳定文件路径，具体 test case 名由测试运行器列出。

| 映射行 | 差异焦点 | 确定性证据 | 尚未由该证据证明 |
|---|---|---|---|
| 1–4 | manifest、品牌、信任/数据边界、文档链接 | `source-integrity.test.ts`、仓库 `validate`、brand/reference validators | 用户对文案的理解、真实安装器兼容性 |
| 5–11 | 七个 Agent 的 namespace、工具/子 Agent allowlist、模型/effort 语义和 prompt 数据边界 | `source-integrity.test.ts`、完整 patch 人审；Core preview 的 `workflow-agent-contract` 与 main-agent scope 旁证 | 模型发现质量与固定上游的统计非劣性；CLI `--agents` flagSettings 跨进程定义 |
| 12–14 | Hook 事件、环境变量、仅命令触发、Banner | `banner.test.ts`、shell/Python syntax gate | 未测试平台的原生启动行为 |
| 15–17 | 元数据、报告、补丁状态机以及 target-only fail-closed 加固 | `scripts.test.ts`、`scripts-edge-cases.test.ts`、`write-scan-meta.test.ts`、`upstream-differential.test.ts` | hostile repository 的 OS 级隔离；SIGKILL 后同进程自动清理 |
| 18–24 | Skill/Role/Job/Spec 路由、输入模式、产物合同和信任措辞 | `source-integrity.test.ts`、`scripts.test.ts`、`scripts-edge-cases.test.ts`、仓库 presentation/reference validators | 真实 CLI/GUI 七输入 E2E、模型输出质量 |
| 25 | cap、retry、dedupe、coverage、panel、quorum、adversarial、失败传播 | `workflow.test.ts`、`workflow-edge-cases.test.ts`、`workflow-host.ts`、`upstream-differential.test.ts`；Core runtime/预算/调度只作 preview 旁证 | provider 随机输出的统计等价、真实发布制品表现 |
| 1–25 + Marketplace | blob/mode/path 一一映射、目标字节、patch 可重放、候选未激活 | `provenance-verifier.test.ts`、`source-integrity.test.ts`、generator `--check`、505 项 verifier | 语义正确性、模型质量和 GA readiness |

当前分层结论：

- `source-set/replay-complete = YES`；
- `deterministic-host-contract-tested = YES`（只对已运行的确定性合同）；
- `model-behavior-equivalence = PENDING`；
- `GA-not-complete = YES`。

## 7. 审计和升级规则

一次可接受的来源审计至少要同时满足：

1. `commit`、提交根树和插件子树对象全部匹配。
2. 上游子树正好 25 个文件、246,940 字节，清单摘要匹配。
3. 每个文件的 mode、size、SHA-256 和 Git blob SHA-1 匹配。
4. 25 个 `sourcePath` 与 25 个唯一 `targetPath` 一一对应，`unmappedSourcePaths` 和 `duplicatedTargetPaths` 都为空。
5. 市场文件哈希匹配，选择器实得且仅得一条，规范条目哈希匹配快照。
6. 目标文件的所有差异都能被该文件的 `changeAxes` 解释，并由上节确定性测试覆盖；模型行为不得由此自动判为等价。
7. CrabCode 仓库可以存在新增测试、来源证明和运行时适配文件，但这些新增物不得被计作 25 个移植文件。
8. 在空临时目录先从固定上游对象 materialize 25 个 blob，再应用锁定的 `FULL-PORT.patch`；目标路径、mode、类型、字节和 25 文件集合必须逐项等于当前目标。
9. 活动 Marketplace 中目标选择器必须为零，staged 条目规范哈希必须匹配；来源完整不自动授权发布。

以后同步上游时不得直接覆写本锁。必须选择新的完整 commit，重新记录三个 Git 对象、25 文件集合（若数量变化则使用新数量）、逐文件哈希和市场条目，再对每个新增、删除、改名及逻辑差异作显式评审。旧锁应随发布历史保留，使任何发布都能反向定位到唯一上游字节集合。
