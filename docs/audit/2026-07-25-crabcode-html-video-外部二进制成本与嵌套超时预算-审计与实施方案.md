# CrabCode HTML Video 外部二进制成本与嵌套超时预算审计与实施方案

> 日期：2026-07-25
>
> 状态：立项存档，尚未实施
>
> 审计范围：`crabcode-html-video` 的外部二进制解析与探测路径、嵌套超时预算的对齐关系、探针失败的降级语义，以及全仓同类问题
>
> CrabCode-Plugin 基线：`62e1783`
>
> 触发来源：PR #4（merge `62e1783`）的实测推翻了本仓记忆中"消除冗余浏览器探针可将 doctor 延迟砍半"的预估

## 1. 执行摘要

本次立项不是为了修一个已知缺陷，而是因为**一条写进记忆并据此立项的性能结论，在 CI 上一测即塌**。复盘这条错误暴露出的不是偶发失误，而是一个在本插件内反复出现的缺陷类，且其中一个实例正是 2026-07-24 `html-video-plugin` job 常红的直接原因。

已确认的核心事实：

1. `resolveFfmpegPath()` 内部**已经**通过 `canRunBinary()` 启动过一次 ffmpeg-static 的 77MB 静态二进制，`doctor` 拿到路径后**又启动一次**取同一份 `-version` 输出。这与 PR #4 刚修复的浏览器双探针是**同一个缺陷类**，但二进制体积大约 30 倍、调用点多得多。
2. `runFfmpeg()` 每次调用都重新执行 `resolveFfmpegPath()`，因此一次多段渲染中的每条 ffmpeg 命令都先额外付一次 `-version` 探测。解析结果从未被缓存。
3. 探测统一压在 **5000ms** 上限上——与 07-24 把 CI 顶红的那个数字相同——且探测失败不是报错，而是**静默降级**（换用系统 ffmpeg，或让测试静默 `skip`）。
4. 至少两处**嵌套超时倒挂**：外层墙钟预算小于它所包裹的内层预算，使内层参数永远不可达。这与把 CI 顶红的缺陷（外层 5000ms < 内层 30s）是同一个不变式被违反。
5. `doctor` 约 6.6s 的耗时归属**仍未定论**。ffmpeg-static 冷加载是当前最有依据的怀疑对象，但**未实测**，本方案的第一优先级就是把它测定，而不是直接动手改。

一条必须先写下来的反直觉结论，否则本方案会重蹈 PR #4 的覆辙：**去重不等于省下冷加载**。冷加载成本由第一次 spawn 承担，第二次已在 page cache 中。因此 F1 的去重只回收"温成本"（每次数十毫秒量级），**不能**预期它消除那 2.3–7s。谁要宣称它能，先测。

## 2. 立项缘由：一条被实测推翻的结论

PR #3 修复 CI 常红时记录了一条未实测的判断："`doctor` 的第二次 `probeBrowserExecutable` 冗余，消除可把 doctor 延迟砍半。" PR #4 实施后实测：

| 测量项 | 实测 |
|---|---|
| 完整 `resolveBrowserPath` + 一次真实 `chrome --version`（CI runner） | 23ms / 24ms（两轮） |
| `doctor` 那条测试，改动前（main run 30123567512） | 6956.91ms |
| `doctor` 那条测试，改动后（PR run 30124835084） | 6964.15ms |
| `doctor` 那条测试，**同一份代码**次轮（PR run 30125193829） | **2293.01ms** |

两点结论：

- 被移除的探针约值 **20ms**，"砍半"是错的，已在 PR #4 的提交信息与本仓记忆中更正。
- **同一份代码两轮相差 3 倍（6964ms vs 2293ms）**。这意味着此前所有基于"改动前 X ms、改动后 Y ms"的单点对比一律无效，包括我自己第一轮差点得出的结论。

`doctor` 那条测试的完整历史：

