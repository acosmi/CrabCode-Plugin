# CrabCode Media Ops MCP 不可用根因审计与实施方案

> 日期：2026-07-18
>
> 状态：实施前存档，尚未实施
>
> 审计范围：`crabcode-media-ops`、CrabCode 1.0.16 插件 MCP 生命周期、工具发现、身份与子代理边界，以及全仓同类问题
>
> CrabCode-Plugin 基线：`b6d6d26`
>
> 本机 CrabCode 应用版本：`1.0.16`

## 1. 执行摘要

`mediaops.originality.scan` 已实现并注册；当前故障不是工具缺失，也不是用户漏部署独立服务，而是 CrabCode 1.0.16 与 `crabcode-media-ops` 0.4.0 之间的生命周期契约没有完成迁移。

当前事实链为：

1. 插件已安装并启用；
2. 插件的 [`.mcp.json`](../../plugins/crabcode-media-ops/.mcp.json) 声明了本地 stdio 服务 `mediaops`；
3. [plugin.json](../../plugins/crabcode-media-ops/.crabcode-plugin/plugin.json) 没有声明 `requiredMcpServers: ["mediaops"]`；
4. 用户设置也没有 `mediaops` 的显式 `mcpServerActivation`；
5. CrabCode 1.0.16 因此将该服务归类为 `inactive`，不会启动 Bun 子进程，也不会把 `mediaops.*` 放入工具池；
6. 重启应用不会改变上述持久状态，因此不能修复。

只补 `requiredMcpServers` 仍不是完整修复。服务被激活后，还会依次遇到：

- 启动路径执行 `bun install` 带来的离线、超时与可重复性风险；
- 插件 MCP 逻辑工具名被宿主哈希后，ToolSearch 未索引原始 `mcpInfo.toolName` 的发现缺口；
- 默认没有可信 principal，变更工具必然返回 `AUTHENTICATION_REQUIRED`；
- 单一静态 host principal 无法满足作者、扫描者、复核者和审批者的主体分离；
- `originality.scan` 只接受已进入治理状态机的 `contentId`，不接受 Markdown 文件路径；
- 工作流和子代理在 MCP 不可用时发生手工降级，却仍可能错误声称已完成正式门禁。

本报告建议先修“停止码与真实状态”，再修激活、冷启动、工具别名、身份模式和内容导入链；不建议部署新的常驻服务，也不建议把全仓 43 个 MCP 一刀切设为自动激活。

## 2. 审计问题与结论

### 2.1 当前是否根本没有启动 MCP

结论：**当前会话没有启动 `mediaops` MCP，但历史上启动过。**

它不是独立部署的 HTTP 服务、容器或守护进程，而是插件安装包内的本地 stdio sidecar：

```text
CrabCode worker
  -> 读取插件 .mcp.json
  -> 根据 lifecycle 判定是否 active
  -> 用 Bun 启动插件子进程
  -> MCP initialize / tools/list
  -> 调用 mediaops.*
```

旧版 CrabCode 1.0.13 日志显示，2026-07-07 曾成功启动并连接：

```text
MCP server "plugin:crabcode-media-ops:mediaops": Starting connection
mediaops: MCP server ready (gate-a)
Successfully connected (transport: stdio) in 66ms
```

因此不能归因于“从未部署”。准确表述是：**插件携带了 MCP 源码和启动定义，但 1.0.16 当前生命周期没有激活它。**

### 2.2 这个 MCP 的职责

Skill 负责提示词和工作流编排；MCP 是确定性执行、状态保存和审计后端。目前插件注册 38 个工具，覆盖：

- 参考材料登记、权利与允许用途；
- 页面 capture、研究证据和来源独立性；
- 内容 revision、阶段、哈希和陈述台账；
- 原创字面覆盖、最长匹配、段落与结构风险；
- 编辑复核、HTML 渲染、浏览器/Nu/axe QA；
- 交付冻结、审批和发布包。

关键实现位置：

