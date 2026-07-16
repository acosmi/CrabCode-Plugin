# crabcode-media-ops 0.4.0 发布阻断审计与补全实施方案

- 文档日期：2026-07-15
- 审计对象：`plugins/crabcode-media-ops`（分支 `codex/media-ops-0.4.0-release-hardening`）
- 当前版本：`0.4.0-rc1`（未晋升正式 `0.4.0`，未做正式发布提交）
- 文档状态：**实施前方案**（基于真实命令输出与代码路径复核；本轮只审计与定方案，不继续试错实现）
- 上游执行日志：`docs/audit/2026-06-23-execution-log.md`（「收口实施、真实输出与三次失败停止」）

---

## 一、执行摘要

媒体运营插件 0.4 能力主体（参考防火墙、联网研究、陈述台账、原创门禁、HTML 主交付、Nu/Playwright/axe 自动 QA、可信身份审批与可恢复 package）已落在工作树，但**全量测试未绿**，按「三次失败即停止」规则停止，**不能**把工作区冒充正式 `0.4.0`。

阻断不是“功能没写完”的单一缺口，而是两条独立门禁：

| 编号 | 门禁 | 性质 | 是否产品缺陷 | 是否可在无人值守下伪造成功 |
|------|------|------|--------------|----------------------------|
| B1 | Playwright 交付 QA 在 Bun 多测场景下不稳定 | 工程/调度 | 是（测试夹具与 QA 生命周期设计） | 否（必须真绿） |
| B2 | 真实微信草稿/编辑器渠道验收 | 渠道/人机 | 否（产品边界已声明不自动发平台） | 否（禁止伪造） |

**结论**：正式发布标注 `0.4.0` 前必须先绿 B1；B2 应拆成「可自动化的渠道产物验收」与「需真人登录的微信后台验收」，后者不得由 agent 绕过浏览器安全策略完成。

---

## 二、现状盘点

### 2.1 工作树与版本

- 路径：`/Users/fushihua/Desktop/CrabCode-Plugin`
- 分支：`codex/media-ops-0.4.0-release-hardening`（当前检出；大量未提交修改）
- `plugins/crabcode-media-ops/package.json` → `"version": "0.4.0-rc1"`
- 运行时 `VERSION = '0.4.0-rc1'`（`src/domain.ts`）
- 已有 QA 栈：`src/qa/delivery-qa.ts`、`tests/browser/*.pw.ts`、`playwright.config.ts`（`workers: 1`）
- CI：`.github/workflows/ci.yml` 的 `media-ops-plugin` job 已使用 Playwright 官方镜像 + **`--ipc=host`** + Java 21 + `bun run test` + `qa:release` + `validate`

### 2.2 已完成且不宜回退的 0.4 能力（摘要）

- 参考材料权利/用途分类与 writer 隔离
- `research.capture/complete/get` 与来源等级服务端派生
- 全可见句 statement ledger + 四类 coverage
- 原创扫描绑定正文/参考字节
- ArticleDoc → `article.html`（主）/ `article.md`（备）/ `wechat-richtext.html`（渠道档案）
- `delivery.verify` 绑定 Nu + Playwright + axe 证据哈希
- 可信 principal 审批与可恢复 package 两阶段提交
- profile SQLite 权威与迁移 fail-closed

上述能力的业务测试在分文件专项中多已通过；**卡在全量矩阵与渠道门禁**。

---

## 三、阻断现场（三次失败原样）

来源：Codex 会话 `rollout-2026-07-15T08-12-04-...` 与执行日志原文。

### 尝试 1：默认/高并发 → IPC ENOENT

```text
$ bun test
101 pass / 3 fail / 2 errors
# 多测试文件同时启动 Playwright：Failed to connect, syscall connect, errno -2, code ENOENT
```

### 尝试 2：有界 QA 并发 2 + `bun test --timeout 60000 --max-concurrency 4`

```text
$ bun run test
105 pass / 2 fail / 1 error
# 失败仍含：delivery 测试启动 Playwright 时 Failed to connect / ENOENT
# 另有 AI bodyLabel 文案断言漂移（后已修成 required/forbidden 双分支）
```

