# CrabAccount 迁移实施执行日志

> 执行日期：2026-07-15
> 工作区：`/Users/fushihua/Desktop/CrabCode-Plugin`
> 下游：`/Users/fushihua/Desktop/CrabCode`
> 目标：依据 `docs/2026-07-15-crabaccount-插件迁移适配-实施方案存档.md`，完成独立审计、实施、验证与提交。

## 0. 执行约束与失败计数

- 主控独立执行 Git 操作与最终复验；未授权合并、删分支、回滚或 force-push。
- 同一问题最多连续尝试三次；达到三次即记录阻塞并停止。
- 当前失败计数：无。
- 所有架构、范围和依赖变化必须先在本日志记录论证；其他已批准范围内的实现直接推进。

## 1. 技能规范与分支保护

### 判断

- 本任务同时涉及仓库插件创建与两个技能设计，因此使用 `plugin-creator` 和 `skill-creator`。
- 先读取两项技能的完整 `SKILL.md` 及其直接要求的 manifest、安装更新和 `openai.yaml` 参考，再修改仓库。
- 基线分支存在一个未跟踪的实施方案文档。创建新分支会保留该文件原状，同时隔离后续提交。

### 命令与真实输出

```text
$ sed -n '1,240p' /Users/fushihua/.codex/skills/.system/plugin-creator/SKILL.md && sed -n '241,520p' /Users/fushihua/.codex/skills/.system/plugin-creator/SKILL.md
[exit 0；完整读取 plugin-creator/SKILL.md，共 2,760 个工具输出 token]

$ sed -n '1,260p' /Users/fushihua/.codex/skills/.system/skill-creator/SKILL.md && sed -n '261,620p' /Users/fushihua/.codex/skills/.system/skill-creator/SKILL.md
[exit 0；完整读取 skill-creator/SKILL.md，共 5,512 个工具输出 token]

$ git status --short --branch && git branch --show-current && git switch -c codex/crabaccount-migration
## codex/work-ui-metadata
?? "docs/2026-07-15-crabaccount-插件迁移适配-实施方案存档.md"
codex/work-ui-metadata
Switched to a new branch 'codex/crabaccount-migration'

$ wc -l docs/2026-07-15-crabaccount-插件迁移适配-实施方案存档.md
952 docs/2026-07-15-crabaccount-插件迁移适配-实施方案存档.md

$ test -f docs/audit/2026-06-23-execution-log.md ...
EXECUTION_LOG_MISSING

$ sed -n '1,260p' /Users/fushihua/.codex/skills/.system/plugin-creator/references/plugin-json-spec.md; sed -n '1,320p' /Users/fushihua/.codex/skills/.system/plugin-creator/references/installing-and-updating.md
[exit 0；完整读取两份参考；确认 repo/team marketplace、manifest 字段、cachebuster 与重装边界]

$ sed -n '1,260p' /Users/fushihua/.codex/skills/.system/skill-creator/references/openai_yaml.md
[exit 0；完整读取；确认 openai.yaml 字符串引用、短描述长度及 `$skill-name` 默认提示要求]

$ find .. -name AGENTS.md -print
[命令因父目录扫描超过 15 秒无输出，人工中止，exit 130；这不是实现失败，改用仓库内 `rg --files` 的有界扫描]
```

## 2. 第一性审计：事实源、根因、影响面与范围

### 已独立确认的第一性根因

1. 当前仓库没有 `plugins/crabaccount`，因此任务不是修补单点，而是把固定上游“面向某一服务的多脚本原型”适配为本仓可发现、可校验、可安全恢复的工作流插件。
2. 风险根因不是品牌字符串本身，而是上游原型把认证、URL、请求、批量行为和输出解释分散在多个脚本中；若只改名复制，会把密码暴露、非原子批量、写请求误重试和契约漂移一起迁入。
3. 本仓 FQN 来自 manifest name + skill 目录 basename；展示中文名不影响调用身份。因此稳定架构是一个插件、两个技能、一个公开 CLI，不能按上游脚本数量拆技能。
4. `capability-routing.md/json` 是静态路由与 CI 合同；办公技能只提供文件处理指导，不能被当作返回固定结构的 RPC。
5. 当前没有可销毁账本、真实凭据或安装态隔离环境。实服端点和 Marketplace 运行态不能伪造为已验收；实现必须对未验证写契约 fail closed，并以固定上游请求形状、合成 fixture 与 fake curl 验证客户端状态机。

### 影响面

