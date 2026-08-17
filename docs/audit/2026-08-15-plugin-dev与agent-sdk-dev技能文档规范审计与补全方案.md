# plugin-dev 与 agent-sdk-dev 技能文档规范审计与补全方案

> 状态：方案已定稿，待执行。审计基线：本仓 main = `988b228`（2026-08-15）；运行时真源 = 主仓 `D:\crabcode\src`（只读参照，本方案**不改主仓**）。
> 审计结论：两插件均通过本仓九道机器闸门（brand/validate-all 实跑 exit 0，含正向对照），但**内容层不合格**——机器闸门查不了「写的事实是不是本产品的事实」。根因：**品牌脱敏 ≠ 事实移植**。
> 本文自包含：执行者不需要审计会话的上下文，只需本文 + 两个仓库。

---

## 0. 执行环境与红线

- 仓库：`D:\CrabCode-Plugin`（唯一 remote `origin = https://github.com/acosmi/CrabCode-Plugin`，fetch/push 同仓）。执行前 `git fetch` + 确认工作树干净 + 快进到 origin/main。
- **开独立分支**（建议 `fix/plugin-doc-truth-20260815`），不直接动 main；分片 commit；只 add 自己改的具体路径，禁 `git add .`。
- **品牌闸门红线**：任何修改不得引入禁词（大小写不敏感子串）：`claude` / `claude code` / `claude-code` / `anthropic` / `sonnet` / `opus` / `haiku` / `codex` / `.claude` / `.codex` / `@anthropic`。⇒ 修 `<model-id>` 时**绝不能**回填上游模型名，一律用 `inherit` / `best` / `planmode`（见 §1）。
- 每片验收必跑（§8 有完整清单）：`bun run validate`（exit 0）、`bun run lint:brand`（exit 0）、`bun test ./tests/`、所有改动过的 `.sh` 过 `bash -n`。**判定命令不接管道**（`| tail`/`| head` 吞退出码，本机已七次踩坑）。
- push 实证：push 后 `git ls-remote https://github.com/acosmi/CrabCode-Plugin.git <branch>` 与 `git rev-parse HEAD` 逐字符相等才算到位（用显式 URL，不用别名）。
- 主仓 CLAUDE.md 硬约束 #0（证据铁律）适用：本文 §1 的真值表已实证，但执行者写进文档前对标注 ⚠ 的条目**必须自己再跑一遍锚点**；凡「期望 0」的验收 grep 必须配正向对照。

## 1. 运行时真值表（写文档以此为准）

以下事实全部在审计轮实证过，锚点均为主仓 `D:\crabcode` 内符号：