### 尝试 3：`MAX_CONCURRENT_QA_RUNS = 1` + `--max-concurrency 1`

```text
$ bun test --timeout 60000 --max-concurrency 1 \
    tests/references-research.test.ts tests/delivery.test.ts
22 pass / 1 fail
# (fail) HTML-primary frozen delivery >
#   incomplete viewport/print evidence cannot mark a candidate verified [60011.50ms]
# 前两个同文件浏览器交付用例约 3s 通过，第三个 60s 无返回
```

按用户规则第三次后停止，未再靠加长 timeout / retry / 跳过浏览器 / 伪造截图造绿。

### 微信草稿

按 `browser:control-in-app-browser` 打开 `https://mp.weixin.qq.com` 时，浏览器能力以**安全策略拒绝**。未绕过、未登录、未建草稿、未发布。本地 `wechat-richtext.html` 与 golden 截图**不能**冒充真实渠道验收。

---

## 四、根因分析（第一性）

### 4.1 B1：Playwright IPC ENOENT + 单并发超时

#### 4.1.1 架构事实

1. **生产路径把完整浏览器 QA 嵌进 `delivery.verify`**  
   `src/tools/delivery.ts` 在静态检查通过后调用 `runDeliveryQa()`：启动 Nu(Java)、Chromium、本地静态服务、8 组视口×配色 axe、文本间距/200% 压力、A4/Letter PDF。

2. **测试夹具把 `verify` 嵌进几乎所有“已审稿”工厂**  
   `tests/helpers.ts` 的 `createReviewedContent()` **无条件**调用 `verifyHandler` 并要求 `status === 'ok'`。  
   全插件约 **26 处**调用（`delivery` / `approval` / `package` / `readiness` / `preview` / `references-research` 等）。  
   结果：任意业务测试都可能冷启动一整套 Chromium+Nu。

3. **进程内限流与 Bun 测试并发不匹配**  
   - `runDeliveryQa`：`MAX_CONCURRENT_QA_RUNS = 1` + 同 artifact root 串行  
   - `package.json`：`"test": "bun test --timeout 60000 --max-concurrency 4"`  
   最多 4 个测试同时进入 `verify`，其中 3 个在 QA 槽位上**空等**；等待时间计入用例 timeout。  
   粗算：单次 QA 若 15–25s，队尾用例 wait+run 易 ≥60s。

4. **“失败视觉证据”用例仍跑完整自动 QA**  
   `delivery.test.ts` 中  
   `incomplete viewport/print evidence cannot mark a candidate verified`  
   先 `createReviewedContent`（已完整 QA 一次），再 `render` + `verify`（静态检查仍通过 → **再完整 QA 一次**），最后才因 `visual-evidence` 失败。  
   在单并发第三次失败中，该用例是 60s 超时点——与“双倍重 QA + 冷启动/残留浏览器”高度吻合，而非业务断言写错。

5. **ENOENT 的典型机制**  
   Playwright 通过 pipe/socket 连 browser server；多实例并发 launch/close、IPC 命名空间受限（容器默认 shm/ipc）、或上一次 browser 未干净退出时，`connect` 可表现为 `ENOENT`（errno -2）。  
   CI 已用 `--ipc=host` 缓解容器侧；**本机 Bun 多文件 fan-out 仍可复现**。进程内 `MAX_CONCURRENT_QA_RUNS=1` 只能串行化**已进入** `runDeliveryQa` 的调用，不能阻止：
   - 多个 Chromium 残留；
   - 队列等待导致的 timeout；
   - “launch 卡死直到用例被 Bun 杀掉”的表观挂起。

6. **队列实现需复核的细节**  
   当前 `acquireQaSlot`/`releaseQaSlot` 在 waiter 唤醒时不增减 `activeQaRuns`（由持有者释放时决定）——单线程正确。但：
   - 无**跨进程**锁（多 Bun 进程/并行 job 仍会撞）；
   - 无 launch 级超时与强制 `browser.close()` 的 watchdog；
   - Nu 的 `runCommand` 60s 与测试 60s 同级，冷启动 Java 时易双超时叠加。