- 新增 `plugins/crabaccount/**` 与 `tests/crabaccount/**`。
- 修改 `.crabcode-plugin/marketplace.json` 根版本和新增 workflow 条目。
- 修改 `tests/workflow-skill-presentation-completeness.test.ts` 的技能数量、调用身份 SHA、模型正文 SHA 和 Marketplace 版本锁。
- 新增本执行日志并将既有实施方案纳入提交。
- 不修改下游 `/Users/fushihua/Desktop/CrabCode`；只读核验其加载、替换、权限和验证行为。
- 不修改 `docs/capability-routing.json`：CrabAccount 是现有办公能力的消费者，不是 provider。

### 同类问题与架构偏差检查

- 检查现有 workflow 插件的 manifest/Marketplace/SKILL 写法，避免套用通用 Codex `.codex-plugin` schema；本仓真实目录是 `.crabcode-plugin`，Marketplace 也是本仓自定义扁平条目。
- 检查展示快照，确认新增技能必须更新锁值，不能删除测试或伪装成 capability tier。
- 检查品牌、引用、tool-scope 和 layout 校验器，确认法律目录允许来源名、办公 FQN 必须反引号包裹、写命令不得 always-allow。
- 检查固定上游提交，逐项建立 endpoint/payload 证据；未出现的删除、幂等键、分页和外部 ID 不实现。

### 架构/范围/依赖决策日志（实施前）

| 决策 | 论证 | 风险与复发条件 |
|---|---|---|
| 保留“一插件、两技能、一个 Bash 入口” | 最小化技能上下文与公共接口；共享安全逻辑集中，避免多脚本漂移 | 单入口变大时按私有 `lib/*.sh` 拆分，不新增公共入口 |
| 不引入 npm/Python/MCP/数据库依赖 | v0.1 能用 Bash + curl + jq 完成 API 适配与状态机；新增依赖会扩大安装和供应链面 | 若要求确定性本地 XLSX/PDF/完整 CSV 解析，必须重新立项并增加依赖审计 |
| CSV/TSV/XLS(X/M)/PDF 定位为“辅助抽取后导入” | 当前办公 provider/核心 FileRead 无法证明所有格式完整；Bash 近似 CSV 解析不可靠 | 只有新增经过 RFC 4180 测试的窄解析器，CSV 才可升级为端到端完整支持 |
| 写端点默认需要 `doctor` 兼容闸门 | 没有正式服务 OpenAPI/版本矩阵，固定上游只是观察证据 | 获取可销毁实服后补 endpoint probe；schema 漂移继续 fail closed |
| 不执行真实 Marketplace 安装/卸载和实服写入 | 会改变用户全局插件状态或真实账本，且缺少专用环境；不属于仓库内安全验证 | 提供明确 opt-in 验收步骤，不将其计入本次自动化通过项 |
| 不添加图标 | 方案明确图标可选；无已授权 CrabAccount 品牌素材，生成占位图会制造品牌资产决策 | 用户提供/批准图标后再加，并通过魔数、大小与路径校验 |

### 审计命令与真实输出

```text
$ { rg --files -g 'AGENTS.md' ...; } | sort -u
/Users/fushihua/Desktop/CrabCode/AGENTS.md

$ sed -n ... docs/2026-07-15-crabaccount-插件迁移适配-实施方案存档.md
[exit 0；分块完整读取 952 行；章节 0–14 均已核对]

$ rg -n '^## |^### ' docs/2026-07-15-crabaccount-插件迁移适配-实施方案存档.md
[exit 0；确认 15 个主章节、Phase 0–5、测试矩阵和 12 条完成定义]

$ sed -n '1,320p' /Users/fushihua/Desktop/CrabCode/AGENTS.md
# CrabCode 仓库根级指引（指针文件）
> **唯一真源 = `CLAUDE.md`（仓库根）。Agent 入这个仓库工作时首读那一份。**

$ rg --hidden --files -g '*marketplace*.json' ...
./docs/marketplace-entry-draft.json
./docs/huibao/window-d/marketplace-entries-window-d.json
./docs/audit/2026-05-19-window-e-marketplace-entries.json
./.crabcode-plugin/marketplace.json

$ wc -l /Users/fushihua/Desktop/CrabCode/CLAUDE.md
424 /Users/fushihua/Desktop/CrabCode/CLAUDE.md

$ jq ... .crabcode-plugin/marketplace.json; jq '.' .crabcode-plugin/plugin.json
[exit 0；确认本仓 Marketplace 为扁平条目，根版本 0.4.1；根 plugin name 为 crabcode-setup]

$ rg -n 'allowed-tools|skills|interface|...' src/policy/{manifestValidator,marketplaceValidator,presentationValidator}.ts
[exit 0；确认 manifest skills 可为具体目录数组、workflow 中文展示规则、版本同步及图标可选]
```

## 3. 固定上游、基线门禁与实施前证据

### 固定上游复验