| 主题 | 真值 | 锚点 |
|---|---|---|
| `model:` 合法值 | `inherit` / 语义别名 `best`、`planmode` / 完整 SDK 模型 id。**文档不得教 pin 字面模型 id**（主仓硬约束 #1 精神） | `src/utils/model/aliases.ts::MODEL_ALIASES`；`src/utils/plugins/loadPluginAgents.ts`（'inherit' 分支）；`src/utils/frontmatterParser.ts` model 注释 |
| hook 事件 | 共 27 个；有 `SubagentStop`，**无 `AgentStop`** | `src/utils/hooks/hooks-events.ts`；`src/utils/plugins/loadPluginHooks.ts` |
| 插件 `hooks/hooks.json` 形状 | **必须** `{ "description"?: string, "hooks": { "<Event>": [ { "matcher"?: string, "hooks": [...] } ] } }` 包裹；`matcher` 可选 | `src/utils/plugins/schemas.ts::PluginHooksConfigSchema`；`src/schemas/hooks.ts::HookMatcherSchema` |
| hook 类型 | 4 种：`command` / `prompt` / `agent` / `http`；`timeout` 单位秒 | `src/schemas/hooks.ts` 判别联合 |
| hook 超时默认 | **600s**（`TOOL_HOOK_EXECUTION_TIMEOUT_MS = 10*60*1000`）；SessionEnd 默认 1.5s。600 是默认不是上限 | `src/utils/hooks/hooks-types.ts` |
| prompt hook 变量替换 | **只有 `$ARGUMENTS`**。`$TOOL_INPUT` / `$TOOL_RESULT` / `$USER_PROMPT` 均不存在 | `src/utils/hooks/execPromptHook.ts`（"Replace $ARGUMENTS" 注释） |
| hook stdin 字段 | 基础：`session_id` `transcript_path` `cwd` `permission_mode` `hook_event_name`（等）；PostToolUse 是 **`tool_response`**（非 tool_result）；UserPromptSubmit 是 **`prompt`**（非 user_prompt）；Stop 带 `stop_hook_active` 等（非 reason）。⚠ 写进文档前从锚点重导完整字段清单 | `src/utils/hooks/hooks-matching.ts`、`hooks-events.ts` |
| `permission_mode` 枚举 | `default` / `acceptEdits` / `bypassPermissions` / `dontAsk` / `plan`（无 "ask"/"allow"） | `src/types/permissions.ts::EXTERNAL_PERMISSION_MODES` |
| hook 输出 JSON | stdout + exit 0 才被解析；`decision` 枚举**只有 `approve\|block`**（无 "deny"）；`hookSpecificOutput` 是判别联合，**必带 `hookEventName`**；`permissionDecision` 取 allow/deny/ask。exit 2 = 阻断，stderr 当**纯文本**反馈（不解析 JSON） | `src/types/hooks.ts`（enum 与判别联合）；`src/utils/hooks/hooks-events.ts`（exit 2 语义） |
| MCP 插件工具命名 | `mcp__p_<hash>__<tool>`（前缀常量 `'p_'`），**不是** `mcp__plugin_<插件>_<server>__<tool>`。文档应教「用 `/mcp` 查真名」而非手拼 | `src/services/mcp/mcpStringUtils.ts::MCP_PLUGIN_SERVER_PREFIX` |
| MCP env 展开 | `${VAR}` 只读 `process.env`；特例 `${CRABCODE_PLUGIN_ROOT}` `${CRABCODE_PLUGIN_DATA}` `${user_config.X}`。`${CRABCODE_PROJECT_DIR}` **在 .mcp.json 里不展开**（它只注入 hook 子进程） | `src/services/mcp/envExpansion.ts`；`src/utils/plugins/mcpPluginIntegration.ts` |
| `/plugin` 子命令 | `help` `install(i)` `manage` `uninstall` `enable` `disable` `validate` `marketplace{add,remove,rm,update,list}`。**无顶层 `update`** | `src/commands/plugin/parseArgs.ts` |
| marketplace 名 | `crabcode-plugins-official`（`crabcode-marketplace` 不存在） | 本仓 `.crabcode-plugin/marketplace.json:2` |
| CLI | 二进制只有 `crabcode`，**无 `cc` 别名**；`crabcode --debug [filter]` 真；`--plugin-dir` 真 | 主仓 package.json 无 bin；`src/utils/debug.ts`（--debug）；`src/cli/handlers/plugins.ts`（--plugin-dir） |
| debug 日志 | `~/.crabcode/debug/<sessionId>.txt` + `latest` 符号链接（目录名是 `debug`，**不是 `debug-logs`**） | `src/utils/debug.ts`（getDebugLogPath 一带 + latestSymlinkPath） |
| 热重载 | `/reload-plugins` 存在（会话内应用插件变更）；「必须重启」的绝对表述过时 | `src/commands/reload-plugins/` |
| agent frontmatter | 运行时字段：name/description/when-to-use/tools/skills/color/model/background/initialPrompt/memory/isolation/effort/maxTurns/disallowedTools；**model、color 均可选**，name 可回退文件名 | `src/utils/plugins/loadPluginAgents.ts` |
| agent color 枚举 | 8 色：`red blue green yellow purple orange pink cyan`（**无 magenta**） | `src/tools/AgentTool/agentColorManager.ts::AGENT_COLORS` |
| command frontmatter | 运行时支持：allowed-tools / argument-hint / arguments / when_to_use / version / name / model / effort / disable-model-invocation / user-invocable / shell | `src/utils/plugins/loadPluginCommands.ts` |
| AskUserQuestion 结果 | `answers` 按**问题文本**键控（非 `answers["0"]` 数字索引） | `src/tools/AskUserQuestionTool/AskUserQuestionTool.tsx`（answers schema） |
| plugin.json 字段 | 支持 `skills` 数组（本仓 plugin-dev 自用）等；manifest-reference 现漏写 skills | `src/utils/plugins/schemas.ts`（PluginManifestSchema 一带） |
| 本仓 presentation 闸门 | workflow 档技能 SKILL.md 强制**中文 `name`** + **中文 `short-description`**（限长、禁模板句） | 本仓 `src/policy/presentationValidator.ts` |
| API key 环境变量 | `ACOSMI_API_KEY`（主）/ `CRABCODE_API_KEY`；**`AGENT_API_KEY` 不存在**（主仓 0 命中） | 主仓全源 grep（46/7/0 命中） |
| SDK 包名产品口径 | `crabcode-agent-sdk`（Python import `crabcode_agent_sdk`）。⚠ 该名在 npm 未发布（404），而 **npm `agent-sdk` 是真实存在的无关第三方包**（审计轮实测 200）——供应链风险 | 主仓 `src/skills/bundled/crabcode-api/{typescript,python}/agent-sdk/README.md` |
| 工具名存在性 | `Task` `TodoWrite` `Skill` `Agent` `AskUserQuestion` 等均为真实工具名 | `src/tools/*/`（TOOL_NAME 常量） |