#### 4.1.2 根因一句话

> **不是 HTML 排版错了，而是“每个业务夹具都同步跑完整 Chromium 交付 QA”+“Bun 多测并发/60s 预算”与“单槽串行 Playwright”结构性冲突，再叠加浏览器 IPC 脆弱性，导致 ENOENT 与超时交替出现。**

### 4.2 B2：微信草稿被安全策略拒绝

#### 4.2.1 产品边界（已写进 README）

> 当前提供本地研究…自动 QA…人工发布包；**不提供**真实平台 API 发布、浏览器最终点击…  
> **真实微信草稿/编辑器回归属于发布前渠道验收**，不等于插件具备自动发布能力。

#### 4.2.2 根因一句话

> **Agent 控制的浏览器不允许打开/操作 `mp.weixin.qq.com`；这是策略边界，不是代码 bug。未登录、未绕过是正确行为。正式版若把“agent 自动完成微信草稿”写成硬门禁，则在当前工具约束下永不可达。**

#### 4.2.3 发布语义澄清（必须先裁决）

| 选项 | 含义 | 建议 |
|------|------|------|
| **R-A** | 正式 `0.4.0` = 插件+自动 QA+安装态绿；微信草稿为人机 **Gate B** 清单 | **推荐**（与现有 README/runbook 一致） |
| **R-B** | 正式 `0.4.0` 必须有真人签字的微信草稿回归证据包 | 可做，但依赖用户在真实浏览器登录操作，agent 只生成 checklist + 本地产物 |
| **R-C** | agent 自动登录微信并建草稿 | **否决**（安全策略 + 合规 + 产品边界） |

本方案默认 **R-A**，并给出 R-B 的可选证据模板；**禁止 R-C**。

---

## 五、影响面

| 层级 | 影响 |
|------|------|
| 发布 | 不能从 `0.4.0-rc1` 晋升；不能声称正式 0.4.0 |
| CI | `media-ops-plugin` job 依赖 `bun run test` + `qa:release`；本机红则 PR 也红（或仅本机红、CI 绿——仍不得本机未验证就宣称） |
| 开发体验 | 任何改 helpers 下游的测试都可能 60s×N 跑 QA，反馈环极慢 |
| 生产行为 | 真实 `delivery.verify` 仍应跑完整 QA；问题在**测试策略**与**生命周期**，不是删掉生产 QA |
| 渠道 | 微信富文本档案可本地验收；真实编辑器清洗效果仍需人工 |

---

## 六、补全实施方案（达到可发布标注）

### 6.0 发布 Definition of Done（DoD）

下列全部满足才允许：

1. 版本号与运行时 `VERSION` 同为 `0.4.0`（或用户书面接受继续 `0.4.0-rc1` 作为“可安装 RC”另标）  
2. 在插件目录：

```bash
bun install --frozen-lockfile
bunx playwright install chromium   # 仅当本机缺固定版本
bun run typecheck
bun run test                       # 0 fail，可重复 2 次
bun run build
bun run qa:release
bun run validate
```

3. （推荐）安装态：`bun run qa:installed` 在真实安装根执行  
4. 微信：按 §6.3 完成 **R-A 自动项**；若选 R-B，附真人签字清单  
5. 变更已提交到任务分支 HEAD；执行日志 append 真实命令与 exit code  
6. **禁止**：跳过 browser、`--update-snapshots` 偷写、伪造 wechat 草稿截图、把源码目录成功冒充安装态  

---

### 阶段 P0 — 拆分“业务夹具”与“浏览器交付 QA”（修 B1 主因）

**目标**：业务测试默认不启动 Chromium；浏览器 QA 只在明确的 delivery/QA 套件中跑，且全程单飞。

#### P0-1 改造 `createReviewedContent`

文件：`tests/helpers.ts`

- 增加选项，例如：
  - `deliveryMode: 'none' | 'render-only' | 'verified'`（默认 **`render-only` 或 `none`**，由调用方需要决定）
  - 或 `skipAutomatedQa?: boolean` + `verifyStatus?: 'pending' | 'verified'`