```text
$ git clone --filter=blob:none https://github.com/QingHeYang/EasyAccounts-Skills.git /tmp/crabaccount-easyaccounts-skills-fcc9300
$ git -C /tmp/crabaccount-easyaccounts-skills-fcc9300 checkout fcc9300a070bd89a13c3d4b4df79a0274db17dd2
HEAD is now at fcc9300 feat: 初始化 EasyAccounts skill v0.2.0
fcc9300a070bd89a13c3d4b4df79a0274db17dd2

$ git clone --filter=blob:none https://github.com/QingHeYang/EasyAccounts.git /tmp/crabaccount-easyaccounts-49eabb7
$ git -C /tmp/crabaccount-easyaccounts-49eabb7 checkout 49eabb784ad718fb1efd4014f569b51948a2b628
HEAD is now at 49eabb7 docs(2.7.0): 补充镜像瘦身数据到 changelog
49eabb784ad718fb1efd4014f569b51948a2b628

$ rg -n 'ea_(get|post|put)|...' /tmp/crabaccount-easyaccounts-skills-fcc9300/scripts/*.sh
[exit 0；确认登录、版本、账户、分类、动作、年度统计、流水详情/查询/新增/更新、服务端导出端点]

$ shasum -a 256 /tmp/crabaccount-easyaccounts-skills-fcc9300/LICENSE
45bde3c1839a38b51335fe9c7217654c62015eebf1bb6b5e35562a0ed9764990  /tmp/crabaccount-easyaccounts-skills-fcc9300/LICENSE
```

确认的上游缺陷：密码可进 argv；Token 在 curl 参数；401 后统一重放读写；批量逐条调用但只分成功/失败；更新覆盖时生成新 createDate；自动追加旧品牌来源与备注。CrabAccount 只保留观察到的协议形状，安全与恢复层全部重写。

### 基线门禁

```text
$ bun run validate
$ bun run scripts/validate-all.ts
[refs]
WARNING plugins/crabfin-cn/fin-core/skills/audit-xls/SKILL.md: 正文命中「办公文档产出/电子表格」关键词(excel、电子表格)但无路由引导——请引用 `crabcode-office-suite:crabcode-spreadsheets` 路由段,或添加 <!-- capability-route: office-spreadsheets=none(理由) --> 显式豁免
[exit 0]

$ bun run typecheck
$ tsc --noEmit
[exit 0]

$ bun run build
Bundled 18 modules in 24ms
cli.js  32.0 KB  (entry point)
[exit 0]

$ bun test ./tests/
70 pass
0 fail
1402 expect() calls
Ran 70 tests across 8 files. [400.00ms]
```

### 脚手架偏离

- 未运行通用 `plugin-creator` 生成器：它生成 `.codex-plugin` 与个人 Marketplace，和本仓 `.crabcode-plugin` 扁平 Marketplace 合同不同。
- 未运行个人 `skill-creator/init_skill.py`：它会增加 `agents/openai.yaml` 等本仓未消费的结构。本次直接按本仓已验证的 SKILL frontmatter 与目录布局创建。
- 仍采用两项技能的命名、渐进披露、references 拆分和完成后验证原则。此偏离是仓库真源优先，不是跳过技能规范。

## 4. 实施记录与首轮验证

### 已实施

- 新建 `plugins/crabaccount`：manifest、Apache-2.0、README、法律通知、MIT-0 原文、schema、两技能、两个 references、单 CLI 与四个私有 Bash 库。
- Marketplace 根版本 `0.4.1 → 0.4.2`，追加 `crabaccount` workflow 条目。
- CLI 实现显式 `--data-dir`、0700/0600、原子写、符号链接拒绝、URL/TLS 策略、Token stdin curl config、隐藏登录、读重试/写不重试、2.7.x doctor 闸门、preview digest、非原子逐行 journal 和写后核对。
- 未添加图标、MCP、hooks、数据库、前端或办公解析器。

### 首轮真实输出

```text
$ chmod 755 plugins/crabaccount/scripts/crabaccount.sh ... && bash -n ... && <config smoke>
{"ok":true,"operation":"config.show","configured":false,"hasToken":false,"compatible":false}
{"ok":true,"operation":"config.set","baseUrl":"http://127.0.0.1:10669","username":"test","tokenInvalidated":true,"doctorRequired":true}
{"ok":true,"operation":"config.show","configured":true,"baseUrl":"http://127.0.0.1:10669","username":"test","hasToken":false,"compatible":false}
700 .../data
600 .../data/config.json
[exit 0]

$ bun run lint:manifest && bun run lint:marketplace && bun run lint:layout
[exit 0；无输出错误]

$ bun run lint:refs
WARNING plugins/crabfin-cn/fin-core/skills/audit-xls/SKILL.md: ...
lint:refs — 0 error(s), 1 warning(s)
[exit 0；与基线完全相同，CrabAccount 零新增]

$ bun run lint:brand && bun run lint:tool-scope
[exit 0；无输出错误]
```