- 工具名与输入契约：[src/tools/originality.ts](../../plugins/crabcode-media-ops/src/tools/originality.ts)
- 服务注册：[src/server.ts](../../plugins/crabcode-media-ops/src/server.ts)
- 身份策略：[src/identity.ts](../../plugins/crabcode-media-ops/src/identity.ts)

没有 MCP 时，模型仍能阅读 Skill 并生成文字，但不能生成受版本哈希约束的 scan、review、delivery 或 approval 记录。

## 3. 事实时间线

| 时间 | 事实 | 结论 |
| --- | --- | --- |
| 2026-07-07 | CrabCode 1.0.13 自动发现并成功连接 `mediaops`，服务版本为早期 `0.1.0` | Bun、stdio 和插件启动机制历史上可用 |
| 2026-07-10 | CrabCode 提交 `45f7ae89e`、`4f0f5f03c`，引入显式插件 MCP lifecycle、配置与源隔离 | 未显式启用且未声明 required 的插件 MCP 默认 inactive |
| 2026-07-15 | media-ops 0.4.0 发布，强化身份和门禁，但 manifest 未补 `requiredMcpServers` | 插件发布晚于宿主契约变化，仍漏迁移 |
| 2026-07-16 | 本机安装 user/project 两份 0.4.0；插件 enabled，但 `pluginConfigs` 为空 | 双 scope 不是主因，两份安装都缺同一声明 |
| 2026-07-18 | 工作流会话查询不到 `mediaops` 工具，转而让通用 code-reviewer 手工扫描文件 | 真实 MCP 未执行，没有 scanId/revision hash |
| 2026-07-18 | 最终报告仍使用 `originality-scan -> editorial-review -> delivery-render` 阶段措辞 | 出现静默降级和错误门禁声明 |

## 4. 分层根因

### 4.1 P0 主因：生命周期未激活

插件当前只声明服务定义：

```json
{
  "mcpServers": {
    "mediaops": {
      "command": "bun",
      "args": ["run", "--cwd", "${CRABCODE_PLUGIN_ROOT}", "--shell=bun", "--silent", "start"]
    }
  }
}
```

但 manifest 没有：

```json
{
  "requiredMcpServers": ["mediaops"]
}
```

CrabCode 1.0.16 的 lifecycle 规则位于宿主仓库：

- `src/services/mcp/pluginMcpLifecycle.ts`
- `src/utils/plugins/mcpPluginIntegration.ts`
- `src/utils/plugins/schemas.ts`

无持久 activation 时，只有 manifest required、local、配置完整且宿主认为无需传输层认证的服务才可自动归类为 required；其他服务为 inactive。当前设置中插件 enabled 与 MCP active 是两个独立状态。

### 4.2 P0 后续缺口：插件 MCP 原始工具名不可稳定发现

CrabCode 1.0.16 为插件源隔离和 64 字符 API 名限制，对插件 server namespace 和带点工具名使用哈希 wire name。`mediaops.originality.scan` 在模型工具面不再保持这个原始名称。

宿主的 ToolSearch 当前主要索引：

- wire tool name；
- tool description；
- 可选 `searchHint`。

但没有把权威的 `tool.mcpInfo.serverName` 和 `tool.mcpInfo.toolName` 作为逻辑别名。于是 Skill 按文档搜索或选择 `mediaops.originality.scan` 时，即使服务已连接，也可能无法找到哈希后的实际工具。

涉及宿主文件：

- `src/services/mcp/mcpStringUtils.ts`
- `src/services/mcp/connectionAndFetch.ts`
- `src/tools/ToolSearchTool/ToolSearchTool.ts`

这属于宿主侧的系统性兼容缺口，不应由每个插件把哈希 wire name 写入 Skill。

### 4.3 P0 后续阻断：身份和角色分离

[identity.ts](../../plugins/crabcode-media-ops/src/identity.ts) 为 19 个变更工具定义了角色。其中：

```text
mediaops.originality.scan -> originality_scanner
mediaops.originality.review -> originality_reviewer
mediaops.content.save -> author
mediaops.research.complete -> fact_checker
mediaops.approval.decide -> approver
```

服务仅接受：

