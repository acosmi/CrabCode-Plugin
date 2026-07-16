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

## 9. 主仓交付提交

```text
$ git commit -m "feat: add CrabAccount workflow plugin"
[codex/crabaccount-migration f8e1ca6] feat: add CrabAccount workflow plugin
22 files changed, 4509 insertions(+), 6 deletions(-)

$ git status --short
?? docs/audit/2026-07-15-crabcode-media-ops-原创与可信来源修复补全实施方案.md
```

`git diff HEAD -- <全部 CrabAccount 任务路径>` 无输出，证明实施方案、执行日志、Marketplace、插件、测试与快照均已进入 `f8e1ca6`。唯一剩余未跟踪文件仍是共享工作区中不属于本任务的 media-ops 方案，继续不暂存、不提交。本段作为审计闭环使用独立 docs follow-up 提交；其最终 SHA 在任务交付信息中报告，避免提交对象自引用。

## 10. CrabCode Media Ops 原创、可信来源与 HTML 主交付修复（2026-07-15）

### 任务边界与分支保护

用户授权本任务依据 `docs/audit/2026-07-15-crabcode-media-ops-原创与可信来源修复补全实施方案.md` 自主完成审计、实施、验证和提交，但明确禁止合并 main、删除分支、回滚和 force-push。主控只在当前仓库任务分支内工作；subagent 仅做只读独立审计，禁止文件修改和 Git，所有实现、复验与 Git 操作均由主控完成。

修改前真实基线：

```text
$ git status --short --branch && git branch --show-current && git rev-parse HEAD
## codex/crabaccount-migration
?? docs/audit/2026-07-15-crabcode-media-ops-原创与可信来源修复补全实施方案.md
codex/crabaccount-migration
3afa5ae55fbe991f60c78aeda6b6763e95c8501b
```

裁决：未跟踪的 media-ops 方案正是本任务指定背景文档，必须保留并纳入本任务；原工作树没有其他未提交改动。先从当前 HEAD 创建独立任务分支，既不移动原分支，也不修改或清理已有提交。

```text
$ git branch --list 'codex/media-ops-integrity-html' && git switch -c codex/media-ops-integrity-html && git status --short --branch
Switched to a new branch 'codex/media-ops-integrity-html'
## codex/media-ops-integrity-html
?? docs/audit/2026-07-15-crabcode-media-ops-原创与可信来源修复补全实施方案.md
[exit 0]
```

按现有本地插件更新任务触发 `plugin-creator` 技能，完整读取其 `SKILL.md` 与 `references/installing-and-updating.md`。适用约束为：不得手改 Marketplace；完成插件变更后用技能脚本更新单一 cachebuster、校验插件，并仅在确认 Marketplace 来源后执行本地重装。是否实际重装需在实现完成后依据当前 Marketplace 和 CLI 能力独立验证，不能预设。

### 审计读取命令与真实输出基线

```text
$ wc -l docs/audit/2026-07-15-crabcode-media-ops-原创与可信来源修复补全实施方案.md docs/audit/2026-06-23-execution-log.md
1185 docs/audit/2026-07-15-crabcode-media-ops-原创与可信来源修复补全实施方案.md
660 docs/audit/2026-06-23-execution-log.md
1845 total

$ cat plugins/crabcode-media-ops/package.json
name=crabcode-media-ops-mcp, version=0.3.1
scripts=start/typecheck/test/build/validate
dependencies=@modelcontextprotocol/sdk ^1.29.0, zod ^3.23.8

$ cat plugins/crabcode-media-ops/.codex-plugin/plugin.json
name=crabcode-media-ops, version=0.3.1
[exit 0]
```

背景方案标记目标版本为 0.4.0，共 1185 行；必须继续逐段独立复核，不能把方案中的判断直接当作已证事实。

### 修改前专项基线与可复现缺陷

主控完整读取方案、核心 Zod/JSON Schema、storage、server、content/readiness/approval/package/preview/renderer、相关技能/agent/command、评测和测试。方案中的三个路径需要纠正：`editorial/commands/*`、`editorial/agents/*`、`editorial/references/humanize-rules.md` 实际分别位于插件根的 `commands/*`、`agents/*`、`references/humanize-rules.md`；本任务不为了迎合文档路径迁移运行时目录，而修改真实加载路径。

未改业务代码时的专项门禁：

```text
$ bun run validate
validate-media-plugin: 9 skills, 5 schemas, versions aligned at 0.3.1

$ bun run typecheck
$ tsc --noEmit
[exit 0]

$ bun test
51 pass
0 fail
154 expect() calls
Ran 51 tests across 14 files. [76.00ms]

$ bun run build
Bundled 230 modules in 17ms
server.js  0.75 MB (entry point)
[以上全部 exit 0]
```

该“全绿”基线仍可稳定复现核心绕过。主控直接调用当前导出函数得到：

```json
{
  "jumped": {"success": true, "status": "ok", "data": {"stage": "drafted", "revision": 1}},
  "selfReportedReady": {"status": "ok", "ready": true},
  "renderer": {"h1Count": 2, "hasJavascript": true},
  "emptySearch": {"status": "ok", "success": true, "count": 0, "warnings": ["unknown source: missing-source"]}
}
```

当前 Python 扫描器的同义轻改失败样本：

```text
$ python3 -c '<导入 originality_scan；比较同一论证顺序的参考文与同义改写稿>'
{'referenceShingles': 93, 'draftShingles': 93, 'matchCount': 0, 'sameArgumentOrder': True}
[exit 0]
```

结论：根因不是单个模型“偶尔偷懒”，而是 generic `content.save` 同时接受阶段和全部门禁结论、readiness 信任调用者自报、研究失败仍返回 ok、扫描结果不与正文/参考哈希绑定、审批发生在最终交付物和素材冻结之前。

独立审计又确认两个同类 P0：

1. `storage.ts` 遇到 malformed JSONL 会静默跳过，最新 revoke 或 revision 损坏时可能回退到旧 approved/旧稿；读取也不重算 `contentHash`。
2. asset manifest 只绑定路径、角色和调用方声明的权利状态；审批后替换同一路径字节，package 会复制替换后的文件，形成 TOCTOU。

### 架构、范围与依赖裁决（实施前）

以下变化影响数据契约或依赖，先记录再施工：

1. **状态拆分而非把所有状态塞进 `ContentManifest.stage`。** 保留并收紧 `intake → researched → drafted → reviewed` 内容阶段；研究、原创扫描、交付验证、审批和发布继续使用独立记录。首次 revision 必须是 intake，只允许同阶段修订或单步前进。
2. **新增 schema v2，同时只读兼容 v1。** 新记录写 `schemaVersion: 2`；旧 0.3.x JSONL 通过兼容解析读取，但不能在缺少 v2 证据时进入新审批/打包。历史 append-only 文件不原地改写。
3. **拆分哈希语义。** `contentHash` 继续表示完整 revision；新增 `articleDocHash`、`researchBundleHash`、`originalitySubjectHash`、asset SHA-256、HTML/Markdown artifact hash 和 `renderManifestHash`，分别驱动失效矩阵。
4. **参考原文与写作者上下文隔离。** reference 工具保存原文及哈希，只向普通调用返回元数据；fresh-context writer 只接收结构化 research packet 和 do-not-copy 清单，不带原始附件、路径或全文。最终人味编辑必须先于原创扫描，避免“扫描后改稿”自相矛盾。
5. **联网由宿主受控浏览能力执行，不在 MCP 内新增任意 URL 抓取器。** `WebSearch/WebFetch` 负责打开网页；确定性工具保存最终 URL、访问状态、时间、来源层级、独立组、支持片段、局限、反证和哈希，并做完整性/独立性门禁。原因是当前 config JSON feed 已无私网、重定向、超时、大小和 MIME 防护；直接把 MCP 扩成抓取器会新增 SSRF 与资源耗尽面。残余边界：工具能证明记录完整和版本绑定，不能单独证明自然语言片段真的支持主张，因此仍要求独立 fact reviewer，且文案不得宣称“机器已自动判真”。
6. **运行时保留 JSONL，但改为 fail-closed 和哈希重算。** 本轮不迁移 SQLite，避免在内容/渲染根因修复中同时更换持久化后端；会增加严格行解析、记录 schema 校验、内容哈希重算、进程内串行化、候选物冻结和原子发布包 rename。风险与复发条件：多个 MCP 进程并发写同一数据目录或拥有本地文件完全改写权限的攻击者仍不在该机制的强一致/防篡改保证内；若 Gate B 开启多进程或远端写操作，必须迁移事务数据库并接入宿主身份/签名。
7. **HTML 使用最小 unified AST 依赖栈。** 采用 `unified`、`remark-parse`、`remark-stringify`、`remark-gfm`、`remark-rehype`、`rehype-sanitize`、`rehype-stringify`；不引入 `rehype-raw`、Juice、DOM/jsdom 或 sanitize-html。微信档案先由受信任常量直接生成允许的行内样式，避免引入 CSS cascade/远程资源能力。
8. **浏览器级验证属于 CI/发布评测，不在每次 MCP runtime verify 中启动。** runtime 负责 AST、协议、资产、白底 token、语义 parity 和字节哈希；固定浏览器的多视口、暗色偏好、打印和可访问性检查在发布门禁单独运行并记日志。
9. **版本先落 `0.4.0-rc1`。** 正式 `0.4.0` 需在真实安装目录和真实微信草稿环境完成额外渠道回归后由用户决定，不把工作区通过冒充正式发布。