| 运行 | 耗时 |
|---|---|
| 绿 07-19 | 2486ms |
| 红 07-24 | 5010ms → 超时 |
| PR #3 | 2875ms |
| main（#3 合并后） | 6956ms |
| PR #4 首轮 | 6964ms |
| PR #4 次轮（与首轮代码逐字节相同） | 2293ms |

分布 2.3–7s，而 bun 的默认门限 5000ms 正压在其中间。**07-24 的红不是环境劣化，是这条测试一直在抛硬币。**

## 3. 审计发现

### F1 `resolveFfmpegPath` 已探测，`doctor` 再探一次（已确认，与 PR #4 同类，规模更大）

代码链（`packages/multi-segment/src/ffmpeg.ts`）：

```
resolveFfmpegPath()
  └─ resolvePackageBinary('ffmpeg-static')      :60
       └─ existsSync(p) && canRunBinary(p)      :69   ← spawn #1（77MB 二进制）
            └─ spawnSync(bin, ['-version'], { timeout: 5000 })  :83
```

而 `src/tools/doctor.ts`：

```
const ffmpeg = resolveFfmpegPath()                                    :48  ← 已含 spawn #1
spawnSync(ffmpeg, ['-version'], { timeout: 10_000 })                  :51  ← spawn #2，同一份输出
```

`resolvePackageBinary` 把 `canRunBinary` 的布尔结果用完即弃，只返回路径——与 `resolveBrowserPath` 丢弃 `BrowserProbeResult` 的形状完全一致。PR #4 已为浏览器侧确立了正确做法（探针随路径一起返回），此处尚未套用。

严重度：**中**。不是正确性缺陷，但它是 F5 的主要干扰项，且在渲染循环中被放大——见 F1b。

### F1b `runFfmpeg` 每次调用都重新解析，解析结果从未缓存（已确认）

```ts
export async function runFfmpeg(args: string[], opts?: ProcessRunOptions) {
  const bin = resolveFfmpegPath()   // ffmpeg.ts:91，每次调用 → 每次一个 -version spawn
  return runProcess(bin, args, opts)
}
```

`resolveFfmpegPath()` 相对进程环境是纯函数，却没有任何记忆化。一次 `renderMultiSegment` 会经过 concat、mux、时长探测等多条 ffmpeg 命令，每条之前都多付一次探测。`resolveFfprobePath()` 同形，且它在 `:50` 还会**再调用一次** `resolveFfmpegPath()`，构成二次放大。

严重度：**中**。温成本，但次数与段数线性相关。

### F2 探测的 5000ms 上限压在冷加载分布上，失败即静默降级（已确认）

- `ffmpeg.ts:83` `canRunBinary`：`timeout: 5000`
- `ffmpeg.test.ts:14`：模块顶层 `spawnSync(resolveFfmpegPath(), ['-version'], { timeout: 5000 })`

若 77MB 二进制的冷加载超过 5s：

- `canRunBinary` 返回 false → `resolvePackageBinary` 返回 null → `resolveFfmpegPath` 悄悄改用系统 ffmpeg 或裸字符串 `'ffmpeg'`。**没有任何日志、没有错误、版本从固定变为不固定。**
- `ffmpeg.test.ts` 的 `ffmpegAvailable` 变 false → audio-mux 契约测试静默 `skip` → **CI 依然全绿，但覆盖已经丢失。**

而 `doctor` 那条测试的实测分布是 2.3–7s，`doctor` 中同一二进制的探测上限是 10s。5000ms 这个数字与把 CI 顶红的那个是同一个，且同样没有依据。

严重度：**高**（静默降级 + 静默丢覆盖，两者都不可观测）。

### F3 嵌套超时倒挂：外层预算 < 内层预算（已确认 2 处）

与 07-24 CI 红的不变式违反完全同形（当时是 bun 默认 5000ms < doctor 自身 30s 预算）：

