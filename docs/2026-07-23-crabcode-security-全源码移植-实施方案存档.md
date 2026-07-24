# CrabCode Security 全源码移植——实施方案存档

> 本文件既是实施依据，也是 2026-07-23 深度复核后的审计与实施记录。
>
> 当前结论分为四条不可混用的口径：固定上游快照达到 `source-set/replay-complete`；已运行的确定性合同达到 `deterministic-host-contract-tested`；随机模型行为的统计等价仍是 `model-behavior-equivalence: PENDING`；产品发布仍为 `GA-not-complete`。Marketplace 只能保持 `staged-not-active`，各 Gate 只按可重放、可定位的实证标记，不因文件已经复制或 preview 代码存在就把模型质量、真实制品或发布状态写成完成。
>
> 本方案按“固定上游快照、100% 源码派生改造”设计。许可问题不作为本技术方案的实施 Gate，本文件也不评价最终分发条件。

---

## 0. 元信息

- 文档日期：2026-07-23
- 文档状态：深度复核并修订；25/25 源码集合与重放完成、确定性合同已测试，模型行为等价和 GA Gate 未关闭，以第 14 节实施审计记录为准
- 工作仓：`/Users/fushihua/Desktop/CrabCode-Plugin`
- 上游仓库：`anthropics/claude-plugins-official`
- 上游插件目录：`plugins/claude-security`
- 上游固定提交：`4b3d2a2a965ce1a36eb4b03078db891ab46bc257`
- 上游插件版本：`0.10.0`
- 上游固定快照：[claude-security@4b3d2a2](https://github.com/anthropics/claude-plugins-official/tree/4b3d2a2a965ce1a36eb4b03078db891ab46bc257/plugins/claude-security)
- 目标插件目录：`plugins/crabcode-security`
- 目标技术 ID：`crabcode-security`
- 目标显示名：`CrabCode 深度安全扫描`
- 建议首个派生版本：`0.10.0-crabcode.1`
- Marketplace 分类：`security`
- Marketplace 层级：`workflow`
- 现有轻量插件：`plugins/crabcode-security-review`

### 0.1 方案裁决优先级

实施中出现冲突时，按以下顺序裁决：

1. 不破坏本方案第 3 节定义的安全不变量；
2. 保持上游固定快照的可观察行为与确定性算法；
3. 满足 CrabCode 当前实际运行时合同；
4. 满足本仓 manifest、layout、marketplace、brand 和 reference 校验器；
5. 保持品牌和产品体验一致；
6. 最后才考虑实现便利性或代码风格。

任何为了“先跑起来”而删除验证面板、覆盖账本、scratch checkout、报告校验或路径围栏的做法，均视为不合格移植。

### 0.2 深度复核结论

本次复核不以“25 个文件已经出现”为完成标准，而从源码来源、宿主可执行性、确定性行为、失败语义、生态关联方和发布边界六个方向逆向检查。原方案存在以下 P0 缺口，实施必须逐项关闭：

| 审计发现 | 风险 | 裁决 |
|---|---|---|
| 只列 SHA256，未锁 commit tree、plugin subtree、Git blob、mode 和 Marketplace 唯一选择器 | 可漏文件、可丢可执行位，也无法证明来自唯一快照 | 建立 `docs/legal/SOURCE-LOCK.json`，锁定 25 个 blob、5 个 `100755` 文件和外部条目 |
| 来源记录原拟放插件根目录 | 来源品牌与本仓 brand guard 直接冲突 | 权威来源材料全部放 `plugins/crabcode-security/docs/legal/`；运行时代码和用户文档仍保持品牌零残留 |
| 把 Workflow 当成插件复制后的自然能力 | 当前 CrabCode Core 的 Workflow 发现和执行是 stub，插件文件存在也不可运行 | Core runtime 是硬依赖；插件与 Core 分仓交付并独立验收，不用提示词模拟 |
| 未识别 plugin agent `initialPrompt` 和受限嵌套 Agent 合同 | 主协调 Agent 或 researcher→explore 链可能静默失效 | 纳入 Core contract 与回归测试，嵌套调用只能使用 Agent front matter 的显式白名单 |
| 机械替换会生成不存在的网站、邮箱、仓库和披露渠道 | 用户被引向虚假服务，安全报告可能泄露或丢失 | 删除臆造地址，只使用本仓真实安装源和私密 Security Advisory |
| 上游 Hook 事件在 CrabCode 不存在 | 直接照搬不会触发，或改成全局 Hook 后每条提示都显示 Banner | 映射到 `UserPromptSubmit`，由脚本读取 stdin 并只匹配本插件命令；这是明确的 `HOST` 差异 |
| Marketplace workflow 有中文展示与具体 Skill 声明要求 | 条目会被 presentation gate 拒绝 | manifest 声明 `./skills/crabcode-security`；只本地化展示字段，不改模型核心 prompt |
| 原输出矩阵把 `patches.jsonl` 写成大写，并漏写非 Git `UNVERSIONED` 与 patch/note 组合 | 文档和脚本合同漂移 | 按固定源码纠正文件名和状态矩阵 |
| `BRAND/HOST/COMPAT` 会把 prompt 改写和安全增强混成一个筐 | 无法判断是否偷改算法 | 差异分类扩为 `UNCHANGED`、`RENAME`、`BRAND`、`HOST`、`PROMPT`、`COMPAT`、`SECURITY_HARDENING`、`ADDED_TEST`、`ADDED_META` |
| 原计划把上游没有完全保证的 symlink/race/SIGKILL 收敛写成既有不变量 | 会把目标增强误称为源码等价 | 忠实移植和新增加固分开；没有专项实现与故障注入证明时不作该承诺 |
| beta/canary、质量统计和安装器最低版本字段在当前生态没有现成合同 | 容易为了“完成计划”自造字段或假灰度 | 作为 promotion gate，不伪造 manifest 字段；先用固定源码本地安装和真实 Core 制品做 canary |
| 单纯以秒级时间戳命名运行目录 | 并发或同秒重试可能碰撞、错认旧报告，清理动作无法证明所有权 | 输出目录改为 `timestamp + CSPRNG nonce` 并排他创建；扫描根、run/patch 子目录和 patch 产品分别写对应 owner marker，读取、续跑和清理均须验证直接子级与 owner 关系 |
| `patch_artifacts.py --prepare-run` 的并发 loser 会无条件回滚共享 run root | 真实双进程竞争可出现零个成功者；虽无双写或越权，仍破坏“一个 winner、其余 fail closed”的租约可用性合同 | 删除 TOCTOU 预判，以原子 `mkdir` 决定 winner；只有设置了本进程 `run_root_created` 的进程才能回滚 lease，已覆盖全新及既有 products owner 两种并发 |
| 只有哈希清单，没有从固定上游重建目标的可执行证明 | 审计者仍需相信人工映射，无法发现遗漏的目标改动 | 增加 `FULL-PORT.patch`，用“规范化上游 + patch = 规范化目标”的逐字节重放等式验收，并把 patch 哈希纳入来源锁 |
| Core preview 已补 worker/vm、强制取消和权限不升级，但缺少发布证据与 hostile-code 边界 | 容易把进程内隔离写成 sandbox，补丁测试仍可接触宿主 | preview 只证明实现方向；可信仓库 GA 仍需私有 Core commit、正式版本门槛和 CLI/GUI E2E。不可信仓库支持另需 OS 隔离与 clean profile，两者均未交付 |
| `vm` context 直接持有宿主函数/对象 | 插件脚本可沿 `constructor`/prototype 链逃回宿主 Node 全局，worker 仍不足以约束脚本面 | 宿主桥只在初始化时短暂注入，由 context 内闭包持有后删除；参数、Agent 结果和终态结果只跨 JSON 边界，并增加构造器/内建模块逃逸测试 |
| worker 收到顶层结果后立即成功，不等待已发起但未 `await` 的 Agent RPC | 子 Agent 可成为孤儿，未等待失败被吞，根任务完成后仍继续消耗权限和预算 | 成功必须等 active RPC 全部收敛；任何未等待失败使 Workflow 失败；终止时取消并限时 drain 全部子任务 |
| 嵌套 Agent 重新申请全局槽，且 coordinator/fork/KAIROS/proactive、remote isolation、handoff 可在显式 background 检查后再次把它转为异步 | 单槽时自锁，多槽时子任务脱离父取消与预算，甚至在父结束后才启动 | 嵌套前台调用借用根槽且兄弟串行；所有异步来源统一裁决并 fail closed；nested remote、foreground→background/auto-background handoff 禁止 |
| Core 用共享 abort 做清理后又以 `signal.aborted` 判断错误类型 | 普通脚本、watchdog、Agent 或预算失败会被误报为用户取消，原始错误和 failed 状态丢失 | 只有真实 `AbortError` 标记 killed/cancelled；清理性 root abort 只取消子调用，不反向改写终态 |
| `maxBudgetUsd` 只在子 Agent 启动前检查一次 | 并发分支可同时越过余额检查，单个多轮 Agent 也可持续超额 | 每个受预算顶层 `agent()` 调用在整个 provider 响应期间持有进程级预算租约，故预算模式下这些并行分支串行化；guard 传给全部嵌套 Agent，在每次模型请求前、terminal usage 后和 fallback 前检查。成本只能在 provider 返回 usage 后得知，因此严格上界仍是一条不可预知的在途响应 |
| 主 Agent 的作用域工具只在直接 QueryEngine/TUI 路径生效 | AppServer worker 会静默退回完整工具集，造成 CLI/GUI/SDK 权限和嵌套 Agent 合同分裂 | 客户端逐回合只传主 Agent 身份；worker 用 cwd-scoped activeAgents 权威精确解析并传 QueryEngine，未知/重复/超长均 fail closed；身份进入 turn-local ALS，避免并发串线 |
| 用固定重复次数、百分点和成本倍数制造“精确”质量门槛 | 没有功效分析、样本相关性和基线方差时，数字不能支持非劣结论 | 改为版本化盲测配对语料、按仓库聚类 bootstrap、预注册功效分析和判定规则；评估完成前不倒推阈值 |
| 责任表只有抽象角色，未覆盖报告留存、隐私和事故响应 | 上线后可能无人对敏感源码、漏洞报告、泄露或撤回负责 | promotion 前必须绑定真实 owner、签署证据和响应轮值；补充最小化采集、默认本地留存、删除边界、事故保全与通报流程 |
| 来源重放、确定性行为和模型质量被一个“100%”混写 | patch 能逐字节复原并不能证明随机模型输出等价，容易过早关闭质量 Gate | 拆为 `source-set/replay-complete`、`deterministic-host-contract-tested`、`model-behavior-equivalence` 和 `GA-not-complete` 四个结论 |
| “项目指令一律是数据”与宿主已加载项目配置矛盾 | 攻击者控制的仓库级指令、Hook 或 MCP 可能在扫描前已取得更高优先级 | 只把扫描工具新读到的文件副本当数据；会话建立时加载的项目指令/Hook/MCP 属于可信宿主配置。不可信仓库未来必须同时使用 OS 隔离与 clean profile |
| “不上传源码”忽略模型推理提供方 | 多 Agent prompt 和代码上下文可能按用户配置发送至远程模型服务 | 改为“无插件专属上传或 telemetry、产物默认本地”；推理数据遵循 CrabCode/模型提供方合同，并在 promotion 前确认字段、地域、保留期和关闭方式 |
| patch 有哈希但生成过程未入锁 | 无法判断 patch 是否由声明的 normalization 和工具可复算 | 增加固定 generator、sealer、verifier 版本/字节/哈希、显式 normalization、seal 环境和实际重放结果；CI 增加 generator `--check` |
| 来源锁绑定活动 Marketplace 的无关版本 | Marketplace 其他插件升级会造成来源证据假漂移 | staged 条目继续纳入来源锁；活动 Marketplace 只保留 selector 零匹配的 promotion 快照，不绑定其 metadata 版本 |
| 差分测试名称被外推到未覆盖文件 | `upstream-differential.test.ts` 原来只运行三个 Python 脚本，却曾被引用为 Agent/Job/Workflow 的证明 | 逐行删除错误引用；Agent/Job 明确使用 hash/replay、人工 patch 审阅和间接合同旁证；为 `scan.js` 新增精确逆变换测试后才引用该文件 |
| `scan.js` prompt 加固被概括成 runtime API 适配 | 实际没有 runtime API 或算法 hunk，只有品牌/namespace 与 XML 实体编码；过宽 axis 会掩盖未来差异 | 从 `SOURCE-LOCK.json` 和映射删除未发生的 `runtimeApi` axis；锁定 3+3+3 次命名替换、一个 escaper hunk 和六个 `scanRoot` 调用点，并新增六阶段 `&/< />` 测试 |
| Banner 无 Python 分支与上游行为不同 | CrabCode 无上游预过滤 matcher；shell 不解析 Hook JSON 时若全局提示，会污染每次 `UserPromptSubmit` | 明确选择无 Python 时静默 fail-open，Python `<3.9` 只对目标命令告警；两条分支均新增测试并作为宿主能力差异留档 |

### 0.3 第一性原理验收口径

“100% 源码移植”被拆为五个可独立证伪的命题：

1. **来源完备**：固定 subtree 中每个 blob 恰好映射一次，且 `normalize(upstream@commit) + FULL-PORT.patch = normalize(target)` 可逐字节重放；missing、extra、mode drift 或重放漂移任一出现即失败。
2. **功能可达**：三类任务和七种输入从真实 CrabCode 入口能到达，不以 Markdown 文件存在代替运行。
3. **确定性控制流合同**：cap、dedupe、retry、panel、adversarial、报告和补丁状态机由差分测试、host simulator 和 Core 测试证明；该结论不外推为模型输出质量等价。
4. **安全边界真实**：进程内 worker/vm 不冒充 OS sandbox；输出、续跑和清理必须绑定 nonce、owner marker 与不可变分析快照。
5. **诚实边界**：未发布 Core、未跑模型语料、未测平台或未完成 owner 签署必须标记未完成，不以“理论支持”代替证据。

因此本文件使用四个互不替代的完成标签：

- `source-set/replay-complete`：固定快照的 25/25 源码、目录外条目与目标派生可逐字节重放；
- `deterministic-host-contract-tested`：固定算法与宿主合同已通过确定性测试，但不包含随机模型质量；
- `model-behavior-equivalence`：必须由预注册配对 corpus 证明，当前为 `PENDING`；
- `GA-ready`：可信仓库产品还要求正式 Core 制品、版本门槛、真实 E2E、盲测语料、owner 签署、canary 与回滚全部通过；OS 隔离与 clean profile 是未来“不可信仓库支持”的联合 Gate，不冒充已完成能力。

---

## 1. 核心决策

### 1.1 采用独立插件，不覆盖现有轻量审查

新插件固定使用：

```text
plugins/crabcode-security
```

现有 `plugins/crabcode-security-review` 保持不动，继续承担快速分支变更审查。

二者定位如下：

| 插件 | 定位 | 层级 |
|---|---|---|
| `crabcode-security-review` | 轻量、快速、聚焦待提交 diff 的安全审查 | capability |
| `crabcode-security` | 深度、多 Agent、带独立验证和补丁产物的完整扫描工作流 | workflow |

采用独立插件的原因：

- 可以建立上游 25 个文件到目标文件的 1:1 映射；
- 避免把当前轻量实现与完整派生源码混在同一版本历史中；
- 便于后续按上游提交同步和审阅差异；
- 新插件出现问题时，可独立回滚，不影响现有安全审查能力。

### 1.2 保留源码语言和控制结构

- 三个 Python 脚本继续使用 Python 3.9+，不重写为 TypeScript。
- `workflows/scan.js` 继续承担代码控制的多 Agent 编排，不改成提示词自调度。
- POSIX Banner Hook 先按原结构适配；跨平台增强作为追加能力，不取代原文件。
- 原有 Agent、Skill、Job、Spec 的职责边界全部保留。
- 允许增加 CrabCode 宿主兼容层、测试和来源锁定文件。

### 1.3 允许的源码修改类别

每处相对上游的修改必须标记为以下类别之一：

| 类型 | 含义 | 示例 |
|---|---|---|
| `UNCHANGED` | 字节和模式均保持 | 无需宿主适配的确定性逻辑 |
| `RENAME` | 只改变路径，不改变正文 | Agent 或 Skill 目录技术 ID |
| `BRAND` | 用户可见名称、标识符和产物品牌迁移 | 名称、命令、Banner、报告前缀 |
| `HOST` | 上游宿主协议到 CrabCode 协议的映射 | manifest、环境变量、Hook、工具名 |
| `PROMPT` | 模型可见提示发生必要变化 | 项目指令文件名、工具调用协议 |
| `COMPAT` | 为维持原行为必须进行的兼容改动 | 模型能力别名、Python/平台适配 |
| `SECURITY_HARDENING` | 超出固定上游行为的安全增强 | 若新增 symlink/race 围栏，必须独立测试 |
| `ADDED_TEST` | 目标生态新增验证代码 | host simulator、差分测试 |
| `ADDED_META` | 来源、审计和发布元数据 | source lock、porting map |

`COMPAT` 不能作为无法解释差异的兜底。任何模型核心 prompt 或安全算法变化必须单独列出，说明必要性、替换次数、影响和测试；不得以“重构”“优化”“简化”为名改写。

---

## 2. 上游源码基线

上游插件目录共 25 个文件、精确 `246940` bytes；commit tree 为 `0961f052c654edbaf6d5f5c1da676920ddc38706`，插件 subtree 为 `e6d006720d46909dd1295a03c41efe11957ec5ec`。仓库根部另有一个 Marketplace 注册项。

```text
plugins/claude-security/
├── .claude-plugin/
│   └── plugin.json
├── LICENSE
├── README.md
├── SECURITY.md
├── agents/
│   ├── claude-security.md
│   ├── explore.md
│   ├── patch-generator.md
│   ├── patch-verifier.md
│   ├── scan-inventory.md
│   ├── scan-researcher.md
│   └── scan-verifier.md
├── hooks/
│   ├── banner_hook.sh
│   ├── banner_notice.py
│   └── hooks.json
├── scripts/
│   ├── patch_artifacts.py
│   ├── render_report.py
│   └── write_scan_meta.py
├── skills/
│   └── claude-security/
│       ├── SKILL.md
│       ├── role.md
│       ├── jobs/
│       │   ├── scan-codebase.md
│       │   ├── scan-changes.md
│       │   └── suggest-patches.md
│       └── specs/
│           ├── patch-spec.md
│           └── report-spec.md
└── workflows/
    └── scan.js
```

文件数量核算：

| 类别 | 数量 |
|---|---:|
| 根文档 | 3 |
| 插件 manifest | 1 |
| Agent | 7 |
| Hook | 3 |
| Python 脚本 | 3 |
| Skill、Role、Job、Spec | 7 |
| Workflow | 1 |
| 合计 | 25 |

目录外还必须映射上游根部 `.claude-plugin/marketplace.json` 中的插件条目，不能只复制插件子目录。

### 2.1 源码冻结产物

权威冻结产物固定放在 brand guard 已定义为 provenance 边界的目录：

```text
plugins/crabcode-security/docs/legal/
├── SOURCE-LOCK.json
├── UPSTREAM-MARKETPLACE-ENTRY.json
├── TARGET-MARKETPLACE-ENTRY.json
├── PORTING-MAP.md
└── FULL-PORT.patch
```

`SOURCE-LOCK.json` 至少记录：

- 上游仓库与目录；
- 固定提交；
- 上游版本；
- commit tree、plugin subtree；
- 25 个文件的相对路径、Git blob SHA-1、大小、SHA256 和 mode；
- 排序清单的规范化规则与总 SHA256；
- Marketplace 源文件哈希、唯一选择器及规范化条目哈希；
- 目标 Marketplace staged 快照、`releaseStatus: staged-not-active` 及规范化条目哈希；
- 活动 Marketplace 中目标 selector 为零的 promotion 快照，但不绑定与本插件来源无关的 Marketplace metadata 版本；
- 每个上游路径到目标路径的唯一映射；
- `FULL-PORT.patch` 的 SHA256、generator/sealer/verifier 版本与自身哈希、规范化规则、seal 环境和实际重放校验结果；
- 获取日期；
- 目标派生版本。

`PORTING-MAP.md` 以 25 行一一映射和覆盖全部行号的交叉表共同记录：

- 上游路径；
- 目标路径；
- 是否重命名；
- 第 1.3 节差异类别和修改点；
- 对应的稳定测试文件/合同；
- 尚未由确定性证据解决的兼容或模型质量差异。

来源证明不是“目标文件哈希与人工表格看起来一致”，而是以下可执行等式：

```text
U = normalize(materialize_locked_blobs(upstream_repository, fixed_commit))
P = plugins/crabcode-security/docs/legal/FULL-PORT.patch
T = normalize(the_25_mapped_target_product_files)

apply(U, P) == T
```

其中 `normalize()` 只能执行事先声明的 `baseline/`、`target/` 路径根转换和排除 `docs/legal/**` 自指来源材料，不得删除、重排或改写产品正文；文件路径、内容、mode 和 symlink 类型都参加比较。校验器在空临时目录先按锁定对象 materialize 固定上游 25 个 blob，再应用 `FULL-PORT.patch`，最后与 25 个映射目标逐字节比较。generator 的 `--check` 还必须从同一输入复算完全相同的 patch。`PORTING-MAP.md` 用于人审，重放等式用于机审，二者缺一不可。所有产品改动收敛后才生成最终 patch 和哈希；当前 seal 尚未进入公开 commit，只能称本地可复现 seal，不能称不可变发布封存。

---

## 3. “100% 源码移植”的验收定义

“100%”不只表示文件全部复制，还表示以下五个层面均不得静默降级。

### 3.1 输入等价

必须支持：

1. 整个代码库扫描；
2. 指定目录或范围扫描；
3. 当前分支变更扫描；
4. Pull Request 变更扫描；
5. 单个 Commit 扫描；
6. 从已有报告建议补丁；
7. 没有 Git 的目录执行整库扫描。

### 3.2 状态机等价

扫描流程固定为：

```text
Inventory
  → Threat Model
  → Research Matrix
  → Sweep / Gap Fill
  → Three-Verifier Panel
  → Max-Effort Adversarial Review
  → Deterministic Report Rendering
```

补丁流程固定为：

```text
Report Freshness Check
  → Per-Finding Scratch Checkout
  → Patch Generation
  → Independent Patch Verification
  → Project Tests
  → Fresh Adversarial Review
  → At Most One Revision
  → Patch or Decline Note
```

### 3.3 输出等价

扫描必须生成：

```text
CRABCODE-SECURITY-<timestamp>-<nonce>/
├── .crabcode-security-owner.json
├── .crabcode-security-run/
│   └── .crabcode-security-owner.json
├── CRABCODE-SECURITY-RESULTS.md
├── CRABCODE-SECURITY-RESULTS.jsonl
├── CRABCODE-SECURITY-REVISION-<sha12>.json
└── .gitignore
```

时间戳固定为 UTC `YYYYMMDD-HHMMSS`，`nonce` 必须由 CSPRNG 生成，不以 PID、线程号或递增计数代替；当前 schema 的扫描 nonce 为 64 bit，patch-run nonce 为 128 bit，若日后改变长度必须升级并测试解析合同。安全性来自排他 `mkdir`、marker 和关系校验，不能把 nonce 当鉴权凭证。owner marker 至少绑定产品 ID、schema、nonce/run ID、扫描根 realpath 和目录 realpath。`.crabcode-security-run` 必须是该报告根的直接子目录，并有独立 owner marker；读、写、续跑、渲染、补丁和清理每一步都重新验证目录层级、marker、nonce 和 revision 关系。

上图的 `.crabcode-security-run/` 是扫描中的临时工作目录；成功渲染后，只有在再次通过 owner/containment 校验时才删除，最终报告根保留产品文件、报告根 owner marker 和 `.gitignore`。渲染失败或所有权无法确认时保留 run 并报告，不能扩大清理范围。

dirty 工作树参与扫描时，revision 产物名必须明确带 `-dirty`；非 Git 目录使用 `CRABCODE-SECURITY-REVISION-UNVERSIONED.json`。dirty 状态无法可靠确定时按 dirty 处理，不能给出更强的 clean 承诺。分析过程使用创建 run 时冻结的 source/analysis root 和 revision 元数据，不在后续步骤重新解释用户当前目录；用户工作树发生变化时应 stale/拒绝，而不是把新状态混入旧报告。

补丁任务必须生成：

```text
CRABCODE-SECURITY-<timestamp>-<nonce>/
├── .crabcode-security-run/
│   ├── .gitignore
│   └── patch-<UTC timestamp>-<patch-nonce>/
│       └── .crabcode-security-patch-owner.json
└── patches/
    ├── .crabcode-security-patches-owner.json
    ├── F<n>.patch
    ├── F<n>.md
    ├── PATCHES.md
    └── patches.jsonl
```

临时 patch run 必须排他创建并绑定报告哈希、revision 哈希和结果集哈希；面向用户的固定 `patches/` 只在其 owner marker 同样匹配时才可复用。不能仅凭目录名发现、复用或清理任何一个目录。渲染完成后只清理 marker 绑定的临时 patch run，保留 `patches/` 产品和 owner marker。

产物状态矩阵：

| unit 状态 | `F<n>.patch` | `F<n>.md` | 汇总记录 |
|---|---:|---:|---:|
| `patch_written` | 是 | 是 | `PATCHES.md` + `patches.jsonl` |
| `declined` | 否 | 是 | `PATCHES.md` + `patches.jsonl` |
| `skipped_stale` | 否 | 是 | `PATCHES.md` + `patches.jsonl` |

不允许自动 apply、commit、push 或创建 PR。

### 3.4 安全不变量

以下十项为 P0，不得妥协；其中第 9、10 项把固定源码边界和本次必要加固明确分开：

1. 扫描范围、effort 和预计成本在运行前明确确认。
2. target、scope、diff、revision 和 dirty 状态由代码确定性记录。
3. 扫描工具在会话中重新读取的仓库文件、注释、`CRABCODE.md` 文件副本、报告和子 Agent 输出一律视为数据；但 CrabCode 在会话建立时已经加载的项目指令、Hook、MCP 和工具配置属于可信宿主配置，不能谎称会被 prompt fencing 中和。
4. 研究者与验证者相互独立。
5. finding 未达到固定 quorum 时不得进入报告。
6. confidence 和 verification status 由代码计算，不接受模型自报。
7. 补丁仅在 scratch checkout 生成，不触碰用户 checkout 或 index。
8. 补丁未同时满足 targeted、无新漏洞、无无关行为变化时只能输出拒绝说明。
9. 所有删除和清理动作保持固定源码的目录形状、命名正则和目标包含关系检查；仅允许处理当前报告根的直接 run/patch 子目录，且必须匹配双方 owner marker、nonce 和 realpath。任何校验失败都 fail closed，不做“尽力清理”。
10. 输出分析视图在 run 建立后不可变；报告渲染和补丁续跑必须校验 canonical report/run、双 owner marker、scan metadata 与 revision/results 三重绑定。不得把尚未实现的 OS 级隔离或 SIGKILL 自动恢复写成现有保证。

### 3.5 信任模型

- 默认仅扫描用户自有、可信代码库。
- 插件本身、Core worker 和 `vm` context 都不等于 hostile-repository sandbox。worker/vm 主要隔离控制流、超时和内存中的宿主对象，不能阻止被执行程序访问宿主文件系统或网络。
- CrabCode 在会话建立时自动加载的项目指令、Hook、MCP、工具配置和 Git 配置是本产品“可信仓库”前提的一部分；扫描阶段后来读到的同名文件副本只是待审计数据。二者必须在 prompt、README 和测试中明确区分。
- 扫描阶段不得 build、test、执行仓库代码或自动下载依赖。
- 补丁阶段运行项目测试会执行仓库代码；patch-generator/patch-verifier 的写权限即使被 Agent policy 限制，也不能替代内核强制的挂载、网络和进程边界。当前稳定目标明确只支持可信仓库。若未来扩展到不可信仓库，必须同时由会话外 OS 沙箱/一次性虚拟机限制网络、进程和文件系统，并使用不加载仓库指令、Hook、MCP 或其他项目配置的 clean profile。
- 插件不臆造或链接不存在的 sandbox 产品；CrabCode 未提供可验证隔离时，用户文档明确“仅支持可信仓库”。

---

## 4. 文件级迁移矩阵

### 4.1 根文件与 manifest

| 上游 | 目标 | 主要动作 |
|---|---|---|
| `.claude-plugin/plugin.json` | `.crabcode-plugin/plugin.json` | 改技术 ID、显示信息、作者和 CrabCode manifest 契约 |
| `README.md` | `README.md` | 改安装、命令、产物、运行时和支持说明，保持功能说明完整 |
| `SECURITY.md` | `SECURITY.md` | 改为 CrabCode 安全披露渠道并重述真实信任模型 |
| `LICENSE` | `LICENSE` | 保留文件槽位，内容按 CrabCode 源码分支治理规则配置 |

### 4.2 Agent

| 上游 | 目标 | 职责 |
|---|---|---|
| `agents/claude-security.md` | `agents/crabcode-security.md` | 主 Security Lead 和任务编排 |
| `agents/explore.md` | `agents/explore.md` | 只读代码结构探索 |
| `agents/scan-inventory.md` | `agents/scan-inventory.md` | 组件清单与顶层目录覆盖账本 |
| `agents/scan-researcher.md` | `agents/scan-researcher.md` | 按组件和漏洞类别寻找候选 |
| `agents/scan-verifier.md` | `agents/scan-verifier.md` | 从可达性、影响和已有防御角度反证 |
| `agents/patch-generator.md` | `agents/patch-generator.md` | 在 scratch checkout 中生成单 finding 修复 |
| `agents/patch-verifier.md` | `agents/patch-verifier.md` | 校验 patch、调用方、测试和三个 confidence claim |

Agent front matter 适配：

- 上游高能力主协调角色映射为 CrabCode 动态语义别名 `best`，其余角色保留 `inherit` 或原 effort 分工，不写死模型 ID；
- `effort: xhigh` 映射为 `max`；
- `tools` 映射到 CrabCode 实际工具名称和授权合同；
- `initialPrompt` 改为 `"/crabcode-security:crabcode-security"`；
- 保留每个 Agent 原有权限边界，不扩大写权限。Core 必须把子 Agent 的有效权限钉在调用者权限与 Agent 声明权限的交集，拒绝嵌套调用借 front matter 或参数升级权限；该策略只约束宿主工具授权，不等于对外部测试进程的 OS 文件系统隔离。

### 4.3 Hook

| 上游 | 目标 | 主要动作 |
|---|---|---|
| `hooks/hooks.json` | `hooks/hooks.json` | namespace 和事件适配 |
| `hooks/banner_hook.sh` | `hooks/banner_hook.sh` | 根目录变量和输出协议适配 |
| `hooks/banner_notice.py` | `hooks/banner_notice.py` | manifest 路径、名称、ASCII Banner 和版本检查适配 |

上游使用 `UserPromptExpansion` 和 stdout `{"systemMessage": ...}`。CrabCode 没有该事件；本次明确映射为 `UserPromptSubmit`，不配置会被忽略的 matcher，而由 Hook 脚本解析 stdin 中的 `prompt`，仅在 `/crabcode-security:crabcode-security`（兼容短入口）时输出。该差异属于 `HOST`，需测试“目标命令显示、普通提示零输出、异常 stdin 零输出、Hook 永远退出 0”。

### 4.4 确定性脚本

| 上游 | 目标 | 主要职责 |
|---|---|---|
| `scripts/write_scan_meta.py` | 同路径 | revision、branch、dirty、base、scope、顶层目录、nonce 报告根和 run owner marker |
| `scripts/render_report.py` | 同路径 | findings/votes 校验、严格路径/行号与 panel 算术、confidence 封顶、canonical report/run 绑定和报告原子生成 |
| `scripts/patch_artifacts.py` | 同路径 | 报告 freshness、patch run/product owner、report/revision/results 哈希绑定、patch/note/index/JSONL、路径围栏、apply check 和清理 |

三个脚本保持 Python 3.9+ 和 stdlib 依赖，不进行语言重写。

### 4.5 Skill、Job 与 Spec

| 上游 | 目标 |
|---|---|
| `skills/claude-security/SKILL.md` | `skills/crabcode-security/SKILL.md` |
| `skills/claude-security/role.md` | `skills/crabcode-security/role.md` |
| `jobs/scan-codebase.md` | 同相对路径 |
| `jobs/scan-changes.md` | 同相对路径 |
| `jobs/suggest-patches.md` | 同相对路径 |
| `specs/report-spec.md` | 同相对路径 |
| `specs/patch-spec.md` | 同相对路径 |

必须逐项适配：

- `$ARGUMENTS`；
- 上游插件根变量到 `${CRABCODE_PLUGIN_ROOT}`；
- 上游 Skill 根变量到 `${CRABCODE_SKILL_DIR}`；
- `!` 命令动态注入；
- `@.../role.md` include；
- `disable-model-invocation`；
- `allowed-tools` 和 Bash 前缀授权语法；
- namespace 和直接调用入口。

### 4.6 Workflow

| 上游 | 目标 |
|---|---|
| `workflows/scan.js` | `workflows/scan.js` |

`scan.js` 不是普通 Node.js 脚本。它依赖宿主注入：

```text
args
log()
phase()
agent()
pipeline()
parallel()
setTimeout()
```

同时依赖宿主允许顶层结果返回。迁移应尽量保持 `scan.js` 核心算法不变，通过 CrabCode Workflow 兼容层满足它的宿主合同。

---

## 5. 品牌与宿主协议原子映射

| 上游标识 | CrabCode 标识 |
|---|---|
| `claude-security` | `crabcode-security` |
| `Claude Security` | `CrabCode Security` |
| `.claude-plugin` | `.crabcode-plugin` |
| `/claude-security:claude-security` | `/crabcode-security:crabcode-security` |
| `claude-security:*` | `crabcode-security:*` |
| `${CLAUDE_PLUGIN_ROOT}` | `${CRABCODE_PLUGIN_ROOT}` |
| `${CLAUDE_SKILL_DIR}` | `${CRABCODE_SKILL_DIR}` |
| `.claude-security-run` | `.crabcode-security-run` |
| `CLAUDE-SECURITY-*` | `CRABCODE-SECURITY-<timestamp>-<nonce>` 及其 `CRABCODE-SECURITY-*` 产品文件 |
| `.claude/` | CrabCode 实际项目配置目录 |
| `CLAUDE.md` | CrabCode 实际项目指令文件 |
| `claude --permission-mode auto` | CrabCode 经实测可用的权限模式入口 |
| `/workflows` | CrabCode 等价进度与任务界面 |
| `opus / sonnet` | 动态语义能力 `best` / `inherit`，不得硬编码具体模型 ID |
| `xhigh` | `max` |

原产物前缀同时出现在以下安全位置，必须一次完成：

- 输出目录名；
- report 和 revision 文件名；
- patch 应用说明；
- dirty 排除；
- stale 产物清理；
- 路径正则；
- realpath 围栏；
- scan/run/patch owner marker 及 nonce 绑定；
- `.gitignore`；
- README、Job、Spec 和测试夹具。

不允许先改显示文案、后改脚本前缀，因为中间状态可能导致清理错误或报告无法发现。

产品代码、运行时输出和用户文档完成后应做到原品牌零残留；固定来源信息仅保留在本实施方案及 `docs/legal/**` 来源记录中，不扩 brand allowlist。

---

## 6. CrabCode Runtime 前置工程

### 6.1 当前观察

初始审计的发布版 CrabCode 1.0.20 和对应 Core 中，`WORKFLOW_SCRIPTS` 默认关闭，`WorkflowTool`、Workflow 命令、LocalWorkflowTask、bundled workflow 导出和插件自动发现链均为 stub；该历史基线解释了为什么“复制插件文件”不构成功能移植。

本次实施已落入受版本控制的实际私有 Core 仓未提交 preview 工作树，并保留测试的能力包括：

- 插件 Workflow 发现、namespace、参数、`log()`、`phase()`、`agent()`、`pipeline()`、`parallel()` 和 structured output 的实现路径；
- 每次 Workflow 在独立 worker thread 中运行，并在受控 `vm` context 内执行；宿主桥接函数只在 context 初始化时短暂注入，随后由 context 内闭包持有并删除全局引用，参数、Agent 结果和终态结果通过 JSON 边界传递，避免把宿主函数构造器或原型链长期暴露给插件脚本；
- deadline/abort 会强制 terminate worker，不依赖永不 resolve 的 Promise 自愿退出；
- Workflow 成功返回前必须等待所有已发起的 Agent RPC 收敛；未 `await` 的失败仍会使 Workflow 失败，终止路径会取消并限时 drain 子任务，不留下脱离根任务生命周期的后台调用；
- 根 Agent 调度槽可由其嵌套前台 Agent 调用借用，避免单槽配置下自锁；同一根调用的嵌套兄弟仍串行化，显式/定义 background、全局强制异步、remote isolation 和 foreground→background handoff 均不得让嵌套 Agent 脱离父生命周期；
- 子 Agent 有效权限固定为调用者权限与声明权限的非升级交集；
- 嵌套 Agent 只允许调用 Agent front matter 的显式白名单目标；
- Workflow 源码按 UTF-8 字节限制为 1,000,000 bytes，且在稳定文件句柄上先 stat、再以 `max+1` sentinel 有界读取；参数、prompt、schema、结果、总 Agent 调用次数、并发数和执行时长也有 fail-closed 上限；
- 有美元预算时，每个受预算约束的顶层 `agent()` 调用在完整模型响应期间持有进程级预算租约，因此预算模式下同进程的这类并行分支会退化为串行；guard 在模型请求前、terminal usage 后和 fallback 前复核。成本只能在 provider 返回 usage 后得知，所以最多仍可能由一条成本事前不可知的在途响应越过阈值；调用参数不得覆盖已安装 Agent 的模型或 effort 策略；
- plugin Agent `initialPrompt` 和任务/进度桥接已进入 preview 实现；
- 直接 QueryEngine/无头/SDK 路径已把主 Agent 的工具与可调用 Agent 类型传入解析、schema 和执行上下文，避免只在 TUI 生效；
- AppServer TUI/print 逐回合传递主 Agent 身份，worker 从自己的 cwd-scoped activeAgents 精确解析定义并同步到 QueryEngine 和 turn-local app state；未知、重复或超长身份 fail closed，不接收客户端自报 prompt/工具定义；
- `WORKFLOW_SCRIPTS` 仍保持 preview/默认关闭，不借此伪装为稳定发布能力。

上述内容已经存在于实际私有 Core 工作树并通过本地验证，但仍只有未提交开发 preview 证据，不是可供 Marketplace 依赖的正式 Core commit 或制品。仍未关闭：

- 私有 Core 仓中的永久 commit、review 和制品 SHA256；
- 安装器/Core 可机读的最低兼容版本 Gate 及旧版本失败 UX；
- 真实打包制品上的 CLI/GUI E2E、取消、崩溃与升级/降级验证；
- CLI `--agents` 的进程内 `flagSettings` 自定义定义尚不能由 worker 从 cwd 无损重建；当前普通 print 使用既有 direct fallback，禁止 direct fallback 的 `account:*` 明确失败。是否扩展公共协议必须作为平台决策，不为单插件序列化闭包；
- 终止路径的 drain 以 10 秒为硬上限，能收敛正常 transport，但不宣称对永久卡死的外部传输具有数学意义的零孤儿保证；
- 成本计数器仍是进程级保守账本而非 per-workflow 独立 ledger；同进程无关任务的成本可能使本 Workflow 提前停止，但不能反向放宽预算；
- patch Agent 执行仓库测试时的 OS 级文件系统、网络和进程隔离，以及禁用项目配置的 clean profile；二者属于未来不可信仓库支持范围，而不是把 worker/vm 包装成沙箱。

worker thread 与 `vm` 能强制取消 workflow JavaScript 并限制注入对象，但不是安全边界；任何文档、UI 或测试名称都不得把它描述为 hostile-code sandbox。

因此，完整移植必须采用“核心兼容先行”，不能只改插件文件。

Core 是独立私有源码仓，不能把其源码 patch 写入本插件仓。实施证据必须分为：

- 本仓：插件、Marketplace、source lock、host contract test；
- Core 私有仓：runtime 代码与测试；
- 发布制品：Core commit、版本、制品 SHA256 和真实 G1/E2E 记录。

当前权威的 Core preview 工作树是受版本控制的私有仓 `/Users/fushihua/Desktop/CrabCode`；49 个现存实施文件连同一个 `.ts`→`.tsx` 删除侧共形成 50 条未提交实施记录。验证暂存副本 `/private/tmp/CrabCode-security-runtime-copy` 与该实施范围的聚合 SHA256 均为 `e0a8dd433b2d7adc32935d6aed9a97cc86fb9ee6949c7fcef553f129b051da42`，只用于交叉复核，不再作为权威落点。实际仓内用户既有的 `package.json`、`bun.lock` 和文档变更不属于本次同步范围。该状态仍是可变工作树；正式验收必须引用不可变 Core commit、review、CI 和制品哈希。

### 6.2 Workflow 兼容层合同

CrabCode 核心至少需要提供：

1. 插件 `workflows/` 自动发现；
2. workflow namespace 注册；
3. `args` 的稳定传入；
4. `log()` 和 `phase()` 进度输出；
5. `agent()` 结构化调用；
6. `pipeline()` 顺序编排；
7. `parallel()` 有界并发；
8. retry、timeout 和 cancellation；
9. JSON Schema 结构化输出校验；
10. 顶层结果返回；
11. Task 状态与 UI 可观测性；
12. 用户中断后的临时目录收敛。
13. caller→child 权限不升级和嵌套 Agent 精确 allowlist；
14. workflow worker 的硬 deadline/abort termination；
15. installer/Core 的正式最低版本 Gate 和可理解的失败 UX。

ABI 还必须明确：

- `agent()` 只做一次逻辑 dispatch；Core transport 自身的瞬时重连不得与 `scan.js` 的两次 8s/25s retry 叠加成额外模型调用；
- `parallel()` 受进程级 Agent 并发槽上限约束，不能无界 fan-out；若启用美元预算，预算租约覆盖完整 provider 响应并使受预算顶层调用串行化；
- workflow 收到 abort 后不再派发新 Agent，并等待/终止已登记子任务；
- JSON Schema 校验失败按“本次 Agent 无有效返回”传播，不把自然语言猜成对象；
- worker 的嵌套 Agent 只能调用 front matter 明确允许的目标，不能扩大工具面或递归自调用；
- workflow 只可从已启用插件的 canonical root 发现 `.js` 文件，拒绝路径穿越、symlink 逃逸、重复 namespace 和动态网络加载。
- caller 的权限模式是上界；任何 child/worker 参数、Agent 声明或嵌套调用都不能产生调用者没有的工具或写权限。
- 可信仓库产品可以在明确警告和真实 E2E 后进入稳定版；若要宣称支持不可信仓库，patch Agent 执行测试必须进入平台 OS 级隔离，且整个会话使用禁用仓库指令/Hook/MCP 的 clean profile。

### 6.3 禁止的降级

以下替代方案不接受：

- 让主 Agent 根据提示词自行模拟 `parallel()`；
- 取消结构化 Agent 输出，改为解析自然语言；
- 以单 Agent 结果代替三验证者 quorum；
- 只输出 Markdown，不生成 JSONL 和 revision stamp；
- 在用户当前 checkout 中直接生成补丁；
- Agent 失败后假装本次扫描完整。
- Core 对 workflow 的每次 `agent()` 再透明重试，改变固定源码的调用次数和成本；
- 为赶进度在 plugin manifest 中自造当前 schema 不认识的最低版本或 `workflows` 字段。

---

## 7. 必须冻结的算法常量

以下上游行为必须写入单元测试：

- `medium` 小 diff：文件数必须可解析且为 1–5，行数必须可解析且不超过 300，才折叠为每个目标一个 all-category researcher；
- `medium` 小 scope：文件数必须可解析且为 1–5，才折叠为每个目标一个 all-category researcher；
- diff/scope 只有在可解析 count 恰为 0 时短路为空；缺失或非法 count 不得猜为空；
- inventory component cap：普通档 12，high/max 为 24；
- 每个 component/category researcher：普通档 1，high/max 为 2；
- 类别矩阵至少包含 injection/input、auth/access、memory/unsafe、crypto/secrets；
- 托管语言按原逻辑跳过不适用的 memory lens；
- sweep：medium 为 1，high/max 为 2；
- attack-surface focus 仅在非 diff 扫描时增加独立 secrets pass；
- raw candidate cap：400，发生在 dedupe 之前；
- verification candidate cap：45，发生在 dedupe 之后；
- 每个 finding 固定 3 个 verifier；
- 至少 2/3 才能进入报告；
- incomplete panel 不得按 keep 处理；
- max 档只重审第一轮恰为 2/3 的 finding，并对 survivor 增加 red-team refuter；repanel 不完整或 red-team 无票时保留第一轮 verdict，不误写成 fail-closed；
- Agent 返回 falsy 时按 8s、25s 基准乘确定性 0.5–1.5 jitter 重试；`agent()` 直接 throw 不由该 helper 自身捕获；
- inventory 只允许一次纠正；第二次仍不完整时可如实标 `partial`，只有 whole-target skip、只有 `..` 等不可用回答才回退整库单组件；
- panel 必须恰有 3 个返回 voter；少于 3 个时无论现有票如何都不得 keep；
- dedupe key 保持 `(file, line, category)`；
- confidence 继续由报告脚本按投票结果封顶。
- 托管语言从类别矩阵删除 `memory-and-unsafe`；
- `unreviewed_candidate_sites` 同时包含 verification cap 外的候选和 raw cap 丢弃后未在保留集出现的唯一 site。

若上游后续版本改变这些常量，应通过单独的上游同步评审更新，而不是在本次移植中自行调整。

---

## 8. 实施阶段与 Gate

### G0：源码快照冻结

交付：

- 25 个文件的哈希、Git blob、mode 和 targetPath 清单；
- 外部 Marketplace 条目快照；
- `SOURCE-LOCK.json`；
- `PORTING-MAP.md`；
- `FULL-PORT.patch`；
- 上游原始基线与目标 patch 的可审阅差异及可执行重放记录。

通过条件：

- 25/25 文件已计入；
- 不存在未映射的上游 blob、重复映射或来源不明的产品文件；
- 上游版本和 commit 唯一。
- 在空临时目录按锁定 Git 对象 materialize 固定上游 25 个 blob、执行声明的路径根规范化并应用 `FULL-PORT.patch` 后，与 25 个映射目标的路径、mode 和内容逐字节相等；
- generator `--check` 能复算相同 patch，`SOURCE-LOCK.json` 中 patch、generator、sealer、verifier 哈希与实物一致；
- 本 Gate 只关闭 `source-set/replay-complete`，不以 505 项来源检查证明模型行为等价。

### G1：CrabCode 核心兼容性探针

用最小测试插件证明：

- Workflow 可发现、可传参、可返回结果；
- Agent 可按 namespace 调用；
- structured output 真正受 schema 校验；
- parallel/pipeline/phase 行为可用；
- Agent 失败、超时、取消能被 workflow 感知；
- `UserPromptSubmit` 适配只在本插件命令触发且普通提示零输出；
- 两个 CrabCode 路径变量替换正确；
- 权限模式可稳定启动。

任一核心项为 stub 或只能靠未发布实验开关时，G1 不通过。

当前状态：preview 实现和确定性 host/Core 测试可用于开发复核，但尚无正式 Core commit、版本 Gate 和真实制品 E2E，因此 G1/G2 的发布口径仍不通过。

### G2：核心运行时实现

若 G1 不通过，先在 CrabCode 核心完成：

- Workflow 插件发现；
- Workflow tool/runtime；
- Agent 和 Task 桥接；
- 进度、取消和重试；
- Hook 兼容事件；
- 对应自动化测试和运行时版本门槛。

当前 manifest schema 没有已生效的最低 CrabCode 版本字段，禁止自造字段。版本门槛必须先在 Core/installer 建立正式 schema 与失败 UX；在此之前只能标 preview，并在 README 明示需要含 Workflow runtime 的 Core 制品。

Core worker/vm、强制取消、caller→child 权限不升级属于已实现 preview 项；OS 级 patch 测试隔离不属于这些机制的能力范围。若未来扩展到不可信仓库，它必须与 clean profile 一并单独交付和验收；在当前明确限定的可信仓库产品范围内，不把这项未来能力伪列为 GA 阻断项。

### G3：源码基线导入

流程：

1. 以固定提交复制完整 25 文件；
2. 验证导入基线 SHA256；
3. 建立独立适配 patch；
4. 按第 1.3 节完整类别逐项登记修改；
5. 不在导入过程中顺手重构。

### G4：确定性脚本迁移

先迁移三个 Python 脚本，因为它们定义报告可信度和文件安全边界。

必须验证：

- 原子写入；
- revision/dirty 绑定；
- coverage、finding、vote schema；
- confidence ceiling；
- report 目录清理；
- patch path containment；
- `git apply --check`；
- stale 产物清理；
- 固定源码已有的路径穿越与包含关系拒绝；任何新增 symlink/race 防护单列 `SECURITY_HARDENING`；
- CRLF、非 UTF-8 和二进制 patch 的字节保真策略。

### G5：Agent、Skill、Job、Spec 迁移

要求：

- 七个 Agent 职责全部存在；
- 原有读写权限不扩大；
- 三个 Job 入口全部可达；
- Report/Patch Spec 与脚本一致；
- 仓库文本是数据而非指令的规则在所有研究和验证 Agent 中一致；
- 用户成本确认和运行前摘要保留。

### G6：Workflow 接入

要求：

- 保持输入字段和输出结构；
- 保持 effort shape、cap、重试、dedupe、quorum 和 max adversarial 逻辑；
- inventory 不完整时按原流程修正或诚实标 partial；
- Agent 缺席时不得伪造投票；
- 全库扫描对每个顶层目录做到 scanned 或 skipped-with-reason。

### G7：品牌、Hook 与文档

统一完成：

- manifest 与 Marketplace；
- Marketplace metadata 版本、中文 workflow 展示字段和全局 workflow skill 快照；
- slash command 和 namespace；
- Banner；
- 报告与 patch 前缀；
- README、SECURITY、Skill、Job、Spec；
- CrabCode 支持和漏洞披露入口；
- 原品牌扫描。

本仓标准目录通常自动加载 Agent、Skill 和 Hook；manifest 不应重复声明会造成重复加载的标准路径，最终以当前 manifest 校验器为准。

### G8：测试与安全复核

完成第 9 节全部测试矩阵，并对所有确定性逻辑达到 100% 通过。三个 Python 脚本使用同一批 fixture 对固定上游和目标分别运行，归一化仅允许的品牌/路径差异后做 differential oracle；`scan.js` 使用 host simulator 或真实 Core contract test 验证行为，不以 minified 单行源码正则代替控制流测试。

### G9：灰度发布

当前生态没有可验证的 Marketplace `beta/canary` 字段。实际顺序固定为：

```text
固定 commit 的本地 source 安装
  → 独立 prerelease tag 或 beta 源
  → 明确测试者名单上的真实 Core 制品 canary
  → 主 Marketplace 条目
```

Marketplace 条目最后合入；核心 runtime 和插件内容不得在一个不可回滚提交中同时上线。下架条目不能回滚已安装副本，必须同时准备修复升级或明确的兼容通知。

当前目标 Marketplace 条目只保存为 `docs/legal/TARGET-MARKETPLACE-ENTRY.json`，状态必须是 `staged-not-active`；活动 Marketplace 不得注册 `crabcode-security`，直至本节 promotion gate 全部关闭。

---

## 9. 验收矩阵

| 层级 | 必测内容 | 阻断标准 |
|---|---|---|
| 源码完整性 | 25 文件、外部 Marketplace 项、SHA256、路径/mode 映射、`FULL-PORT.patch` 重放等式 | 任一遗漏、重放漂移或来源锁不一致即阻断 |
| 差异审计 | 每处差异按第 1.3 节分类 | 无法解释的业务逻辑差异即阻断 |
| Manifest | name、version、author、keywords、标准目录自动发现 | 任一校验错误即阻断 |
| Presentation | 中文 workflow/skill 展示、具体 Skill 声明、版本和全局快照 | 任一漂移即阻断 |
| Workflow 单元 | effort shape、cap、dedupe、retry、2/3、confidence clamp | 确定性用例必须 100% |
| 元数据 | Git/非 Git、dirty、scope、base、commit、空目标 | revision 不实或范围夸大即阻断 |
| 报告 | Markdown、JSONL、revision、coverage、清理 | schema 错误或临时文件泄漏即阻断 |
| 补丁 | scratch clone、claims、revision、tests、apply check | checkout/index 被改变即阻断 |
| 输出所有权 | timestamp+nonce、排他 mkdir、scan/run/patch owner marker、直接子级、不可变分析根 | 碰撞、越权复用、marker 不匹配或旧状态混入即阻断 |
| 路径安全 | `..`、绝对路径、空路径、异常目录及源码已有 containment；新增 symlink/race 加固单测 | 任意目标外写删即阻断 |
| Prompt 边界 | 工具新读的源码、注释、commit/PR 文本、报告 JSONL 和动态 finding/component 字段；已加载项目指令另按可信宿主配置处理 | 未转义 fence delimiter、把数据字段直接执行为命令或混淆已加载配置/新读数据即阻断；模型是否遵循边界另进入盲测质量评估 |
| Agent 故障 | 无结果、超时、schema 错误、部分 panel、中断 | 不得伪造完整结果 |
| Git 场景 | branch、PR、commit、detached、empty diff、dirty | 结果必须绑定真实对象 |
| 非 Git | 整库扫描 | 不得错误要求 Git |
| Patch 场景 | pass、reject、revision、无测试、测试失败 | 不能满足三项 claim 时不得产出 patch |
| 字节边界 | 空格路径、Unicode、CRLF、binary diff | 不得改变 patch 字节语义 |
| 品牌 | 运行时代码、输出、用户文档 | 原品牌残留为 0 |
| 平台 | macOS、Linux；Windows 单独声明 | 未测平台不得标记支持 |
| Core 安全合同 | worker/vm、硬取消、权限不升级、嵌套 allowlist、版本 Gate | 取消失效、权限扩大或旧 Core 静默运行即阻断 |
| 不可信代码隔离 | patch 测试进程的 OS 文件系统/网络/进程边界 | 未隔离时不得宣称支持不可信仓库 |
| 隐私与留存 | 产物默认本地、无插件专属 telemetry、模型提供方字段/地域/保留合同、用户删除、事故保全与通知 | 未指定真实 owner、未披露推理数据去向或插件另行外发敏感内容即阻断 |
| 生态 | layout、brand、manifest、marketplace、reference、CI | 全部校验通过 |

### 9.1 E2E 非变更断言

每个 E2E 运行前后必须记录并比较：

```text
HEAD
current branch
git status --porcelain
git diff
git diff --cached
tracked file hashes
```

允许的持久写入只有：

```text
CRABCODE-SECURITY-<timestamp>-<nonce>/
```

以及该报告根直接拥有、owner marker 匹配的 `.crabcode-security-run/` 和补丁流程受控 scratch 目录。每次 E2E 还必须证明两个并发同秒任务得到不同 nonce，旧报告不能被续跑或清理代码误认，分析 source/analysis root 在用户目录变化后保持冻结或拒绝 stale。

graceful success、已处理失败和可捕获取消必须收敛；process crash 与 SIGKILL 分别测试并记录孤儿目录，不能承诺同一进程在 SIGKILL 后自动清理。若增加下次启动回收，只能识别本插件严格命名、直接子级、双 owner marker 匹配且通过 containment 检查的孤儿目录；未知内容一律保留并报告。

当前本地测试已经覆盖主要状态机和拒绝路径，但以下故障注入仍是发布验收 backlog，不能用“代码看起来 fail closed”替代实测：

- `patch_artifacts.py` 的 rename/copy/C-quoted/non-UTF8/`.git` diff 以及中途 I/O/SIGKILL；
- `render_report.py` 的 64 MiB 输入上限和产物写入后清理失败/SIGKILL；
- `write_scan_meta.py` 的复制中 source 突变、gitlink 和 SIGKILL；
- 特殊字符 canonical `scanRoot` 在真实模型中的路径识别，以及未来若把该宿主路径降为不可信数据时需要的结构化/围栏传递合同。

这些项不表示 25/25 上游源码集合缺失；它们限制的是目标加固和正式发布证据的外推范围。首版可信仓库 preview 不为同用户 hostile writer 或 SIGKILL 后自动恢复自造复杂事务系统，但 promotion owner 必须明确接受或补测相应风险。

### 9.2 非确定性质量评估

安全发现本身具有非确定性，不得只用一次 golden output 判断质量。

应建立包含真实漏洞和良性陷阱的版本化盲测配对语料库，覆盖：

- SQL/命令/模板注入；
- 鉴权绕过；
- IDOR；
- SSRF；
- 路径穿越；
- 不安全反序列化；
- 密钥和凭证泄露；
- 密码学误用；
- C/C++ 内存安全；
- 与漏洞相似但实际安全的良性代码。

每个 effort 重复运行多次，统计：

- seeded vulnerability recall；
- verified finding precision；
- severity 校准；
- confidence 校准；
- Agent 故障率；
- 平均和高分位运行成本。

语料不能只由相邻代码片段组成；同一仓库、同一漏洞族和同一模板产生的样本必须使用稳定 `repository_cluster_id`，正例与对应良性陷阱成对盲测，评审者在解盲前不知道目标实现、基线实现和期望标签。质量 baseline 固定为本方案锁定提交的上游插件在其预期宿主上的实现，目标组为本次 CrabCode 派生版在其预期宿主上的实现；两组使用同一 corpus、同一模型家族/可比路由、同一 effort、同一重试与成本口径。宿主能力无法完全相同的差异必须预先登记、分层报告，不能偷偷换成轻量 `crabcode-security-review` 或“上一版目标”作为更容易通过的基线。确定性脚本/状态机差分另由代码测试判定，不与模型质量统计混成一个总分。每个运行记录 corpus 版本与 SHA256、样本来源和隐私/脱敏状态、Core/runtime commit、插件 commit、动态模型清单、模型路由配置、温度/effort、时间窗、失败重试和成本口径。

promotion 评估采用事先冻结的统计分析计划：

1. 先在独立 pilot 集估计仓库内相关性、方差和有效样本量，不使用 promotion holdout 调参；
2. 按 `repository_cluster_id` 做 paired cluster bootstrap，同时报告点估计、区间和配对差值，禁止把同仓多个 finding 当作独立样本；
3. 在看正式结果前预注册主要终点、可接受差异、显著性/区间口径、缺失 Agent 输出的处理、multiple-comparison 策略、成本与时长边界；
4. 用预期最小效应和方差完成功效分析，据此确定仓库数与重复次数；没有功效证明时不得用固定“五次”或任意百分点冒充通用门槛；
5. 模型或路由在评估中变化时该批次作废或分层报告，不得混合成一个平均数；
6. 保存可复算的匿名运行清单、聚类 bootstrap seed/代码、盲测解盲记录和 owner 签署。

promotion gate 固定为受控手动或定时任务，不进入每个 PR 的必跑 CI。确定性安全不变量仍要求 100%；模型质量只在预注册计划有足够功效且 paired 结果满足该计划时通过，不以一次 golden result、事后挑选阈值或平均值掩盖仓库级退化。

### 9.3 关联方、责任边界与影响

| 关联方 | 受影响面 | 上线前责任 |
|---|---|---|
| CrabCode Core | Workflow ABI、structured Agent、嵌套 Agent、进度/取消 | Core 维护角色提供私有仓 commit、测试和发布制品哈希 |
| 插件维护 | 25 文件、来源锁、脚本、prompt、Hook | 插件维护角色保证可重建、差异可解释和确定性测试 |
| Marketplace/installer | 条目、版本排序、旧 runtime UX | 生态维护角色验证 prerelease 安装/升级/拒绝路径 |
| 现有安全插件 | 搜索结果、默认 Prompt、用户选型 | 保持 `crabcode-security-review` 与 `security-guidance` 不变，用中文文案明确快速/深度分工 |
| 最终用户 | token、时长、报告目录、项目测试执行 | 运行前获知范围/投入；报告与补丁永不自动提交 |
| Security 响应 | 插件自身漏洞私密披露 | 只指向真实私密渠道，不使用公开 issue 或臆造邮箱 |
| CI/Release | Linux/macOS、Python、Core canary、回滚 | QA/发布角色保存测试证据和 last-known-good，不把下架误当已安装版本回滚 |
| 上游同步维护 | 新增/删除文件、宿主能力变化 | 每次动态枚举 subtree，不把“25”永久写死为未来数量 |

责任表在规划阶段可使用角色，但正式 promotion 不能以“团队”“维护者”或机器人账号代替责任人。每个 Gate 必须追加如下签署记录，字段为空即未通过：

| Gate | 实际 owner（姓名/企业账号） | 决策 commit/制品 | 证据路径或不可变 URL | 签署时间 | 结论/例外到期日 |
|---|---|---|---|---|---|
| Core runtime/权限 | 待绑定 | 待填写 | 待填写 | 待填写 | 未签署 |
| 插件来源/行为 | 待绑定 | 待填写 | 待填写 | 待填写 | 未签署 |
| Marketplace/installer | 待绑定 | 待填写 | 待填写 | 待填写 | 未签署 |
| 安全/隐私响应 | 待绑定 | 待填写 | 待填写 | 待填写 | 未签署 |
| QA/canary/回滚 | 待绑定 | 待填写 | 待填写 | 待填写 | 未签署 |

签署必须引用实际审阅的 commit 和证据，不能在后续代码变化后沿用；任何临时例外都要写明风险接受人、范围、补偿控制和自动到期日。当前全部真实 owner 签署仍为开放项。

### 9.4 数据留存、隐私与事故响应

报告、JSONL、revision、patch、Agent transcript 和测试日志可能包含专有源码、未公开漏洞、凭证片段、用户名、分支/提交信息和本机路径，按高敏感工程数据处理。

数据原则：

- 插件没有专属上传通道或 telemetry，报告、JSONL、revision 和 patch 产物默认只落在用户选择的本地仓库报告目录及 marker 绑定的临时目录；
- Agent 推理会把完成任务所需的 prompt、代码上下文和中间结果交给 CrabCode 已配置的模型提供方，本插件不得把“没有自建托管扫描器”表述为“所有处理均本地”。promotion 前必须复用并核验 CrabCode/提供方已披露合同，明确发送字段、处理地域、保留期、零保留/本地模型能力（若实际提供）和关闭方法；
- 平台诊断遥测必须复用已披露合同；插件不得另造隐式 telemetry；
- 诊断事件默认只允许产品版本、阶段、耗时、枚举状态和匿名错误类别，不含源码、绝对路径、commit message、漏洞正文、patch 或 Agent 自由文本；
- 用户报告不由插件自动过期或删除。产品要显示其位置和敏感性，由用户或真实数据 owner 定义保留期；自动清理只限双 marker 验证通过的 scratch/run 临时内容；
- CI/corpus 证据在入库前脱敏，秘密扫描命中只保留不可逆指纹或受控引用；访问权限、下载和删除操作纳入组织现有审计系统；
- bug 报告和安全披露采用最小复现，默认不附用户仓库、完整报告或 transcript；需要传输时取得项目 owner 明确授权并使用真实私密渠道。

事故响应最小流程：

1. 发现越界写入、敏感内容外发、错误清理、权限升级、错误 revision 或公开披露后立即停止 promotion/下架 staged entry，并保存只读证据；
2. 真实 Security/Privacy owner 评估受影响仓库、制品、模型请求和日志，撤销可能暴露的 token/凭证，禁止通过删除日志掩盖事件；
3. 按组织政策通知受影响 owner，记录时间线、影响、遏制、恢复和根因；未知影响按较高敏感级处理；
4. 修复必须补回归测试、轮换相关密钥、更新 last-known-good 和来源锁；复盘与再上线由不同于实现者的 owner 签署；
5. 若无法确定删除目标所有权，只隔离并报告，不扩大删除范围。

### 9.5 后续优化空间与过度工程边界

首版必须保留源码算法，不在移植中顺手调优。可在有基准后独立立项：

- 根据 Agent failure/cost 数据调整并发和超时，但不得改变 quorum 或把缺席票当反对票；
- 为不可信仓库接入通用 OS sandbox，而不是在本插件内造半套隔离；
- 增加 Windows 原生 Hook 启动器、图标和本地化，不改模型核心 prompt；
- 增加上游同步机器人，只生成 diff/证据，不自动接受新源码；
- 用 versioned JSON Schema、事件流和 GUI 进度提升可观测性；
- 基于真实 corpus 优化模型能力选择，不硬编码具体厂商或模型。

以下不在首版 P0：为单插件自造全局 telemetry、SBOM/签名体系、独立灰度平台、第二套 Marketplace schema、全局安全关键词路由或自定义 sandbox。它们只有在平台级需求成立时才实施。

---

## 10. 版本、发布与回滚

### 10.1 版本线

建议：

```text
0.10.0-crabcode.1
0.10.0-crabcode.2
...
```

含义：

- `0.10.0` 表示上游基线；
- `crabcode.N` 表示 CrabCode 适配迭代。

后续同步上游新版本时，先更新 `SOURCE-LOCK.json`，再生成新的上游差异和本地 patch 重放报告。

### 10.2 发布拆分

至少拆成三个可独立回滚的变更单元：

1. CrabCode Workflow runtime；
2. `crabcode-security` 插件内容；
3. Marketplace 注册和默认推荐。

不得在 runtime 尚未稳定时提前把 Marketplace 条目设为 GA。当前只允许保存 `TARGET-MARKETPLACE-ENTRY.json` 作为 `staged-not-active` 候选；活动 `.crabcode-plugin/marketplace.json` 中不得出现 `crabcode-security`。激活 Marketplace 是独立、可回滚且必须最后发生的变更。

### 10.3 回滚策略

保留：

- 上一个可用插件包；
- 对应 runtime 最低版本；
- `SOURCE-LOCK.json`；
- `PORTING-MAP.md`；
- `FULL-PORT.patch` 及成功重放记录；
- 构建产物哈希；
- 测试报告。

下列事件触发立即回滚：

- 用户工作树、index、HEAD 或 branch 被改变；
- 目标目录外发生写入或删除；
- 未授权网络访问；
- revision 错绑；
- 路径逃逸；
- quorum 或 confidence 被错误计算；
- 严重 finding 被报告为已完整验证但 panel 实际不完整；
- 插件崩溃率超过 canary 前预注册且由 owner 签署的灰度阈值。

回滚只关闭新 Workflow、恢复 last-known-good 或下架新版本。不得删除用户已有 `CRABCODE-SECURITY-*` 报告和补丁。

---

## 11. 上游同步策略

禁止自动跟随 `main`。

每次上游同步必须：

1. 固定新 commit；
2. 从新 subtree 动态枚举全部文件，重新生成新增、删除、mode 变化和哈希清单，不预设仍为 25；
3. 对比上游旧版与新版的语义差异；
4. 识别新增/删除的 Agent、Hook、Job、Spec、脚本和 runtime 依赖；
5. 重放并审计第 1.3 节全部目标差异；
6. 人工处理冲突；
7. 重新生成 `FULL-PORT.patch`，在空临时目录先 materialize 新 commit 的全部锁定 blob、再应用 patch，逐字节重放并锁定 generator/sealer/verifier 与 patch 哈希；
8. 重跑全部确定性测试、E2E 和质量语料；
9. 更新派生版本与 `SOURCE-LOCK.json`；
10. 经 canary 后发布。

如果上游引入新的专属宿主能力，应先补 CrabCode runtime，不得在插件层删除相应功能。

---

## 12. 实施检查清单

### 源码与落位

- [x] 创建 `plugins/crabcode-security`
- [x] 固定上游 commit
- [x] 映射固定快照 25/25 文件
- [x] 保存上游与 staged 目标 Marketplace 条目
- [x] 生成文件 SHA256/blob/mode 清单
- [x] 创建 `SOURCE-LOCK.json`
- [x] 创建 `PORTING-MAP.md`
- [x] 生成并锁定 `FULL-PORT.patch`，刷新 `SOURCE-LOCK.json` 的 staged Marketplace、promotion 快照、normalization、工具哈希与实际 replay 结果；在空临时目录先 materialize 固定上游 25 个 blob，再逐字节重放（patch `475580` bytes，SHA256 `da912e2ca5e002816ccb9ee3818ea30ff46fe6a9788a0df17fbe05894b99ba08`；目标 25 文件、`361113` bytes，manifest SHA256 `ec70515a65b70c370669ac710eacdd8f18b7193757b574262fc06926544e4bea`；verifier `505` 项通过）

### CrabCode Runtime

- [x] 在实际私有 Core 的未提交 preview 工作树实现 Workflow 自动发现
- [x] 在实际私有 Core 的未提交 preview 工作树实现 args、log、phase
- [x] 在实际私有 Core 的未提交 preview 工作树实现 agent、pipeline、parallel
- [x] 在实际私有 Core 的未提交 preview 工作树实现 structured output schema
- [x] 在实际私有 Core 的未提交 preview 工作树实现 worker/vm、deadline、forced cancel
- [x] 在实际私有 Core 的未提交 preview 工作树收紧宿主桥接/JSON 边界并阻断构造器逃逸
- [x] 在实际私有 Core 的未提交 preview 工作树实现未等待 RPC 的收敛、失败传播、取消与限时 drain
- [x] 在实际私有 Core 的未提交 preview 工作树实现嵌套 Agent 调度槽借用、防单槽死锁，并关闭显式/隐式 background、remote isolation 和 handoff 旁路
- [x] 在实际私有 Core 的未提交 preview 工作树实现 caller→child 权限不升级和嵌套 Agent allowlist
- [x] 在实际私有 Core 的未提交 preview 工作树实现调用/大小/时长上限、预算单飞与每轮 guard，并拒绝模型策略覆盖
- [x] 在实际私有 Core 的未提交 preview 工作树区分真实取消与清理性 abort，保留普通失败原错和 failed 状态
- [x] 在实际私有 Core 的未提交 preview 工作树实现 Task 状态、进度和 `initialPrompt`
- [x] 在实际私有 Core 的未提交 preview 工作树接通直接 QueryEngine/无头/SDK 的主 Agent 工具作用域
- [x] 在实际私有 Core 的未提交 preview 工作树接通 AppServer 已安装/cwd Agent 的逐回合身份解析、作用域工具和 ALS 隔离
- [x] 在插件侧映射 Hook 事件
- [ ] 把 preview 改动落入私有 Core 的永久 commit、review 和发布制品
- [ ] 建立正式最低 CrabCode 版本 Gate 与旧版本失败 UX
- [ ] 对 CLI `--agents` 自定义定义选择并实现正式平台合同，或将 AppServer 不支持写入稳定兼容矩阵并保留 fail-closed/fallback 行为
- [ ] 在真实 CLI/GUI 打包制品验证发现、运行、取消、崩溃、升级与降级
- [ ] 未来若扩展到不可信仓库，为执行项目测试的 patch Agent 提供 OS 级文件系统/网络/进程隔离，并提供禁用仓库指令/Hook/MCP 的 clean profile（不作为可信仓库 GA 的伪阻断项）

### 品牌与协议

- [x] `.claude-plugin` → `.crabcode-plugin`
- [x] plugin/skill/agent/workflow namespace
- [x] slash command
- [x] 根目录和 skill 目录变量
- [x] 模型语义别名和 effort
- [x] Banner 与条件触发 Hook
- [x] report/run/patch 前缀、nonce 和 owner marker
- [x] 项目配置和指令文件映射
- [x] 安装、权限和进度文案按现有 CrabCode 合同改写
- [x] 产品代码、运行时输出和用户文档的原品牌扫描规则已建立，来源边界单独排除
- [ ] 在最终包和真实运行输出上重新执行品牌零残留验收

### 行为

- [x] `scan-codebase`、scoped scan 与 non-Git 路径的 Job/脚本实现
- [x] branch、PR、commit changes 的 Job/脚本实现
- [x] `suggest-patches` 的 freshness、scratch、验证和产品渲染实现
- [x] coverage ledger、3-verifier quorum、max adversarial 和 deterministic confidence 的控制流/脚本实现
- [x] patch 只在 marker 绑定 scratch 中产生，产品不自动 apply/commit/push/PR
- [x] `write_scan_meta.py`、`render_report.py` 与 `patch_artifacts.py` 的 timestamp+nonce parser 已统一
- [ ] 从真实 CrabCode CLI/GUI 对所有七种输入逐一 E2E，证明入口可达、状态与产物一致
- [ ] 在真实可信仓库 patch 项目测试中证明用户 checkout/index 非变更；若未来声明不可信仓库支持，再单独证明 OS 隔离 + clean profile

### 安全与测试

- [x] 已建立元数据、报告、补丁的确定性测试套件与 fixture
- [x] 已建立严格路径/行号、panel 票数、canonical report/run、revision/results 绑定测试
- [x] 已建立路径穿越、symlink、owner marker、碰撞和错误复用测试
- [x] 已建立全新/既有 products owner 下的真实双进程 patch lease 竞争、results/owner 篡改、非空 snapshot digest 双向篡改和 clean-HEAD snapshot 测试
- [x] 已建立 Prompt Injection 与 Agent 无结果/schema/部分 panel 故障 fixture
- [x] Core preview 已建立 CPU loop、永不 resolve Promise 的硬取消和权限不升级测试
- [x] 在最终产品改动收敛后记录完整、可复现的本地插件测试、项目定义仓库测试、来源 verifier/generator、typecheck、build、validators 和语法校验结果
- [ ] 在真实 CLI/GUI E2E 记录 Git/非 Git 非变更断言、取消和孤儿回收
- [x] macOS/Linux CI job 已配置
- [ ] 保存 macOS/Linux 对最终 commit 的成功 CI 证据
- [ ] 完成版本化盲测配对语料、功效分析和按仓库聚类 bootstrap
- [ ] 完成隐私/留存演练、事故响应桌面演练和真实 owner 签署

### 发布

- [x] 目标 Marketplace 候选已保存为 `staged-not-active`，活动 Marketplace 未注册该插件
- [ ] internal alpha
- [ ] 独立 prerelease/beta 源
- [ ] 真实 Core 制品 canary 与预注册指标
- [ ] last-known-good 制品与升级/降级路径
- [ ] 回滚和敏感数据事故演练
- [ ] stable Marketplace 激活

---

## 13. Definition of Done

完成定义拆为四层，不能再用一个“100%”同时指源码集合、确定性合同、随机模型行为和产品可发布性。

### 13.1 `source-set/replay-complete`

满足以下条件，才能说固定快照的源码集合与派生重放完整：

1. 当前固定上游的 25 个文件和目录外 Marketplace 条目全部唯一映射，未来同步按 subtree 动态枚举；
2. 所有源码差异按第 1.3 节分类，没有用 `COMPAT` 隐藏 prompt、算法或权限变化；
3. 三个 Job、七个 Agent、三个确定性脚本、Hook、Skill/Spec 和 `scan.js` 的源码职责均保留；
4. 产品命名、namespace、输出前缀和宿主协议完成 CrabCode 映射，原品牌只存在于权威 provenance 边界；
5. `PORTING-MAP.md`、`SOURCE-LOCK.json`、generator 和 verifier 能解释并从锁定 blob 重建全部 25 个目标文件。

本层只回答“固定上游 25 个 blob 是否完整进入目标派生”。当前本地可复现 seal 已通过 505 项检查；由于文件尚未进入最终公开 commit，它不是不可变发布封存。任何 25 个产品文件或三项来源工具变化都必须重新生成/校验 seal，否则本结论自动失效。

### 13.2 `deterministic-host-contract-tested`

满足以下条件，才能说确定性宿主合同已测试：

1. effort、cap、retry、dedupe、quorum、adversarial、report 和 patch 状态机通过 host simulator 与边界测试；
2. 三个 Python 脚本对来源固定逻辑执行差分 oracle，target-only hardening 有独立反例测试；
3. Core preview 的 worker/vm、硬取消、权限非升级、嵌套 allowlist、调度、预算和 AppServer 已安装 Agent 路径通过确定性测试；
4. 测试结果记录明确通过/跳过/环境复跑，不能用“测试文件存在”替代运行证据。

本层不证明 provider 随机输出质量，不证明真实发布制品 E2E，也不证明 CLI `--agents` flagSettings 跨进程等价。

### 13.3 `model-behavior-equivalence`

只有在第 9.2 节以锁定上游作为 baseline、同 corpus/模型家族/effort 执行预注册配对评估并由独立 owner 解盲签署后，才能从 `PENDING` 改为 `PASSED`。源码重放、单次 golden、总体平均数或“看起来相似”均不能关闭本层。

### 13.4 `GA-ready`（可信仓库产品）

除 13.1–13.3 外，还必须同时满足：

1. 已通过重放的 `FULL-PORT.patch`、目标 manifest 和来源锁进入不可变的最终公开 commit，并由 CI 在该 commit 重新验证；
2. CrabCode Core 兼容层进入私有仓永久 commit、正式版本 Gate 和可验证发布制品，不是临时 preview；
3. worker/vm 硬取消、权限不升级、嵌套 allowlist 在真实制品通过故障注入；
4. 三个用户任务与七种输入模式在真实 CLI/GUI E2E 可达，用户 checkout、index、HEAD 和 branch 前后不变；
5. 最终 commit 的全量生态校验、macOS/Linux CI 和真实安装/升级/降级路径通过；
6. 数据留存、模型提供方数据合同、隐私、事故响应、last-known-good 和回滚演练有真实 owner 签署；
7. Marketplace 激活是最后的独立变更，且有可验证回退路径；
8. 产品所有入口明确标注“只支持自有可信仓库”，且不把 worker/vm 或 scratch checkout 描述为 OS 沙箱。

OS 级文件系统/网络/进程隔离与不加载项目指令、Hook、MCP 的 clean profile，是未来 `untrusted-repository-supported` 的联合前置条件，不是可信仓库 GA 的无条件阻断项。上述 13.4 全部满足前，对外只能标记为 preview 或受控 beta；无论可信仓库 GA 是否完成，在该联合边界落地前都不得声称“支持不可信仓库”。

---

## 14. 2026-07-23 实施复核审计记录

### 14.1 审计方法与证据边界

本次复核按“来源能否重建 → 宿主能否执行 → 失败是否安全 → 输出是否有所有权 → 关联方能否运营 → 发布能否回滚”逆向取证。勾选只表示对应源码或证据已在审计时点出现，不把测试文件存在或私有 Core 未提交工作树等同于最终 commit、CI 或发布制品。

权威/候选证据路径：

| 证据 | 路径 | 审计用途 |
|---|---|---|
| 目标插件 | `plugins/crabcode-security/` | 25 文件派生内容和 CrabCode 追加测试/元数据 |
| 来源锁 | `plugins/crabcode-security/docs/legal/SOURCE-LOCK.json` | 固定 commit、tree/subtree、blob、mode、target mapping |
| 人工差异表 | `plugins/crabcode-security/docs/legal/PORTING-MAP.md` | 逐文件差异类别和测试关联 |
| Marketplace 快照 | `plugins/crabcode-security/docs/legal/UPSTREAM-MARKETPLACE-ENTRY.json`、`TARGET-MARKETPLACE-ENTRY.json` | 目录外来源与 `staged-not-active` 目标候选 |
| 重放 patch | `plugins/crabcode-security/docs/legal/FULL-PORT.patch` | 在空临时目录先 materialize 固定上游 25 个 blob 后的完整目标重建证明；`475580` bytes，SHA256 `da912e2ca5e002816ccb9ee3818ea30ff46fe6a9788a0df17fbe05894b99ba08` |
| 来源工具 | `scripts/build-crabcode-security-port-patch.ts`、`seal-crabcode-security-port.ts`、`verify-crabcode-security-port.ts` | 生成器复算、原子 seal、25/25、mode、staged Marketplace、promotion selector 与重放等式；三项工具自身哈希进入锁，固定上游完整 checkout 通过 `505` 项检查 |
| 插件测试 | `tests/crabcode-security/` | 来源、差分、Workflow host、脚本、边界和 Banner 的确定性证据 |
| 运行入口 | `plugins/crabcode-security/skills/crabcode-security/jobs/`、`plugins/crabcode-security/workflows/scan.js` | 三个任务和控制流合同 |
| 文件安全边界 | `plugins/crabcode-security/scripts/write_scan_meta.py`、`render_report.py`、`patch_artifacts.py` | nonce、owner、报告/补丁校验与清理 |
| CI 配置 | `.github/workflows/ci.yml` | macOS/Linux、来源 verifier、插件测试与 mode 检查的计划证据 |
| Core preview | `/Users/fushihua/Desktop/CrabCode/src/tools/WorkflowTool/runtime.ts`、`tests/unit/workflow-runtime.test.ts`、`tests/unit/workflow-budget-query.test.ts`、`tests/unit/workflow-agent-contract.test.ts`、`tests/unit/StreamingToolExecutor-reentrantAgentSlot.test.ts`、`tests/unit/query-engine-main-agent-tools.test.ts`、`apps/agent-worker/tests/headless-runtime.test.ts` | 实际私有 Core 未提交工作树中的 worker/vm、宿主桥接收紧、硬取消、RPC drain、预算 guard、嵌套全生命周期调度和 direct/AppServer Agent 合同证据；不是持久发布证据 |
| Core 交叉复核副本 | `/private/tmp/CrabCode-security-runtime-copy` | 与实际私有 Core 的 50 条实施记录具有相同聚合 SHA256；仅用于验证交叉复核，不是权威落点或发布证据 |
| 私有 Core 审计归档 | `/Users/fushihua/.codex/visualizations/2026/07/23/019f8fcf-ca67-78c2-8b72-7cbcc6025999/private-core/2026-07-23-crabcode-security-private-core-实施审计归档.md` | 仅含私有实现元数据、测试结果、边界和变更清单，不向公开插件仓复制 Core 源码或 patch；SHA256 `ac44903283333577424e09f817e8b31a1de1701a5ba7b723ce0b209193b399d3` |

本次本地可复现 seal 的精确值已经写入 `SOURCE-LOCK.json`：上游 manifest SHA256 为 `c1273995451841d9ae9f1015683920efdd47c4006ab31589b04e62b35ca88a7d`，目标 manifest SHA256 为 `ec70515a65b70c370669ac710eacdd8f18b7193757b574262fc06926544e4bea`，目标 Marketplace 规范化条目 SHA256 为 `32cdc33f271035c5e418214e7d9dccaf58058fce7d8804e0303e676ebcafe090`，重放 patch SHA256 为 `da912e2ca5e002816ccb9ee3818ea30ff46fe6a9788a0df17fbe05894b99ba08`。正式公开 commit、Core commit、构建制品和发布记录尚未生成，不得填入占位哈希或把本地工作树称为不可变封存。

本轮最终本地验证记录：

- `bun run scripts/build-crabcode-security-port-patch.ts --check /private/tmp/claude-security-upstream-full`：patch 逐字节复算一致；
- `bun run scripts/verify-crabcode-security-port.ts /private/tmp/claude-security-upstream-full`：`505/505` checks；
- `CRABCODE_SECURITY_UPSTREAM_CHECKOUT=... bun test ./tests/crabcode-security/`：`88 pass / 1 expected skip / 0 fail`（89 tests、936 expects）；
- `CRABCODE_SECURITY_UPSTREAM_CHECKOUT=... bun run test`：2026-07-23 原实施工作树的项目正式 `./tests/` 套件为 `167 pass / 1 expected skip / 0 fail`（168 tests、2422 expects）；
- 2026-07-24 推送前从最新 `origin/main@c9776a33a10b2f3e2d15306035bc30871f3477ef` 建立的隔离分支复核：插件专项仍为 `88 pass / 1 expected skip / 0 fail`；项目正式套件为 `171 pass / 1 expected skip / 0 fail`（172 tests、2432 expects），新增 4 项来自主线既有 validator 测试；
- `bun test --rerun-each 20 ./tests/crabcode-security/scripts-edge-cases.test.ts -t concurrent`：全新与既有 products owner 两类真实双进程竞争合计 `40 pass / 0 fail`；
- `bun run typecheck`、`bun run build`、shell/Python syntax、`git diff --check`：均 exit 0；
- `bun run validate`：exit 0，仅有一个既存且与本移植无关的 `plugins/crabfin-cn/fin-core/skills/audit-xls/SKILL.md` office-spreadsheets 路由 warning；
- 私有 Core：同步后的实际工作树 `bun run test` 为 `5616 pass / 3 skip / 13 todo / 0 fail`，共 5632 tests、508 files、19087 expects；实际工作树 `bun run test:worker` 在允许 loopback/watch 能力的环境为 `1695 pass / 2 skip / 0 fail`，14 项 audit 测试、Core/worker typecheck、两项通信审计和 diff-check 均通过；与实际实施范围逐字节一致的验证暂存副本中，定向主/worker 分别 `187/187`、`132/132`，47 个相关 TS/TSX 文件的 Biome 检查通过。暂存副本曾在受限沙箱内因 loopback listen `EPERM` 与 watcher 环境出现 5 个环境失败，已保留该发现但不把环境拒绝写成产品失败；
- 额外执行的裸 `bun test` 会递归进入不属于项目正式 `test` 脚本的独立插件套件。最终树连续两次分别得到 `368 pass / 4 skip / 23 fail / 20 errors` 与 `371 pass / 4 skip / 20 fail / 20 errors`（均为 395 tests）；差异来自既有、带状态的 `security-guidance` Hook 用例，稳定的 20 个 unhandled errors 来自 `crabcode-media-ops` 缺少 `zod`、`unified`、MCP SDK 等依赖，以及 `crabcode-html-video` 缺少 workspace 包/puppeteer。这个裸递归命令本身不是项目正式套件，重复结果也非稳定基线；它不否定上述正式套件，但作为仓库级发现完整保留，未擅自修改这些用户范围外组件。

### 14.2 已关闭的实现问题

| 项目 | 状态 | 审计结论 |
|---|---|---|
| 固定上游源码面 | `CLOSED — source content` | 固定 commit 的 25/25 文件、目录外 Marketplace 来源和逐文件映射已经落位；没有发现以“核心文件”抽样替代全量复制 |
| 插件职责面 | `CLOSED — source content` | 七个 Agent、三个 Job、Skill/Role/Spec、三个 Python 脚本、Hook 和 `scan.js` 均保留独立职责，没有把多 Agent/quorum 简化成单提示词 |
| 品牌/宿主适配 | `CLOSED — implementation` | namespace、slash command、变量、模型语义别名、effort、Banner、报告/patch 前缀按 CrabCode 合同映射；provenance 原品牌被限制在 `docs/legal/**` |
| Marketplace 激活风险 | `CLOSED — staging control` | 目标条目保存为 `staged-not-active`；活动 Marketplace 只保留既有 `crabcode-security-review`，没有提前暴露不可运行插件 |
| 并发输出与所有权 | `CLOSED — implementation` | 报告根使用 UTC timestamp + schema-defined CSPRNG nonce 排他创建；scan/run/patch 产品以 owner marker、直接子级、canonical 关系和 report/revision/results 哈希绑定，三个脚本的 nonce parser 已统一。真实双进程补测揭露并修复了 loser 回滚 winner lease 的 TOCTOU；现在由原子 `mkdir` 选 winner，且只有本进程成功创建 run root 后才允许回滚，覆盖全新及既有 products owner 两种竞争 |
| 分析快照 | `CLOSED — implementation` | Job 使用 run 建立时冻结的 source/analysis root 与 revision 元数据；后续目录变化走 stale/refusal，不把移动中的用户工作树混入旧扫描 |
| 报告可信度 | `CLOSED — implementation` | 报告脚本对路径/行号、coverage、finding/vote schema、恰好三票、计数算术、confidence、canonical report/run 和双 marker 关系 fail closed |
| 补丁产品安全 | `CLOSED — implementation` | 补丁入口验证报告 freshness、选中 finding、revision/results 哈希、diff/header/reviewed paths，scratch 和产品目录各自绑定 owner；不自动 apply/commit/push/PR |
| 来源锁与重放 seal | `CLOSED — local reproducibility evidence` | 固定上游完整 checkout 经 verifier 通过 `505` 项检查；25 个目标文件、mode、staged Marketplace 规范化条目、promotion selector、三项来源工具哈希和 `FULL-PORT.patch` 均已入锁；在空临时目录 materialize 上游 blob 后重放逐字节相等。最终 commit/CI 封存仍开放 |
| Core 取消、边界与调度 | `IMPLEMENTED — preview / ACCEPTANCE OPEN` | 实际私有 Core 未提交工作树已有 worker/vm、deadline/forced termination、宿主桥接收紧、RPC drain、普通失败保真、预算租约/每轮 guard、嵌套单槽防死锁及所有 detached 旁路拒绝、caller→child 权限不升级和嵌套 Agent allowlist；预算模式会把受预算顶层 Agent 调用串行化，10 秒 drain 与进程级保守成本账本仍是明确边界 |
| AppServer 已安装 Agent 作用域 | `IMPLEMENTED — preview / ACCEPTANCE OPEN` | TUI/print 只传主 Agent 身份，worker 用自身 activeAgents 精确解析并把同一定义交给 QueryEngine/turn-local app state；并发 ALS 隔离和 fail-closed 条件已有确定性测试。CLI `--agents` 自定义定义仍列为独立开放限制 |
| Marketplace/质量/隐私决策口径 | `CLOSED — plan correction` | 已删除假 beta 字段与伪精确质量阈值，改为 staged 激活、盲测配对语料、聚类 bootstrap、预注册功效和真实 owner 签署 |

“IMPLEMENTED — preview”只表示实际私有 Core 的未提交工作树存在并通过当前确定性测试，不等于永久 commit、review、制品或真实 E2E 已验收。

### 14.3 仍开放的发布阻断项

| 阻断项 | 状态 | 关闭条件 |
|---|---|---|
| Core 永久交付 | `OPEN` | 已在实际私有 Core 工作树中的 preview 改动形成不可变 commit，经 review、CI、构建并保存制品 SHA256 |
| 正式版本 Gate | `OPEN` | Core/installer 提供可机读最低版本合同和旧版本明确拒绝 UX，不在插件 manifest 自造字段 |
| AppServer 自定义 `--agents` 与制品等价性 | `OPEN` | 为不可由 cwd 重建的 flagSettings 定义建立安全的正式协议，或在兼容矩阵中明确 AppServer 不支持并验证 direct fallback/account fail-closed；真实制品继续证明已安装 Agent 路径等价 |
| 真实制品 E2E | `OPEN` | 在 CLI/GUI 包验证发现、参数、structured Agent、并发、进度、取消、崩溃、七种输入和非变更断言 |
| 最终集成测试证据 | `OPEN` | 对最终 commit 记录来源 verifier、插件测试、本仓 validators 和 macOS/Linux CI；失败、跳过或未运行均不得写成通过 |
| 模型质量 promotion | `OPEN` | 冻结版本化盲测配对 corpus，完成 pilot/功效分析和预注册，按仓库聚类 bootstrap 后由独立 owner 解盲签署 |
| 数据治理与事故演练 | `OPEN` | 绑定真实 Security/Privacy owner，确认遥测/保留/删除合同并完成越界写入和敏感外发桌面演练 |
| canary/回滚/升级降级 | `OPEN` | 使用真实 Core 制品和明确测试者名单完成 canary、last-known-good、升级/降级与不删用户报告的回滚演练 |
| Marketplace GA 激活 | `OPEN` | 仅在可信仓库 GA 的以上 Gate 关闭后，以独立提交把 staged 条目激活；当前必须保持 inactive |

### 14.4 未来不可信仓库扩展（不冒充可信仓库 GA Gate）

`untrusted-repository-supported` 当前为 **NO**。若未来改变产品范围，必须同时交付并故障注入验证：

1. 项目测试进程的只读/临时挂载、网络策略、子进程边界和资源上限；
2. 不加载仓库 `CRABCODE.md`、`.crabcode/` 指令、Hook、MCP、Git 配置或其他项目级设置的 clean profile；
3. 从打开仓库之前即建立的隔离会话，避免先加载高优先级配置再进入沙箱；
4. 明确的模型提供方数据边界和不可信样本处置合同。

只完成 OS sandbox 或只做 prompt fencing 都不足以关闭该扩展。

### 14.5 最终分层结论

| 结论 | 当前值 | 含义 |
|---|---|---|
| `source-set/replay-complete` | **YES** | 固定上游 25/25 blob、目录外条目、一一映射、mode、目标字节和完整适配 patch 均可从锁定对象重建；这是本地可复现结论，最终 commit 仍开放 |
| `deterministic-host-contract-tested` | **YES** | 固定脚本、Workflow host simulator、边界与 Core preview 的确定性合同已经执行测试；不外推为随机模型质量或真实制品等价 |
| `model-behavior-equivalence` | **PENDING** | 尚未完成以锁定上游为 baseline 的版本化盲测配对 corpus、功效分析和独立解盲签署 |
| `GA-not-complete` | **YES** | 正式 Core commit/版本 Gate、AppServer 自定义 `--agents` 平台合同、真实制品 E2E、质量盲测、owner 签署、canary 和回滚尚未全部完成 |
| `untrusted-repository-supported` | **NO** | worker/vm 与 scratch 不是 OS 沙箱，且尚无从会话建立前禁用项目配置的 clean profile |

`source-set/replay-complete` 和 `deterministic-host-contract-tested` 都不能被宣传成 `GA-ready` 或模型质量等价。在开放项关闭前，`crabcode-security` 必须保持 `staged-not-active`，用户面只允许 preview/受控 beta 口径。