1. MCP `authInfo` 中的可信 subject/issuer/roles；或
2. 宿主显式配置的 `MEDIAOPS_IDENTITY_MODE=host-principal` 及 principal 环境变量。

默认 [`.mcp.json`](../../plugins/crabcode-media-ops/.mcp.json) 只注入数据目录。CrabCode 当前 stdio `tools/call` 也不会自动产生 HTTP/OAuth `authInfo`，因此匿名变更调用会稳定返回 `AUTHENTICATION_REQUIRED`。

不能把一个静态 principal 配成 `*` 作为完整修复，因为服务还执行主体分离：

- 草稿作者不能等于原创扫描者；
- 原创复核者不能等于作者或扫描者；
- 研究完成人不能等于 intake 作者；
- delivery reviewer 不能等于 renderer；
- approver 不能等于 requester。

单一静态身份即使拥有所有角色，也无法通过这些检查。

### 4.4 P0 诚信问题：MCP 不可用时静默手工降级

实际工作流把 Markdown 文件路径交给通用 code-reviewer，子代理明确说明“当前 MCP 不可用，本次是手工替代，不构成自动门禁证据”。之后文档又被修改，最终报告仍把流水线写成已经过 originality、editorial 和 delivery 阶段。

这违反 [media-ops/SKILL.md](../../plugins/crabcode-media-ops/media-core/skills/media-ops/SKILL.md) 和 [media-originality-review/SKILL.md](../../plugins/crabcode-media-ops/editorial/skills/media-originality-review/SKILL.md) 中“遇到停止码立即暂停”“结论只能由工具写入哈希记录”的契约。

严重性高于普通可用性故障，因为它可能让使用者误以为已经取得正式审计证据。

### 4.5 P1 调用契约不匹配

`mediaops.originality.scan` 的输入是：

```text
contentId: UUID
createdBy: 由可信 principal 覆盖
quotations: 可选的已登记引用
```

服务端还要求：

- 内容存在；
- schema version 为 v2；
- 当前 revision 处于 `drafted`；
- 扫描者不同于作者；
- 引用来自 reference registry；
- 结果绑定 revision、subject、reference hashes 并写入审计记录。

因此 `{ file_path: "...md" }` 不是合法调用。直接给 scan 增加文件路径会绕过插件最重要的版本和证据链，不建议这样修。

### 4.6 P1 子代理工具边界不一致

部分 agent frontmatter 使用排他工具白名单，但正文宣称会调用 MCP：

- [agents/trend-researcher.md](../../plugins/crabcode-media-ops/agents/trend-researcher.md) 只允许 `WebSearch, WebFetch`，却要求调用 `mediaops.research.capture/complete`；
- [agents/fact-checker.md](../../plugins/crabcode-media-ops/agents/fact-checker.md) 只允许 `WebSearch, WebFetch`，却要求调用 `editorial.review`；
- `media-director`、`platform-publisher` 只允许文件/命令工具，职责中却包含 MCP 状态推进。

宿主子代理可以继承父级 MCP clients，但显式 `tools` 是排他白名单；插件 agent 没有声明 MCP 工具或 agent-specific MCP server 时，文案与实际能力不一致。

为避免扩大宿主改造，本报告推荐主编排线程独占所有 `mediaops.*` 状态调用，子代理只返回结构化研究、写作或核查数据。

### 4.7 P1 冷启动和发行物风险

[package.json](../../plugins/crabcode-media-ops/package.json) 当前：

```json
"start": "bun install --frozen-lockfile --no-summary && bun src/server.ts"
```

两份本机安装缓存均没有 `node_modules`，也没有被 `.mcp.json` 使用的预构建 server。服务一旦被激活，第一次启动将：

- 依赖网络或 Bun 全局缓存；
- 写插件安装缓存；
- 消耗 MCP 30 秒连接超时；
- 每次 spawn 重复执行安装检查。

现有 `scripts/check-installed.ts` 直接用当前 Bun 执行 `src/server.ts` 并注入测试身份，绕过了真实 `.mcp.json`、`start` 脚本和 CrabCode lifecycle，因此不能证明 marketplace 干净安装可启动。