| 外层 | 内层 | 关系 |
|---|---|---|
| `renderFrames.ts:91` 墙钟 `270_000` | `render.ts:125` 单段 `600_000` | 外层是内层的 0.45×，**单段预算永不可达** |
| `previewFrame.ts:97` 墙钟 `120_000` | `previewFrame.ts:114` 远端 `300_000` | 外层是内层的 0.4×，同上 |

两处的 `signal` 都由外层 `renderCancellation` 提供并向内传递，因此实际生效值恒为外层。后果不是挂死，而是：**内层那个参数是死配置**，且用户看到的错误永远是 `render wall timeout`，而非"第 N 段超时"，定位信息丢失。

严重度：**中**（诊断误导 + 死旋钮，非正确性）。

### F4 探针失败转为静默 `skip`，CI 保持绿（已确认）

- `ffmpeg.test.ts:14-15`：`const mediaTest = ffmpegAvailable ? test : test.skip`
- `seek-shim/src/index.test.ts:109`：`test.skipIf(!chromiumPath)(...)`

两者都把"外部依赖探测失败"翻译成"跳过"，并且跳过计数不会让 job 变红。PR #4 新增的三条 POSIX-only 测试同样使用这个模式（这是刻意对齐仓内既有约定），因此该模式的覆盖损失面还在扩大。

严重度：**中**。当前 CI runner 上 ffmpeg 与 Chromium 均可用（实测 `(pass) audio mux [209ms]`、`(pass) real Chromium [886ms]`），所以尚未真实丢覆盖；风险在于它丢的时候**没有任何信号**。

### F5 `doctor` 那约 6.6s 到底在哪（**待实测，本方案第一优先级**）

已知：同文件另两条只做 MCP connect 的测试为 348ms / 310ms，故 connect 约 300ms，其余约 6.6s 在 `doctor` 处理器内部。远端模式下 `@hyperframes/producer` 不被导入、`probeProducer` 因无 URL 返回 null，故无网络 I/O。

浏览器侧已实测出局（约 20ms）。剩余候选：

1. **ffmpeg 探测（当前最有依据）**：`resolveFfmpegPath` 把 ffmpeg-static 的 77MB 二进制排在系统 ffmpeg 之前，doctor 路径上冷加载它。旁证有二：跨运行 2.3–7s 的波动符合冷盘读特征；排在其后执行的 audio-mux 测试仅需 209ms，符合 page cache 已热。
2. `verifyProducerRuntimeAssets()` 读取并 sha256 `dist/hyperframe.runtime.iife.js`（本地实测 251KB，量级不符，优先级低）。
3. bun 加载 `server.js` 包中 doctor 分支的惰性代价。

**明确标注：以上均未实测，不得作为结论引用。** 本方案不接受"看起来最像"就动手。

## 4. 全仓同类问题

| 位置 | 形状 | 状态 |
|---|---|---|
| `crabcode-html-video` | 见 F1–F5 | 已确认 |
| `crabcode-media-ops` `src/tools/doctor.ts:58` + `src/qa/delivery-qa.ts:475,490` | `Bun.which('java')` 判存在，随后 `runCommand([javaBin, '-version'])` 再探一次；与 F1 同形 | **疑似，需独立一次审计** |
| `crabwork-bio-research/skills/nextflow-development/scripts/check_environment.py` | `shutil.which` + `subprocess([..., '-version'])`；独立环境检查脚本，不在热路径 | 已确认存在但低优先级 |

`crabcode-media-ops` 那一条不并入本次范围：它是另一个插件、另一套 CI job，混进来会让本方案的验收标准失去边界。

## 5. 测量方法学（本方案的硬约束）

本节的存在本身就是 PR #4 的产物。以下四条为**强制**，违反则结论无效：

1. **同代码两轮基线**。任何"改动前后"的对比，必须先用**逐字节相同的代码**跑两轮，取得噪声幅度。本例噪声为 3 倍；小于噪声的差异一律不得声称。
2. **用一条只做那件事的测试当探针**。PR #4 中那条 23ms 的不变式测试同时完成了回归防护与成本测量，是目前性价比最高的手段。优先用它，而不是往生产代码里塞计时。
3. **未实测的性能收益不得写入提交信息、PR 正文或记忆**；确需记录时必须显式标注"未实测"。
4. **冷/温必须分别标注**。去重只回收温成本；冷成本由第一次 spawn 承担。任何"消除冗余调用可省 X 秒"的表述，先回答"这次 spawn 是冷的还是温的"。