## 2. 已定默认裁决（用户可推翻；执行者按此走，不停下来问）

| # | 事项 | 默认决定 |
|---|---|---|
| D1 | `hook-development/references/migration.md`（伪「迁移指南」——不存在被废弃的旧格式，四类 hook 并列现行，且教删旧脚本 + 裸形 hooks.json） | **重写**为「hook 类型选型指南」（改标题与叙事，删「归档/删除旧脚本」破坏性建议，示例改包裹形）；不删文件 |
| D2 | `skill-development/references/skill-creator-original.md`（整篇未移植上游残留：教跑不存在的 init_skill.py / package_skill.py、zip 分发、name 与真插件冲突） | **删除文件**，SKILL.md 中两处指路（:621-622 与 :149 的对比句）一并删除/改写。上游溯源已由 THIRD_PARTY_NOTICES 承担 |
| D3 | plugin-settings 的 multi-agent-swarm 案例（该插件不存在，行号引用全是编的） | **删除该案例**，用修正后的 ralph-loop 真案例（TS 实现：`plugins/ralph-loop/src/stopHook.ts`、state 字段 `active`/`session_id`、默认 `DEFAULT_MAX_ITERATIONS=5`）作为唯一案例重写 |
| D4 | agent-sdk-dev 的 SDK 包名（产品口径包未发布，文档现指向他人的包） | **止血案**：删除全部 npmjs/pypi 直链与 `install agent-sdk` 类命令；包名统一 `crabcode-agent-sdk`/`crabcode_agent_sdk`，安装表述改为「以产品内置 crabcode-api 技能与官方发布渠道为准」。分发真源问题另立项在主仓，本轮不解决 |
| D5 | P4b（command-development 三个 reference 里大段「伪 shell 命令体」重写，工作量大） | **本轮做**，但排最后；若时间截断，单独留明确遗留清单 |
| D6 | P7 事实闸门作用域 | 全库扫描：对 `plugins/plugin-dev` + `plugins/agent-sdk-dev` 判 error，其它插件先 warn 列存量 |

## 3. 分片工单

### P1 —— 坏脚本修复（可执行物，最高优先）

1. `plugins/plugin-dev/skills/agent-development/scripts/validate-agent.sh`
   - :131/:135 `case` 里的 `inherit|<model-id>|<model-id>|<model-id>)` → `inherit|best|planmode)`（`<` 在 case 模式是重定向符，当前 `bash -n` exit 2，**整个脚本不可执行**）；提示语同步。
   - :151/:155 颜色枚举 6 色含 magenta → 8 色真值（§1）。
   - :109-111/:16 「description 应含 `<example>` 块」的 warn 与本插件自家规范（flat prose、禁 transcript 形）相反 → 删除该检查。
   - :124/:144 model/color 缺失从 error 降级为提示（运行时可选；文档措辞可保留「推荐显式写」）。
   - 修完 `bash -n` 必绿，并用插件自带的 `examples/complete-agent-examples.md` 里的示例实测跑一遍。
2. `command-development/references/testing-strategies.md` :97-101 内嵌校验片段：只匹配字面 `<model-id>`、拒绝一切真值 → 改为校验 `inherit|best|planmode` 或删掉 model 白名单一段。
3. `hook-development/scripts/validate-hook-schema.sh`
   - 校验目标是插件 `hooks/hooks.json` ⇒ 按**包裹形**解析（先取 `.hooks` 再遍历事件；对裸形给出明确错误提示）。当前对合法配置必假红（把 `description`/`hooks` 当未知事件，随后 jq 报错）。
   - :41 VALID_EVENTS：`AgentStop` → `SubagentStop`，并从主仓 `hooks-events.ts` 重导事件全集（27 个）。
   - :71-75 matcher 必填 → 可选；:97-98 类型白名单补 `agent`/`http`；:136-137 「max 600s」措辞改（600 是默认非上限）。
4. `hook-development/scripts/test-hook.sh`：`AgentStop`→`SubagentStop`（:59,:96）；样例 `permission_mode: "ask"` → `"default"`（5 处）；`tool_result`→`tool_response`（:55）；Stop 样例 `reason`→`stop_hook_active`（:67）；`user_prompt`→`prompt`（:79）；SessionStart 样例补 `source` 字段（:84-92）。
5. `hook-development/scripts/hook-linter.sh` :102 「< 60s」→ 按 600s 默认改述。
6. `hook-development/examples/validate-bash.sh`、`validate-write.sh`、`plugin-settings/examples/read-settings-hook.sh`：现在把 `hookSpecificOutput` JSON 发 **stderr** + `exit 2`（结构化决策永不被解析，且缺必填 `hookEventName`）。统一改为规范形态之一并注释说明两种通道：
   - 简式：exit 2 + stderr 纯文本原因；
   - 结构化：stdout JSON（含 `hookEventName: "PreToolUse"`、`permissionDecision`、`permissionDecisionReason`）+ exit 0。
   - `"permissionDecision": "ask"` + exit 2 的死路径（validate-bash :38、validate-write :33）改为结构化 ask + exit 0。read-settings-hook.sh 另修 :57-59 字符数/bytes 措辞。

