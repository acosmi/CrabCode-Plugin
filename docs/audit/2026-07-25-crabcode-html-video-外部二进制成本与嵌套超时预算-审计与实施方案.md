# CrabCode HTML Video 外部二进制成本与嵌套超时预算审计与实施方案

> 日期：2026-07-25
>
> 状态：**已实施**（分支 `task/html-video-external-binary-cost-20260725`）。实施中有 4 项与本文正文不符，全部记在 §10，正文中会误导的两处已就地订正并标注。
>
> 审计范围：`crabcode-html-video` 的外部二进制解析与探测路径、嵌套超时预算的对齐关系、探针失败的降级语义，以及全仓同类问题
>
> CrabCode-Plugin 基线：`b659558`（发现均在 `62e1783` 上读码坐实）
>
> 触发来源：PR #4（merge `62e1783`）的实测推翻了本仓记忆中"消除冗余浏览器探针可将 doctor 延迟砍半"的预估

## 1. 执行摘要

本次立项不是为了修一个已知缺陷，而是因为**一条写进记忆并据此立项的性能结论，在 CI 上一测即塌**。复盘这条错误暴露出的不是偶发失误，而是一个在本插件内反复出现的缺陷类，且其中一个实例正是 2026-07-24 `html-video-plugin` job 常红的直接原因。

已确认的核心事实：

1. `resolveFfmpegPath()` 内部**已经**通过 `canRunBinary()` 启动过一次 ffmpeg-static 的 77MB 静态二进制，`doctor` 拿到路径后**又启动一次**取同一份 `-version` 输出。这与 PR #4 刚修复的浏览器双探针是**同一个缺陷类**，但二进制体积大约 30 倍、调用点多得多。
2. `runFfmpeg()` 每次调用都重新执行 `resolveFfmpegPath()`，因此一次多段渲染中的每条 ffmpeg 命令都先额外付一次 `-version` 探测。解析结果从未被缓存。
3. 探测统一压在 **5000ms** 上限上——与 07-24 把 CI 顶红的那个数字相同——且探测失败不是报错，而是**静默降级**（换用系统 ffmpeg，或让测试静默 `skip`）。
4. 至少两处**嵌套超时倒挂**：外层墙钟预算小于它所包裹的内层预算，使内层参数永远不可达。这与把 CI 顶红的缺陷（外层 5000ms < 内层 30s）是同一个不变式被违反。
5. `doctor` 约 6.6s 的耗时归属**仍未定论**。批次 A 用一次"同会话内连续调用两次 doctor"的测量直接判定它是一次性成本还是每次成本，**批次 B 的修复不依赖该结论**。

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

注意墙钟值可经 `CRABCODE_HTML_VIDEO_WALL_TIMEOUT_MS` / `..._PREVIEW_TIMEOUT_MS` 配置（`cancellation.ts:5` `boundedWallTimeoutMs`，上限 30 分钟），因此倒挂是**默认值下成立**，而非所有配置下成立。§6 的修法让它在任何配置下都成立。

严重度：**中**（诊断误导 + 死旋钮，非正确性）。

### F3b 同类倒挂另有 2 处，本审计漏了（实施期间的交付复核发现）

`packages/multi-segment/src/render.ts` 调用两个 ffmpeg 助手时只传了 `signal`，没传 `timeoutMs`：

| 外层 | 内层 | 关系 |
|---|---|---|
| `renderFrames.ts` 墙钟 `270_000` | `concatVideos` 落到 `opts?.timeoutMs ?? 300_000`（copy）/ `?? 600_000`（re-encode） | 内层 1.1×–2.2× 外层 |
| 同上 | `muxAudio` 落到 `opts?.timeoutMs ?? 300_000` | 内层 1.1× 外层 |

与 F3 是同一个病灶——**内层用硬编码兜底，而不是继承调用方预算**——所以按"一次修掉一整类"处理，见 §10。

已扫描确认**不属于**本类的两处：`hfRender.ts:216` 的 `120_000` 小于墙钟且该处无旋钮；`producerClient.ts:65` 的 `?? 600_000` 两个活调用方现在都显式传预算。

### F4 探针失败转为静默 `skip`，CI 保持绿（已确认）