## 5. 已排除因素

| 假设 | 结论 | 依据 |
| --- | --- | --- |
| 工具没有实现 | 排除 | `originality.ts` 已声明，`server.ts` 已注册；插件 validator 报告 38 个工具一致 |
| 插件缓存过旧 | 排除 | 当前安装缓存与 0.4.0 仓库内容匹配 |
| Bun 完全不可用 | 排除为当前主因 | 旧版曾成功启动；当前应用也携带 Bun runtime |
| user/project 双 scope 同时冲突 | 排除为当前主因 | 宿主按优先级选择一个有效安装；两份 manifest 都缺同一 required 声明 |
| 只需重启 | 排除 | manifest 和 settings 不变，重启仍计算为 inactive |
| 仅首次会话懒加载 | 排除为完整解释 | 实际后续查询仍无工具；inactive 不会因等待变 active |
| 直接手动启用就是完整修复 | 排除 | 后续仍有 install、ToolSearch、identity 和 contentId 阻断 |

## 6. 全仓同类问题

仓库共有 43 个插件包含 `.mcp.json`，对应 manifest 均未声明 `requiredMcpServers`。这不等于 43 个都应自动启动。

| 类别 | 数量 | 结论与建议 |
| --- | ---: | --- |
| `crabcode-media-ops` | 1 | 确定存在本报告生命周期缺陷 |
| `crabcode-html-video` | 1 | 确定同类；Skill 强制需要 `validateGraph/renderFrames`，应在发行物自包含后声明 required |
| LSP 插件 | 12 | 协议分类错误；原始 LSP wrapper 放入 `.mcp.json`，应迁移到 `.lsp.json/lspServers`，不能补 required |
| Discord/Fakechat/iMessage/Telegram | 4 | 缺新版 `channels/userConfig`；外部频道保持显式启用，Fakechat 可评估本地自动激活 |
| 单用途 MCP wrapper | 11 | 逐项判定；远程 OAuth、`npx/uvx/docker` 首启下载型不自动激活 |
| `crabwork-*` 套件 | 13 | MCP 是可选增强，保持 opt-in；空 URL 占位不应留在可执行配置中 |
| 示例插件 | 1 | 示例占位，不进入生产 required |

### 6.1 `crabcode-html-video`

[`.mcp.json`](../../plugins/crabcode-html-video/.mcp.json) 已采用预构建 `dist/bootstrap.js` 的正确方向，但 manifest 没有 required。当前工作树中四个已跟踪 dist 文件处于删除状态；已安装缓存仍有 dist，所以不是本次 mediaops 故障，但会阻断下次 HTML-video 发布。

### 6.2 12 个 LSP 插件

`clangd-lsp`、`csharp-lsp`、`gopls-lsp`、`jdtls-lsp`、`kotlin-lsp`、`lua-lsp`、`php-lsp`、`pyright-lsp`、`ruby-lsp`、`rust-analyzer-lsp`、`swift-lsp`、`typescript-lsp` 的 wrapper 只代理 LSP 字节流，没有 MCP initialize/tools/list 协议。

若简单增加 `requiredMcpServers`，结果将从“inactive”变成“MCP 握手失败”。正确方案是改用 CrabCode 的 LSP 声明，并增加语言服务依赖预检。

### 6.3 频道桥接

四个频道插件实现了 `notifications/crabcode/channel`，但 manifest 没有新版 `channels` 声明。Discord/Telegram 还缺宿主可见的 token `userConfig`，启动时执行 `bun install`，依赖范围未锁定。频道修复应走 channel 生命周期，不应把有凭据和系统权限要求的服务设为无条件 required。

## 7. 实施方案

### 7.1 P0-A：先阻止错误门禁声明

目标：即使 MCP 仍不可用，也不能产生“已完成治理”的错误报告。

1. 在所有 media-ops 入口增加统一 preflight：
   - 工具是否存在；
   - `mediaops.capabilities` 是否可调用；
   - principal、roles 和 assurance；
   - runtime/dependency readiness。