依赖候选通过 npm registry 读取到的真实版本/许可证：

```text
unified 11.0.5 MIT
remark-parse 11.0.0 MIT
remark-stringify 11.0.0 MIT
remark-gfm 4.0.1 MIT
remark-rehype 11.1.2 MIT
rehype-sanitize 6.0.0 MIT
rehype-stringify 10.0.1 MIT
```

`bun audit --production` 在主控环境没有返回漏洞清单，而是：

```text
UNKNOWN_CERTIFICATE_VERIFICATION_ERROR: audit request failed
```

因此该命令不能被记录为安全通过。独立审计报告锁内 Hono 4.12.23 存在已修复于 4.12.25 的公开 advisory；后续会通过锁文件更新、已安装版本核对和官方 advisory 复验闭环。相同审计命令若仍受证书阻塞，必须把这一环境限制保留在最终日志，不得伪造零漏洞。

### `plugin-creator` 适配偏离

技能提供的 cachebuster 与 validator 脚本硬编码 `.codex-plugin/plugin.json`；本插件真实合同是 `.crabcode-plugin/plugin.json`，Marketplace 也是仓库级 `.crabcode-plugin/marketplace.json`。主控完整读取脚本后确认直接运行必然报 missing manifest，且脚本只更新单一 manifest，会破坏本仓 package/runtime/Marketplace 全版本一致性。

裁决：不制造伪 `.codex-plugin` 目录，也不运行不兼容脚本。遵循技能的“单一 cachebuster、禁止累加、必须验证和重装”原则，但使用本仓 `validate-media-plugin.ts` 与根校验器协调更新真实版本源；Marketplace 只作与插件版本同步的窄改动，不改变条目结构。该偏离是插件合同不兼容，不是跳过验证。

审计读取时有一次 cwd 组合错误：先 `cd plugins/crabcode-media-ops` 后仍使用 `plugins/crabcode-media-ops/...` 相对路径，三个 `sed/find` 返回 `No such file or directory`。立即在仓库根以正确路径复读成功；未修改文件，不计为产品失败，也未重复三次。

### 新领域层接入后的首次类型检查

在领域模型、存储校验、ArticleDoc/渲染器以及研究/原创工具的第一批变更落盘后执行：

```text
$ bun run typecheck
$ tsc --noEmit
src/rendering/article-doc.ts(138,17): error TS2345: Argument of type 'RootContent' is not assignable to parameter of type 'ArticleNode'.
src/storage.ts(158,18): error TS2352: Conversion of type ... may be a mistake ...
src/tools/content.ts: 3 errors（旧 content.save 仍引用已删除的 OriginalityReviewSchema，并与 v2 类型不兼容）
src/tools/package.ts: 1 error（旧 package 仍读取 v1 originalityReview）
src/tools/readiness.ts: 4 errors（旧 readiness 仍使用 v1 sourceUrl/originalityReview）
[exit 2]
```

判断：前两项是新代码的窄类型问题，直接修正；后三组是预期中的合同迁移信号，不能用兼容字段把旧的调用方自报门禁重新塞回 v2，而应按既定架构重写 content/readiness/package。此为同一次协调迁移的中间状态，不是假定测试通过。

### 既有可配置 feed 的边界补充裁决

实现中复核到 `src/sources/index.ts` 早已允许 `sources.config.json` 提供任意 URL，且默认跟随重定向、无 allowlist、无超时/响应大小/MIME 限制。这不是本轮新增 fetcher，但与前述“联网由宿主受控浏览、MCP 不成为任意 URL 抓取器”的架构裁决冲突，也构成同类 SSRF/资源耗尽面。

实施裁决：不删除既有扩展点，但将自定义 JSON feed 改为默认禁用；只有 `https` 且 hostname 被显式列入 `MEDIAOPS_FEED_HOST_ALLOWLIST` 才注册，禁止重定向，增加 10 秒超时、2 MiB 上限与 JSON MIME 校验。内置 Hacker News 仍是固定公开 HTTPS endpoint，同样增加超时/大小/MIME门禁。该变更可能让旧的未配置 allowlist feed 从“尝试抓取”变为带警告的不可用，这是有意的安全收紧；趋势 feed 始终只能发现线索，不能替代 `research.complete` 的网页证据。

### 最终敌意复核触发的信任边界补充裁决（实施前）

最终复核用两个 `.invalid` URL、调用方伪造的 `httpStatus=200`、`snapshotText` 和正数搜索计数，复现 `research.complete` 返回 completed；说明“记录搜索日志”仍不等于“工具执行过联网”。同时复现两个 `expectedRevision=1` 的并发保存均生成 revision 2，及旧 style/profile 接口仍可把长段第三方原文塞入 `features/style/style_refs`。这三项均属于原问题的同类入口，不是新增功能。

在继续修改前作如下裁决：

1. 新增受限 `research.capture`，由 MCP 自己执行 HTTP(S) 获取、逐跳验证地址、禁止私网/回环/凭据/自定义端口、限制重定向/超时/MIME/字节，并保存哈希绑定的受保护快照；`research.complete` 只接受 captureId，不再接受调用方自报 HTTP 状态或 snapshotText。该变化新增一个 append-only `research-captures` 集合，不新增第三方依赖；搜索查询仍由宿主 WebSearch 完成，但至少每个证据页面的“真实打开、最终 URL、状态、响应类型和快照字节”由工具证明。
2. 把同一 contentId 的“读取最新 revision + 校验 expectedRevision + append”放进同一进程内存储锁；继续明确多进程/本地完全改写者不在 JSONL 的强一致保证内，不假装哈希链是外部签名日志。
3. style form、corpus 与直接 profile.save 统一使用已登记 referenceId 和有界抽象字段；阻断 rawText/fileRef/bodyMarkdown 等原文载荷。直接 profile.save 仍保留给人工建档和旧流程，但必须通过相同递归大小/禁键门禁，不能成为 clean-room 后门。
4. 人工原创、视觉和审批 actor 目前只能做具名字符串与职责分离，无法证明真实自然人身份。0.4.0-rc1 不伪称强身份认证；Gate B 若要跨人协作，必须由宿主注入不可伪造 principal/role，而不是扩大本地 MCP 的身份系统。
5. 对重复文本下可能退化的原创扫描增加输入预算并改进最长匹配算法；不能让 2 MB 正文乘 500 KB 参考在单个 MCP 调用中形成拒绝服务。

### 根因修复落地与合同闭环

最终实现没有在 prompt 上增加“请原创”一类软约束，而是把原问题拆成可验证的状态机与冻结证据链：

