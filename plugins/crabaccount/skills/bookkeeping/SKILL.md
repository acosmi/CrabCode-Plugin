---
name: 日常记账与查账
short-description: 连接自建账本，安全完成收支记录、查账、统计、转账和流水修改
description: 连接用户自行部署的兼容账本服务，处理个人或家庭的收入支出记录、流水查询、区间统计、内部转账和已有流水修改。当用户说“记一笔”“查本月账单”“统计收支”“账户转账”或“修改刚才那笔记录”时使用。
when_to_use: "Use when the user wants personal or household bookkeeping against a compatible self-hosted ledger, including adding an entry, querying transactions, calculating totals, transferring between accounts, or correcting an existing entry."
argument-hint: "[记账、查账、统计、转账或修改需求]"
brand-color: "#0F766E"
version: 0.1.0
allowed-tools:
  - Read
  - Skill
  - Bash(bash "${CRABCODE_PLUGIN_ROOT}/scripts/crabaccount.sh" --data-dir "${CRABCODE_PLUGIN_DATA}" doctor:*)
  - Bash(bash "${CRABCODE_PLUGIN_ROOT}/scripts/crabaccount.sh" --data-dir "${CRABCODE_PLUGIN_DATA}" config show:*)
  - Bash(bash "${CRABCODE_PLUGIN_ROOT}/scripts/crabaccount.sh" --data-dir "${CRABCODE_PLUGIN_DATA}" auth status:*)
  - Bash(bash "${CRABCODE_PLUGIN_ROOT}/scripts/crabaccount.sh" --data-dir "${CRABCODE_PLUGIN_DATA}" accounts list:*)
  - Bash(bash "${CRABCODE_PLUGIN_ROOT}/scripts/crabaccount.sh" --data-dir "${CRABCODE_PLUGIN_DATA}" categories list:*)
  - Bash(bash "${CRABCODE_PLUGIN_ROOT}/scripts/crabaccount.sh" --data-dir "${CRABCODE_PLUGIN_DATA}" actions list:*)
  - Bash(bash "${CRABCODE_PLUGIN_ROOT}/scripts/crabaccount.sh" --data-dir "${CRABCODE_PLUGIN_DATA}" flows get:*)
  - Bash(bash "${CRABCODE_PLUGIN_ROOT}/scripts/crabaccount.sh" --data-dir "${CRABCODE_PLUGIN_DATA}" flows query:*)
  - Bash(bash "${CRABCODE_PLUGIN_ROOT}/scripts/crabaccount.sh" --data-dir "${CRABCODE_PLUGIN_DATA}" flows stats:*)
---

# 日常记账与查账

只通过 CrabAccount CLI 操作账本，不直接拼 curl，不猜端点，不创建或删除账户、分类、动作与流水。

稳定入口：

```bash
bash "${CRABCODE_PLUGIN_ROOT}/scripts/crabaccount.sh" --data-dir "${CRABCODE_PLUGIN_DATA}" <command>
```

`${CRABCODE_PLUGIN_ROOT}` 和 `${CRABCODE_PLUGIN_DATA}` 由 CrabCode 在技能加载时替换。它们不是 Shell 自动继承的环境变量，所以每次都显式传 `--data-dir`。

## 开始前

1. 运行 `config show`、`auth status` 和 `doctor`。
2. 若未配置，让用户提供账本页面的 base URL 和用户名；运行 `config set --base-url URL --username USER`。公网只接受 HTTPS。
3. 密码永不进入对话或命令参数。需要登录时，把替换完成的绝对命令 `... auth login` 展示给用户，让用户在自己的终端执行；不要替用户调用。
4. `doctor` 未返回 `compatible: true` 时只做本地预览和诊断，禁止写账。

旧服务登录中的 MD5 只是协议兼容变换，不是密码加密或安全存储，也不能替代 HTTPS。

## 读取主数据

写账前总是读取真实 ID：

```bash
# 账户
bash "${CRABCODE_PLUGIN_ROOT}/scripts/crabaccount.sh" --data-dir "${CRABCODE_PLUGIN_DATA}" accounts list

# 分类；有子分类的一级分类不可直接使用
bash "${CRABCODE_PLUGIN_ROOT}/scripts/crabaccount.sh" --data-dir "${CRABCODE_PLUGIN_DATA}" categories list

# 动作；handle 0=收入、1=支出、2=内部转账
bash "${CRABCODE_PLUGIN_ROOT}/scripts/crabaccount.sh" --data-dir "${CRABCODE_PLUGIN_DATA}" actions list
```

`typeId` 是分类，`actionId` 是收支动作，不得混用。金额只传正数十进制字符串，方向由动作决定。账户、分类或动作匹配不唯一时让用户选择，不自行猜测。

## 查账与统计

```bash
# 单条详情
... flows get --flow-id 123

# 条件查询
... flows query --handle 3 --start-date 2026-07-01 --end-date 2026-07-31

# 年度统计
... flows stats --year 2026
```

查询结果若标记截断，只把它描述为局部结果；不要据此宣称全库去重或完整统计。

<!-- capability-route: office-spreadsheets=none(服务端原生导出仅返回服务端产物，不进行本地表格生成或编辑) -->

服务端原生导出使用 `flows export`，它会先返回预览 digest。用户确认后再加 `--apply --digest DIGEST`；只报告服务端实际返回的文件名或位置，不虚构下载 URL。

## 所有写操作的两阶段门禁

任何新增、更新、转账或导出都必须：

1. 收集字段并查询真实 ID；
2. 不带 `--apply` 运行，取得人类可读 preview、`runId` 和 `previewDigest`；
3. 把账户、分类、动作、日期、金额、备注、目标服务和操作类型展示给用户；
4. 等用户明确确认；
5. 用原命令加 `--apply --digest PREVIEW_DIGEST` 提交；
6. 检查返回的逐行状态并报告恢复动作。

工具权限确认与上述业务确认是两层防线，不能互相替代。写命令没有 always-allow 规则。

### 新增收支

```bash
... flows add --account-id 1 --type-id 5 --action-id 2 --money 30.00 --date 2026-07-15 --note "午餐"
```

### 修改流水

先 `flows get --flow-id ID`。更新命令会再次读取原记录并合并字段；服务端记录缺少 `createDate` 时会 fail closed，避免全量覆盖丢字段。

```bash
... flows update --flow-id 123 --money 35.00 --note "午餐（更正）"
```

### 内部转账

源账户和目标账户必须不同，动作的 `handle` 必须是 2。只使用服务端单次转账语义，不拆成两条普通流水。

```bash
... transfers create --account-id 1 --account-to-id 2 --type-id 9 --action-id 7 --money 500.00 --date 2026-07-15 --note "账户调拨"
```

## 结果处理

- `success`：收到可验证成功响应并完成写后核对；不得再次提交。
- `confirmed_failed`：服务端明确拒绝且确认未写入；修正后可重新预览。
- `commit_unknown`：超时、断线、5xx、空响应、响应无法解析或写后核对失败；禁止直接重放，先按返回的 flowId、时间、金额和账户远端核对。

不使用“自动回滚”或“原子批量”描述当前服务。需要删除时引导用户在账本前端操作。

## 详细合同

需要核对端点、字段、错误语义或版本闸门时，读取 [API 合同](references/api-contract.md)。