## 6. 实施方案（分批，严格按序）

### 批次 A：测定 F5（不改任何生产逻辑）

1. 新增一条**只测量 ffmpeg 解析成本**的测试（对齐 PR #4 `browser.test.ts` 的做法）：分别测 `resolveFfmpegPath()` 首次调用与二次调用，二者之差即冷/温差值。
2. 同一提交跑两轮 CI，取得噪声基线。
3. 若冷成本占 `doctor` 6.6s 的主要部分 → F5 结案，进入批次 C；若不占 → 按候选 2、3 顺次排查，**不进入批次 C**。

批次 A 的产出是数据，不是修复。它必须先于 B、C 落地。

### 批次 B：与 F5 结论无关、可独立落地的修复

- **F3**：把两处倒挂的内层预算改为由外层派生（或直接删除内层死旋钮），使"外层 ≥ 内层"成立；并为该不变式补一条测试，防止再次倒挂。这是与 07-24 CI 红同类的问题，独立于 F5 的结论都应该修。
- **F4**：让探测失败产生**可见信号**（例如在 CI 环境变量下把 skip 升级为 fail，或至少输出一行说明"因 X 不可用而跳过 N 条"）。目标是"丢覆盖时有声音"，不是取消 skip 机制。
- **F2 的一半**：把 `canRunBinary` 的 5000ms 提高到与被探测对象的实际分布相称，并**注释写明依据**（对齐 PR #3 确立的"按工具自身预算上限设，不按实测典型值设"）。

### 批次 C：仅在批次 A 确认冷加载主导时执行

- **F1 / F1b**：给 `resolveFfmpegPath` / `resolveFfprobePath` 加进程级记忆化，并让探针结果随路径返回（复用 PR #4 在 `BrowserResolveResult` 上确立的形状）。预期收益是温成本 × 调用次数，**不预期消除冷成本**。
- **偏好顺序是决策而非修复**：`resolveFfmpegPath` 目前把 ffmpeg-static 排在系统 ffmpeg 之前，这是版本固定与编解码器保证的**刻意选择**。若批次 A 证明冷加载确实主导，改序需要单独决策，并评估"版本不再固定"的代价，不得作为性能优化顺手做掉。

## 7. 明确不做

- 不在本方案内处理 `crabcode-media-ops` 的 java 探针（另立）。
- 不回调 PR #3 确立的两个 `60_000` 测试上限。即使批次 C 让 doctor 变快，门限依然按工具最坏预算设——"因为现在变快了就收紧"正是本仓刚吃过亏的思路。
- 不为性能往生产代码里加常驻计时或埋点。
- 不在批次 A 出数据之前改任何 ffmpeg 解析逻辑。

## 8. 验收标准

1. F5 有实测数字，且该数字来自同代码两轮基线之上的对比。
2. F3 的两处倒挂消除，并有一条测试守住"外层 ≥ 内层"。
3. F4 的覆盖损失可观测：人为使 ffmpeg 不可用时，CI 有明确信号而非静默变绿。
4. F2 的每个超时常数在代码中都能回答"这个数字的依据是什么"。
5. 本方案中任何一条被实测推翻时，**更正写回本文件与对应记忆**，与 PR #4 的处理方式一致。

## 9. 相关记录

- PR #3 `815ae9d` / merge `1537c59`：外部二进制测试超时对齐工具自身预算（CI 常红的直接修复）
- PR #4 `c800c86` / merge `62e1783`：doctor 复用 resolve 已付过的浏览器探针（本方案的触发来源）
- 记忆 `html-video-ci-env-red`：根因、六次实测数据、以及被推翻的"砍半"预估