1. `content.save` 仅允许 `intake → researched → drafted → reviewed` 单步迁移；研究、原创扫描、编辑复核、交付验证、审批各自有工具生成记录，调用者不能在内容对象里自报通过。
2. `reference.register` 保存第三方原文和内容哈希，普通读取只返回角色、权利、允许用途及抽象特征；写作者工作流只接收研究包和禁止复现特征。style/profile 的公开输入改为已登记 `referenceId` 和有界结构化字段，递归拒绝 `rawText/bodyMarkdown/fileRef` 等原文后门。
3. `research.capture` 由服务端实际打开 HTTP(S) 页面，并限制公开地址、标准端口、逐跳重定向、12 秒总预算、2 MiB、允许 MIME；`research.complete` 只接受 captureId，检查快照内原文片段、主张—证据链接、双来源 host/独立组、用户参考不计独立支持及精确镜像去重。零搜索结果、无来源、未解决缺口全部保持 incomplete/action_required。
4. 原创工具版本升级为 `literal-structure@2`：4/8/12 字符 n-gram、稿件全局多参考覆盖率、后缀自动机最长连续匹配、受预算限制的段落近似候选与论证顺序风险；规范短引必须精确绑定 referenceId、位置和署名。工具结论定位为风险证据，仍要求与写作者不同的具名人工判断。
5. `ArticleDoc` 成为 HTML 与 Markdown 的共同语义源；unified/remark/rehype 默认禁用 raw HTML，资源只允许哈希登记的包内文件。`article.html` 是 primary，`article.md` 是 backup，另生成 `wechat-richtext.html` 渠道档案；三者在审批前冻结，不在打包时重渲染。
6. `editorial-white@1` 明确 `html/body/main/article` 白底、中文字体栈、唯一 H1、标题/段落/引用/代码/表格/图片/图注/来源区、移动断点和打印规则。HTML 无脚本、远程字体、远程图片和主动 URL，包含离线 CSP；表格与代码只允许局部横向滚动。
7. DeliveryManifest 绑定 content/article/asset 字节、bun.lock、renderer/template/style/sanitizer 合同、HTML/Markdown/channel artifact 哈希和具名视觉记录；request/decide/package 每一步重新读取并校验。模板、渲染器或净化合同最后提升到 `article-semantic@2`、`mediaops-unified@2`、`mediaops-html-safe@2`，保证本轮语义与安全改动会使旧交付失效。
8. JSONL 读取改为 malformed/哈希链/head-count 异常即 fail-closed；同一 contentId 的 compare-and-append 在单进程锁内串行；资产在渲染候选中按字节冻结，package 只原子复制并复验冻结产物。

Schema 版本为 v2，同时保留 v1 只读解析；v1 记录不能进入新审批/发布。新增 ArticleDoc、ReferenceMaterial、ResearchCapture、ResearchReview、OriginalityScan、EditorialReview、DeliveryArtifact、DeliveryManifest 共 8 个 schema，已有 5 个 schema 同步收紧，数组、字符串、对象深度和 additionalProperties 均设边界。creator style form 一度仍为顶层开放对象，`validate-media-plugin` 首次正确失败；将其完整结构化并关闭未知字段后通过。公开 `profile.save` MCP schema 同步移除自由 `style/style_refs`，避免内部兼容字段重新暴露。

### 依赖、供应链与版本裁决

最终直接依赖全部精确锁定：MCP SDK 1.29.0、zod 3.25.76、unified 11.0.5、remark/rehype 所需 6 个包；通过 override 将传递 Hono 固定为 4.12.25。未引入 `rehype-raw`、Juice、DOM/jsdom、浏览器运行时或外部 embedding 服务。

新增 CycloneDX 1.5 生成器，从 `bun.lock` 生成 181 个锁定组件并以 `--check` 阻断漂移；版本、直接依赖、Hono 固定值及 THIRD_PARTY_NOTICES 一起进入插件 validator。

```text
$ bun run sbom:check
sbom: 181 locked components match crabcode-media-ops-mcp@0.4.0-rc1

$ bun audit --production
No vulnerabilities found
[exit 0]

$ bun pm scan
error: no security scanner configured
```

先前一次 `bun audit --production` 的证书错误是环境失败，不能当作安全结论；最终同一锁文件下命令已真实成功。`bun pm scan` 不是漏洞失败，而是当前环境没有额外 scanner 配置，因此供应链结论只包含 lock/SBOM 一致性和成功的 Bun audit，不宣称有第二套扫描器。

### MCP 工具、版本源与能力真值复验

validator 增加运行时声明/注册工具集合比对、13 个 schema 的有界结构检查、manifest/package/Marketplace/runtime/SBOM 版本对齐和 Hono 固定值检查。MCP 真实 stdio 冒烟与 SDK listTools 结果：

```text
$ bun src/server.ts </dev/null
mediaops: MCP server ready (gate-a)

$ <SDK client listTools + capabilities>
tool count: 37
includes: mediaops.reference.register, mediaops.research.capture,
          mediaops.research.complete, mediaops.originality.scan,
          mediaops.editorial.review, mediaops.delivery.render,
          mediaops.delivery.verify, mediaops.approval.request,
          mediaops.publish.package
capabilities.authenticatedActorIdentity: false
capabilities.automaticBrowserVisualVerification: false
capabilities.defaultDeliveryFormat: html
capabilities.backupFormat: markdown
```

能力声明有意区分三类事实：WebSearch query/resultCount 是调用方日志；captureId 对应页面字节由服务端受限抓取证明；多视口/打印/可读性由具名视觉验收证明。具名 actor 只做 NFKC、大小写和空白规范化后的职责分离，测试已证明全角/大小写/空白不能绕过，但调用者仍可能冒名，不能写成认证身份。

### 渲染器与浏览器呈现实测

按 `browser:control-in-app-browser` 技能在独立本地静态服务中打开实际生成的 primary HTML，使用 320、768、1440 CSS px 视口、暗色系统偏好和打印规则做实测。工具动作只读取生成物；服务测试后停止，浏览器视口恢复。

真实 DOM/计算样式结论：

```text
html/body/main/article background: rgb(255, 255, 255)
color-scheme: light
h1 count: 1
h2 sequence: no heading-level skips
table wrapper: role=region, tabindex=0, aria-label present
remote images/scripts/inline event handlers: 0
document horizontal overflow at 320px: false
external links: rel="noopener noreferrer"
print: white page, shadow removed, heading/figure/table break rules present
```

桌面截图确认白底、标题层级、正文行宽、留白、引用、表格、代码、图注和来源区可读；320px 的 DOM scrollWidth/clientWidth 与元素边界通过。浏览器工具的 mobile full-page screenshot 出现后端缩放/裁切伪影，但同一页面的实际视口 DOM 指标无溢出或裁切，因此该截图伪影没有被伪记成视觉回归通过证据。渲染测试还覆盖唯一 H1、危险 URL/raw HTML/远程资源、hash/path injection、task state、脚注 target/ARIA、微信行内样式、图片图注与来源、100 次字节一致。

有意偏离：本 RC 没有新增 Nu HTML Checker 与 axe-core 自动依赖，也没有在真实微信草稿编辑器保存清洗后 DOM；工作区浏览器检查不等于完整 WCAG 认证或真实渠道验收。因此版本停在 `0.4.0-rc1`，正式 0.4.0 仍以 Nu/axe 固化、固定 Chromium golden、真实微信草稿回归和已安装目录复验为阻断项。runtime `delivery.verify` 只接受具名视觉证据并重新做可自动化的字节/安全/语义检查，不声称自己启动了浏览器。

### CLI、技能脚本和安装态偏离

所有 command frontmatter 的 `argument-hint` 修正为合法带引号 YAML。全局已安装的旧 `crabcode -- plugin validate` 最初同时报告 command YAML 与 hooks；修正 YAML 后只剩：

```text
Validating hooks: .../hooks/hooks.json
✘ Plugin path rejected (path-missing)
✘ Validation failed
```

本插件没有声明 hooks；该错误来自全局旧 validator 对可选标准路径的已知判断。尝试从用户指定的下游源码仓只读调用其 validator 时，环境又因未安装依赖失败：

```text
error: Cannot find package 'figures'
```

按照用户后来明确的“不要改动 CrabCode 仓库，发现问题报告即可”，没有安装下游依赖、没有修改 validator、没有切换或提交下游分支，也没有制造假 hooks 文件。`plugin-creator` 的脚本硬编码 `.codex-plugin`，而本仓合同是 `.crabcode-plugin`；也没有为了让脚本通过而制造第二套 manifest。权威工作树验证使用本插件 validator 加根仓 validator；真实安装 cachebuster/reinstall 延后到用户决定下游/全局 CLI 更新之后。

最终只读观察 `/Users/fushihua/Desktop/CrabCode` 时，该外部仓已有其他任务状态：

```text
## codex/gui-i18n-en-20260715
 M docs/audit/2026-06-23-execution-log.md
?? docs/audit/2026-07-15-GUI中英文切换实施方案.md
?? docs/video/
docs/audit/2026-06-23-execution-log.md | 68 insertions
```

这些不是本任务产出；主控没有对该仓执行写操作或 Git 变更命令。外部仓在任务期间由其他上下文切换分支并产生修改，进一步说明本任务必须只报告而不能代为清理。

