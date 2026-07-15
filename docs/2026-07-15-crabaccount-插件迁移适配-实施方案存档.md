# CrabAccount CrabCode 插件迁移与适配——修订实施方案存档

> 本文件是后续实现的自包含执行依据，只修订方案，不包含插件实现。
>
> 本次修订同时核对了当前插件仓、下游 CrabCode 运行时、固定版本上游技能源码，并参考多个成熟开源记账/导入项目。任何实现若偏离本档的安全边界、技能数量、依赖语义或写入恢复规则，应先更新本档。

---

## 0. 元信息与修订状态

- 文档日期：2026-07-15
- 文档状态：修订版已定稿，尚未实施
- 工作仓：/Users/fushihua/Desktop/CrabCode-Plugin
- 下游源码：/Users/fushihua/Desktop/CrabCode
- 目标目录：plugins/crabaccount
- 产品显示名：CrabAccount
- 插件技术 ID：crabaccount
- 插件初始版本：0.1.0
- Marketplace 分类：finance
- Marketplace 层级：workflow
- 上游应用固定版本：[QingHeYang/EasyAccounts@49eabb7](https://github.com/QingHeYang/EasyAccounts/tree/49eabb784ad718fb1efd4014f569b51948a2b628)
- 上游技能固定版本：[QingHeYang/EasyAccounts-Skills@fcc9300](https://github.com/QingHeYang/EasyAccounts-Skills/tree/fcc9300a070bd89a13c3d4b4df79a0274db17dd2)
- 上游技能许可：[MIT-0 原文](https://github.com/QingHeYang/EasyAccounts-Skills/blob/fcc9300a070bd89a13c3d4b4df79a0274db17dd2/LICENSE)
- 目标插件许可：Apache-2.0

### 0.1 修订记录

| 版本 | 状态 | 主要变化 |
|---|---|---|
| 初版 | 已替代 | 确立“一插件、两技能”、Bash 适配层和可选办公路由 |
| 本修订版 | 当前基线 | 校正运行时变量、办公路由、认证、批量非原子、未知写入结果、展示校验、测试快照和发布刷新等事实；增加 API 兼容闸门、导入状态机、审计日志与外部调研依据 |

### 0.2 事实优先级

实施时按以下顺序裁决冲突：

1. 本仓校验器和 CI 中的实际规则；
2. 下游 CrabCode 当前源码中的加载、权限、数据目录和技能调用行为；
3. 固定提交的上游技能请求与响应行为；
4. 目标服务的隔离环境实测；
5. 外部开源项目的设计经验；
6. 未经验证的推测。

任何处于第 6 类的写入假设都不得直接进入生产路径。

---

## 1. 审计结论：原方案必须修正的地方

总体方向不变：迁移的是智能体记账能力，不重做服务端；采用一个插件、两个技能和一个轻量 API 适配入口。以下问题已从“实施细节”提升为前置约束。

| 原有隐患 | 修订后的结论 |
|---|---|
| 把 CRABCODE_PLUGIN_* 当作脚本自动继承的环境变量 | 它们是 CrabCode 对技能正文和 allowed-tools 做的文本替换。技能必须把替换后的绝对路径显式传给脚本，例如 --data-dir；脚本不得假设环境中存在这些变量 |
| 把 capability-routing.md 理解为办公插件的数据交换协议 | 它是作者规范、CI 路由注册表和提示词级调用约定。Skill 调用会加载 provider 指导，不会自动得到某个固定 JSON 返回值 |
| 假定办公套件能完整解析所有 Excel/PDF | 当前办公套件技能可提供处理指导，但其 CLI/XLSX/PDF 辅助层尚未形成完整账单抽取器；必须先做集成探针，并保留 CrabCode FileRead 与格式转换降级 |
| 密码可由代理交互输入 | BashTool 没有可靠的交互 stdin。密码不得进入对话或命令参数；首次登录由用户在自己的终端运行隐藏输入命令 |
| 批量新增等同服务端原子批量接口 | 固定上游脚本实际逐行调用单笔写入，可能部分成功；不得宣称事务、自动回滚或全有全无 |
| 失败行可以统一重试 | 必须区分明确失败与结果未知。POST 超时、断线、空响应或无法解析响应属于 commit_unknown，核对前禁止重放 |
| 本地哈希即可确定去重 | 内容相似度只能产生重复候选。只有稳定外部 ID 或已确认成功的本地回执才能做确定性去重 |
| 401 后可统一自动登录并重放 | 读请求可续期后重试；写请求若网络结果不确定，必须先远端核对，不能因 401/断线直接重发 |
| Marketplace 显示名只写 CrabAccount | workflow 展示字段必须含中文，改为“CrabAccount 智能记账”；技术 ID 仍为 crabaccount |
| 新技能不会影响现有快照 | 两个 workflow 技能会改变技能数量、Invocation SHA 和模型正文 SHA；必须更新而不能移除快照锁 |
| 下游校验需要特殊 hooks 规避 | 实施复验发现当前解析器把缺失 hooks 包装为 `PluginPathSecurityError(path-missing)`，而校验器只接受原生 ENOENT；应在下游根因修复可选文件分类，CrabAccount 仍不添加空 hooks workaround |

这些修订避免了三类最危险的虚假承诺：并不存在的办公返回协议、并不存在的服务端幂等/事务保证，以及代理无法安全完成的密码交互。

---

## 2. 产品范围、命名与法律边界

### 2.1 实际迁移对象

上游应用仓主要提供部署编排与发布镜像，并非完整可改名的应用源码。本次迁移对象是固定提交的 Skills 仓中的：

- 账户、分类、动作和流水查询工作流；
- 单笔新增、逐行批量新增和流水更新；
- 内部转账、年度统计和服务端导出；
- 登录协议和 REST 请求形状。

目标仍是调用用户自行部署的兼容账本服务，不重新打包、不改名、不分发上游服务镜像。

### 2.2 v0.1 保留与排除

保留：

- 日常收支记录、查账、统计、转账和修改；
- 账单标准化、映射、候选去重、预览、确认和逐行提交；
- 服务端现有的原生导出能力，但只按实测结果说明其产物；
- 可选的表格和 PDF 能力路由。

明确排除：

- 服务端、前端、数据库或 Docker 栈重建；
- 银行直连、投资组合聚合、自动同步；
- 账户、分类、动作等主数据的创建和删除；
- 自建 OCR、完整 Excel 引擎、PDF 引擎或规则 DSL；
- OFX、QFX、QIF、CAMT、MT940 等金融格式；
- 跨币种自动换算；
- 公告、捐赠、营销更新、上游社区人格；
- MCP、hooks、groups、子代理、前端面板和插件私有数据库。

### 2.3 品牌规则

| 用途 | 值 |
|---|---|
| 产品与 Marketplace 展示 | CrabAccount 智能记账 |
| 技术 ID / 目录 | crabaccount / plugins/crabaccount |
| 日常记账 FQN | crabaccount:bookkeeping |
| 账单导入 FQN | crabaccount:statement-import |
| 配置变量前缀 | CRABACCOUNT_ |
| Shell 函数前缀 | crabaccount_ 或 ca_ |

插件用户可见内容中不保留旧名称、旧人格、旧配置路径或旧兼容别名。原名称只允许出现在第三方来源说明、许可证副本和本规划档的来源证据中。

不得预设 from=CrabAccount 或向备注自动追加品牌标签。只有 API 契约确认该字段存在、不会污染账本且用户接受时，才可启用可配置来源标记。

### 2.4 法律文件

插件整体使用 Apache-2.0。对上游脚本的改写必须保留可追溯记录：

    plugins/crabaccount/LICENSE
    plugins/crabaccount/docs/legal/
    ├── THIRD_PARTY_NOTICES.md
    └── licenses/
        └── EasyAccounts-Skills-MIT-0.txt

THIRD_PARTY_NOTICES 至少记录：

- 来源仓、固定提交 SHA、访问日期；
- 上游 MIT-0 许可证和原文副本路径；
- 哪些逻辑被参考或改写；
- 本地在安全、配置、恢复和 CrabCode 适配方面的主要修改。

外部调研项目只借鉴公开设计思想，不复制 AGPL/GPL 项目的源码、文案、测试夹具或资源。

---

## 3. 本仓和下游 CrabCode 的真实插件合同

### 3.1 Manifest 与 Marketplace

插件清单固定为 plugins/crabaccount/.crabcode-plugin/plugin.json，目录名、manifest.name 和 Marketplace name 都必须等于 crabaccount。manifest 的 skills 显式列具体目录，不能写宽泛的 ./skills。

建议清单草案：

~~~json
{
  "name": "crabaccount",
  "version": "0.1.0",
  "description": "CrabCode workflows for safe personal bookkeeping and reviewed statement import.",
  "author": {
    "name": "CrabCode"
  },
  "license": "Apache-2.0",
  "keywords": [
    "personal-finance",
    "bookkeeping",
    "statement-import",
    "self-hosted"
  ],
  "skills": [
    "./skills/bookkeeping",
    "./skills/statement-import"
  ]
}
~~~

Marketplace 条目草案：

~~~json
{
  "name": "crabaccount",
  "source": "./plugins/crabaccount",
  "version": "0.1.0",
  "displayName": "CrabAccount 智能记账",
  "shortDescription": "连接自托管账本，完成安全记账、查账与经核对的账单导入",
  "longDescription": "面向个人和家庭的自托管记账工作流，支持日常收支、查账、统计、转账、流水修改，以及表格或 PDF 账单的标准化、映射、查重、预览和确认后导入。",
  "defaultPrompt": [
    "记一笔今天的午餐支出",
    "查一下这个月的收支情况",
    "导入这份银行账单，先核对再写入"
  ],
  "brandColor": "#0F766E",
  "description": "Safe personal bookkeeping and reviewed statement import for a compatible self-hosted ledger.",
  "category": "finance",
  "tier": "workflow",
  "tags": [
    "personal-finance",
    "bookkeeping",
    "statement-import",
    "self-hosted"
  ]
}
~~~

说明：

- finance 是当前白名单中最接近的分类，尽管现有分类说明偏机构金融。v0.1 不为单个插件新增全局分类，只记录这项分类治理债务。
- 图标字段是可选的。只有真实 PNG/JPEG/WebP 文件通过 1–256 KiB、魔数和路径校验后才加入 composerIcon/logo；不得先填占位路径。
- 根 Marketplace 当前版本在实施时按“当时版本 patch +1”更新。若仍为 0.4.1，则更新为 0.4.2，并同步更新对应测试断言。

### 3.2 技能身份与展示草案

FQN 由插件名和技能目录 basename 组成，稳定值为：

- crabaccount:bookkeeping
- crabaccount:statement-import

中文 name 只负责展示，不参与 FQN。本仓 workflow 展示校验要求 name 为中文，short-description 为 18–72 个字符的中文文案。

bookkeeping frontmatter 草案：

~~~yaml
---
name: 日常记账与查账
short-description: 连接自建账本，安全完成收支记录、查账、统计、转账和流水修改
description: 连接用户自行部署的兼容账本服务，处理个人或家庭的收入支出记录、流水查询、区间统计、内部转账和已有流水修改。当用户说“记一笔”“查本月账单”“统计收支”“账户转账”或“修改刚才那笔记录”时使用。
when_to_use: "Use when the user wants personal or household bookkeeping against a compatible self-hosted ledger, including adding an entry, querying transactions, calculating totals, transferring between accounts, or correcting an existing entry."
argument-hint: "[记账、查账、统计、转账或修改需求]"
brand-color: "#0F766E"
version: 0.1.0
---
~~~

statement-import frontmatter 草案：

~~~yaml
---
name: 账单导入与核对
short-description: 解析表格或 PDF 账单，核对映射去重后经确认批量写入账本
description: 把 CSV、TSV、Excel、PDF 或粘贴表格中的个人账单整理成统一记录，校验币种、日期、账户和分类，展示未匹配项、重复候选与收支合计，经用户确认后批量写入。当用户要求导入微信、支付宝、银行或其他支付账单时使用。
when_to_use: "Use when the user wants to review and import a personal payment, bank, or wallet statement from a table, spreadsheet, or PDF into a compatible self-hosted ledger."
argument-hint: "[账单文件路径或粘贴数据]"
brand-color: "#0F766E"
version: 0.1.0
---
~~~

实施时再加入最小 allowed-tools：

- Read 和 Skill 可按工作流需要声明；
- Bash 只能给 doctor、配置状态、账户/分类查询、流水查询等只读子命令配置精确规则；
- 不得使用裸 Bash 或 Bash(*)；
- add、update、transfer、import apply 等写命令不进入 always-allow；
- allowed-tools 规则必须以替换后的绝对命令开头做下游匹配测试。

### 3.3 运行时路径不是脚本环境变量

CrabCode 会替换技能正文和 allowed-tools 中的：

- ${CRABCODE_PLUGIN_ROOT}
- ${CRABCODE_PLUGIN_DATA}
- ${CRABCODE_SKILL_DIR}

普通 Shell 子进程不会因此自动获得同名 env。技能中的命令必须显式传值：

~~~bash
bash "${CRABCODE_PLUGIN_ROOT}/scripts/crabaccount.sh" --data-dir "${CRABCODE_PLUGIN_DATA}" accounts list
~~~

脚本用自身路径定位 scripts/lib，只用 --data-dir 定位持久化数据。不得给命令增加自定义环境变量前缀来绕过参数，因为这会干扰 Bash 权限规则匹配。

开发态 --plugin-dir 的数据 source 与 Marketplace 安装态不同，两者配置和 Token 不自动共享。联调应使用独立测试配置或显式临时 --data-dir。最后一个 scope 卸载插件时数据目录会被删除，README 必须提醒用户。

### 3.4 capability-routing.md 到底是什么

[capability-routing.md](./capability-routing.md) 是“跨插件能力的静态作者规范 + CI 路由合同 + 运行时提示词约定”，配套的 capability-routing.json 是机器可读注册表，lint:refs 负责检查引用。

它不是：

- RPC 或 SDK；
- provider 的 JSON 返回协议；
- provider 已实现全部能力的保证；
- 插件安装器。

下游调用 Skill FQN 的实际效果是把 provider 技能的指导加载进当前会话。statement-import 仍负责读取结果、形成 CrabAccount 中间数据、做账本 ID 映射和控制写入。

具体要求：

- 表格文件处理正文引用完整 FQN：crabcode-office-suite:crabcode-spreadsheets；
- PDF 文件处理正文引用完整 FQN：crabcode-office-suite:crabcode-pdf；
- 两个 FQN 在 SKILL.md 中以反引号形式出现，以满足引用校验；
- CrabAccount 是能力消费者，不修改 capability-routing.json；
- 办公套件不写入 dependencies，避免其缺失导致整个记账插件不可用；
- 捕获精确的 Unknown skill 后走降级，不把它误当安装动作；
- bookkeeping 若提到“服务端原生 Excel 导出”，增加精确豁免注释，说明它不进行本地表格生成或编辑，避免误触 office-spreadsheets 路由检查。

建议豁免原文：

~~~html
<!-- capability-route: office-spreadsheets=none(服务端原生导出仅返回服务端产物，不进行本地表格生成或编辑) -->
~~~

### 3.5 展示快照与发布刷新

当前快照基线为 313 个 workflow 技能、Marketplace 根版本 0.4.1。增加两个 workflow 技能后，tests/workflow-skill-presentation-completeness.test.ts 中至少会变化：

- workflow 技能总数；
- Invocation identity SHA；
- model-facing content SHA；
- 测试名称中的技能数量；
- Marketplace 根版本断言。

这些锁用于发现意外变更，实施时应根据确定产物重新计算并更新，不能删除或放宽。安装/启用后执行 /reload-plugins；插件更新后按下游提示重启 CrabCode。manifest 和 Marketplace 插件版本必须同步递增。

### 3.6 本地证据索引

本修订版在 2026-07-15 以以下源码为准：

| 结论 | 本仓/下游证据 |
|---|---|
| manifest、Marketplace 和展示字段 | src/policy/manifestValidator.ts、src/policy/marketplaceValidator.ts、src/policy/presentationValidator.ts |
| 跨插件路由和引用校验 | docs/capability-routing.md、docs/capability-routing.json、src/policy/referenceValidator.ts |
| 办公 provider 当前边界 | plugins/crabcode-office-suite/src/cli.ts、plugins/crabcode-office-suite/src/xlsx/index.ts、plugins/crabcode-office-suite/src/pdf/index.ts |
| 技能发现、FQN 和变量替换 | /Users/fushihua/Desktop/CrabCode/src/utils/plugins/loadPluginCommands.ts、/Users/fushihua/Desktop/CrabCode/src/utils/plugins/pluginLoader/createPlugin.ts |
| Skill 调用与 Unknown skill | /Users/fushihua/Desktop/CrabCode/src/tools/SkillTool/SkillTool.ts |
| 数据目录与敏感配置替换 | /Users/fushihua/Desktop/CrabCode/src/utils/plugins/pluginOptionsStorage.ts、/Users/fushihua/Desktop/CrabCode/src/utils/plugins/pluginDirectories.ts |
| Bash 权限和非交互能力 | /Users/fushihua/Desktop/CrabCode/src/tools/BashTool/bashPermissions.ts、/Users/fushihua/Desktop/CrabCode/src/tools/BashTool/BashTool.tsx |
| 下游插件校验与刷新 | /Users/fushihua/Desktop/CrabCode/src/utils/plugins/validatePlugin.ts、/Users/fushihua/Desktop/CrabCode/src/utils/plugins/pluginInstallationHelpers.ts |
| 展示快照 | tests/workflow-skill-presentation-completeness.test.ts |

---

## 4. 最小可维护架构

### 4.1 一插件、两技能、一个公开入口

目标结构：

    plugins/crabaccount/
    ├── .crabcode-plugin/
    │   └── plugin.json
    ├── LICENSE
    ├── README.md
    ├── assets/
    │   └── icon.png
    ├── docs/
    │   └── legal/
    │       ├── THIRD_PARTY_NOTICES.md
    │       └── licenses/
    │           └── EasyAccounts-Skills-MIT-0.txt
    ├── schemas/
    │   └── import-batch.schema.json
    ├── scripts/
    │   ├── crabaccount.sh
    │   └── lib/
    │       ├── common.sh
    │       ├── auth.sh
    │       ├── api.sh
    │       └── journal.sh
    └── skills/
        ├── bookkeeping/
        │   ├── SKILL.md
        │   └── references/
        │       └── api-contract.md
        └── statement-import/
            ├── SKILL.md
            └── references/
                └── import-contract.md

    tests/crabaccount/
    ├── client.test.ts
    └── fixtures/
        ├── accounts.json
        ├── flows.json
        ├── partial-failure.json
        └── non-json-error.txt

只保留 crabaccount.sh 作为稳定公开入口，上游多个脚本的共同配置、认证、错误解析和参数校验收敛到私有库。这样既保留 Bash 轻量性，也避免八个公开脚本各自漂移。

测试放在根 tests/crabaccount 下，使现有 bun test ./tests/ 自动覆盖，不为插件引入独立测试框架。

### 4.2 CLI 契约

建议子命令：

    crabaccount.sh --data-dir PATH doctor
    crabaccount.sh --data-dir PATH config show|set
    crabaccount.sh --data-dir PATH auth status|login
    crabaccount.sh --data-dir PATH accounts list
    crabaccount.sh --data-dir PATH categories list
    crabaccount.sh --data-dir PATH actions list
    crabaccount.sh --data-dir PATH flows query|stats|export
    crabaccount.sh --data-dir PATH flows add|update
    crabaccount.sh --data-dir PATH transfers create
    crabaccount.sh --data-dir PATH import preview|apply|status

统一约定：

- stdout 只输出稳定 JSON；诊断和可操作提示走 stderr；
- 输出不得夹带二进制、Token、密码、curl 详情或完整原始账单；
- 稳定错误代码至少包括 CONFIG_REQUIRED、AUTH_REQUIRED、VALIDATION_ERROR、NETWORK_ERROR、REMOTE_ERROR、COMMIT_UNKNOWN、PARTIAL；
- 写命令默认只校验并生成预览，只有 --apply 加匹配 digest 才发请求；
- 任何写操作都返回逐行状态和 runId。

---

## 5. API 兼容性必须先过闸

当前没有目标后端完整源码。固定上游 Skills 提供的是“已观察到的适配器行为”，不是正式服务协议。实施写功能前先产出 skills/bookkeeping/references/api-contract.md，逐项记录：

| 能力 | method/path | auth | request | 成功响应 | 错误响应 | 分页/上限 | 幂等性 | 写后核对方法 | 实测状态 |
|---|---|---|---|---|---|---|---|---|---|

至少验证：

- 登录、服务版本、账户、分类、动作、流水查询；
- 新增、更新、转账和服务端导出；
- 字段必填性、金额/日期格式、时区、默认币种；
- 查询是否只返回前 100 条及其分页方式；
- update 是否为全量覆盖，是否必须保留原 createDate 等字段；
- 服务端是否支持稳定外部 ID、幂等键、来源字段、备注检索和删除；
- POST 成功、业务失败、非 JSON、空响应、超时、连接重置和 5xx；
- 导出究竟只返回服务端文件名，还是可安全下载的 URL/文件流。

在验证前不得把 from、品牌备注、删除、自动回滚、幂等、完整分页或可下载工作簿写成既定能力。

doctor 只做只读探测：

- bash 3.2+、curl、jq、可用的 SHA-256 工具，以及登录协议所需的 MD5 兼容实现；
- 配置文件权限与 data dir 可写性；
- URL 规范化和 TLS 策略；
- 认证状态；
- 服务版本和必须端点的响应形状。

未知版本或响应 schema 不匹配时 fail closed：允许本地预览和只读诊断，禁止写入。

---

## 6. 配置、认证与传输安全

### 6.1 Base URL

接受 https://host[:port][/deployment-prefix]，由客户端统一追加一次 /api。禁止：

- userinfo；
- query 和 fragment；
- 已经重复包含 /api 的模糊配置；
- 前后空白、换行和控制字符；
- 默认跟随重定向；
- curl -k 或任何关闭 TLS 校验的方式。

HTTPS 是默认。HTTP 仅对 localhost、127.0.0.0/8 和 ::1 自动允许；其他 HTTP 必须由用户在启动 CrabCode 前显式设置一次性 CRABACCOUNT_ALLOW_INSECURE_HTTP=1。不要在 Bash 中自造复杂的私网 DNS/IP 判定。

Token 绑定规范化 API base（包括部署前缀）；地址改变立即使 Token 失效。重定向默认拒绝，避免凭据跨 origin 泄露。

### 6.2 本地数据

crabaccount.sh 启动即执行 umask 077：

- data dir 为 0700；
- 配置、Token、待确认 payload 和 journal 为 0600；
- 敏感文件采用同目录临时文件、chmod 后原子 rename；
- 拒绝把敏感目标写到符号链接；
- Token 不得出现在 argv、日志或错误文本中；
- curl 认证头通过 stdin config 或受保护的临时配置传入，不把 Bearer Token 放在命令参数里。

插件卸载可能删除数据目录，因此 journal 是恢复辅助，不是永久财务档案。用户仍应使用服务端备份。

### 6.3 密码与旧协议

密码永不：

- 出现在 CrabCode 对话；
- 作为技能参数或 Shell argv；
- 写入配置、日志、journal 或临时账单；
- 被默认长期保存。

首次登录由用户在自己的终端运行由技能生成的绝对路径命令，login 子命令用 /dev/tty 和 read -s 隐藏输入。代理不得请求用户把密码粘贴进对话。

用户可在启动 CrabCode 前自行设置一次性 CRABACCOUNT_PASSWORD，供当前进程自动续期；这是显式 opt-in，不持久化。脚本读取后应立即从自身环境 unset，且不得传给 curl 子进程。Token 失效且没有会话密码时，停止写操作并给出终端重新登录指令。

manifest 虽支持敏感 userConfig，但下游不会把敏感值替换进技能正文，纯 Bash 技能也没有安全读取通道。因此 v0.1 不用 userConfig 保存密码；Base URL 和用户名可放在 0600 配置文件中，密码仍走终端交互或用户预置的会话环境。

固定上游协议会在提交登录请求前做 MD5。文档必须明确：这是旧服务兼容所需的协议变换，不是加密、密码存储方案或安全哈希；它不能替代 HTTPS。

### 6.4 请求重试

- GET/只读请求：仅对明确可重试的网络错误和 429/部分 5xx 做有界退避；
- POST/PUT 写请求：只有服务端已验证支持可靠幂等键时才允许自动重试；
- 写后超时、断线、空响应或无法解析响应：标记 commit_unknown，先查账核对；
- 401：读请求可登录后重试；写请求必须先判断前次是否可能已经落账；
- 禁止“捕获任意错误后重新发一遍”。

---

## 7. 日常记账技能设计

### 7.1 只读能力

- doctor、配置状态和认证状态；
- 账户、分类、动作列表；
- 流水查询、区间统计和年度统计；
- 服务端原生导出。

服务端导出只按实测能力描述。如果响应只是 Resource/excel/screen 下的文件名，就只向用户报告服务端位置，不虚构下载 URL。本地生成格式化工作簿不属于 v0.1 核心。

### 7.2 写入能力

- 新增收入或支出；
- 更新已有流水；
- 账户间转账；
- 导入批次逐行写入。

每次写入都经过：

    收集字段
      → 查询真实账户/分类/动作 ID
      → 本地校验
      → 展示人类可读预览
      → 生成 payload digest
      → 用户确认
      → --apply + digest
      → 写后核对与回执

技能中的业务确认和 CrabCode 的工具权限确认是两层不同防线，不能互相替代。digest 绑定的是“用户看到的 payload 未漂移”，不是用户身份的密码学证明。

更新流水时先读取原记录并做字段合并，必须保留未修改字段和原始 createDate；在实测确认 update 是部分更新前，按全量覆盖的保守模型处理。

转账使用服务端已验证的单次语义调用和目标 accountToId。不得把账单中金额相同的两行自动合并成转账，也不得自行发送两个互相抵消的普通流水来模拟事务。

---

## 8. 账单导入设计

### 8.1 办公路由的真实工作方式

推荐流程：

    收到文件
      → 调用对应办公技能 FQN，加载文件处理指导
      → 用 CrabCode FileRead/办公能力读取
      → CrabAccount 检查是否截断、缺页或 OCR 不确定
      → 标准化为 canonical JSON
      → 查询并映射真实账本 ID
      → 查重、合计和异常预览
      → digest 确认
      → 逐行提交并记录状态

办公技能不负责账本 ID 映射、去重策略、业务确认或账务写入。

如果返回精确 Unknown skill：

1. 说明办公套件未加载，而不是自动安装；
2. 继续尝试 CrabCode 核心 FileRead；
3. 检测到截断时禁止把预览当完整账单；
4. 核心读取也不足时，要求用户转换格式、指定页码或粘贴结构化表格；
5. 可提示通过 /plugin 安装或启用办公套件；
6. 安装后只重试文件处理阶段，不重复已完成的账本写入。

### 8.2 v0.1 格式矩阵

| 输入 | v0.1 策略 | 写入门禁 |
|---|---|---|
| 粘贴 JSON/Markdown 表格 | CrabAccount 直接标准化 | 行数、合计和字段复核 |
| CSV/TSV | 先调用表格技能，再用 FileRead 完整读取；不得用 Shell IFS 粗拆 | 必须证明没有截断，并覆盖引号、换行、BOM、CRLF 和空字段 |
| XLSX | 表格技能 + FileRead；当前核心预览存在行数/工作表/文件大小边界 | 任何截断提示都阻断写入，必要时另存 CSV |
| XLS | 依赖可用的 LibreOffice；否则要求转换 | 完整性无法证明则不写 |
| XLSM | 只允许读取单元格值，绝不执行宏、公式、外链或嵌入指令 | 无法保证静态读取时要求另存 CSV/XLSX |
| 文本型 PDF | PDF 技能 + FileRead 文本层 | 逐页、逐行、总额复核；密码保护文件要求用户在本地提供已解锁副本 |
| 扫描 PDF | OCR 辅助，默认低置信 | 必须人工复核，不允许无人值守批量写入；密码不得发到对话 |
| OFX/QFX/QIF/CAMT/MT940 | v0.1 不支持 | 明确提示，不路由给通用办公解析器冒充支持 |

Phase 0 必须做办公集成探针。当前 office suite CLI 主要是 summarize，XLSX/PDF 辅助层仍不完整；如果无法稳定得到完整行数据，就把对应格式标为“辅助导入”，而不是在 CrabAccount 中重造完整办公引擎。CSV 若要升级为确定性完整导入，需单独批准一个窄小、经过 RFC 4180 测试的解析器；不能用 Bash 近似解析。

### 8.3 Canonical 数据合同

所有来源先转换为同一个版本化中间结构，再进行映射和写入。示意：

~~~json
{
  "schemaVersion": "1",
  "batch": {
    "sourceType": "csv",
    "inputSha256": "…",
    "sourceName": "redacted",
    "apiBase": "https://ledger.example/api"
  },
  "defaults": {
    "currency": "CNY",
    "timeZone": "Asia/Shanghai"
  },
  "transactions": [
    {
      "source": {
        "sheet": null,
        "row": 2,
        "page": null,
        "externalId": null
      },
      "occurredAt": "2026-07-01T12:30:00+08:00",
      "postedAt": null,
      "amount": "25.80",
      "currency": "CNY",
      "kind": "expense",
      "status": "posted",
      "sourceAccountHint": "尾号 1234",
      "targetAccountHint": null,
      "categoryHint": "餐饮",
      "counterparty": "示例商户",
      "rawDescription": "午餐",
      "note": "",
      "parseConfidence": 0.98,
      "warnings": []
    }
  ]
}
~~~

规则：

- amount 是正数十进制字符串，收支方向由 kind 表达，避免浮点和符号约定混淆；
- kind 至少为 expense、income、transfer、refund；
- pending 和 void 默认不入账；
- 退款不能仅靠负数猜测；
- v0.1 每批只允许一个已确认币种，不静默换汇；
- rawDescription 与用户 note 分开；
- 文件内容一律视为不可信数据，不执行其中的公式、宏、链接或提示词；
- sourceName 在日志中应脱敏，原文件不复制到 plugin data。

### 8.4 状态机

    intake
      → extract
      → normalize
      → validate
      → map
      → reconcile
      → preview
      → confirmed
      → commit
      → verify
      → completed

    旁路状态：
      rejected
      needs_mapping
      partial
      commit_unknown

任何数据、目标 API base、映射 ID 或操作类型改变，都会使原确认失效并回到 preview。

### 8.5 映射配置

可保存小型、版本化、origin 绑定的导入 profile：

- 列名与 canonical 字段映射；
- 日期、时区、小数点和借贷方向规则；
- 默认账户、币种与分类映射；
- 来源账户提示与真实账本 ID；
- profile schema 版本和目标 API base。

只有批次成功并经用户确认后才保存/更新 profile。真实 ID 消失或 origin 改变时立即失效。v0.1 不做规则引擎、不自动创建主数据、不从一次模糊匹配中永久学习。

### 8.6 去重与确认

确定性重复仅来自：

- 来源提供的稳定 externalId，且与同一 origin 的既有成功回执匹配；
- 本地 journal 中已确认 success 的同一行；
- 可选的服务端稳定标记，但前提是实测确认备注容量、检索和用户接受可见标记。

日期、金额、商户、账户和描述的相似组合只能把 canonical `duplicateStatus` 标记为 `possible`，必须让用户选择“跳过、导入或重新映射”，不能静默跳过或覆盖。

内容哈希不是业务唯一 ID。当前查询若存在 100 条上限，远端历史查重只能标为 best effort，不能宣传全库去重。

previewDigest 计算范围：

    SHA-256(
      canonical 标准化行
      + 目标 API base
      + 已解析账户/分类/动作 ID
      + 每行操作类型
    )

确认页至少展示：总行数、收入/支出/退款/转账数量、币种、合计、未映射、低置信、确定重复、重复候选和拟写入数。

### 8.7 非原子提交与恢复

固定上游 batch 行为是顺序调用单笔新增，不是服务端原子批量接口。每行 journal 状态必须区分：

| 状态 | 含义 | 后续动作 |
|---|---|---|
| success | 收到可验证成功响应并保存服务端 ID | 永不自动重试 |
| confirmed_failed | 服务端明确拒绝且确认未写入 | 修正后可仅重试该行 |
| commit_unknown | 请求可能到达，但结果无法确认 | 先按外部 ID/时间金额/回执远端核对，禁止自动重放 |

journal 最小记录：

- runId、schemaVersion、API base 哈希；
- 输入 SHA-256、previewDigest、确认时间；
- canonical schema/fingerprint 版本；
- 每行来源定位、状态、服务端记录 ID 和错误代码；
- 不记录密码、Token、完整原始文件、完整备注或不必要的商户隐私。

服务端无删除契约时，不使用“自动回滚”一词。部分成功后的恢复是继续明确失败行、核对未知行或由用户在账本中人工纠偏。

### 8.8 导出安全

若生成供复核的 CSV/XLSX，防止公式注入：对以 =、+、-、@ 开头的显示值在导出层做中和，同时保持 canonical 内部值不变。参照 [OWASP CSV Injection](https://owasp.org/www-community/attacks/CSV_Injection)。

---

## 9. 隐私与用户告知

个人账单属于高敏感数据。statement-import 开始时应明确告知：

- 文件内容可能进入当前已配置模型的上下文；
- CrabAccount 脚本只向用户配置的账本 API base 发请求，不向其他外部服务上传；
- 调用办公技能后，还受该能力自身的本地工具和数据处理约束；
- 原始文件不复制到 plugin data；
- 成功批次只保留最小脱敏回执；partial/commit_unknown 只暂存恢复所需最小状态；
- 用户可在完成核对后删除导入 journal。

默认日志脱敏不意味着屏蔽用户主动查询的账目结果。只读结果可按用户请求展示，但调试日志和持久化回执必须最小化。

---

## 10. 外部项目调研与取舍

以下只采用设计模式，不引入其源码：

| 项目/资料 | 可借鉴 | 本项目不照搬 |
|---|---|---|
| [Actual Budget 导入](https://actualbudget.org/docs/transactions/importing/) / [API](https://actualbudget.org/docs/api/)（MIT） | imported_id 优先、相似项只作候选、dry-run、备份意识 | 不引入其同步引擎或完整预算模型 |
| [Firefly III Data Importer](https://github.com/firefly-iii/data-importer) / [CSV 文档](https://docs.firefly-iii.org/how-to/data-importer/import/csv/)（AGPL-3.0） | 转换/验证与提交分阶段、可复用映射、批次标签、稳定退出码 | 不复制 AGPL 源码，不引入独立 importer 服务 |
| [GnuCash 导入匹配](https://www.gnucash.org/docs/v5/C/gnucash-manual/trans-import.html)（GPL） | 候选匹配、人类覆盖、谨慎学习账户映射 | 不复制概率阈值或专用双式账模型 |
| [Beancount 导入设计](https://beancount.github.io/docs/importing_external_data/) / [Beangulp](https://github.com/beancount/beangulp)（GPL） | identify → extract → file 分层、golden fixtures | 不引入记账 DSL |
| [Paisa Import](https://paisa.fyi/reference/import/)（AGPL-3.0） | 原始预览与账本预览分开、映射配置、PDF 低保证 | 不把实验性 PDF 解析宣传成确定性能力 |
| [Blnk](https://github.com/blnkfinance/blnk)（Apache-2.0） | 对账、账本保证和不可变性是服务端能力 | 不为个人插件重建 ledger backend |
| [Maybe](https://github.com/maybe-finance/maybe)（AGPL，仓库已归档） | 反证：完整金融应用、同步和商标边界会显著扩大范围 | 不做账户聚合、投资追踪或应用再品牌 |
| [Stripe 幂等请求](https://docs.stripe.com/api/idempotent_requests) / [低层错误](https://docs.stripe.com/error-low-level) | 服务端无幂等键时，写后断线的结果可能未知 | 不用本地哈希冒充服务端 exactly-once |
| [Modern Treasury Ledger Guarantees](https://docs.moderntreasury.com/ledgers/docs/ledgers-guarantees) | 原子性、不可变性、幂等性必须由服务端契约提供 | 不宣称当前后端拥有未验证的账本保证 |

从这些项目抽取出的最小共识是：导入必须先标准化和预览，模糊重复必须人工判断，映射应可复用但要绑定来源，提交要有持久化回执，服务端不提供幂等性时必须承认“结果未知”。

---

## 11. 分阶段实施与退出门禁

### Phase 0：契约与办公能力探针

任务：

- 固定并记录上游提交与许可证；
- 在隔离、可销毁账本上完成 endpoint 矩阵；
- 验证服务版本、时区、币种、分页、更新、导出和错误响应；
- 验证两个 office FQN、Unknown skill、FileRead 截断提示和各格式真实边界；
- 决定 CSV 是“完整支持”还是“辅助导入”；若要求完整支持，另行批准窄小确定性解析器；
- 产出 api-contract.md 和 import-contract.md 的验证版。

退出门禁：

- 所有 v0.1 写能力都有请求、响应和失败证据；
- 未验证能力被降级或移出范围；
- 办公格式矩阵与现实能力一致。

### Phase 1：插件骨架与品牌

任务：

- 建立目录、manifest、两个 SKILL、README 和法律文件；
- 添加 Marketplace 条目；
- 添加合规图标或暂不声明图标字段；
- 写入两个 office FQN 和 bookkeeping 精确豁免；
- 更新 Marketplace 根版本和展示快照。

退出门禁：

- 只发现两个目标 FQN；
- manifest、marketplace、layout、presentation 和 refs 校验通过；
- 用户可见旧品牌扫描为零，法律目录除外。

### Phase 2：安全客户端与认证

任务：

- 实现单一 crabaccount.sh 和私有库；
- URL、TLS、redirect、data dir、权限、原子写和符号链接防护；
- doctor、config、auth status 和终端交互登录；
- JSON stdout、stderr、错误码、有界读重试和写入未知状态；
- fake curl 自动化测试。

退出门禁：

- 密码/Token 不进入对话、argv、日志；
- 公网 HTTP、userinfo、query、fragment、跨 origin redirect 被阻断；
- 进程参数检查不暴露 Bearer Token；
- 写请求网络异常不会自动重放。

### Phase 3：日常记账

任务：

- 账户/分类/动作/流水查询与统计；
- 新增、更新、转账和服务端导出；
- 写操作 preview、digest、--apply、写后核对；
- 更新字段合并和 createDate 保留；
- 只读 allowed-tools 精确规则。

退出门禁：

- 每个写操作有 golden payload；
- 无 --apply 或 digest 不匹配时零 HTTP 写请求；
- 更新不丢字段，转账不被拆成两条普通流水；
- 导出行为与实测响应一致。

### Phase 4：账单导入

任务：

- canonical schema、格式路由、完整性检查；
- 映射 profile、确定重复和候选重复；
- previewDigest、确认摘要、journal；
- success / confirmed_failed / commit_unknown 三态；
- PDF/OCR 低置信阻断和 CSV 注入防护。

退出门禁：

- 任一截断、缺页、币种冲突、未映射或低置信状态都能阻断自动写入；
- 部分成功可恢复，未知结果不会重放；
- 原始账单和完整备注不进入持久日志。

### Phase 5：全链验收与发布

任务：

- inline 模式和 Marketplace 安装态分别测试；
- 验证 /reload-plugins、更新后重启和版本同步；
- 在专用可销毁账本运行 opt-in 实服测试；
- 完成 README、故障恢复、卸载数据提醒和法律复核。

退出门禁：

- 所有自动化门禁通过；
- 核心 bookkeeping 在 office 缺失时仍可用；
- 安装态能触发两个技能，更新后新版本实际生效；
- 无生产账本被自动测试修改。

---

## 12. 测试与验证矩阵

### 12.1 自动化测试

必须覆盖：

- bash -n；可用时运行 shellcheck，但不把未声明依赖作为唯一门禁；
- doctor 缺 bash/curl/jq/SHA/MD5 兼容工具的可操作错误；
- URL 部署前缀、重复 /api、userinfo、query、fragment、HTTP 和 redirect；
- data dir 0700、文件 0600、原子写、符号链接拒绝；
- 手工登录、Token 过期、无会话密码；
- 401、429、非 JSON、空响应、超时、连接重置和 5xx；
- GET 有界重试，写后未知不重试；
- 每个写操作的 golden payload；
- 金额、日期、币种、ID、同账户转账校验；
- --apply 缺失和 digest 漂移时零写请求；
- 更新合并不丢字段；
- 顺序批量的成功、明确失败、未知和恢复；
- office FQN、Unknown skill 和 FileRead 降级；
- XLSX 49/50/51 行、截断提示、超限文件；
- 文本 PDF、扫描 PDF、多页缺页和 OCR 低置信；
- 若 CSV 被定为完整支持，覆盖引号内逗号/换行、UTF-8 BOM、CRLF、空字段、中文和公式注入；若仅辅助导入，则测试其完整性阻断与转换提示；
- 用户可见品牌与法律例外。

网络测试用 PATH 注入的 fake curl 捕获请求，不在 CI 访问真实账本。实服测试只在显式 CRABACCOUNT_TEST_BASE_URL 存在时运行，并要求专用可销毁数据。

所有 fixtures 必须是合成或脱敏数据，禁止提交真实个人账单。

### 12.2 仓库门禁

实施完成时运行：

~~~bash
bun run lint:manifest
bun run lint:marketplace
bun run lint:layout
bun run lint:refs
bun run lint:brand
bun run lint:tool-scope
bun run typecheck
bun test ./tests/
bun run validate

# 当前原生启动器需用 -- 把 TS 子命令透传
crabcode -- plugin validate /Users/fushihua/Desktop/CrabCode-Plugin/plugins/crabaccount
~~~

lint:refs 当前存在一个与 CrabAccount 无关的历史 warning，因此完成口径是“CrabAccount 不新增 error 或 warning”，除非同期另行修复基线。

### 12.3 下游验收

| 测试面 | 场景 | 通过标准 |
|---|---|---|
| 技能发现 | --plugin-dir 启动 | 只出现两个目标 FQN |
| 路径替换 | ROOT/DATA/SKILL_DIR | 脚本收到绝对 --data-dir，不依赖 env |
| 数据隔离 | inline 与安装态 | 配置路径隔离且文档明确 |
| 办公缺失 | Unknown skill | 继续 FileRead/转换/粘贴降级，不影响日常记账 |
| 权限 | 只读与写命令 | 只读可窄授权；写命令仍需工具确认和业务确认 |
| 确认绑定 | 预览后改 payload | digest 不一致时拒绝提交 |
| 写入恢复 | POST 超时、部分成功 | 未知不重放，只继续明确失败行 |
| 安装更新 | 安装、启用、升级 | reload/restart 后新版本生效 |
| 卸载 | 最后 scope 卸载 | 明确提示本地配置、Token、journal 会删除 |

---

## 13. 风险、降级与非目标

| 风险 | 默认策略 |
|---|---|
| 后端版本或 schema 不兼容 | doctor fail closed，禁止写入 |
| 无服务端幂等键 | 本地 journal + 写后核对；未知结果不重放 |
| 查询只有前 100 条 | 明示查重不完整，候选交给用户 |
| 办公 provider 未安装 | FileRead、格式转换或粘贴表格降级 |
| 办公 provider 能力不足 | 对应格式标为辅助导入，不自造完整引擎 |
| PDF/OCR 置信度不足 | 阻断自动批量写入 |
| 部分写入成功 | 记录逐行结果，不宣称回滚 |
| 用户忘记凭据 | 终端重新登录，不在对话收密码 |
| inline/安装态数据不共享 | 分别配置或使用显式测试 data dir |
| 更新后缓存仍旧 | reload 或重启，并同步递增版本 |

以下事项只有出现真实需求和独立验收标准时才进入后续版本：

- OFX/QFX，其次 CAMT，再评估 QIF；
- 独立确定性 CSV 解析器；
- 服务端幂等键/外部 ID 支持；
- Windows 原生客户端；
- 规则化自动分类；
- 多币种与汇率；
- 本地格式化报表输出；
- 更适合个人财务的 Marketplace 分类治理。

---

## 14. 完成定义

只有同时满足以下条件，CrabAccount v0.1 才可视为完成：

1. 插件只暴露 crabaccount:bookkeeping 和 crabaccount:statement-import。
2. 所有用户可见命名统一为 CrabAccount，来源和法律例外可追溯。
3. manifest、Marketplace、中文展示、版本和快照符合本仓规则。
4. 日常记账不依赖 office suite；账单文件按完整 FQN 路由并有 Unknown skill 降级。
5. 脚本显式接收 --data-dir，不误把 CrabCode 文本替换变量当作 env。
6. 密码不进入对话/argv/文件，Token 不进入进程参数或日志。
7. 所有写操作先预览、绑定 digest、经业务确认和工具权限确认后执行。
8. 批量提交明确承认非原子，区分 success、confirmed_failed 和 commit_unknown。
9. 未验证的 API、分页、幂等、导出和删除能力不会出现在产品承诺中。
10. 原始账单不持久化，审计回执足以恢复但保持最小化。
11. 自动化和下游 inline 验收通过；Marketplace 安装态在可使用官方来源的发布环境验收，专用实服测试仅在显式提供 `CRABACCOUNT_TEST_BASE_URL` 时运行，二者不得用生产账本或本地改名市场冒充通过。
12. 没有为“以后可能需要”添加 MCP、数据库、hooks、groups、前端或完整办公解析器。

本方案的核心不是把上游脚本换个名字，而是把一个能调用记账 API 的原型，收敛成符合 CrabCode 规范、边界诚实、写入可确认、故障可核对、办公能力可降级的 CrabAccount 工作流插件。
