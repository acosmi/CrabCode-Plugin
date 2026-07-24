# CrabCode 深度安全扫描 v0.10.0-crabcode.1

发布日期：待 Core Workflow runtime 发布后确定
状态：preview 源码候选；验收与发布 Gate 仍开放，不作为当前稳定版可用性声明

## 本次交付

- 新增独立插件 `crabcode-security`，不覆盖现有轻量 `crabcode-security-review`。
- 完整落位 25 个产品文件：7 个 Agent、3 个 Hook、3 个 Python 脚本、Skill/Job/Spec 和代码化扫描 Workflow。
- 25 个移植文件完整保留全库、指定范围、分支变更、拉取请求、单次提交和报告补丁入口；这些入口仅在兼容的 preview Core 中可运行。
- 保留 400 个 raw candidate、去重后 45 个验证候选、固定三验证者和 2/3 quorum 等控制流。
- 新增逐 blob/mode/哈希来源锁、目标快照、staged Marketplace 条目证明，以及“在空临时目录先 materialize 固定上游 25 个 blob、再应用 `FULL-PORT.patch`”的可复现重放命令。
- 新增可执行 Workflow host simulator、脚本产物/清理、Hook 过滤、完整路径映射和全局展示快照测试。
- 修复 `patch_artifacts.py --prepare-run` 的真实双进程 lease 竞态：并发 loser 不再可能清理 winner 的 run root；全新和既有 products owner 两条路径都要求恰好一个成功者。

## 运行时要求

本版本依赖 CrabCode 的插件 Workflow runtime，包括 Workflow 自动发现、结构化 Agent 输出、受并发槽上限约束的 `parallel`、顺序 `pipeline`、进度阶段和取消传播。启用美元预算时，每个受预算约束的顶层 `agent()` 调用在完整模型响应期间持有进程级预算租约，故同一进程中的这类调用退化为串行；单个已在途响应仍可能在最终 usage 返回时越过阈值。当前 CrabCode 1.0.20 尚无该完整 runtime；在对应 Core 制品发布并通过真实 E2E 前，本插件只能作为固定源码派生 preview，不能把“安装成功”表述为“扫描可运行”。

普通已安装/cwd Agent 在 AppServer 中按身份由 worker 重新解析；CLI `--agents` 注入且无法从 cwd 重建的自定义定义尚无跨进程正式合同。该路径必须继续 fail closed 或走已验证的 direct fallback，不能宣称与已安装 Agent 等价。

CrabCode 的 `UserPromptSubmit` 当前没有上游式预过滤 matcher。为避免在每条用户提示上误报，Banner helper 在找不到 `python3` 时静默 fail-open；Python `<3.9` 时只有目标命令会收到版本告警。扫描与补丁脚本仍明确要求 Python 3.9+，缺失时任务不能运行。

活动 Marketplace 有意不注册 `crabcode-security`；候选条目仅作为
`staged-not-active` 证据保存在插件的 `docs/legal/` 中。

## 用户数据与安全边界

- 扫描结果只写入仓库根部原子创建的 `CRABCODE-SECURITY-<timestamp>-<nonce>/`，并由 report/run 双 owner marker 绑定到扫描源与不可变分析快照。
- 补丁在 marker 绑定的 scratch checkout 生成，插件不自动 apply、commit、push 或创建拉取请求；scratch 不等于 OS 沙箱。
- 插件面向用户自有、可信代码库。插件没有专属遥测或上传通道，报告产物默认保存在本地；Agent 推理仍会把所需 prompt/代码上下文发送给 CrabCode 已配置的模型提供方，并遵循该提供方的地域、保留和隐私合同。
- OS 沙箱或一次性虚拟机只能限制文件、进程和网络，不能中和 CrabCode 在会话建立时已加载的项目指令、Hook 或 MCP 配置。当前不支持不可信仓库；未来若要支持，必须同时使用 OS 隔离和禁用项目配置的 clean profile。
- 插件自身漏洞通过仓库的私密 Security Advisory 报告。

## Promotion Gate

进入可信仓库范围内的稳定 Marketplace 前仍须完成：Core 私有仓变更进入永久 commit 与发布制品、正式最低兼容版本 Gate 和旧 Core 拒绝 UX、CLI `--agents` 自定义定义的安全平台合同或明确稳定兼容矩阵、真实安装/升级测试、macOS/Linux E2E、固定安全语料的预注册配对质量评估、数据治理 owner 签署、canary 和回滚演练。OS 沙箱与 clean profile 是未来“不可信仓库支持”的联合 Gate，不是可信仓库 GA 的伪装完成项。