- **默认路径**只做到 `reviewed` +（可选）`render` 出 deliveryId，**不**调用完整 `verifyHandler`。
- 仅 `delivery` / `package` / 明确断言 `qaEvidence` 的测试使用 `verified`。

#### P0-2 引入测试用“轻量 verify”与“完整 QA”分层

文件：`src/tools/delivery.ts`（或测试专用 hook，避免污染生产默认）

推荐两种等价设计（二选一，优先 A）：

**A. 环境门控（推荐）**

- 生产默认：始终跑 `runDeliveryQa`  
- 测试：`MEDIAOPS_QA_MODE=full|static|off`
  - `full`：与生产相同（CI 与 `delivery`/`browser` 套件）
  - `static`：只做字节/CSP/H1/确定性重渲染，不启 Chromium/Nu  
  - `off`：仅写 visual 输入校验路径（用于 incomplete viewport 负例）
- **禁止**在未设门控时静默跳过；CI 的 `bun run test` 对含 QA 的 job 显式 `MEDIAOPS_QA_MODE=full`，或拆 job。

**B. 测试注入 fake QA**

- 仅在 unit 层注入已通过的 `qaEvidence` 结构；真实 `runDeliveryQa` 只在 `tests/browser` 与 1–2 个集成测。

#### P0-3 修正 `incomplete viewport` 用例

文件：`tests/delivery.test.ts`

- 使用 **未 verified** 或 `MEDIAOPS_QA_MODE=off` 的 candidate  
- 断言停在 `visual-evidence` failed / `action_required`  
- **禁止**为负例再跑两轮完整浏览器 QA  

#### P0-4 串行化策略（与限流一致）

| 层级 | 动作 |
|------|------|
| Bun 默认业务测 | `--max-concurrency` 可保持 4–8（因不再抢 Chromium） |
| 含 full QA 的文件 | 单独脚本：`bun test --max-concurrency 1 --timeout 180000 tests/delivery.qa.test.ts` 或只跑 `playwright test` |
| `runDeliveryQa` | 保持全局 `MAX_CONCURRENT_QA_RUNS=1`；补 **跨进程文件锁**（`proper-lockfile` 级或自实现 `qa.lock` + stale 检测），避免并行 job 互撞 |
| Playwright CLI | 已有 `workers=1`；保持 `--retries=0 --fail-on-flaky-tests` |
| CI | 已有 `--ipc=host`；本机 macOS 文档注明勿并行开多个 media-ops full QA |

#### P0-5 生命周期硬化（防 ENOENT / 挂起）

文件：`src/qa/delivery-qa.ts`

1. **单次 browser 复用（进程内）**：`runDeliveryQaOnce` 使用模块级 `Browser` 懒加载 + 引用计数；所有 viewport 共用一个 browser，context 级隔离。减少反复 `chromium.launch`。  
2. **Launch/操作超时**：`chromium.launch`、`page.goto`、整次 `runBrowserQa` 设显式 timeout（建议 browser 段 120s，Nu 段保持 60s 或升至 90s 并写入报告）。  
3. **失败必清理**：`finally` 中 `context.close` / 条件 `browser.close`；可选 `SIGTERM` 残留进程（仅 QA 子进程）。  
4. **错误分类**：IPC/ENOENT 记为 `tools_unavailable` 或 `qa_infrastructure_failed`，报告中保留 syscall，**不得**改写成“内容不合格”。  
5. **可观测性**：`browser-report.json` 增加 `queueWaitMs`、`browserLaunchMs`、`totalMs`，便于区分“内容失败”与“基建慢/挂”。

#### P0-6 超时预算重算

- 业务测（无 browser）：保持 30–60s  
- 单次 full QA 集成测：`timeout ≥ 180000`  
- `helpers.setDefaultTimeout` 与 package 脚本对齐，避免 30s 默认误杀  
- **不要**用无限加大 timeout 掩盖队列设计错误；先减 fan-out，再设合理上限  

**P0 验收**