### 中间失败、三次停止规则与纠正记录

除前述首轮类型迁移错误外，以下命令问题均如实保留：

1. 根 cwd 执行 `jq empty media-core/schemas/*.json`，zsh 因路径不存在返回 `no matches found`。
2. 插件 cwd 又把不存在的 `evals/*.jsonl` 加入 jq glob，再次返回 `no matches found`。
3. 最终宽泛 `find .crabcode-plugin plugins/crabcode-media-ops ... | xargs jq empty` 把 `node_modules` 中 JSONC 风格配置和逐行 JSONL 都交给单文档 jq，返回多个 parse error。

这三次是同一“用宽泛 jq 命令重复验证异构 JSON/JSONL”检查设计失败，已达到用户规定的连续三次阈值；记录原因后停止重试。产品 JSON 的有效性由成功的 schema/manifest/Marketplace/SBOM validator、运行时 Zod 解析及 73 项测试覆盖，不再用第四条变体命令掩盖失败。

秘密扫描首次因为 zsh 把含单引号的复合正则当作 glob，返回 `bad pattern`；改为多个独立 `rg -e` 参数后无命中（rg exit 1 表示没有匹配）。危险模式扫描的命中只出现在 sanitizer 本身和恶意输入回归测试中的 `javascript:`/loopback 字面量，没有生产代码主动资源。

根仓门禁曾首次暴露两个真实协调问题：Marketplace defaultPrompt 为 4 条，超过根 validator 上限 3；9 个被有意更新的 workflow SKILL 改变了模型内容快照。前者收敛为 3 条，后者在完整检查 invocation identity 未变化后只更新模型内容 SHA-256；第二次及最终门禁通过。没有放宽 validator 或删除快照测试。

### 最终全量验证真实输出

插件最终命令：

```text
$ bun install --frozen-lockfile --no-summary
$ bun run validate
sbom: 181 locked components match crabcode-media-ops-mcp@0.4.0-rc1
validate-media-plugin: 9 skills, 37 registered tools, 13 schemas, runtime/docs/manifest/marketplace/SBOM aligned at 0.4.0-rc1

$ bun run typecheck
$ tsc --noEmit

$ bun test
73 pass
0 fail
235 expect() calls
Ran 73 tests across 17 files. [875.00ms]

$ bun run build
Bundled 521 modules in 21ms
server.js  1.38 MB (entry point)

$ bun audit --production
No vulnerabilities found
[组合命令 exit 0]
```

根仓最终命令：

```text
$ bun run validate
[refs] WARNING plugins/crabfin-cn/fin-core/skills/audit-xls/SKILL.md:
正文命中办公文档/电子表格关键词但无路由引导

$ bun run typecheck
$ tsc --noEmit

$ bun test ./tests/
76 pass
0 fail
1480 expect() calls
Ran 76 tests across 9 files. [5.99s]

$ bun run build
Bundled 18 modules in 2ms
cli.js  32.0 KB (entry point)
[组合命令 exit 0]
```

该 `crabfin-cn` warning 位于未修改的其他插件，不是本任务引入；根 validate 返回 0。`git diff --check` 无输出，说明工作树无空白错误；任务文件秘密扫描无命中。

### 最终敌意复核与残余风险

对根因、回归、范围、过度工程和交付完整性的最终复核结论：

- 原问题的直接入口已封：第三方参考原文不能进入 writer/style/profile 的公开创作载荷；缺 capture、零搜索结果、单一参考来源、精确镜像、无主张证据、无工具扫描、稿件哈希变化均不能进入 reviewed/ready/approval/package。
- “同义替换”不能仅靠字面算法承诺完全识别；当前确定性结构/段落信号用于召回并强制不同 actor 的人工判断。真正语义模型因模型许可、隐私与可复现性未在 RC 引入，避免把外部 embedding 作为未经论证的新依赖。
- 来源 host、精确快照和调用方声明的 originPublisher 可自动检查；隐蔽通稿、同媒体集团、近似转载及片段是否足以支持复杂自然语言结论仍是具名事实核查责任。工具不宣称自动判真。
- SSRF 已覆盖显式私网/回环/本地域、自定义端口、逐跳重定向、MIME、大小和总时限；DNS 校验与 fetch 之间的 DNS rebinding 竞态仍是本地 fetch 的残余风险。若进入更高信任 Gate B，应使用宿主网络代理/固定解析结果；RC 不抓 PDF。
- JSONL 现在对损坏与完整尾记录删除 fail-closed，并阻止单进程并发 revision 冲突；多 MCP 进程共享目录和有能力同步重写日志/head 的本地攻击者不在强一致/防篡改承诺内。远端协作前应迁移事务数据库和签名身份。
- HTML/Markdown/微信档案、资产、render contract、dependency lock 和审批均冻结绑定；任何内容、资产、模板、renderer 或 sanitizer 变化都会在 readiness/request/decide/package 的字节复验中失效。没有为未来邮件/自动发布提前引入 ProviderAdapter 队列，避免过度工程。
- 交付范围只在 `CrabCode-Plugin` 的 `codex/media-ops-integrity-html` 分支；没有合并 main、删除分支、回滚、force-push、发布平台内容或修改外部 CrabCode 仓。

结论：`0.4.0-rc1` 已完成本轮 P0 根因修复、HTML primary/Markdown backup 合同、白底精排、冻结审批、供应链与自动回归；正式 0.4.0 的 Nu/axe、固定浏览器 golden、真实微信草稿和安装态回归仍明确保留，不能把 RC 描述成正式渠道认证完成。

暂存 104 个明确任务文件并检查 cached diff 后，再按用户要求重跑同一最终门禁：插件仍为 73 pass / 0 fail / 235 expects / 17 files（855ms），521 modules 构建成功，Bun audit 无漏洞；根仓仍为 76 pass / 0 fail / 1480 expects / 9 files（6.55s），18 modules 构建成功，仅保留同一未改 `crabfin-cn` 引用 warning。两组组合命令 exit 均为 0。随后只重新暂存本段执行记录，不再改变产品代码。

## 2026-07-15：`0.4.0` 对外发布验收与加固

### 启动边界、分支与技能偏离

用户要求完成此前保留的正式版验收与安全加固后再晋升 `0.4.0`。延续上一轮明确边界：只修改 `/Users/fushihua/Desktop/CrabCode-Plugin`，不得修改 `/Users/fushihua/Desktop/CrabCode`。安装态检查可以读取实际安装记录；任何无法通过现有官方安装入口完成的下游问题只报告，不手工伪造安装记录或改写外部仓。

本轮先完整读取 `plugin-creator/SKILL.md`、其 `references/installing-and-updating.md` 与 `browser:control-in-app-browser/SKILL.md`。通用 `plugin-creator` 的缓存脚本继续硬编码 `.codex-plugin`，而本仓权威结构是 `.crabcode-plugin`；因此仍不运行该脚本，不制造第二份 manifest。采用本仓 validator、真实 CrabCode 安装入口和实际缓存目录进行验证。浏览器技能用于后续真实页面、固定截图和微信草稿验收。

创建分支前工作树真实输出：

```text
$ git status --short --branch
## codex/media-ops-integrity-html
$ git log -1 --oneline --decorate
ac26d4a (HEAD -> codex/media-ops-integrity-html) feat(media-ops): enforce original research and HTML delivery
$ git branch --show-current
codex/media-ops-integrity-html
```

分支命令与输出：

```text
$ git switch -c codex/media-ops-0.4.0-release-hardening
Switched to a new branch 'codex/media-ops-0.4.0-release-hardening'
$ git status --short --branch
## codex/media-ops-0.4.0-release-hardening
```

### 独立复核结论：此前残余边界均为真实发布阻断项

主控重新读取 `storage.ts`、`research-capture.ts`、`domain.ts`、`server.ts`、approval/delivery/package/originality/editorial/content/capabilities 及相关测试，没有把 RC 文档中的假设当作结论。并行子任务均被禁止执行 Git；其中正式验收缺口审计没有编辑文件，敌意复核在隔离临时目录复现问题后结束。

确认的第一性根因与影响面：