### 下游可选 hooks 根因与范围变化论证

第一次按方案运行：

```text
$ crabcode plugin validate /Users/fushihua/Desktop/CrabCode-Plugin/plugins/crabaccount
error: unexpected argument 'validate' found
提示：未识别的 flag 可能是 TS 端 commander 定义但 Rust 启动器未 mirror。
解决：用 `--` 分隔后整段透传给 TS。
[exit 2]
```

按启动器提示改用等价透传命令：

```text
$ crabcode -- plugin validate /Users/fushihua/Desktop/CrabCode-Plugin/plugins/crabaccount
Validating plugin manifest: .../.crabcode-plugin/plugin.json
Validating hooks: .../hooks/hooks.json
✘ Found 1 error:
  ❯ file: Failed to read file: Plugin path rejected (path-missing): hooks config target cannot be canonicalized: .../hooks/hooks.json
✘ Validation failed
[进程错误地返回 exit 0；文本结果为失败]
```

第一性根因：`validatePluginContents()` 无条件调用 `validateHooksJson()`；后者只把原生 errno `ENOENT` 当作可选缺失，但 `resolveInternalPluginPath()` 已把缺失路径包装为 `PluginPathSecurityError(reason="path-missing")`。因此“hooks 可选”的注释和实现不一致。

裁决：不在 CrabAccount 添加空 hooks 规避。该 workaround 会让每个纯技能插件携带无业务价值组件，并在下游修复后留下垃圾结构。由于用户明确把下游 `/Users/fushihua/Desktop/CrabCode` 纳入背景，且下游工作区当前为干净 main，本次在下游独立 `codex/crabaccount-validator-optional-hooks` 分支做窄根因修复与专项回归；不改下游架构、协议或依赖。两个仓库分别提交，绝不合并 main。

### 并发工作区保护

实施中 `git status` 新出现未跟踪文件 `docs/audit/2026-07-15-crabcode-media-ops-原创与可信来源修复补全实施方案.md`。它不是本任务产物，推定来自共享工作区的其他任务；本任务不读取、不修改、不暂存、不提交该文件。

### 下游根因修复与实际启动器复验

下游改动只包含：`validateHooksJson()` 同时接受原生 `ENOENT` 与解析器包装后的 `PluginPathSecurityError(reason="path-missing")`，以及“无 hooks 的插件应通过内容校验”回归用例。其他 `PluginPathSecurityError`（越界、权限、符号链接等）继续失败，未放宽安全边界。

```text
$ bun run scripts/run-bun-test.ts tests/unit/plugin-realpath-containment.test.ts
77 pass
0 fail
149 expect() calls
Ran 77 tests across 2 files. [88.00ms]
[exit 0；测试运行器同时发现主工作树与既有临时工作树中的同名文件，新增用例仅在主工作树，结果仍全部通过]

$ bun run typecheck
$ tsc --noEmit
[exit 0]

$ git diff -- src/utils/plugins/validatePlugin.ts tests/unit/plugin-realpath-containment.test.ts
[仅 1 个异常分类分支与 1 个 9 行回归用例]

$ bun run build:ts
$ bun scripts/build-ts.ts
Built dist/index.js (1 output(s), version 1.0.15, build-id 1.0.15+f05292a3948d)

$ crabcode -- plugin validate /Users/fushihua/Desktop/CrabCode-Plugin/plugins/crabaccount
Validating plugin manifest: /Users/fushihua/Desktop/CrabCode-Plugin/plugins/crabaccount/.crabcode-plugin/plugin.json

✔ Validation passed
[组合命令 exit 0]
```

### 客户端静态复核发现并修正

- HTTP IPv6 loopback 解析原表达式会拼出多余右方括号，改为从 authority 截取首个 `]`，使 `[::1]` 与 `[::1]:port` 均按本机地址处理。
- pending 文件装载后未回填 `CA_PREVIEW_DIGEST`，journal 又错误地从 binding 读取不存在的字段，导致 apply 日志丢摘要；改为从已复算通过的文件名摘要显式写入 journal。
- update 无法区分“未提供 `--note`”和“明确清空备注”；新增 `note_set` 状态，只在参数缺席时回填原备注。
- canonical import 的 jq 过滤器错误使用 `$.defaults.currency`；改为先绑定 `$document`，再在 `all()` 的逐行上下文中引用批次默认币种。
- 预览金额汇总的 jq 运算优先级与格式不稳定；改为整数分计算，并固定输出两位小数。

```text
$ bash -n plugins/crabaccount/scripts/crabaccount.sh plugins/crabaccount/scripts/lib/*.sh
[exit 0]

$ jq -n '<cents/money smoke: 1, 1.2, 1.23, 123.45>'
["1.00","1.20","1.23","123.45"]
[exit 0]
```