```text
# 业务套件（无/静态 QA）应快速全绿
bun test --timeout 60000 --max-concurrency 8 \
  tests/*.test.ts --exclude 若需要可拆分

# Full QA 子集连续 2 次
MEDIAOPS_QA_MODE=full bun test --max-concurrency 1 --timeout 180000 tests/delivery.qa.test.ts
bun run qa:release
# 2× 全量：0 fail
```

---

### 阶段 P1 — 测试资产重组与 CI 对齐

#### P1-1 文件拆分建议

| 文件 | 内容 |
|------|------|
| `tests/delivery.static.test.ts` | 确定性重渲染、incomplete visual、角色分离（无 Chromium） |
| `tests/delivery.qa.test.ts` | 1–2 个 full QA 正向；缺 Java/Chromium 负向（已有 browser 测可复用） |
| `tests/browser/*.pw.ts` | golden + delivery-qa（已有）保持唯一视觉源 |

#### P1-2 package.json scripts

```json
{
  "test": "bun test --timeout 60000 --max-concurrency 8 tests --ignore tests/browser",
  "test:qa": "bun test --timeout 180000 --max-concurrency 1 tests/delivery.qa.test.ts",
  "qa:browser": "playwright test --workers=1 --retries=0 --forbid-only --fail-on-flaky-tests --update-snapshots=none",
  "qa:release": "bun run qa:fixture && bun run qa:browser",
  "test:all": "bun run test && bun run test:qa && bun run qa:release"
}
```

（路径 ignore 语法按 Bun 实际能力微调；若 ignore 不稳，则用显式文件列表。）

#### P1-3 CI `media-ops-plugin`

保持 Playwright 容器 + `--ipc=host` + Java 21。建议步骤顺序：

1. `typecheck` / `build`  
2. `bun run test`（业务）  
3. `bun run test:qa`（full，concurrency 1）  
4. `bun run qa:release`  
5. `validate`  
6. 失败上传 `test-results`（已有）

固定 `bun-version: 1.3.11`（已有），避免 `latest` 漂移。

#### P1-4 本机开发者说明（README 一小节）

- 需要 full QA 时：`bunx playwright install chromium` + Java 17+  
- 不要多终端同时跑 `test:qa`  
- macOS 与 CI linux golden 分平台目录（已有 `darwin`/`linux`）

---

### 阶段 P2 — 微信渠道门禁（B2）可发布化

#### P2-1 自动化（纳入正式 0.4.0，R-A）

在**不打开微信后台**的前提下必须绿：

1. `wechat-richtext.html` 由同一 ArticleDoc 确定性生成；字节进 manifest  
2. 仅允许内联样式/本地图片约定；无远程脚本/字体/跟踪（已有渲染约束，补测试）  
3. 复制清单/runbook 步骤可机读：`platform-delivery/references/publish-runbook.md`  
4. （可选）本地“富文本片段结构快照”测试：标签白名单、单 H1 不强制于渠道档案、图注 alt 存在  

#### P2-2 人机渠道验收（R-B，可选但推荐随发布窗口）

输出 `docs/releases/wechat-draft-acceptance-checklist-0.4.0.md`（模板）：

1. 打开本机 `article.html` 与 `wechat-richtext.html`  
2. 真人浏览器登录公众号后台（**非 agent**）  
3. 粘贴/导入草稿，记录：是否被清洗的标签、图片是否在、是否多余空行  
4. 截图与 `deliveryId` / HTML sha256 一并归档  
5. 签字：操作者、时间、结论 pass/fail  

Agent **只**准备产物与清单，**不**执行登录。

#### P2-3 文档口径

- README「平台与合规边界」保持：无自动发布  
- 发布说明写清：0.4.0 交付的是**可审计发布包 + 自动视觉/HTML QA**；微信后台以人工清单为准  
- 若 R-B 未完成：版本可仍标 `0.4.0`，但 release notes 列 **Known residual: live WeChat editor not executed in this window**

---

### 阶段 P3 — 版本晋升与提交闭环

仅当 P0–P1 全绿（及 P2-1）：