1. `server.ts` 丢弃 MCP handler 的 `extra.authInfo`，所有 `savedBy/completedBy/reviewedBy/decidedBy` 均来自调用方字符串。敌意端到端样本使用不同伪名即可完成 request、approve、package；因此“名字不同”不是身份或职责分离。
2. `editorial-review.ts` 只用年份、百分比、金额和少量固定词检查正文，未建立“正文每个陈述 → 研究主张”的完整覆盖。空 claims 的“已经收购并迁址”可以通过；研究称“增长 10%”、正文写“下降 10%”也能进入已验证交付。
3. JSONL 的 Promise 锁只在单进程有效。12 个进程同步写入时出现多个 `previousRecordHash=null`、head 计数回退及断链；approval 的先读后写也使 approved/rejected 两个并发决定都返回 ok。
4. `publish.package` 在读到 approved 后进行异步复制，撤销可以并行成功，形成“包已生成但最终状态已 revoked”的竞态。
5. `originality.review` 没把第一次 `changes_required` 作为终态，同一 scan 不改稿、不重扫可再次提交 pass。
6. `research-capture.ts` 先 `lookup` 校验、后 `fetch(hostname)` 再解析，连接没有固定到已校验地址，存在 DNS rebinding TOCTOU。
7. `sourceTier/isPrimary/originPublisher` 是调用方声明；服务器能客观证明的是最终 URL、连接目标、响应字节与哈希，来源级别及“是否一手”只能由受信身份评估或显式主机策略确认，不能伪装成网络自动证明。
8. `delivery.verify` 目前只校验调用方提交的 viewport 布尔值；没有 Nu、axe、浏览器截图或打印报告，却会把 accessibility 标为 passed。
9. 实际安装记录仍指向 `0.3.1`，当前 `crabcode 1.0.13` CLI 没有 plugin install/uninstall 子命令；不得手工改 `installed_plugins.json` 冒充官方安装成功。

敌意复核的相关既有 21 个测试仍全绿，说明不是旧测试失败，而是测试模型遗漏了多进程、身份、逐句事实覆盖、状态 CAS 与撤销/打包并发。

### 架构与依赖变化裁决（实施前）

这些变化会改变存储、网络和发布契约，按用户要求在写产品代码前记录：

1. **持久化**：以 Bun 内置 `bun:sqlite` 替代新写入 JSONL，启用 WAL、foreign keys、`busy_timeout`、事务性 collection head 与 entity CAS；旧 JSONL 先完整验证哈希链/head，再一次性导入，损坏时 fail-closed。SQLite 是现有 Bun 运行时内建能力，不增加生产依赖。content revision、approval、originality review、delivery verify 使用 entity version CAS。打包对 approval 取得有期限的数据库租约；撤销必须在同一事务里检查无有效租约，从而给“撤销”和“开始打包”确定线性化顺序。租约只防并发状态竞态，不宣称抵御可任意改写本地数据库的系统管理员。
2. **网络**：不用“先查 DNS 后普通 fetch”的 workaround。每一跳解析一次、验证全部地址，只从已验证集合选择连接地址；`node:http`/`node:https` 的 custom `lookup` 将 socket 固定到该地址，同时保留原 hostname 的 Host、TLS SNI 与证书验证。重定向重新解析并固定。若运行时不能提供可核验连接目标则 fail-closed。
3. **身份**：MCP 注册层保留并使用 SDK 的 `extra.authInfo`；敏感写操作从经认证 token 的 subject/scopes 或宿主显式注入的进程 principal/roles 取得 actor，调用方同名字符串不再形成认证。无受信 principal 的 stdio 会话可做读取和低风险准备，但不得形成强人工原创结论、正式审批或发布包。一个 principal/进程共享 SQLite；跨人职责分离由不同受信 principal 的进程完成。该设计不改外部 CrabCode；若当前宿主不能注入 principal，工具返回 `AUTHENTICATION_REQUIRED`，不得降级自报姓名。
4. **正文事实覆盖**：工具从 ArticleDoc 确定性抽取逐句 statement id 和强事实信号；editorial review 必须对每句分类，并把所有事实句绑定到研究 claim。数字/日期/增长下降/肯定否定等关键语义做确定性矛盾检查；开放语义改写仍由受信事实核查人给出有界说明，不宣称算法自动理解所有自然语言。空 claim 不能覆盖含事件动词或量化信号的正文。
5. **来源评级**：最终 host、URL、response bytes、content hash 由服务器生成；`sourceTier/isPrimary/originPublisher` 改为受信事实核查人的 assessment，并保存依据与身份 assurance。工具继续做 host/内容哈希去重，但不声称从域名自动证明一手性或编辑独立性。
6. **自动呈现验收**：精确增加 `@playwright/test@1.61.1`（Apache-2.0）、`@axe-core/playwright@4.12.1`（MPL-2.0）、`vnu-jar@26.7.15`（MIT 包装；Nu 上游许可证另记）作为固定开发/运行验收依赖。`delivery.verify` 自动产生 Nu、axe、320/375/768/1440、light/dark、文本间距、200% 文本压力、A4/Letter 打印和截图报告；报告与截图逐一哈希并写入 DeliveryManifest。浏览器或 Java 缺失时 `action_required`，不得接受布尔自报。
7. **固定视觉基线**：使用与 `@playwright/test` 同版本的官方 Playwright 容器并按 image digest 固定 Linux/Chromium/字体环境；仓库提交 fixture golden，跨平台真实字体只做布局 invariant smoke，不混用像素基线。
8. **真实渠道与安装态**：微信只创建明确标注“验收、请勿发布”的草稿，不执行发布；保存清洗后编辑区 DOM 摘要、无账号信息的局部截图及哈希。安装必须经过现有 CrabCode 官方入口并从实际缓存目录复验；禁止手工复制缓存或修改 `installed_plugins.json`。

依赖/环境核对命令与真实输出：

```text
$ bun --version
1.3.11
$ node --version
v24.18.0
$ java -version
openjdk version "21.0.10" 2026-01-20
OpenJDK Runtime Environment Homebrew (build 21.0.10)
$ npm view @playwright/test version
1.61.1
$ npm view @axe-core/playwright version
4.12.1
$ npm view vnu-jar version
26.7.15
$ command -v "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
$ command -v pdftoppm
/opt/homebrew/bin/pdftoppm
$ pdftoppm -v
pdftoppm version 26.06.0
$ docker info --format '{{.ServerVersion}} {{.Architecture}}'
29.2.0 aarch64
$ crabcode --version
crabcode 1.0.13
```

官方维护资料复核：Nu 官方提供 npm `vnu-jar`/Java 17+ 与原生包；axe 官方说明自动规则只能覆盖部分 WCAG，仍需人工复核；Playwright 官方推荐 `@axe-core/playwright` 并支持固定截图；Bun 官方 SQLite 支持 WAL、immediate transaction 和跨连接文件锁。由此明确：自动门禁可以证明“所运行规则无 violation”，不能写成“完整 WCAG 认证”。

### 正式版敌意复核新增阻断项与实施前裁决

固定浏览器和安装态验收后，主控与只读敌意子审计用隔离临时数据目录继续尝试绕过完整发布门禁，确认以下问题可穿透或破坏正式交付，不能仅写成残余边界：

1. 事实兼容只检查有限谓词且把多个已审 claim 拼成一段，导致“未增长/增长”否定反转、跨 claim 主体与数值拼接以及“泄露”等未收录事件漏账。图片 caption 会公开渲染，却未进入 statement ledger。
2. `supportingExcerpt + sourceInterpretation` 一起参与兼容检查，调用方可以用自己的解释补足无关原文；同时任意站点可以自报 government/original 或 professional，来源强度缺少可核验的 publisher-host 身份边界。
3. 任意已登记参考材料都由调用方自选 role；把他人表达性文章标成 `factual_source` 可绕过语义/结构人工复核。
4. AI disclosure 的 `bodyLabelText` 会在审校完成后写入公开 ArticleDoc，即使唯一确认方式是 platform-native；这形成审校后的任意可见文本注入。
5. 同一受信 principal 同时拥有 `profile_editor`/`profile_approver` 时可以自拟并自批风格变更；角色授权不能替代记录级职责分离。
6. package 先把目录 rename 到最终路径、再分多次 SQLite 写入 approval/history/audit；任一后续存储错误或进程崩溃会留下不可重试的孤儿包或“已 packaged 但无审计”的半提交状态。

实施前架构裁决如下：