### P2 —— hook-development 文档事实修正

- `AgentStop` → `SubagentStop` 全文（SKILL.md :4,:17,:35,:212,:319,:641）；:635-645 的 9 事件表标注「常用子集，全集以 `/hooks` 命令显示为准」。
- SKILL.md :343-381 与 migration.md :282-316 的 hooks.json 示例加 `{"hooks": {...}}` 包裹（与 :120 的正确表述对齐）。
- `$TOOL_INPUT` 家族 → `$ARGUMENTS`（SKILL.md :30,:321；advanced.md :22,:158；migration.md :66,:140,:222；patterns.md :17,:164）。`$ARGUMENTS` 的值是整个 stdin JSON，教配 `jq` 取字段。
- stdin 字段表 :307-321 按 §1 修（permission_mode 枚举 / tool_response / prompt / stop_hook_active；⚠ 从锚点重导后写全）。
- `"decision": "deny"` → `"block"` 全部（SKILL.md :443,:457,:463；advanced.md :283,:332,:372；migration.md :112,:119,:168；patterns.md :328）；同步修通道（stdout+exit0 才解析 JSON）。SKILL.md :147-153 的 `hookSpecificOutput` 示例补 `hookEventName`。advanced.md :189 `"approve"` 对 PreToolUse 无效 → 改 permissionDecision 形。advanced.md :472 stderr+exit0 的 JSON 会被丢弃 → 改 stdout。
- 超时默认 :492 「60s/30s」→ 600s（SessionEnd 1.5s 一并写明）。
- :419 matcher 示例 `mcp__plugin_asana_.*` → 删除手拼形，教「`/mcp` 查看真名（`mcp__p_…__` 形）后再写 matcher」。
- 重启断言（:577-588、patterns.md :298）→ 改为「用 `/reload-plugins` 应用变更」；删 `cc` 别名（:588）。patterns.md :298 与其 flag-file 模式自相矛盾（flag 在 hook 执行时读取，本就即时生效）→ 删该句。
- :105 「user settings in `.crabcode/settings.json`」→ 项目级是 `.crabcode/settings.json`，用户级在 `~/.crabcode/settings.json`，分清两级。
- :325-330 env 清单：`CRABCODE_ENV_FILE` 非仅 SessionStart（⚠ 执行者到 `src/utils/hooks/hooks-executor.ts` 实证事件集与 shell 限定后写真话）；`CRABCODE_REMOTE` 一行删除或改述为「运行时读取的外部变量，非注入 hook」。
- migration.md 按 D1 重写为类型选型指南。
- advanced.md :85-111 与 :233-265 的 `$$` 跨 hook 状态共享**机制性失效**（每个 hook 独立进程，PID 恒不同；:442 自己也在骂这个模式）→ 改为固定路径 + `session_id` 键控的状态文件模式，或整段删除。
- 死引用：SKILL.md :694 与 mcp SKILL.md :537 的 `[upstream documentation reference removed]` 空话行删除；SKILL.md :252,:375 `scripts/load-context.sh` → `examples/load-context.sh`（与 :265 统一）。

### P3 —— mcp-integration 文档修正

- 工具名：SKILL.md :195-222 与 references/tool-usage.md 全篇的 `mcp__plugin_<插件>_<server>__<tool>` 及全部示例名 → 改为真格式说明（`mcp__p_<hash>__<tool>`）+「用 `/mcp` 查看实际名」指引；allowed-tools 示例同步。
- SKILL.md :228-230（启用即连接）vs :406（首次调用才连接）互斥 → ⚠ 执行者到 `src/services/mcp/config.ts` 实证连接时机后统一写真话。
- `examples/stdio-server.json` :5 `${CRABCODE_PROJECT_DIR}` 在 .mcp.json 不展开 → 改 `${CRABCODE_PLUGIN_ROOT}` 或删除该参数。
- `examples/http-server.json`：两个 server URL 被脱敏成同一个 → 第二个（internal-service）改用可区分的示例域名（如 `https://internal.example.com/mcp`）。
- `examples/sse-server.json` :9 与 references/server-types.md :176 的 `https://mcp.github.com/sse` 不可达（实测）且 authentication.md :40 自己写「(when available)」→ 移除该端点，换 `https://mcp.asana.com/sse`（实测可达）或去掉「Official Services」名录。
- authentication.md :59-63 「Encrypted at rest」无证 → 弱化为「由产品保管、插件不可见」（或执行者实证后写真话）。
- SKILL.md :491 checklist「type 必填」vs 三个示例省略 type → 统一为「type 可省略，默认 stdio」。
- tool-usage.md :244-258 虚构的「CrabCode 内部表示」段删除；:124,:152-155,:351 无证断言（agent 不受 tools 限制 / 自动并行）删除或改保守表述。