1. `package.json` + `domain.ts` VERSION → `0.4.0`  
2. `docs/releases/2026-07-15-v0.4.0.md`：变更摘要、门禁命令、残余风险  
3. SBOM：`bun run sbom` / `sbom:check`  
4. 全量 `test:all` + `validate` 连续两轮  
5. 提交任务分支（不 merge main、不 force-push）  
6. 执行日志 append 最终命令与哈希  
7. 用户决定是否 PR / 合并 / 安装态刷新  

**明确不做**：为绿而删 QA 依赖、降低 axe 阈值、自动 update snapshots、把 RC 假标成 GA。

---

## 七、实施顺序与工时量级（供排期）

| 顺序 | 项 | 预估 | 依赖 |
|------|----|------|------|
| 1 | P0-1/P0-3 helpers + incomplete 用例 | 0.5–1d | 无 |
| 2 | P0-2 QA mode 门控 | 0.5d | 1 |
| 3 | P0-5 browser 复用与超时/清理 | 0.5–1d | 2 |
| 4 | P0-4/P1 scripts + CI | 0.5d | 3 |
| 5 | 全量双跑与 flake 观察 | 0.5d | 4 |
| 6 | P2-1 微信产物自动项 | 0.5d | 5 |
| 7 | P3 版本与 release 笔记 | 0.5d | 6 |
| 8 | P2-2 真人微信清单（可选） | 用户日历 | 7 |

合计工程约 **3–5 人日**（不含真人微信排期）。

---

## 八、风险与非目标

### 风险

- 若业务测默认 `skip QA` 过度，可能回归“未 verified 就 package”——必须由 readiness/package 测试在 **static 或 full** 模式覆盖门禁，而不是依赖每个夹具都跑 Chromium。  
- Browser 单例若跨测试污染状态：每个 `runDeliveryQa` 必须新 context，禁止共享 page。  
- 跨进程文件锁 stale：崩溃后需 TTL（如 10min）回收。  

### 非目标（本窗口）

- 微信开放平台 draft API 自动发文（Gate B / 另立项）  
- 语义 embedding 查重  
- 完整 WCAG 认证  
- 修改 `/Users/fushihua/Desktop/CrabCode` 宿主仓（除非另任务）  

---

## 九、建议的立即下一步

1. **用户确认发布语义**：正式 `0.4.0` 采用 **R-A** 还是 **R-B**。  
2. 在本分支实施 **P0-1 → P0-3 → P0-2 → P0-5**，先让 `bun run test` 在无重复前提下全绿。  
3. 再跑 `test:qa` + `qa:release` 双次。  
4. 通过后执行 P3 版本晋升；微信真人清单并行安排。  

在未完成 P0 前，**不应**再以“调 concurrency / 加 timeout”作为第三次以上的试错主路径——那只会重复已记录的失败模式。

---

## 十、追溯索引

| 证据 | 位置 |
|------|------|
| 三次失败原始记录 | `docs/audit/2026-06-23-execution-log.md` §收口实施… |
| QA 实现 | `plugins/crabcode-media-ops/src/qa/delivery-qa.ts` |
| verify 挂载点 | `plugins/crabcode-media-ops/src/tools/delivery.ts` |
| 夹具 fan-out | `plugins/crabcode-media-ops/tests/helpers.ts` → `createReviewedContent` |
| 超时用例 | `plugins/crabcode-media-ops/tests/delivery.test.ts` |
| CI ipc | `.github/workflows/ci.yml` `media-ops-plugin` `options: --ipc=host` |
| 产品边界 | `plugins/crabcode-media-ops/README.md` §平台与合规边界 |
| 0.4 能力方案 | `docs/audit/2026-07-15-crabcode-media-ops-原创与可信来源修复补全实施方案.md` |

---

**审计结论**：阻断真实、可复述、可修。B1 应用“夹具降载 + QA 单飞 + 生命周期硬化”根治；B2 应用“自动产物验收 + 可选真人清单”对齐发布标注，禁止安全策略绕过。完成 DoD 后方可标注正式 `0.4.0`。