- **事实账本**：保留确定性、可复现的词法守卫，不声称通用语义理解；增加否定极性与常见事实动作，正文 statement 必须由某一条完整 verified claim 单独兼容，禁止跨 claim 拼接。机器无法识别结构的研究 claim 不能作为 supports 通过。ArticleDoc 正文、图片 alt/caption 与任何实际公开 disclosure 都进入同一可见文本抽取边界。
- **来源身份**：TLS 抓取只能证明“从该 host 取得这些字节”，不能证明调用方填写的 publisher。政府/法院和学术来源只在保守机构域后缀匹配时自动建立 publisher 身份；其他来源只有 final host 精确匹配部署者通过 `MEDIAOPS_TRUSTED_SOURCE_HOSTS` 配置的显式信任列表才可形成强来源或“两家专业来源”替代条件。配置只接受规范化 host/`*.suffix`，不接受 URL、端口或全局通配。未验证专业来源仍可做上下文和第二路材料，但不能单独抬高结论强度。该变化会收紧默认行为，属于有意 fail-closed，不引入外部信誉 API 或维护不透明媒体白名单。
- **证据语义**：supports 只比较捕获快照中逐字存在的 `supportingExcerpt`，`sourceInterpretation` 仅保留为具名说明，不能补足证据。每一条 supporting excerpt 必须独立覆盖 claim 的主体、数字、动作和极性。
- **可见正文抓取**：原始响应字节继续用 `contentHash` 冻结，但 research 可引用的 `snapshotText` 必须由 MIME 感知的解析器产生。HTML/XHTML 使用标准 HTML AST，剔除 `head/script/style/noscript/template`、注释和显式非可见节点后只抽取可见文本；纯文本规范化；JSON 解析成功后输出确定性结构文本。XML 在本正式版没有受审解析器，直接拒绝而不是把标签原文冒充可见证据。为避免用正则解析 HTML 的安全 workaround，精确增加 MIT 许可的 `rehype-parse@9.0.1` 与 `hast-util-to-text@4.0.2` 两个直接依赖，并更新 lock/SBOM/notice；不执行脚本、不加载远程子资源。
- **参考材料**：只要本稿绑定了任何原文参考，无论调用方选择何种 role，都强制不同受信 actor 完成结构与论证独立性人工复核；role 继续约束允许用途，但不再决定是否可跳过语义复核。这是偏保守的正式发布门禁，代价是自有旧稿也需要复核。
- **AI 披露**：只有 `body-label` 且文本已经逐字存在于被扫描草稿时，才允许把该文本作为 ArticleDoc disclosure；platform-native/file-metadata 只记录渠道/文件确认，不再向文章字节注入调用方文本。
- **风格职责分离**：在 proposal/confirmation 记录上比较规范化后的受信 actor key；同一 principal 即使兼具两个角色也不得自批，必须由另一 principal 确认。
- **打包提交协议**：引入可恢复的 package operation 记录和确定性 packageId/finalRoot。流程先以 SQLite CAS 取得 approval 租约并登记 `preparing`，在临时目录生成并核验，rename 后以单个数据库事务提交 approval=`packaged`、package operation=`committed`、publish history 与审计。重试先按 operation/packageId 检查：`preparing` 且 finalRoot 完整时完成提交，临时目录存在则续作，不完整最终目录则隔离并重建；`committed` 返回幂等成功。若现有存储接口不能提供同事务多记录提交，则先扩展该根能力并测试进程崩溃恢复，不用删除目录掩盖状态。
- **全局业务/审计原子性**：敌意故障注入证明“业务 append 成功、audit append 失败”不是 package 特例。存储层增加跨 collection 的单 SQLite `BEGIN IMMEDIATE` 批量 append，先完整预检所有涉及的 legacy collection，再在一个事务中更新各自哈希链/head/CAS。content、reference、capture、research、originality、editorial、delivery、approval 的业务记录与其审计事件必须使用该原语；任何一个 collection 损坏或写失败都整体回滚。文件系统产物仍用 prepared/committed 恢复协议处理，不能靠数据库事务假装文件 rename 原子。
- **无哈希 legacy**：旧 JSONL 若全部或部分没有 `recordHash/head`，历史是否被改写或截尾不可验证。默认迁移改为 fail-closed；只有部署者显式设置确认值 `MEDIAOPS_ALLOW_UNVERIFIED_LEGACY_IMPORT=I_ACCEPT_UNVERIFIED_HISTORY` 才允许一次性导入，并在导入时从第一条记录重新建立 SQLite 哈希链。该确认只能说明管理员接受“迁移前历史不可追溯”的风险，不能反向证明旧记录真实；文档和 warning 必须明确。已带完整 hash/head 的 legacy 继续先整链验证再导入。

上述范围不改变外部 CrabCode 仓、不新增生产网络依赖；会同步修改 Zod/JSON schema、迁移文档与敌意回归。正式版本号仍保持 `0.4.0-rc1`，直到这些门禁、全量测试、官方安装态和真实微信草稿全部通过。

### 公开研究交接契约补全裁决（实施前）

只读契约审计发现一个此前测试夹具掩盖的正式版 P0：`research.complete` 在服务端为来源生成随机 `sourceId`，而 `editorial.review` 要求事实 claim 的 `evidenceLinkIds` 精确引用 `${sourceId}:${locator}`；现有公开 MCP 工具既不返回完整 research bundle，也没有 research get。测试夹具直接 import 内部 `getResearchReview`，所以单元测试能继续，但真实 MCP 客户端或 fresh-context 接手者无法构造下一步合法输入，也无法查看服务器派生的 `publisherIdentityMethod/sourceTier/independenceGroup`。这是公开状态机不可达，不是文档问题。

根修方案：新增只读 `mediaops.research.get`，按 `researchId` 返回完整、已重新校验 `researchBundleHash` 的结构化研究包（claims、服务器生成 sources、evidenceLinks、searches、问题与策略版本），不返回第三方参考原文或未绑定抓取字节。`research.complete` 成功响应同时返回这份结构，减少同一会话往返；fresh-context 仍以 get 为权威恢复入口。同步 server 注册、capabilities、validator 已知工具、命令/技能/迁移文档与公开契约测试。测试必须从公开 handler 取回 sourceId 后构造 editorial 输入，不能再把内部 getter当作唯一通路。该变化只增加只读工具，不扩大网络、写入或发布权限。

同时确认两个同根可见文本缺口，直接按现有“所有用户可见句子入账”架构修复，不新增依赖：正文 AI label 必须在解析后的正文文本节点中逐字可见，不能仅因它出现在 Markdown URL/title 等非正文位置而通过；渲染可见的 citation published date 同时进入事实账本与原创扫描输入。

### 对外交付与来源契约加固裁决（实施前）

契约敌意复核继续确认三类正式版阻断，均属于已采用架构缺少公开、可验证的闭环，而不是新增业务功能：

1. 可恢复打包在失败时只返回字符串 error；恢复测试靠内部 `listRecords` 才能找到 operation/finalRoot，真实 MCP 调用者无法按协议续作。改为 `action_required` 的结构化恢复载荷，包含 operationId、packageId、state、finalRoot、markerPath、samePrincipalRequired 与 retry tool/固定参数；不返回 token、密钥或参考原文。首次成功明确 `recoveryMode=new`，prepared 后恢复为 `resumed`，已提交幂等读取为 `idempotent`，不再用“只要最终 state=committed 就 recovered=true”的错误布尔语义。
2. `package-manifest.json` 是对外发布包的主追溯合同，却只有临时对象和哈希，没有 runtime/static schema。新增严格 `PackageManifestSchema` 与 `package-manifest.schema.json`，在计算/复验哈希前解析，validator 纳入 schema 列表，并用未知字段/字段错配负例证明 fail-closed。Package operation 仍是内部恢复记录，不把其本地路径合同冒充对外格式。
3. `publisherIdentityMethod` 只有枚举，没有跨字段不变量或“配置为何命中”的可复核证据。`EvidenceSourceSchema` 增加严格条件：primary 必须 `isPrimary=true`，非 primary 必须 false；primary/authoritative 不得 unverified；recognized/configured 方法必须保存匹配 rule，configured 另存规范化信任列表的配置哈希，其他方法不得夹带这些字段。这里的配置哈希只能复核“当时使用哪份部署配置”，不证明配置本身正确；部署者仍对信任列表负责。

