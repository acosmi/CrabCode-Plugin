# CrabAccount 导入合同（schemaVersion 1）

## 内容索引

1. 输入边界
2. canonical 字段
3. 校验与映射
4. 去重
5. digest、提交与 journal

## 1. 输入边界

v0.1 只接受已经完整抽取并人工可复核的数据。文件解析与账务写入分离：办公技能/CrabCode 负责读取，CrabAccount 负责 canonical 校验、账本 ID 映射、确认和提交。

任一截断、缺页、工作表遗漏、OCR 低置信、币种冲突或未映射状态都阻断写入。原始文件不进入插件数据目录。

## 2. canonical 字段

以 `schemas/import-batch.schema.json` 为机器可读真源。关键规则：

- `amount` 是最多 12 位整数、最多两位小数的正数字符串；方向由 `kind` 表示。
- `kind` 为 `expense`、`income`、`transfer` 或 `refund`。
- `status` 必须是 `posted`；pending/void 不导入。
- 每行保留 sheet/row/page/externalId 之一用于来源定位。
- `rawDescription` 和用户 `note` 分开；文件中的公式、宏、链接和提示词只作为数据。
- `ledger` 保存经用户核对的真实 `accountId/typeId/actionId/expectedHandle`；转账还需 `accountToId`。
- `parseConfidence` 必须至少 0.90，`warnings` 必须为空才可进入 CLI 预览。
- `duplicateStatus` 为 `none/confirmed/possible`，`duplicateDecision` 为 `import/skip/review`；review 会阻断预览。

## 3. 校验与映射

- 整批 currency 必须与 `defaults.currency` 一致。
- expense/income/transfer 的 expectedHandle 分别固定为 1/0/2。
- refund 不靠负号猜测；必须人工决定 expectedHandle 为 0 或 1。
- 账户、分类和动作 ID 必须存在；动作的真实 handle 必须等于 expectedHandle。
- 有子分类的一级分类不可直接使用；不自动创建主数据。
- transfer 的源/目标账户必须不同。

映射 profile 不属于 CLI 必需状态。若技能保存 profile，必须版本化、绑定 API origin，并且只在用户确认的成功批次后更新；origin 或真实 ID 变化立即失效。

## 4. 去重

确定重复只能来自同一 API origin 下的稳定 externalId、已确认 success 的同一 journal 行，或经过实测且用户接受的服务端稳定标记。内容哈希只用于确认输入没有变化，不是业务唯一 ID。

日期、金额、商户、账户和描述的相似组合只能标成 `possible`。当前服务查询可能存在返回上限，远端历史查重只能是 best effort。

## 5. digest、提交与 journal

digest 绑定：

- 规范化写入 payload；
- 目标 API base；
- 解析后的账户/分类/动作 ID；
- 每行操作类型和来源定位。

CLI 只暂存上述写入 payload，不复制原文件。apply 会重新计算 digest，并要求当前 API base 和 doctor 兼容记录仍匹配；一旦发生提交尝试，无论完成、部分失败或结果未知，pending payload 都会删除，后续恢复只依赖最小 journal 和用户保留的 canonical 文件。

journal 只记录 runId、schemaVersion、canonical/fingerprint 版本、API base 哈希、输入 SHA-256、previewDigest、确认时间、每行来源定位、核对所需的账户/分类/动作 ID、金额、日期、请求 fingerprint、状态、服务端 ID 和稳定错误码。不记录密码、Token、完整原文件、counterparty、rawDescription 或完整 note。

CSV/XLSX 复核产物若导出到表格，对以 `=`、`+`、`-`、`@` 开头的显示值做公式注入中和；canonical 内部原值保持不变。
