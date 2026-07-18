# CrabCode Media Ops MCP 修复实施——前置审计与决策记录

> 日期:2026-07-18
>
> 状态:实施前审计,作为《2026-07-18-crabcode-media-ops-MCP不可用根因审计与实施方案.md》(下称"方案")的实施依据
>
> 基线:`codex/mediaops-mcp-audit-20260718` @ `20fb9a5`(= main `b6d6d26` + 方案文档)
>
> 方法:主控线程 + 三个只读审计子代理(A:插件内部事实;B:全仓 MCP census;C:仓库基建),关键数字由主控二次复核

## 1. 方案事实核实结论

方案第 2–6 章全部关键声明经逐条核实**属实**,包括:

| 声明 | 核实 |
| --- | --- |
| server 注册 38 个带点工具,server name `mediaops` | 属实(`src/server.ts:68-113` 精确 38;validator knownTools 亦 38) |
| manifest 无 `requiredMcpServers`,全仓 43 插件零先例 | 属实(75 个 manifest 均无该字段;`channels`/`mcpServerActivation`/`.lsp.json` 亦零先例) |
| `start` 含 `bun install`,双装缓存无 node_modules | 属实(`package.json:8`) |
| identity 19 条角色策略,匿名变更→`AUTHENTICATION_REQUIRED` | 属实(`src/identity.ts:36-56,150-155`) |
| 五项主体分离 | 属实且另有三项(editorial 复核者、profile 确认者、editorial 嵌套问责) |
| `originality.scan` 仅收 contentId/quotations,要求 v2+drafted+扫描者≠作者+登记引用 | 属实(`src/tools/originality.ts:227-277`) |
| agent 白名单与正文 MCP 声称矛盾(4 个) | 属实,且新发现第 5 个:`agents/style-collector.md`;7 个 command 也直接编排 `mediaops.*` |
| Skill 无 preflight/MCP 不可用契约 | 属实("停止码"仅 2 处提及,"MCP 不可用"零提及) |
| `check-installed.ts` 绕过 `.mcp.json` 与 start | 属实 |
| 全仓分类:12 LSP 纯字节流代理 / 4 频道缺 channels 声明 / 11 wrapper / 13 crabwork / 1 示例 | 属实(23 处空 URL 分布于 12 个 crabwork) |
| html-video dist 预构建、已跟踪、manifest 缺 required | 属实(HEAD 中 4 个 dist 文件完好;方案 §12 所述 dist 删除仅存在于原审计者工作树,当前干净) |
| 存储为 SQLite,`SCHEMA_VERSION=2` 为内容 manifest 版本 | 属实(无独立 DB schema 版本;建表 IF NOT EXISTS) |

**两处出入(不影响方案结论):**

1. `crabwork-small-business` 不是"远程占位"同构体:唯一的 npx -y + `@latest` + user_config 混合,且无空 URL——validate-mcp-contract 需单列;
2. 方案 §8.5 所设想的 `.mcp.json` 一致性校验目前完全不存在:`validate-media-plugin.ts` 不读 `.mcp.json`,根 marketplace validator 不校验版本。

## 2. 前置审计新发现(方案未覆盖、影响实施)

### 2.1 宿主仓基线不可用(裁决批次2)

`D:\CrabClawApp`(CrabCode 宿主源码)最后提交 **2026-05-01**,方案所引 2026-07-10 生命周期提交(`45f7ae89e`/`4f0f5f03c`)与 `pluginMcpLifecycle.ts` 在其任何分支均不存在;`requiredMcpServers` 仅出现于 AgentTool(子代理 frontmatter),插件 manifest schema 无此字段;该仓 main 另有 7 个与本任务无关的未推送提交。

**裁决:批次2(P0-C 逻辑别名、P0-D 首轮有界初始化)不在本机过期基线上盲改,以精确交接规格文档交付(见批次2 文档),在与 1.0.16 对应的宿主仓上实施。**

### 2.2 validator 与 P1-A 冲突(防回归点)

`validate-media-plugin.ts:96` 强制 `start` 含 `--frozen-lockfile`;P1-A 要求 start 去 install。二者必须**同一提交**内互换,否则 CI 必红。

### 2.3 发行物必须入库

marketplace 安装 = 打包仓库目录(镜像 CI 产出 `{sha}.zip`),不含 node_modules。离线冷启动唯一路径 = 自包含 dist 提交入库(html-video 已验证此模式并有 CI 新鲜度校验)。子代理C"不提交 dist"的建议**被主控否决**。`.gitignore` 的 `dist/` 规则通过 `git add -f` 绕过(与 html-video 一致)。

### 2.4 静态 QA 导入使离线 dist 启动即崩

`src/tools/delivery.ts:15 → qa/delivery-qa.ts:1-2` 静态导入 `@playwright/test`/`@axe-core/playwright`,构建时 `--external` 保留为顶层 import——无 node_modules 时 **MCP initialize 都无法发生**。QA 惰性动态导入是 P1-A 的组成部分(方案 §7.6 第 5 点),随批次3a 一并落地。

### 2.5 测试基线并不干净(回归归因基准)

Windows 本机基线:typecheck 通过;`bun run test` 103 通过 / **4 失败**(均为 Windows 文件锁 EBUSY 环境问题,CI Linux 容器为绿):