### 第二轮敌意静态复核：合同、恢复与权限

在全量门禁前逐函数复核又发现并修正以下根因：

- import operations 保留原账单行号，但 apply 用 operations 数组位置更新 journal；首行被 skip 时会找不到 journal row，且旧实现静默不报。改为 position 只负责取数组元素，row 更新使用 operation 自带 index，并在 journal 更新前验证 index 确实存在。
- canonical CLI 校验只覆盖写安全子集，却在技能中声称重验 schema。继续保持零依赖，使用 jq 补齐根、batch、defaults、transaction/source/ledger 的 exact keys、类型、长度、枚举、来源定位、ISO 时间、币种、置信、重复决策与 mapping 约束，并用系统 date 再验真实日历日期。
- journal 缺少结果未知时远端核对所需字段。新增不含备注/商户/原文的最小 reconcile（账户/分类/动作 ID、金额、日期）、canonical schema 版本和 fingerprint 版本；一旦发生提交尝试即删除 pending payload，恢复依赖最小 journal 与用户自己的 canonical 文件。
- 关键 chmod/mkdir/rm 返回值此前有少数未检查。全部改为 fail closed；并拒绝 pending/journal/tmp 子目录被替换为符号链接。
- doctor 从“只看 data 是数组”收紧到固定上游实际字段形状：release、账户 id/name、分类树 id/tname/childrenTypes、动作 id/hname/handle。
- 文档中的 `possible_duplicate` 与 schema 枚举 `possible` 漂移，统一以机器 schema 的 `possible` 为真源。

合成 fixture 特意调整为“第 0 行 confirmed/skip，第 1 行 import”，写入后真实 journal 为 index 1、status success，证明非连续来源索引已修复。

```text
$ bash -n plugins/crabaccount/scripts/crabaccount.sh plugins/crabaccount/scripts/lib/*.sh tests/crabaccount/fixtures/fake-curl.sh
$ bun test tests/crabaccount/client.test.ts
6 pass
0 fail
65 expect() calls
Ran 6 tests across 1 file. [5.91s]
[组合命令 exit 0]
```

### lint、类型、shellcheck

```text
$ bun run lint:manifest && bun run lint:marketplace && bun run lint:layout && bun run lint:refs && bun run lint:brand && bun run lint:tool-scope
WARNING plugins/crabfin-cn/fin-core/skills/audit-xls/SKILL.md: ...
lint:refs — 0 error(s), 1 warning(s)
[exit 0；唯一 warning 与基线相同]

$ bun run typecheck
$ tsc --noEmit
[exit 0]

$ shellcheck plugins/crabaccount/scripts/crabaccount.sh plugins/crabaccount/scripts/lib/*.sh tests/crabaccount/fixtures/fake-curl.sh
SC1007: CDPATH= cd 写法
SC1091: 动态 source 未跟随
SC2034: 分文件分析误报及真实未使用 path_part/base_url
SC1003: token pattern 引号提示
[exit 1；shellcheck 问题失败计数 1/3]
```

处理：入口增加 `source-path=SCRIPTDIR` 并用 `shellcheck -x` 从唯一公开脚本递归分析；删除未使用 `path_part` 和 `ca_save_config` 冗余参数；把等价 token case pattern 改成无歧义转义；`CDPATH` 改为子 shell 内 unset。没有用全局 disable 掩盖告警。

```text
$ bash -n ...
$ shellcheck -x plugins/crabaccount/scripts/crabaccount.sh tests/crabaccount/fixtures/fake-curl.sh
[exit 0；无输出]
```

### 插件仓全量门禁（中间全量轮次）

```text
$ bun test ./tests/
76 pass
0 fail
1476 expect() calls
Ran 76 tests across 9 files. [10.07s]

$ bun run build
Bundled 18 modules in 96ms
cli.js  32.0 KB (entry point)

$ bun run validate
[refs]
WARNING plugins/crabfin-cn/fin-core/skills/audit-xls/SKILL.md: ...
[组合命令 exit 0]
```

说明：该轮之后仍有 pending 最小化、chmod 返回值检查和存档方案事实修订，因此提交前必须再跑最终轮；本节不冒充最终 HEAD 证据。

### 下游全量回归

首次 `bun run typecheck && bun run test` 的测试输出超过工具回传上限；可见部分均为 pass，但最终退出码被截断，因此没有据此判定成功。进程随后自然结束。为取得可审计结果，保留 `pipefail` 再跑全量并只回传末尾摘要：