另有 profile 文件写入先于独立 audit append，会在崩溃/磁盘错误时产生“当前 profile 已生效但审计缺失”，style confirm 又分多次写 proposal/form/profile。根修采用已有 SQLite 原子批次：新增 `profiles` 业务 collection，以 brand CAS 保存不可变 profile + audit，并作为读取权威；现有 JSON 版本文件降为可重建导出/旧版兼容来源。style 确认所需 proposal/form/profile/audit 状态放进同一数据库事务，文件导出在提交后从权威记录物化。旧文件在未产生 SQLite profile 前仍只读兼容，首次新确认后 SQLite 成为该 brand 权威；不会删除旧文件。该变化不修改外部 CrabCode 仓，也不增加依赖。

### 收口实施、真实输出与三次失败停止（未晋升正式版）

主控完成但尚未形成正式发布提交的加固项：公开 `mediaops.research.get`、来源身份派生不变量和配置哈希、全可见句四类 statement coverage、AI 正文披露可见性、package manifest runtime/static Schema、可恢复 package 的结构化 `action_required`/`new|resumed|idempotent`、aborted 终态、approval 纯业务公开输出、profile SQLite 权威记录，以及 profile/proposal/form/audit 单事务确认。新增 profile 审计损坏故障注入与同 proposal 并发确认测试。对应顺序专项验证为：

```text
$ bun run typecheck && bun test tests/profiles.test.ts tests/style.test.ts
13 pass
0 fail
42 expect() calls
Ran 13 tests across 2 files. [227.00ms]
[exit 0]

$ bun test tests/references-research.test.ts tests/factual-integrity.test.ts tests/markdown.test.ts
31 pass
0 fail
104 expect() calls

$ bun test tests/approval.test.ts tests/package.test.ts
11 pass
0 fail
55 expect() calls

$ bun test tests/references-research.test.ts
20 pass
0 fail
63 expect() calls
```

契约只读审计还确认并处理了：修复此前 EOF 未闭合的 `delivery-manifest.schema.json`；新增 `package-manifest.schema.json`；`claim.schema.json` 条件分支补 array type；creator-style 条件 required 补同层 properties；README/迁移/实践/agent/runbook/skill 同步四类 ledger、`MEDIAOPS_TRUSTED_SOURCE_HOSTS` 精确/受限通配规则、公开 research get、无哈希 legacy 精确确认值、profile 权威源和 package 恢复协议。版本仍保持 `0.4.0-rc1`。

修改期间的非产品命令偏差如实记录：第一次从根目录用 `src/...` 查询插件文件，只有 Git 状态输出而没有 rg 命中；改用 `plugins/crabcode-media-ops/src/...` 后得到正确位置。一次大块 `apply_patch` 因上下文来自重叠 `sed` 输出而误以为存在重复声明，verification failed、未产生编辑；随后读取精确行并拆分补丁成功。一次用 jq 命令引用 shell 未正确保护的 `$defs`，由 shell 展开造成错误；没有把该输出当 Schema 结论，产品 JSON 后续用明确文件路径解析。上述均没有触碰 `/Users/fushihua/Desktop/CrabCode`。

第一次全量测试暴露两个类别：一个旧测试期望的 AI 错误文案与更严格 runtime 文案不一致；更关键的是多个测试文件同时启动 Playwright 时出现 `Failed to connect`、`code: ENOENT`，此前全量摘要为：

```text
$ bun test
101 pass
3 fail
2 errors
354 expect() calls
[exit 1]
```

主控先用进程内串行队列限制 QA。它消除了当次早期 IPC 报错，但因为 Bun 1.3.11 每测试默认 5000ms，排队用例出现超时。Bun 官方文档确认 CLI `--timeout` 和 `--max-concurrency`；当前固定 Bun 对临时尝试的 bunfig timeout 没有生效，因此删除该无效配置，改由 package 的权威 `test` 脚本传入 `--timeout 60000 --max-concurrency 4`，CI 同步调用 `bun run test`。随后为避免无限串行，将运行时改成“同 artifact root 串行、全局上限 2”。第二次全量真实结果仍复现 Playwright IPC：

```text
$ bun run test
$ bun test --timeout 60000 --max-concurrency 4
105 pass
2 fail
1 error
383 expect() calls
Ran 107 tests across 19 files. [58.34s]

失败 1：旧测试期望 `bodyLabelText is forbidden unless body-label`，runtime 返回语义等价但不同的
`bodyLabelText is required exactly when body-label is declared`。
失败 2/错误：delivery 测试启动 Playwright 时 `Failed to connect`, syscall `connect`, errno -2, code `ENOENT`。
[exit 1]
```

AI 条件随后拆成明确的 required/forbidden 两个分支；该专项测试通过。QA 全局并发再收紧为 1，并以单并发专项运行。第三次同类稳定性尝试的真实结果：

```text
$ bun test --timeout 60000 --max-concurrency 1 tests/references-research.test.ts tests/delivery.test.ts
22 pass
1 fail
78 expect() calls
Ran 23 tests across 2 files. [67.13s]

失败：HTML-primary frozen delivery > incomplete viewport/print evidence cannot mark a candidate verified
该测试 60011.50ms 超时；前两个同文件浏览器交付用例分别约 3.14s、2.93s 通过，第三个没有在 60s 内返回。
[exit 1]
```

这构成同一“多交付测试中的 Playwright 进程/队列稳定性”连续三次未通过：原始无限并发 IPC `ENOENT`；有界并发 2 仍 `ENOENT`；有界并发 1 出现 60 秒无返回。按用户明确规则，主控在第三次后停止，不再通过增加 retry、继续延长 timeout、跳过浏览器或伪造截图来掩盖。阻塞点是 QA 调度与 Playwright 子进程生命周期尚未形成在 Bun 单进程、多测试文件场景下可重复通过的实现；当前全量测试不是绿色，不能执行正式版本号晋升、最终 diff/构建/lint/安装态提交闭环。

真实微信草稿门禁也未完成。按已读取的 `browser:control-in-app-browser` 技能尝试进入 `https://mp.weixin.qq.com` 时，浏览器能力以安全策略拒绝该操作，并明确不能改用其他浏览器/API 绕过。主控没有绕过、没有登录、没有创建草稿、没有发布内容，因此不能把本地微信富文本或固定夹具冒充真实渠道回归。

停止时正式发布结论：**未验收、未升级、未提交正式 `0.4.0`**。分支仍为 `codex/media-ops-0.4.0-release-hardening`；外部 CrabCode 仓无写入。本轮变更仍在工作树，尚未声称所有产出已提交到 HEAD，因为用户要求的全量测试/构建/lint/真实微信/安装态/最终敌意复核没有全部通过；在失败门禁下制作“正式发布提交”会违反发布真实性约束。

### 2026-07-15/16 主控执行：0.4.0 发布阻断修复与正式晋升

任务分支：`task/media-ops-0.4.0-qa-release-20260715`（自 `codex/media-ops-0.4.0-release-hardening` 含全部未提交 0.4 能力工作树）  
依据：`docs/audit/2026-07-15-crabcode-media-ops-0.4.0-发布阻断审计与补全实施方案.md`  
发布语义：**R-A**（自动 QA 门禁正式版；微信草稿为人机 Gate B；禁止 R-C 绕过）。

#### 前置审计（独立复核）

| 项 | 问题 | 第一性根因 | 影响面 | 症状级？复发条件 | 同类变体 |
|----|------|------------|--------|------------------|----------|
| B1-夹具 fan-out | `createReviewedContent` 无条件 `verifyHandler`→`runDeliveryQa` | 测试工厂把**生产路径**完整 Chromium/Nu 嵌进业务夹具；~26 处调用 | 全量 `bun test` IPC/超时；开发反馈环极慢 | 否（架构） | 任何新增 `createReviewedContent` 调用继续放大 |
| B1-并发/预算 | `MAX_CONCURRENT_QA_RUNS=1` vs `max-concurrency 4` + timeout 60s | 队列等待计入用例 timeout；队尾 wait+run≥60s | 单并发仍超时（第三次失败点） | 否 | 加 timeout 不修 fan-out 会复发 |
| B1-IPC ENOENT | Playwright connect errno -2 | 多实例 launch/close IPC 竞态 + 无跨进程锁 | 多文件 fan-out / 并行 job | 否 | CI 无 `--ipc=host` 时容器侧更易发 |
| B1-负例双倍 QA | incomplete viewport 先 full QA 再 verify full QA | 负例仍走生产 QA 路径 | 60s hang | 否 | 所有“先 verified 再失败 verify”用例 |
| B2 微信 | agent 打开 mp.weixin 被拒 | 浏览器安全策略 + 产品边界 | 不能伪造成渠道验收 | 否（非 bug） | 任何 agent 自动登录平台 |