### P4 —— command-development 修正

- `references/frontmatter-reference.md` model 节整体重写：Values = `inherit` / `best` / `planmode` / 完整模型 id；三段「Use X for」按「继承会话 / 追求最强 / 规划档」重写；:443 fix 行同步；「用字面 id 钉死模型不推荐」写明。顺带补 CrabCode 特有字段简表（effort / user-invocable / shell / when_to_use / arguments，来源 §1）。
- 虚构模板语法删除：`$IF(...)`（SKILL.md :420-424；plugin-features-reference.md :453-456,:496-499——含虚构 `in [...]`/`AND` 算子）；`${1:-default}`（advanced-workflows.md :460-463）；`$(...)` 命令替换 → `` !`...` ``（advanced-workflows.md :86-95，与同文件 :657-659 已有的正确写法统一）。真语法全集只有：`$ARGUMENTS`、`$1..$n`、`` !`cmd` ``、`@file`。
- testing-strategies.md :152 `~/.crabcode/debug-logs/latest` → `~/.crabcode/debug/latest`。
- marketplace-considerations.md：:442,:870 `/plugin update plugin-name` → 改「`/plugin manage` 或 `/plugin marketplace update`」；上游残留整段删除：评分流（:566-595）、遥测设计（:597-613）、beta 报名（:774-812）、release-notes 拉取（:869-872）；:435 `[ "$V" < "2.0.0" ]` 坏 shell（`<` 是重定向）修掉或随所在伪脚本段一并处理。
- interactive-commands.md：`answers["0"]` 键形 → 按问题文本键控（同修 plugin-settings/examples/create-settings-command.md :61-62）；:775 `.daisy/swarm/tasks.md` → `.crabcode/`；:668-780 的 multi-agent-swarm 出处案例改造或删除（对齐 D3）；:593 `config-partial.yml` → `.local.md` 约定统一。
- documentation-patterns.md :616 安装命令统一 `name@crabcode-plugins-official` 形。
- README.md（plugin-dev）：:198,:201,:381 `crabcode-marketplace` → `crabcode-plugins-official`；:390 版本 → 与 bump 后 manifest 一致、「three validation agents」→ 如实（2 验证 1 生成）；:398 MIT → Apache-2.0；:63 事件清单去 `AgentStop`；:276-283 脚本相对路径修为 `skills/hook-development/scripts/…`；:207/:385 `cc` → `crabcode`；⚠ :45 的 `/plugin-dev:create-plugin` 调用形执行者在 `loadPluginCommands.ts` 实证命名形后统一（与 create-plugin.md :324、command-development SKILL.md :621 的三种说法归一）。
- 字数自报全部删除（README 各技能条目、子 README、SKILL.md :304,:311 对兄弟技能的字数断言）——多处失实（如自称 1,232 实测 3,231），且必然再漂。
- 自相矛盾归一：`commands/` legacy 口径（两处 legacy vs 四处一等公民）→ 统一为「commands/ 仍受支持；新建用户可调用能力优先用 skills」，六处同一措辞；嵌套命令发现两说 → ⚠ 实证 `loadPluginCommands.ts` 后统一；`/help` 标注格式两说（:82 vs :621）→ 实证后统一；create-plugin.md :41 「7 phases」→ 8；:313 「copy to `.crabcode-plugin/`」→ 删（组件禁入该目录，plugin-structure :43 已明说）；create-plugin.md :310 `cc` → `crabcode`。
- **P4b（排最后，D5）**：documentation-patterns.md / advanced-workflows.md / marketplace-considerations.md 里把 `if/case/exit` 伪 shell 当命令正文的大段示例（三文件合计约 25 段，行号见审计）→ 重写为「给模型的指令式正文 + 必要处用 `` !`cmd` ``」。命令 .md 不是脚本，这是这三个文件的骨架级返工。

### P5 —— agent-development / skill-development / plugin-settings 修正