```text
$ bun run typecheck
$ tsc --noEmit
[exit 0]

$ set -o pipefail
$ bun run test 2>&1 | tail -n 60
Built dist/index.js (1 output(s), version 1.0.15, build-id 1.0.15+f05292a3948d)
3 tests skipped
13 tests todo
5246 pass
0 fail
17441 expect() calls
Ran 5262 tests across 475 files. [79.18s]
[exit 0]
```

### 下游 inline 发现和变量替换

```text
$ crabcode -- --bare --plugin-dir /Users/fushihua/Desktop/CrabCode-Plugin/plugins/crabaccount plugin list
Session-only plugins (--plugin-dir):
  ❯ crabaccount@inline
    Version: 0.1.0
    Path: /Users/fushihua/Desktop/CrabCode-Plugin/plugins/crabaccount
    Status: ✔ loaded
[exit 0]
```

随后在临时 `CRABCODE_CONFIG_DIR` 中直接调用下游真实 skill loader。第一次直接静态 import 因开发态未注入构建宏 `MACRO` 报 `ReferenceError`（探针失败计数 1/3）；第二次先注入与构建等价的测试宏再 dynamic import，通过：

```text
[
  {"name":"crabaccount:bookkeeping", "skillRoot":".../skills/bookkeeping", "allowedTools":["Read","Skill","Bash(bash \"/Users/.../crabaccount.sh\" --data-dir \"<临时配置>/plugins/data/crabaccount-inline\" doctor:*)", "..."]},
  {"name":"crabaccount:statement-import", "skillRoot":".../skills/statement-import", "allowedTools":["Read","Write","Skill","Bash(bash \"/Users/.../crabaccount.sh\" --data-dir \"<临时配置>/plugins/data/crabaccount-inline\" doctor:*)", "..."]}
]
[exit 0；恰好两个 FQN；ROOT/DATA 已替换为绝对路径；写入/apply 命令不在 always-allow 列表]
```

### 隔离 Marketplace 安装探针与停止裁决

不能把官方市场在本地改名后冒充安装态。所有探针都使用随后删除的临时 `CRABCODE_CONFIG_DIR`，未修改用户真实安装状态。

前两次经原生 launcher 透传：

```text
$ crabcode -- plugin marketplace add /Users/fushihua/Desktop/CrabCode-Plugin
Adding marketplace...
[launcher exit 0]
$ crabcode -- plugin marketplace list --json
[]
[exit 0；未登记]

$ crabcode -- plugin marketplace add ../CrabCode-Plugin
Adding marketplace...
$ crabcode -- plugin marketplace list --json
[]
ADD_RC=0 LIST_RC=0
[仍未登记；同一安装探针失败计数 2/3]
```

第三次绕过 native launcher，直接使用刚由全量测试构建的 TS CLI，得到被 launcher 吞掉的真实原因：

```text
$ bun dist/index.js plugin marketplace add ../CrabCode-Plugin
Adding marketplace...
✘ Failed to add marketplace: The name 'crabcode-plugins-official' is reserved for official Acosmi marketplaces and can only be used with GitHub sources from the 'acosmi' organization.
$ bun dist/index.js plugin marketplace list --json
[]
ADD_RC=1 LIST_RC=0
[同一安装探针失败计数 3/3；按要求停止]
```

裁决：这是官方市场来源保护按设计拒绝本地路径，不是 CrabAccount manifest/entry 失败；真实安装态必须等提交发布到 `acosmi` 官方来源后验收。不得为测试改市场名、绕过 source policy 或污染用户市场。另有下游 native launcher 风险：透传子命令错误可能被包装成 exit 0；复发条件是任一 forwarded TS 子命令失败。当前验证 workaround 是同时检查文本，必要时直接运行已构建 `dist/index.js`；该 workaround 只用于验证，不能作为修复 launcher 的替代。本任务不继续扩大到启动器退出码架构。

未运行专用实服测试：环境未提供 `CRABACCOUNT_TEST_BASE_URL`，且禁止用生产账本代替。所有自动测试均为 fake curl，真实账本写请求为零。

### 补记：首轮离线客户端回归与原子写根因修复

新增 `tests/crabaccount/client.test.ts`、规范导入 fixture 和假 curl。测试完整执行真实 CLI，但所有服务响应、传输失败和请求计数均来自临时目录，不访问真实网络、不读取或修改真实账本。

第一次执行：

```text
$ bun test tests/crabaccount/client.test.ts
5 pass
1 fail
59 expect() calls
失败：symlinkAttempt 预期 exit 1，实际 exit 0
[exit 1；同一问题失败计数 1/3]
```

第一性根因不是测试断言：`jq ... | ca_atomic_write` 使写函数运行在 Bash 管道子 shell；符号链接拒绝虽然输出错误并让子 shell 失败，但外层函数在未启用 `errexit` 时继续执行并最终返回 0。影响面包括 config、token、compatibility、pending、journal 创建和 journal 更新。统一改成“先检查 JSON 序列化结果，再通过 here-string 在当前 shell 调用 `ca_atomic_write`”，没有用 `set -e` 这种会扩大行为面的 workaround。