2. 不可用时返回结构化停止码：
   - `MCP_INACTIVE`
   - `MCP_START_FAILED`
   - `MCP_TOOL_UNDISCOVERABLE`
   - `AUTHENTICATION_REQUIRED`
   - `ROLE_REQUIRED`
   - `DEPENDENCY_NOT_READY`
3. 若用户选择继续写作，只能输出“未治理草稿”；不得使用 `scan passed`、`reviewed`、`delivery.render complete` 等措辞。
4. 手工扫描、旧 Python 脚本或通用 reviewer 结果只能标为 diagnostic，不计入 gate。
5. 最终报告中的每个已完成阶段必须附权威 ID/hash；没有证据字段就不能显示 completed。

### 7.2 P0-B：插件生命周期兼容

修改 [plugin.json](../../plugins/crabcode-media-ops/.crabcode-plugin/plugin.json)：

```json
"requiredMcpServers": ["mediaops"]
```

同时：

- 保持用户显式 disable 优先于 manifest required；
- validator 校验 required 名称必须真实存在于 `.mcp.json`；
- 发布新补丁版本，建议 `0.4.1`；
- 同步 `plugin.json`、`package.json`、`src/domain.ts`、marketplace、README、SBOM；
- 不修改已安装 0.4.0 缓存作为正式交付手段。

### 7.3 P0-C：宿主逻辑工具名别名

在 CrabCode ToolSearch 中建立两层名称：

```text
wire name: mcp__p_<hash>__h_<hash>
logical aliases:
  plugin:crabcode-media-ops:mediaops
  mediaops
  mediaops.originality.scan
  originality.scan
```

要求：

1. 关键词索引包含 `tool.mcpInfo.serverName` 和 `tool.mcpInfo.toolName`；
2. `select:mediaops.originality.scan` 能解析到唯一 wire tool；
3. 多插件同 logical name 时返回歧义候选，不静默任选；
4. 权限和实际调用仍使用权威 wire identity，别名只服务发现；
5. 增加插件哈希 server、带点 tool、冲突别名回归测试。

### 7.4 P0-D：required local 首轮初始化

CrabCode 当前冷 worker 首轮故意使用空 MCP 集，以避免远程 OAuth 把首 token 延迟拉长。该策略对 required local sidecar 不合适。

建议分流：

- `required + local + config-complete`：首轮有界等待；
- optional local：后台初始化或用户显式启用；
- remote/OAuth：继续后台初始化；
- 超时后暴露明确 lifecycle 状态，不让 Skill 猜测。

前提是 required local 已满足“无启动时安装、离线可启动、时间有界”。

### 7.5 P0-E：身份模式拍板

推荐显式支持两种 assurance，不伪造多人：

#### `local-editorial`

- 一个可信本地用户；
- 确定性扫描、渲染、哈希计算等机器操作使用明确的 server-owned service actor；
- 需要第二位真人的 review/approval 继续 pending；
- 输出明确 lower assurance，不宣称完成多人治理；
- 不使用 `*` 静态角色。

#### `team-governed`

- 宿主或远程 MCP 为每位实际用户注入不同的可信 subject；
- 使用 MCP OAuth 或等价的签名宿主断言；
- 继续执行现有作者/扫描者/复核者/审批者分离；
- subject、issuer、roles 必须来自可信上下文，不能由工具参数自报。

在身份模式未拍板并通过测试前，不能把“工具已出现”当成“插件已恢复可用”。

### 7.6 P1-A：发行物与冷启动

1. 构建可直接启动的 `dist/server.js` 或等价自包含入口；
2. `.mcp.json` 直接执行发行物；
3. 禁止生产 sidecar 的 `start` 脚本执行 `npm/pnpm/bun install`；
4. 固定所有运行依赖和浏览器/Java/Nu 版本；
5. 重型 delivery QA 能力单独探测，缺依赖时返回明确 readiness，不影响基础 MCP initialize/tools/list；
6. 在只复制发行包、无 `node_modules`、禁网、最小 PATH 的环境做冷启动 smoke。

### 7.7 P1-B：文件稿进入治理状态机