- agent-development/SKILL.md：:102-104,:341 model 选项 → `inherit`（推荐）/`best`/`planmode`；color 枚举 8 色（:112 及各示例）；model/color「Yes 必填」→ 可选（推荐显式写）；:285-286 命名空间两行病句重写；:372,:202 「exact prompt from CrabCode」→「参考模板」；:386 `test-agent-trigger.sh` 引用删除（文件不存在）。examples/agent-creation-prompt.md、complete-agent-examples.md、references/agent-creation-system-prompt.md 中同类项同步。
- `agents/*.md` 三个 agent：**删尾部混入的作者对话残留**（plugin-validator.md :182-184「Excellent work! …」；agent-creator.md :173-175；skill-reviewer.md :182-184 的收尾营销句——这些会进 agent 系统提示词）；plugin-validator.md 校验规则对齐运行时（model/color 可选、8 色、「all 6 skills」→ 7、manifest 未知字段名单承认 license/keywords/skills 合法）；agent-creator.md :102 与 plugin-validator.md :94 的 `<model-id>`；agent-creator.md 自身 frontmatter 补 `model: inherit`（与其教义一致）。
- skill-development/SKILL.md：frontmatter 节写清双作用域——通用插件技能 `name`/`description`（+可选 version）；**要进本插件库 workflow 档的技能必须中文 `name` + 中文 `short-description`**（presentationValidator 强制，本插件 7 个 SKILL.md 自身即例证）；三个互斥字数上限（:193,:332,:436,:601,:85）统一为「理想 1,500-2,000 词、硬上限 5k」一个口径；`assets/` vs `examples/` 两套布局（:39-42 vs :145 等）统一为 `references/` `examples/` `scripts/`（`assets/` 标注为另一形态技能使用，或删）；:283 zip 矛盾随 D2 消解；:149 init_skill 对比句删；:621-622 指路删（D2）。
- plugin-settings：multi-agent-swarm 全案例删除（D3）；real-world-examples.md 的 ralph-loop 描述改真（TS 文件名、`active`/`session_id` 字段、默认 5、删编造行号）；「`enabled` 字段两插件通用」断言（:280-282）删；awk「能保住正文里的 `---`」假断言（parsing-techniques.md :119,:336；real-world-examples.md :382）修正——正确提取器：`awk 'c==2{print; next} /^---$/{c++}'`（写入前实测：正文含 `---` 行的样例文件跑一遍）；「BAD: 假设恰两个 --- 的 sed」反模式段（real-world-examples.md :379-381）与全技能到处教的同款 sed 的矛盾——统一改教上面 awk；example-settings.md :98-101 块序列 YAML 与 grep 解析器矛盾 → 改 inline 数组并注明解析器限制；:142-143 gitignore 的 `.local.json` 行删（无此格式）；SKILL.md :370-384 重启断言对齐 `/reload-plugins` + 「hook 每次执行时读取 `.local.md`，值变更即时生效」的真话；:380 `cc` 删。
- SKILL.md :354「No restart required: Changes take effect on next CrabCode session」自相矛盾句（plugin-structure）重写。
- plugin-structure：manifest-reference.md 补 `skills` 字段文档（本插件自身 manifest 即用例）；:186-192 SKILL.md 格式示例对齐上面双作用域；examples/*.md 里 `capabilities:` 形 agent frontmatter（4 处）→ 运行时真字段；examples 里命令 frontmatter `name:` 字段与 reference 归一（运行时支持 name，reference 补一行即可）。

### P6 —— agent-sdk-dev 修正（按 D4 止血案）

- `commands/new-sdk-app.md`：:77-78 npmjs/pypi 直链**删除**（npm `agent-sdk` 是他人包——供应链风险）；:83-87 安装/查版命令包名 → `crabcode-agent-sdk`；:98 `.env.example` → `ACOSMI_API_KEY`。
- `agents/agent-sdk-verifier-py.md`：:14 `agent-sdk` → `crabcode-agent-sdk`；:28 `agent_sdk` → `crabcode_agent_sdk`；:45 `AGENT_API_KEY` → `ACOSMI_API_KEY`。`agent-sdk-verifier-ts.md`：:14,:28,:51 同。
- `README.md`：:139 `AGENT_API_KEY` → `ACOSMI_API_KEY`；:152-155 「included in the CrabCode repository」→ marketplace 安装表述；:166-171 Resources 四条空话删或换成「产品内置 crabcode-api 技能」指引；:186-191 Troubleshooting 包名同步；:208 版本 → 与 bump 后 manifest 一致。

### P7 —— 防复发「事实闸门」（按 D6）

- 新增 `src/policy/docFactsValidator.ts` + `scripts/lint-doc-facts.ts` + `tests/validators/` 用例，接入 `scripts/validate-all.ts` 与 package.json（`lint:doc-facts`），风格对齐既有 validator。
- 机检规则（对 .md/.sh/.json，`docs/legal` 豁免）：
  1. 禁 pattern（error on plugin-dev + agent-sdk-dev，warn 其它）：`\bAgentStop\b`、`mcp__plugin_`、`\$TOOL_INPUT|\$TOOL_RESULT|\$USER_PROMPT`、`"decision"\s*:\s*"deny"`、`crabcode-marketplace`、`debug-logs`、`<model-id>`、`AGENT_API_KEY`、`answers\["\d+"\]`。
  2. `/plugin <sub>` 子命令白名单（§1 清单）。
  3. hook 事件名白名单：`src/policy/facts/hook-events.json`（从主仓 `hooks-events.ts` 手工导出并注明来源 commit；文档中出现的 `"<Event>":` 键必须在单内）。
- 修完 P1-P6 后全库 `<model-id>` 应为 0，可直接 error。

## 4. 版本与收尾

- bump：plugin-dev `0.2.1 → 0.2.2`，agent-sdk-dev `0.1.0 → 0.1.1`；三处同步：各自 `.crabcode-plugin/plugin.json` + 根 `.crabcode-plugin/marketplace.json` 对应条目 + README 版本行；`command-development` 子 README 的 changelog 版本口径顺带对齐。
- commit 分片建议与 P1-P7 对应；每片 commit 前跑 §8。

## 5. 明确不做（本轮范围外）

- 主仓 `D:\crabcode` 的任何改动（含 `crabcode-agent-sdk` npm 未发布的分发真源问题——需主仓侧另立项）。
- 其它 74 个插件的同类清理（P7 的 warn 存量清单就是后续立项输入）。
- 上游插件的功能性增强；本轮只修「真」不加「新」。

## 6. 审计发现全量索引（供执行时逐条勾销）

> 上文工单已覆盖全部条目；此处按文件聚合便于自查勾销。行号为 main=988b228 时点值，改动后以内容锚定位。

- **README.md**：:63(AgentStop) :198/:201/:381(marketplace名) :207/:385(cc) :276-283(脚本路径) :390(版本/agent口径) :398(许可) 字数自报多处。
- **agents/**：agent-creator.md :102(<model-id>) :161(脚本路径) :173-175(残留) 缺model字段；plugin-validator.md :94 :56-65(unknown fields) :91-96(必填/颜色) :182-184(对话残留) :184("6 skills")；skill-reviewer.md :56-57(字段口径) :182-184(残留)。
- **commands/create-plugin.md**：:41(7vs8) :250-252(ok) :310(cc) :313(.crabcode-plugin误导) :324(调用形)。
- **skills/agent-development/**：SKILL.md :102-104/:341(<model-id>) :112(颜色) :285-286(命名空间) :372/:202(措辞) :386(死引用)；scripts/validate-agent.sh :131/:135(语法死) :151/:155(颜色) :109-111(example块矛盾)；examples+references 同类项。
- **skills/command-development/**：SKILL.md :119/:164/:169/:175-177(<model-id>) :420-424($IF) :625(manifest位置) :82vs:621(标注格式) :10vs结构(legacy口径)；frontmatter-reference.md :135/:141-193/:443/:460(<model-id>) ；README.md :154 :268(版本) 字数；testing-strategies.md :99-100(坏校验) :116(60vs80) :152(debug-logs)；plugin-features-reference.md :24(manifest位置) :217-219(空格断言) :453-456/:496-499($IF)；documentation-patterns.md :616 + 伪shell段；advanced-workflows.md :86-95($()) :460-463(${1:-}) + 伪shell段；marketplace-considerations.md :435(坏shell) :442/:870(/plugin update) :566-613/:774-812/:869-872(上游残留)；interactive-commands.md :593(yml) :670(出处) :775(.daisy) answers键形；examples/simple-commands.md :52/:287/:323/:465、plugin-commands.md :62(<model-id>) :490/:501-502(crabcode /cmd argv形⚠实证)。
- **skills/hook-development/**：SKILL.md :4/:17/:35/:212/:319/:641(AgentStop) :30/:321($TOOL_INPUT) :105(settings层级) :147-153(hookEventName缺) :252/:375(路径) :307-321(stdin表) :343-381(裸形) :419(matcher) :443/:457/:463(deny) :492(超时) :577-588(重启/cc) :635-645(9事件表) :694(空话)；advanced.md :22/:158 :85-111/:233-265($$) :124(config路径) :189(approve) :248(tool_result) :263(通道) :283/:332/:372(deny) :442-448(自相矛盾) :472(通道)；migration.md 整篇(D1) :66/:140/:222 :112/:119/:168 :243/:273 :282-316；patterns.md :17/:164 :268-298(flag矛盾) :306(.local.json) :328(deny)；scripts 三件+examples 两件(P1)。
- **skills/mcp-integration/**：SKILL.md :195-222(工具名) :228-230vs:406(连接时机) :491vs示例(type) :537(空话)；tool-usage.md 全篇工具名 :124/:152-155/:244-258/:351/:510；authentication.md :40vs server-types:176 :59-63(加密断言)；server-types.md :176 :382(Reconnect未证) :501vs:184(http)；examples 三个 json(P3)。
- **skills/plugin-settings/**：SKILL.md :107(ok) :124-135(必填矛盾→以运行时定) :201/:287/:311/:370-384/:543(重启) :320-322(ok) :333-334(.local.json) :380(cc) :422(ok) :427-468(swarm案例+ralph行号)；parsing-techniques.md :33等(sed口径) :119/:336(awk假断言) :128(不安全JSON→jq -n --arg) ；real-world-examples.md :1-96(swarm) :136-141/:151/:222-231(ralph失实) :280-282(enabled) :379-383(反模式矛盾)；examples/create-settings-command.md :61-62(键形) :80/:89(重启)；example-settings.md :51(swarm) :98-101(YAML矛盾) :126 :142-143 :155-156；scripts/validate-settings.sh :55 :100；read-settings-hook.sh(P1)。
- **skills/plugin-structure/**：SKILL.md :29等(legacy口径) :43(ok·被create-plugin违反) :91-98(缺skills字段) :128(name字段口径) :152-158(capabilities形) :186-192(SKILL格式) :230(AgentStop) :354(自矛盾句) :455(settings指名) :467(重启)；README.md :17/:90-91(字数) :99-100(stale hedge/死引用)；manifest-reference.md :42-47(默认值⚠) :102-106(string author⚠) :149-155(directory⚠) :182-186(SPDX表达式⚠) 缺skills字段 :354-393(合并/校验行为⚠——执行者对⚠项实证后决定保留或删)；component-patterns.md :111(嵌套两说) :340-348(file:引用矛盾段删) :472(ok)；examples 三个(capabilities形/name字段/references死链:421-423/K8S env默认值:155⚠)。
- **skills/skill-development/**：SKILL.md 双作用域frontmatter/字数三口径/:145vs:39-42(assets) :149 :202vs:212(措辞) :275-283(zip矛盾) :304/:311(字数假) :386 :590-601 :621-622；references/skill-creator-original.md 整删(D2)。
- **agent-sdk-dev**：README :139 :152-155 :166-171 :186-191 :208；commands/new-sdk-app.md :77-78 :83-87 :86-87 :98；agents 两 verifier :14/:28/:45(:51)。

## 7. 执行纪律（子窗/执行会话通用）

1. 起手 `git branch --show-current` 自报；确认在自己的分支。
2. 每改一个 `.sh` 当场 `bash -n`；每片完成实跑 §8；禁凭 diff 判「应该没问题」。
3. 文档里写任何运行时事实，先到 §1 锚点或主仓源码看一眼（尤其 ⚠ 项）；**不确定就保守表述，不编造**。
4. 修改不得引入品牌禁词（§0）；`<model-id>` 的替换值只能是 `inherit`/`best`/`planmode`/中性描述。
5. 遇到与本方案冲突的新事实：以代码为准，方案侧记一行偏差说明，不静默改道。

## 8. 验收命令（每片必跑；零断言配对照）

```bash
cd /d/CrabCode-Plugin
bun install
bun run validate                      # exit 0
bun run lint:brand                    # exit 0（全库）
bun test ./tests/                     # 全绿
# 改过的每个脚本：
bash -n <script>                      # exit 0
# 终态复算（P1-P6 完成后应全 0；正向对照防「grep 自身失效」）：
grep -rn "AgentStop" plugins/plugin-dev plugins/agent-sdk-dev | grep -v docs/legal   # 0
grep -rn "SubagentStop" plugins/plugin-dev | head -1                                  # ≥1（对照）
grep -rn "<model-id>" plugins/plugin-dev plugins/agent-sdk-dev                        # 0
grep -rn "inherit|best|planmode" plugins/plugin-dev | head -1                         # ≥1（对照）
grep -rn "crabcode-marketplace" plugins/plugin-dev                                    # 0
grep -rn "crabcode-plugins-official" plugins/plugin-dev | head -1                     # ≥1（对照）
grep -rnE '"decision"\s*:\s*"deny"' plugins/plugin-dev                                # 0
grep -rnE '\$TOOL_INPUT|\$TOOL_RESULT|\$USER_PROMPT' plugins/plugin-dev               # 0
grep -rn "mcp__plugin_" plugins/plugin-dev                                            # 0
grep -rn "multi-agent-swarm" plugins/plugin-dev                                       # 0
grep -rn "debug-logs" plugins/plugin-dev                                              # 0
grep -rn "AGENT_API_KEY" plugins/agent-sdk-dev                                        # 0
grep -rn "ACOSMI_API_KEY" plugins/agent-sdk-dev | head -1                             # ≥1（对照）
grep -rn 'answers\["' plugins/plugin-dev                                              # 0
# 版本三方一致：
grep -n '"version"' plugins/plugin-dev/.crabcode-plugin/plugin.json plugins/agent-sdk-dev/.crabcode-plugin/plugin.json
grep -n '"name": "plugin-dev"' -A 3 .crabcode-plugin/marketplace.json
# push 实证（显式 URL）：
git ls-remote https://github.com/acosmi/CrabCode-Plugin.git <branch>
```