修复后：

```text
$ bash -n plugins/crabaccount/scripts/crabaccount.sh plugins/crabaccount/scripts/lib/*.sh tests/crabaccount/fixtures/fake-curl.sh
$ bun test tests/crabaccount/client.test.ts
6 pass
0 fail
61 expect() calls
Ran 6 tests across 1 file. [3.27s]
[组合命令 exit 0]
```

覆盖结果：URL/TLS 与 IPv6 loopback、0700/0600、符号链接拒绝、密码和 Token 不进入 curl argv、doctor 2.7.x 闸门、预览零写、摘要篡改拒绝、成功写后核对、成功预览不可重放、写传输错误只发一次并记 `commit_unknown`、未知提交后二次 apply 被阻止、明确清空备注、规范导入金额汇总与重复决策/币种拒绝。

### 补记：首次工作流稳定快照更新

新增两个 workflow skills 后，按现有测试同一规范重算调用身份与去除展示字段后的模型内容哈希，不手填猜测：

```text
$ bun -e '<读取 Marketplace/manifest/SKILL 并按测试算法重算>'
{
  "count": 315,
  "invocationSetSha256": "f7b0838eba63cdf4c8e37e00a86c91185d3af4d98a3bdb816d406477e9e036af",
  "modelContentSha256": "f59e29824fb45926d00f7d8a785a3399aec8853acaafd8d2beec489d49031c5e",
  "marketplaceVersion": "0.4.2"
}
[exit 0]
```

第二轮复核把技能正文中的 `possible_duplicate` 校正为机器 schema 真源 `possible`，因此 invocation 集合不变、模型正文哈希按同一算法再次重算。最终待提交快照为：

```text
count: 315
invocationSetSha256: f7b0838eba63cdf4c8e37e00a86c91185d3af4d98a3bdb816d406477e9e036af
modelContentSha256: 95aedfcb1b63d12437277394ddc4aef1caf54c2b19359069a1068689c0f63c2c
marketplaceVersion: 0.4.2
[exit 0]
```

## 5. 提交前最终门禁（冻结实现后）

以下命令在 pending 最小化、权限返回值检查、方案事实修订全部完成后运行，是最终候选内容的验证证据：

```text
$ bash -n plugins/crabaccount/scripts/crabaccount.sh plugins/crabaccount/scripts/lib/*.sh tests/crabaccount/fixtures/fake-curl.sh
$ shellcheck -x plugins/crabaccount/scripts/crabaccount.sh tests/crabaccount/fixtures/fake-curl.sh
$ jq -e . .crabcode-plugin/marketplace.json plugins/crabaccount/.crabcode-plugin/plugin.json plugins/crabaccount/schemas/import-batch.schema.json tests/crabaccount/fixtures/import-batch.json
[均无输出错误]

$ bun run validate
[refs]
WARNING plugins/crabfin-cn/fin-core/skills/audit-xls/SKILL.md: ...
[仅基线 warning]

$ bun run typecheck
$ tsc --noEmit

$ bun test ./tests/
76 pass
0 fail
1476 expect() calls
Ran 76 tests across 9 files. [5.72s]

$ bun run build
Bundled 18 modules in 5ms
cli.js  32.0 KB (entry point)

$ git diff --check
[无输出]
[整组 exit 0]

$ crabcode -- plugin validate /Users/fushihua/Desktop/CrabCode-Plugin/plugins/crabaccount
Validating plugin manifest: /Users/fushihua/Desktop/CrabCode-Plugin/plugins/crabaccount/.crabcode-plugin/plugin.json

✔ Validation passed
[exit 0]
```

## 6. 冻结后敌意复核补丁

对“HTTP 只自动允许 loopback”做攻击者视角复核时发现：shell glob `127.*` 也匹配 `127.example.com`，原 IPv6 authority 截取还会忽略 `]` 后的非法域名后缀。这会在 DNS 可解析时绕过 insecure HTTP 默认拒绝，属于必须在提交前修复的传输策略根因。

修复：HTTP authority 明确拆分 bracket host、suffix 和端口；端口必须为 1–65535；127/8 只接受 `127.<0-255>.<0-255>.<0-255>` 数字段；`localhost` 与 `[::1]` 精确匹配。显式 `CRABACCOUNT_ALLOW_INSECURE_HTTP=1` 仍保留给用户主动选择的公网 HTTP。