1. `tests/package.test.ts` — approved content packages with trace manifest and copied asset
2. `tests/package.test.ts` — a committed package is idempotent and terminal to later revocation
3. `tests/package.test.ts` — storage failure leaves a marked package and retry completes one atomic commit
4. `tests/storage.test.ts` — explicitly acknowledged unhashed legacy records are re-chained during import

**回归标准:实施后本机失败集合不得超出以上 4 项;CI 全绿。**

### 2.6 单人模式的可达性推导

`delivery.render` 要求 `reviewed` 阶段(`delivery.ts:217`);`research.complete` 要求完成人≠intake 作者(`research.ts:222`)。由此单人 local-editorial 的诚实可达边界见 §3 决策 4。

## 3. 方案 §11 决策清单裁决

| # | 决策项 | 裁决 |
| --- | --- | --- |
| 1 | `mediaops` 是否 first-party essential local MCP | **是**(采纳方案建议),manifest 声明 `requiredMcpServers:["mediaops"]` |
| 2 | 是否接受 `local-editorial` 低保证模式 | **是**,第二人门禁保持 pending,输出显式低保证标注 |
| 3 | team 模式可信 subject 来源 | MCP OAuth `authInfo`(现有 `principalFromMcp` 路径)= `team-governed`;宿主签名断言作为未来扩展写入批次2 交接规格 |
| 4 | service actor 边界 | **仅限确定性机器操作**:`originality.scan`(扫描计算)、`delivery.render`(确定性渲染)、`content.save` 之**机械文件导入**(限 stage=intake 且显式 `serviceImport` 请求)。研究完成、原创复核、编辑复核、交付目验、审批、profile 确认必须真人。单人可达:intake(service 导入)→ research(真人)→ drafted(真人)→ scan(service);editorial 及之后一律 pending 第二真人 |
| 5 | required local 首轮超时预算 | 建议 10s 有界等待(dist 冷启动实测亚秒级,详见冷启动 smoke),写入批次2 交接规格 |
| 6 | 发行物依赖携带方式 | 基础 runtime = 仅 Bun + 自包含 dist/server.js(入库);重型 QA(Playwright/axe/vnu/Java)保持 external + 惰性加载 + doctor/capabilities readiness 探测 |
| 7 | 最低兼容版本组合 | 插件 0.4.1 + 宿主 ≥1.0.16(required 生命周期);旧宿主上退化为 inactive,不崩溃 |
| 8 | 双 scope 升级与回滚 | 不触碰已装 0.4.0 缓存;0.4.1 不改任何存储记录 schema(`SCHEMA_VERSION=2` 不动、无迁移),0.4.1→0.4.0 代码回退不触碰事实记录;显式 disable 始终优先 |

**通配拒绝**:host/local 环境变量角色配置中的 `*`/`mediaops:*` 直接拒绝(fail closed);OAuth 角色由可信 issuer 负责,不在插件侧扩大。

## 4. 实施批次与范围(按方案 §9.1,含本仓可落地性裁决)

| 批次 | 内容 | 落地方式 |
| --- | --- | --- |
| 1 止损 | P0-A:PRACTICE 预检契约 + 7 停止码 + 证据驱动阶段报告,贯通 9 skill + 7 command | 本仓实施 |
| 2 宿主 | P0-C 逻辑别名、P0-D 首轮有界初始化 | **交接规格文档**(§2.1 裁决) |
| 3 media-ops 0.4.1 | P0-B manifest required;P1-A dist 发行物+QA 惰性化;P0-E 身份模式;P1-B 导入链(复用 content.save,不新增工具);P1-C 编排边界;P1-D doctor/capabilities;版本六点同步+SBOM+发布说明 | 本仓实施,拆 3 个提交 |
| 4 仓库治理 | §8.5 `validate-mcp-contract`(接入 validate-all 与 CI)+ html-video `requiredMcpServers`;12 LSP 迁移与 4 频道 channels 声明因宿主 schema 零先例且宿主仓过期,**以 ratchet 基线冻结存量、阻止新增**,实迁移列为后续批(需宿主 schema) | 本仓实施 |

**明确不做**(承接方案 §10):不部署常驻服务;不把 43 个 MCP 一刀切 required;scan 不收文件路径;不伪造多人;不改宿主子代理框架;不自动连接远程 connector;crabwork 空 URL 占位与 small-business 浮动版本记入 ratchet 基线,由套件所有者另行决策。

## 5. 回归防线

1. 每批提交前:`typecheck` + `bun run test`(失败集合 ⊆ §2.5 四项)+ `validate`(sbom:check + validate-media-plugin);
2. 批次3 后:`bun run build` + 清洁目录冷启动 smoke(无 node_modules、最小 env,MCP initialize→tools/list→capabilities,38 工具);
3. 批次4 后:根 `bun run validate`(含新 validate-mcp-contract)全仓通过;
4. 身份/分离行为新增测试断言(子代理A 指出 scan/review/research/delivery/editorial 分离缺直接断言,随批次3b 补);
5. 不改 14 个 media-core JSON schema 与 SQLite 存储结构(§9.2 红线)。