- `ffmpeg.test.ts:14-15`：`const mediaTest = ffmpegAvailable ? test : test.skip`
- `seek-shim/src/index.test.ts:109`：`test.skipIf(!chromiumPath)(...)`

两者都把"外部依赖探测失败"翻译成"跳过"，并且跳过计数不会让 job 变红。

严重度：**中**。当前 CI runner 上 ffmpeg 与 Chromium 均可用（实测 `(pass) audio mux [209ms]`、`(pass) real Chromium [886ms]`），所以尚未真实丢覆盖；风险在于它丢的时候**没有任何信号**。

需与**平台门**区分：`packages/multi-segment/src/browser.test.ts` 的 `test.skipIf(process.platform === 'win32')` 跳过的是"这台机器不是 POSIX"，不是"依赖缺失"，**不在 F4 的整改范围内，保持 skip**。

### F5 `doctor` 那约 6.6s 到底在哪（**待实测，由批次 A 判定**）

已知：同文件另两条只做 MCP connect 的测试为 348ms / 310ms，故 connect 约 300ms，其余约 6.6s 在 `doctor` 处理器内部。远端模式下 `@hyperframes/producer` 不被导入、`probeProducer` 因无 URL 返回 null，故无网络 I/O。浏览器侧已实测出局（约 20ms）。

剩余候选：① ffmpeg 探测（当前最有依据：77MB 二进制冷加载，且跨运行 2.3–7s 的波动符合冷盘读特征，排在其后的 audio-mux 测试仅 209ms 符合 page cache 已热）；② `verifyProducerRuntimeAssets()` 读取并 sha256 `dist/hyperframe.runtime.iife.js`（实测 251KB，量级不符）；③ bun 加载 server 包中 doctor 分支的惰性代价。

**以上均未实测，不得作为结论引用。**

## 4. 全仓同类问题

| 位置 | 形状 | 处置 |
|---|---|---|
| `crabcode-html-video` | 见 F1–F5 | 本方案范围 |
| `crabcode-media-ops` `src/tools/doctor.ts:58` + `src/qa/delivery-qa.ts:475,490` | `Bun.which('java')` 判存在，随后 `runCommand([javaBin, '-version'])` 再探一次；与 F1 同形 | 疑似，**明确不并入本次**，另立 |
| `crabwork-bio-research/skills/nextflow-development/scripts/check_environment.py` | `shutil.which` + `subprocess([..., '-version'])`；独立环境检查脚本，不在热路径 | 已确认存在，**不处理** |

## 5. 测量方法学（硬约束）

本节的存在本身就是 PR #4 的产物。以下四条为**强制**，违反则结论无效：

1. **同代码两轮基线**。任何"改动前后"的对比，必须先用**逐字节相同的代码**跑两轮，取得噪声幅度。本例噪声为 3 倍；小于噪声的差异一律不得声称。
2. **用一条只做那件事的测试当探针**。PR #4 中那条 23ms 的不变式测试同时完成了回归防护与成本测量，是目前性价比最高的手段。优先用它，而不是往生产代码里塞计时。
3. **未实测的性能收益不得写入提交信息、PR 正文或记忆**；确需记录时必须显式标注"未实测"。
4. **冷/温必须分别标注**。去重只回收温成本；冷成本由第一次 spawn 承担。任何"消除冗余调用可省 X 秒"的表述，先回答"这次 spawn 是冷的还是温的"。

## 6. 实施方案

**顺序强制：A 必须在 B 之前完成并取得数据。** 原因：B 的记忆化会让 A 的测量对象（重复解析的成本）消失，届时再测已无意义。

### 批次 A：测定 F5（不改任何生产逻辑）

在 `plugins/crabcode-html-video/tests/mcp-stdio.test.ts` 中新增一条测试，**同一 MCP 会话内连续调用两次 `doctor`** 并输出两次耗时：

```ts
test('measure: doctor first vs second call in one session', async () => {
  const connected = await connect({ CRABCODE_HTML_VIDEO_RENDER_MODE: 'remote' })
  const t0 = performance.now()
  await connected.callTool({ name: 'doctor', arguments: {} })
  const first = performance.now() - t0
  const t1 = performance.now()
  await connected.callTool({ name: 'doctor', arguments: {} })
  const second = performance.now() - t1
  console.log(`[measure] doctor first=${first.toFixed(0)}ms second=${second.toFixed(0)}ms`)
}, 120_000)
```