不扩展 `originality.scan(file_path)`。推荐流程：

```text
读取 Markdown
  -> content.save/import 生成 contentId/revisionId
  -> reference.register
  -> research.capture/complete
  -> 保存 drafted revision
  -> originality.scan(contentId)
  -> 修改后新 revision，旧 scan 自动 stale
```

优先复用现有 `content.save`。若 Skill 构造现有 schema 过于复杂，再增加一个范围很窄的 `mediaops.content.import`，但必须生成相同的 revision/hash/audit 记录，不能绕过状态机。

### 7.8 P1-C：主编排与子代理边界

为避免修改宿主通用 Agent 框架：

- 主线程持有并调用所有 `mediaops.*`；
- 写作者只返回稿件和主张台账；
- 研究者只返回候选 URL、摘要与建议评估；
- 核查者只返回结构化 coverage/decision 建议；
- 主线程把结构化数据提交 MCP，读取权威结果并决定下一阶段；
- agent 文案不得声称自己调用其白名单中不存在的 MCP。

如果未来确需 agent 直接调用 MCP，再为特定 agent 增加 `mcpServers` 和精确工具授权，并补集成测试；不在本次修复中改造全局继承模型。

### 7.9 P1-D：doctor/capabilities 真实 readiness

当前 `mediaops.doctor` 主要检查数据目录和平台凭据；`capabilities` 会报告许多逻辑能力为 true，但不代表身份、Java、Chromium、Nu 和依赖已就绪。

建议返回：

- server/runtime version；
- data directory durability/writability；
- principal assurance、roles；
- 每个治理阶段的 callable/readiness；
- Java、Chromium、Nu、axe、Playwright 精确版本；
- 发行依赖是否完整；
- 阻断码和可操作 setup 提示。

## 8. 自动化验证方案

### 8.1 生命周期与工具发现

| 用例 | 输入条件 | 预期结果 |
| --- | --- | --- |
| clean required activation | 干净 settings，安装 mediaops 新版本 | `mediaops` 自动为 required/active，用户仍可 disable |
| optional remote | 未授权的远程 connector | 保持 inactive/needs-auth，不自动登录 |
| first-turn required local | 冷 worker、离线发行包 | 首轮在有界时间内出现核心工具 |
| logical select | `select:mediaops.originality.scan` | 返回唯一哈希 wire tool |
| ambiguous alias | 两插件声明同 logical name | 返回歧义，不静默选择 |

### 8.2 发行包

在临时目录只复制 marketplace 发行物，然后：

1. 删除 `node_modules`；
2. 禁止网络；
3. 使用最小 PATH；
4. 按 `.mcp.json` 启动；
5. 执行 `initialize -> tools/list -> capabilities`；
6. 验证启动期间没有依赖安装和包文件修改；
7. 验证超时预算。

### 8.3 身份矩阵

| 场景 | 预期 |
| --- | --- |
| 匿名变更调用 | `AUTHENTICATION_REQUIRED` |
| 有 principal、缺角色 | `AUTHORIZATION_DENIED` |
| static wildcard | 生产配置校验拒绝或强告警 |
| 同一主体跨作者/扫描者 | `ROLE_SEPARATION_REQUIRED` |
| local service actor 扫描 | 记录 service assurance，不冒充真人 |
| team 模式不同 subject | 通过相应角色与分离检查 |
| token 过期/issuer 缺失 | fail closed |

### 8.4 工作流真实性

- MCP 不可用时，Skill 必须停止并输出 `GATE_NOT_EXECUTED`；
- 手工 reviewer 输出不能变成 scan completion；
- 最终报告没有 scanId/hash 时不得显示 originality completed；
- 文件路径直接传 scan 必须 schema 拒绝；
- 合法 contentId、drafted stage、注册 references 可以扫描；
- 改稿后旧 scan 变 stale；
- reviewer 与作者/扫描者相同时保持阻断；
- delivery/approval 同样要求权威 manifest/hash。

### 8.5 仓库合同检查

新增轻量 `validate-mcp-contract`，至少检查：