三问：

1. **架构偏差**：生产 verify 应 full QA；测试应分层。此前测试=生产耦合是偏差。  
2. **过度工程**：跨进程锁 + 共享 browser 为防复发最小充分；未引入新 npm 依赖。  
3. **遗漏关联方**：package 断言真实截图、CI 仅 `bun run test`、plugin/marketplace 版本、SBOM、负向 browser 断言文案。

背景文档前提已独立验证：`helpers` 仍无条件 verify（改前）、`MAX_CONCURRENT_QA_RUNS=1`、`package.json` timeout 60s concurrency 4、delivery incomplete 用例结构、三次失败日志原文一致。

#### 偏离点记录

| 偏离 | 原因 | 影响 | 一致性 |
|------|------|------|--------|
| 默认发布语义 R-A（用户未再确认） | 方案推荐 + README 已声明不自动发平台 | 正式 0.4.0 不绑定真人微信签字 | 与方案 §4.2.3 / §6.3 一致 |
| 负向 browser 断言改为匹配 `qa_infrastructure_failed` | 根因分类改进改变错误字符串 | 测试期望同步 | 仍验证“缺工具 fail-closed” |

#### 实施要点

1. `tests/helpers.ts`：`deliveryMode: none|render-only|verified`，默认 **render-only**  
2. `src/tools/delivery.ts`：`MEDIAOPS_QA_MODE=full|static|off` + static 证据写入（≥3 artifacts）  
3. `tests/delivery.test.ts` 去 full QA；`tests/delivery.qa.test.ts` full 正向  
4. package/approval/readiness/preview 显式 `deliveryMode: 'verified'`  
5. `src/qa/delivery-qa.ts`：进程内共享 Chromium、跨进程 lockfile（stale 10min）、launch/goto/段超时、timing 字段、IPC→`qa_infrastructure_failed`  
6. scripts：`test` static / `test:qa` full / `test:all`；CI 增加 `test:qa`  
7. P2：checklist + runbook；P3：版本 0.4.0（package/domain/plugin/marketplace/README/SBOM）

#### 真实命令输出（摘录）

```text
$ git checkout -b task/media-ops-0.4.0-qa-release-20260715
# on task branch from ac26d4a + WIP

$ bun run typecheck
# exit 0

$ bun run test   # MEDIAOPS_QA_MODE=static
107 pass
0 fail
383 expect() calls
Ran 107 tests across 19 files. [3.77s]
[exit 0]

$ bun run test:qa   # round 1
1 pass
0 fail
Ran 1 test across 1 file. [3.31s]
[exit 0]

$ bun run test:qa   # round 2
1 pass
0 fail
Ran 1 test across 1 file. [2.95s]
[exit 0]

$ bun run build
Bundled 568 modules in 25ms
[exit 0]

$ bun run qa:release  # after assert fix
8 passed (7.0s)
[exit 0]

# 版本对齐后：
$ bun run validate
sbom: 200 locked components match crabcode-media-ops-mcp@0.4.0
validate-media-plugin: 9 skills, 38 registered tools, 14 schemas, runtime/docs/manifest/marketplace/SBOM aligned at 0.4.0
[exit 0]

# 双轮业务+QA+release（版本 0.4.0 后）：
# round1: test 107 pass / test:qa 1 pass / qa:release 8 pass
# round2: test 107 pass / test:qa 1 pass / qa:release 8 pass
# validate exit 0
```

#### 需求逐条

| 需求 | 状态 | 证据 |
|------|------|------|
| B1 根因修复（夹具降载） | 满足 | helpers 默认 render-only；业务测 3.7s 全绿 |
| B1 QA 单飞/生命周期 | 满足 | MAX=1 + 共享 browser + 跨进程锁；test:qa ~3s×2 |
| B1 incomplete 无双倍 QA | 满足 | MEDIAOPS_QA_MODE=off；delivery.test 第三例 <60s |
| P1 scripts/CI | 满足 | package.json + ci.yml test:qa |
| B2 自动产物 | 满足 | delivery channel 无 script 断言 + wechat fixture |
| B2 真人草稿 | 未满足（有意 R-A） | Known residual；checklist 已写 |
| 正式 0.4.0 版本对齐 | 满足 | package/domain/plugin/marketplace/SBOM/README |
| 禁止伪造微信/跳过 browser | 满足 | 未改 golden 偷写；未开 mp.weixin |
| 全产出在 HEAD | 见提交 | 本段提交后 |

#### 敌意复核

- 根因/同类变体：新夹具默认不启 Chromium；verified+static 仍覆盖 package 门禁；full 仅 test:qa/CI/production  
- 调用方：approval/package/readiness/preview 已改 verified  
- 需求偏离：R-A 微信人机未签字——已知残余，非伪造成  
- 过度工程：无新依赖；锁为文件 wx  
- 交付完整性：DoD 命令已双轮绿  

**结论：已知缺陷交付**（正式工程门禁通过；真人微信草稿未在本窗口执行——与 R-A 一致，release notes 已列 residual）。

#### 终点闸门（合并安全核验 — 交用户决定）

**禁止本 agent 执行**：merge main、删分支、回滚、force-push、覆盖他人改动。

建议用户步骤：

1. `git log --oneline main..HEAD` / `git diff main...HEAD` 审阅  
2. 可选：真实安装根 `bun run qa:installed`  
3. 可选：按 `docs/releases/wechat-draft-acceptance-checklist-0.4.0.md` 完成 R-B  
4. `gh pr create` 或 merge `task/media-ops-0.4.0-qa-release-20260715` → 目标分支（由用户选）  
5. 合并后打 tag / 发布说明引用 `docs/releases/2026-07-15-v0.4.0.md`


#### HEAD 证明（提交后）

```text
$ git rev-parse --abbrev-ref HEAD
task/media-ops-0.4.0-qa-release-20260715
$ git rev-parse HEAD
3530823ef84b7843a48f8ff9c6387296e4dca611
$ git log --oneline -5
3530823 feat(media-ops): release 0.4.0 with QA fixture split and hardened Playwright lifecycle
ac26d4a feat(media-ops): enforce original research and HTML delivery
3afa5ae docs: close CrabAccount execution audit
f8e1ca6 feat: add CrabAccount workflow plugin
b58e7b2 feat(workflows): localize all official skill cards
$ git status
On branch task/media-ops-0.4.0-qa-release-20260715
Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	modified:   docs/audit/2026-06-23-execution-log.md

no changes added to commit (use "git add" and/or "git commit -a")
$ git show HEAD:plugins/crabcode-media-ops/package.json | head -5
{
  "name": "crabcode-media-ops-mcp",
  "version": "0.4.0",
  "license": "Apache-2.0",
  "type": "module",
$ git show HEAD:plugins/crabcode-media-ops/src/domain.ts | head -5
import { createHash } from 'node:crypto'
import { z } from 'zod'

export const VERSION = '0.4.0'
export const SCHEMA_VERSION = 2 as const
$ git show HEAD:plugins/crabcode-media-ops/tests/helpers.ts | grep -n deliveryMode | head -5
77: * deliveryMode:
96:  deliveryMode?: 'none' | 'render-only' | 'verified'
98:  const deliveryMode = args.deliveryMode ?? 'render-only'
240:  if (deliveryMode === 'none') {
247:  if (deliveryMode === 'render-only') {
$ git diff main...HEAD --stat | tail -15
 .../plugin-dev/skills/agent-development/SKILL.md   |    3 +-
 .../plugin-dev/skills/command-development/SKILL.md |    3 +-
 .../plugin-dev/skills/hook-development/SKILL.md    |    3 +-
 plugins/plugin-dev/skills/mcp-integration/SKILL.md |    3 +-
 plugins/plugin-dev/skills/plugin-settings/SKILL.md |    3 +-
 .../plugin-dev/skills/plugin-structure/SKILL.md    |    3 +-
 .../plugin-dev/skills/skill-development/SKILL.md   |    3 +-
 scripts/validate-all.ts                            |   11 +
 src/policy/presentationValidator.ts                |  461 ++
 tests/crabaccount/client.test.ts                   |  357 ++
 tests/crabaccount/fixtures/fake-curl.sh            |  102 +
 tests/crabaccount/fixtures/import-batch.json       |   66 +
 tests/validators/presentation.test.ts              |  210 +
 ...orkflow-skill-presentation-completeness.test.ts |   88 +
 505 files changed, 24739 insertions(+), 1356 deletions(-)
```