这个设计不依赖测试文件执行顺序，也不需要制造冷 page cache：两次调用在同一进程内，第二次对 page cache 而言必然是温的，**差值即一次性成本**。

> **订正（实施后）**：上面这段推理是错的。page cache 是**机器级**而非进程级的，而本测试排在同文件那条调 doctor 的测试之后——冷加载的账早被它付掉，所以 `first` 同样是温的，差值测不到一次性成本。实测差值仅 4ms / 7ms。F5 最终由横向比较判定，见 §10。

判据（写死，实施时直接套用）：

- `first − second ≥ 1500ms` → **一次性成本主导**，F5 结案为"冷加载类"，在批次 B 的注释中记录该数字。
- `first − second < 1500ms` 且 `second ≥ 1500ms` → **每次成本**，F5 结案为"per-call 工作"，另开工单排查候选 ②③，**不阻塞批次 B**。
- 其余情况 → 记录数字，F5 标记为"低于噪声，暂不追查"，**不阻塞批次 B**。

按 §5 第 1 条，本测试须在**同一份代码**上跑两轮 CI 取噪声基线，两轮数字都写进批次 B 的提交信息。

批次 A 的产出是数据，不是修复；完成后**保留**这条测试（它同时是 doctor 的回归探针）。

### 批次 B：全部修复（不依赖 A 的结论，A 完成后即可实施）

按下列顺序执行，每步的取值均已写死：

**B1 统一外部二进制探测上限为 `20_000`**

- ~~在 `packages/multi-segment/src/browser.ts` 顶部新增并导出~~ **订正**：常量放独立模块 `packages/multi-segment/src/probeTimeout.ts`，且**不经 index.ts 导出**。理由见 §10。
- 替换以下~~四~~**三**处的字面量：`ffmpeg.ts:83`（5000）、`browser.ts:44`（10_000）、`packages/multi-segment/src/ffmpeg.test.ts:14`（5000）。**`src/tools/doctor.ts:51` 的 10_000 不是被替换而是被 B3 整条删除**——原文把它列进 B1 与 B3 冲突。
- 注释写明依据：探测对象含 ffmpeg-static 的 77MB 静态二进制；5000 与 10_000 都是无依据的数字；探测失败的代价是静默降级（F2），因此按"最坏预算"设，与 PR #3 确立的纪律一致。代价是探针挂死时最坏等待由 5s/10s 变为 20s，此代价被接受。

**B2 同步放大 doctor 测试的允许上限（B1 的连锁项，不可遗漏）**

B1 之后 doctor 的最坏预算变为 ffmpeg 20s + chrome 20s = 40s，已顶穿 `tests/mcp-stdio.test.ts:123` 现有的 `60_000`——**这正是本方案要修的倒挂**。因此：

- `tests/mcp-stdio.test.ts` 中 doctor 那条测试的允许上限 `60_000` → `120_000`。
- `packages/seek-shim/src/index.test.ts:139` 的 `60_000` **不动**：它是 puppeteer 启动 Chromium，不经过这些探针。

方向是**放大**，与 §7 "不因变快就收紧"的纪律一致，不构成回调。

**B3 F1 / F1b：探针随路径返回 + 记忆化**

在 `packages/multi-segment/src/ffmpeg.ts`：

- 新增 `export interface FfmpegResolveResult { path: string; probe: { ok: boolean; versionLine: string | null } | null }` 与 `export function resolveFfmpegPathDetailed(): FfmpegResolveResult`，形状对齐 PR #4 的 `BrowserResolveResult.probe`。
- `resolveFfmpegPath(): string` 保留，实现改为 `resolveFfmpegPathDetailed().path`，其余调用方不动。
- 模块级记忆化：缓存 `{ envKey, result }`，`envKey` 为 `HYPERFRAMES_FFMPEG_PATH`、`CRABCODE_FFMPEG_PATH`、`FFMPEG_PATH` 三者的拼接。**关键细节**：`doctor.ts:66` 在探测成功后会写回 `process.env.HYPERFRAMES_FFMPEG_PATH = ffmpeg`，这会改变 `envKey`；因此缓存命中规则须为"**若新的 env 指向的路径与缓存路径相同且缓存 `probe.ok`，直接返回缓存**"，否则会白白多出一次 spawn。
- `resolveFfprobePath()` 同样记忆化，其内部对 `resolveFfmpegPath()` 的调用因此变为缓存命中。
- `src/tools/doctor.ts:48-51`：改用 `resolveFfmpegPathDetailed()`，删除第 51 行的二次 `spawnSync`，`checks.ffmpeg` 的字段与取值保持不变（`path` / `ok` / `versionLine` / `env` 四项，取自返回的 probe）。