```text
$ bash -n plugins/crabaccount/scripts/crabaccount.sh plugins/crabaccount/scripts/lib/*.sh
$ shellcheck -x plugins/crabaccount/scripts/crabaccount.sh tests/crabaccount/fixtures/fake-curl.sh
$ bun test tests/crabaccount/client.test.ts
6 pass
0 fail
69 expect() calls
Ran 6 tests across 1 file. [5.23s]
[组合命令 exit 0]
```

新增回归明确证明 `http://127.example.com` 返回 `INSECURE_HTTP_BLOCKED`，`http://[::1].example` 返回 `VALIDATION_ERROR`，合法 `http://[::1]:10669` 仍通过。上一节全量门禁已被此补丁后续轮次取代，不作为最终 HEAD 证据。

## 7. 最终 HEAD 候选门禁与运行时选择复核

```text
$ bash -n ...
$ shellcheck -x ...
$ jq -e . ...
$ bun run validate
[仅同一基线 refs warning]
$ bun run typecheck
$ bun test ./tests/
76 pass
0 fail
1480 expect() calls
Ran 76 tests across 9 files. [7.19s]
$ bun run build
Bundled 18 modules in 2ms
cli.js  32.0 KB (entry point)
$ git diff --check
[无输出]
[上述仓内门禁全部成功]
```

同一组合命令末尾从插件仓 cwd 调用 `crabcode -- plugin validate` 时，launcher 选择了全局旧 TS 运行时，文本再次误报缺少 hooks，且仍返回 0。该输出没有被当作通过：

```text
Validating hooks: .../plugins/crabaccount/hooks/hooks.json
✘ PluginPathSecurityError(path-missing)
✘ Validation failed
[launcher 错误返回 exit 0]
```

从用户明确指定的下游源码仓 `/Users/fushihua/Desktop/CrabCode` 运行刚由全量套件构建的实际产物，并在同一 cwd 复验 launcher，均通过：

```text
$ bun dist/index.js plugin validate /Users/fushihua/Desktop/CrabCode-Plugin/plugins/crabaccount
Validating plugin manifest: .../.crabcode-plugin/plugin.json
✔ Validation passed

$ crabcode -- plugin validate /Users/fushihua/Desktop/CrabCode-Plugin/plugins/crabaccount
Validating plugin manifest: .../.crabcode-plugin/plugin.json
✔ Validation passed
[组合命令 exit 0]
```

结论：下游源码修复有效；全局已安装 CrabCode 尚未包含本分支修复，工作目录会影响当前 launcher 选用的运行时。复发条件是从下游源码仓之外用旧安装态校验无 hooks 插件。发布/合并前的权威口径是下游分支构建产物和 5246 项下游回归；用户决定合并后，全局安装态需按正常发布/更新流程刷新。本任务不擅自更新全局安装。

## 8. 下游修复的敌意安全加固与最终回归

提交前复核 `path-missing` 分类时发现：mustExist 路径的 dangling symlink 也可能先表现为 `PluginPathSecurityError(path-missing)`。若直接把该 reason 当作“可选 hooks 不存在”，validator 会错误放过存在但断链的 symlink，与 `pluginPathSecurity.ts` 的明确安全注释冲突。

最终根因修复不是宽泛放行：收到 `path-missing` 后，用同一 resolver 以 `mustExist:false` 把路径作为创建目标再解析一次。只有最深既有祖先可规范化且仍在插件根内时，才认定为安全缺失；dangling/cyclic symlink、越界祖先和不可解析现有节点继续失败。新增一正一反两个回归：真正无 hooks 通过，optional hooks 位置的 dangling symlink 失败。

```text
$ bun run scripts/run-bun-test.ts tests/unit/plugin-realpath-containment.test.ts
78 pass
0 fail
150 expect() calls
Ran 78 tests across 2 files. [2.40s]

$ bun run typecheck
$ tsc --noEmit

$ bun run build:ts
Built dist/index.js (1 output(s), version 1.0.15, build-id 1.0.15+f05292a3948d)

$ bun dist/index.js plugin validate /Users/fushihua/Desktop/CrabCode-Plugin/plugins/crabaccount
✔ Validation passed
[组合命令 exit 0]

$ set -o pipefail
$ bun run test 2>&1 | tail -n 60
5247 pass
3 skip
13 todo
0 fail
17442 expect() calls
Ran 5263 tests across 475 files. [80.60s]
[exit 0]
```

最终下游 diff 仍只有 `validateHooksJson` 的可选缺失安全确认逻辑与两个相邻回归用例，无依赖、协议、CLI 或安装架构变化。

下游提交完成：

```text
$ git commit -m "fix(plugin): accept safely missing optional hooks"
[codex/crabaccount-validator-optional-hooks fea30c131] fix(plugin): accept safely missing optional hooks
2 files changed, 43 insertions(+), 2 deletions(-)

$ git status --short
[无输出；下游任务分支干净]
```