- wrapped/unwrapped `.mcp.json` 均按宿主 schema 解析；
- required/channel server 名真实存在；
- Skill、Command、Agent 中 dotted、namespaced、裸工具引用；
- agent 文案引用 MCP 时具备相应编排边界或工具授权；
- raw LSP proxy 不得放入 `.mcp.json`；
- channel notification 实现必须有 `channels` 声明；
- required local 启动路径不得包含 install；
- 自动激活发行配置不得使用 `@latest`、未固定 Git HEAD 或空 URL；
- 发行内容变化但 manifest/marketplace/package 版本未递增时失败；
- 根 CI 执行 HTML-video distribution 和 mediaops clean-package smoke。

## 9. 发布顺序

### 9.1 建议拆分

1. **止损补丁**：Skill preflight、停止码和证据驱动的阶段报告；
2. **CrabCode 宿主补丁**：ToolSearch logical aliases、required local 首轮有界初始化；
3. **media-ops 0.4.1**：required manifest、预构建发行物、身份模式、编排边界；
4. **仓库治理补丁**：validator、HTML-video、LSP、channel 分批修复。

不要把所有问题塞进一个跨仓巨型提交。每批都有独立 smoke 和回滚面。

### 9.2 升级验证

- 覆盖 user scope 和 project scope 0.4.0 升级；
- 确认宿主只选择一个有效安装；
- 不能原地修改旧 0.4.0 cache 伪装升级；
- marketplace、manifest、package、runtime、SBOM 版本一致；
- 旧 SQLite 数据只读打开并通过现有完整性校验；
- 本轮 lifecycle/工具发现补丁不改变数据 schema。

### 9.3 回滚

- 插件侧可通过用户显式 disable 停止 `mediaops`；
- 回滚插件版本不得删除或重建 `MEDIAOPS_DATA_DIR`；
- 宿主 ToolSearch 别名改动不写业务数据，可独立回滚；
- P0 补丁避免 SQLite schema 迁移，使 0.4.1 到 0.4.0 的代码回退不会触碰既有事实记录；
- 回滚后功能可以停止，但不能把未完成门禁显示为完成。

## 10. 明确不做

为控制复杂度，本轮不建议：

- 部署新的常驻服务、容器或独立数据库；
- 把仓库全部 43 个 MCP 自动设为 required；
- 让 `originality.scan` 接受裸文件并绕开 content lifecycle；
- 用静态 `*` principal 或多个虚构 Agent 名冒充多人；
- 重构 CrabCode 全局子代理框架；
- 把可选远程连接器随插件安装自动连接；
- 在同一提交中同时重做 mediaops、LSP、channels 和所有 wrappers。

## 11. 实施前决策清单

实施前必须确认：

- [ ] `mediaops` 是否定义为 first-party essential local MCP；本报告建议“是”。
- [ ] 是否接受 `local-editorial` lower-assurance 模式；本报告建议“是，但不完成第二人门禁”。
- [ ] team 模式可信 subject 由哪个宿主边界提供。
- [ ] 哪些操作属于 server service actor，哪些必须由真人 principal 证明。
- [ ] required local 首轮等待的超时预算。
- [ ] 发行物如何携带基础 runtime 与重型 delivery QA 依赖。
- [ ] 宿主和插件补丁的最低兼容版本组合。
- [ ] 0.4.0 双 scope 用户升级和回滚路径。

## 12. 审计边界与工作树说明

本报告形成期间只进行了读取、搜索、现有验证脚本和 Git 状态检查，没有：

- 启动或启用 `mediaops` MCP；
- 修改 `~/.crabcode/settings.json`；
- 修改已安装插件缓存；
- 安装运行依赖；
- 实施本报告中的代码方案。

审计时工作树已存在与本报告无关的改动：

- `plugins/crabcode-html-video/dist/` 四个已跟踪文件处于删除状态；
- `docs/audit/2026-07-18-crabcode-media-publisher-多平台多内容类型分发调研与实施方案.md` 为未跟踪文件。

实施或发布时必须继续隔离这些改动，除非其所有者明确纳入范围。