**B4 F3：消除嵌套超时倒挂**

- `src/tools/renderFrames.ts`：把 `boundedWallTimeoutMs('CRABCODE_HTML_VIDEO_WALL_TIMEOUT_MS', 270_000)` 的返回值提为局部常量 `wallMs`，同时用于 `renderCancellation(context.signal, wallMs)` 与传入 `renderMultiSegment({ ..., segmentTimeoutMs: wallMs })`。
- `src/tools/previewFrame.ts`：把 `boundedWallTimeoutMs('CRABCODE_HTML_VIDEO_PREVIEW_TIMEOUT_MS', 120_000)` 提为 `previewMs`，同时用于 `renderCancellation` 与 `renderViaProducerHttp({ ..., timeoutMs: previewMs })`（替换第 114 行的 `300_000`）。
- `render.ts:43` 的 `segmentTimeoutMs?: number` 与 `:125` 的 `?? 600_000` **保留不动**（供无外层约束的直接调用方使用）。
- **不新增测试**：修复后两个值来自同一局部变量，不变式由构造保证，再加测试等于测试语言本身。此项为已决定，不要在实施时改主意。

**B5 F4：让覆盖损失可见**

在 `packages/multi-segment/src/ffmpeg.test.ts` 与 `packages/seek-shim/src/index.test.ts` 各自内联（两个包相互独立，此处重复是正确的，不要抽公共模块）：

```ts
if (process.env.CI && !ffmpegAvailable) {
  throw new Error('CI 要求 ffmpeg 可用，探测失败意味着覆盖损失而非环境差异')
}
```

（seek-shim 处把条件换成 `!chromiumPath`、文案换成 Chromium。）模块顶层抛出会让该文件失败、job 变红，即所需信号。本地开发（无 `CI`）行为不变，仍 skip。

`browser.test.ts` 的 POSIX 平台门**不改**（见 F4 末段）。

### 交付方式

按本仓惯例：分支 `task/html-video-external-binary-cost-20260725` → PR → 合并。批次 A 与批次 B 可以是同一 PR 的两个提交，但 **A 的提交必须先落地并跑过两轮 CI**，其数字写进 B 的提交信息。

## 7. 明确不做

- **不改 `resolveFfmpegPath` 的偏好顺序。** 它把 ffmpeg-static 排在系统 ffmpeg 之前，是版本固定与编解码器保证的刻意选择；即使批次 A 证明冷加载主导，改序会让产出不再可复现，代价大于收益。**此项为已决定，不是待决**；将来若要改，另立独立方案并单独评估。
- 不在本方案内处理 `crabcode-media-ops` 的 java 探针（另立），也不处理 bio-research 的环境检查脚本。
- 不回调 PR #3 确立的两个 `60_000`。B2 是**放大**（60_000 → 120_000）且仅针对 doctor 那条，seek-shim 那条不动；"因为现在变快了就收紧"是本仓刚吃过亏的思路。
- 不为性能往生产代码里加常驻计时或埋点（批次 A 的计时在测试内，不进生产路径）。

## 8. 验收标准

1. 批次 A 的两轮 CI 数字已记录在批次 B 的提交信息中，且 F5 已按 §6 的三条判据之一结案。
2. 四处探测上限已统一为 `EXTERNAL_BINARY_PROBE_TIMEOUT_MS`，且 `tests/mcp-stdio.test.ts` 的 doctor 允许上限已同步为 `120_000`（B1 与 B2 必须同批落地，缺一即重现倒挂）。
3. `doctor` 处理器内不再出现第二次 ffmpeg `spawnSync`；`checks.ffmpeg` 的输出字段与取值与改动前一致。
4. `renderFrames` / `previewFrame` 各自只有一处墙钟预算字面量，内层不再出现独立的 `300_000`。
5. 人为使 ffmpeg 不可用并置 `CI=1` 时，`bun test ./packages` 变红且报出上述文案；不置 `CI` 时仍为 skip。
6. `bun run typecheck`、`bun test ./tests ./packages`、`bun run check:distribution` 全绿，dist 已重封提交且洁净度检查通过。
7. 本方案中任何一条被实测推翻时，**更正写回本文件与对应记忆**，与 PR #4 的处理方式一致。

## 9. 相关记录

- PR #3 `815ae9d` / merge `1537c59`：外部二进制测试超时对齐工具自身预算（CI 常红的直接修复）
- PR #4 `c800c86` / merge `62e1783`：doctor 复用 resolve 已付过的浏览器探针（本方案的触发来源）
- 记忆 `html-video-ci-env-red`：根因、六次实测数据、以及被推翻的"砍半"预估
- 记忆 `shared-worktree-concurrent-sessions`：本工作树存在并发会话，提交前须确认 HEAD

## 10. 实施记录与订正

### F5 结案：一次性成本主导（~99%）

批次 A 在 PR #5 上跑了两轮（同一 commit `2e9fef0`，第二轮为 rerun）：

| | 轮 1 | 轮 2 |
|---|---|---|
| `[measure] doctor` | first=34ms second=30ms | first=35ms second=28ms |
| 同文件那条调 doctor 的测试 | 3567ms | 2930ms |
| 测量测试整条 | 371.98ms | 379.00ms |

§6 写死的判据字面套用会得出"低于噪声"，**但那是测量设计的缺陷而非事实**（见 §6 批次 A 的订正）。真正的判据来自横向比较，两轮一致：

- 371.98 − (34 + 30) ≈ **308ms**，与同文件两条纯 connect 测试（348ms / 310ms）吻合，确认 connect 约 300ms
- 3567 − 308 ≈ **3.26s** 是冷的 doctor；同一台机器上温的 doctor 只要 **30ms**

即 doctor 观测延迟的约 99% 是一次性冷加载，per-call 工作约 30ms。这同时解释了历史上同代码 6956ms vs 2293ms 的 3 倍差——是冷盘读方差，不是环境劣化，也不是每次成本。

**推论**：B3 的去重省下的是那 30ms 里的温 spawn，**碰不到那 3.2s**。这正是 §1 预先写下的"去重不等于省下冷加载"，此处得到实测确认。B3 的价值在渲染循环（`runFfmpeg` 每条命令一次解析）与消除 TOCTOU，不在 doctor 延迟。

### 与正文不符的 4 项

1. **B1 与 B3 冲突**：B1 要替换 `doctor.ts:51` 的 `10_000`，B3 要删掉整行。终态取 B3：探测上限统一为**三处**，doctor 那处消失。§8 验收标准 2 相应按三处计。
2. **常量归属**：放 `browser.ts` 会使 `ffmpeg.ts` import 浏览器模块，造成两个无关关注点耦合。改为独立模块 `probeTimeout.ts`；并且**不从 index.ts 导出**——B3 删掉 doctor 的探针后包外已无消费者，导出即投机性 API 面。
3. **B2 附带**：`tests/mcp-stdio.test.ts` 那段注释仍写"chrome 探针两次、各 10s"，PR #4 早已推翻，一并重写，否则留下误导性遗留。
4. **F3b（新增，超出原范围）**：交付复核发现 `render.ts:148/152` 的同类倒挂。修法与 F3 同源：把 `input.segmentTimeoutMs ?? 600_000` 提为 `stepTimeoutMs`，同时用于单段渲染、concat、mux，使"内层 ≤ 外层"在任何配置下成立。`render.ts:43` 的文档注释（"Per-segment render timeout"）已同步订正。

### 验证方式

- Linux 平价（Docker `oven/bun:1.3.11`）全量：43 pass / 1 skip / 0 fail
- B5 负向**实证**（非推断）：`CI=1` + 移除 ffmpeg → exit 1 并报出预期文案；同状态不设 `CI` → skip 且 exit 0。Chromium 侧同理。
- `bun run typecheck`、`bun run check:distribution` 绿，dist 已重封且洁净。
