# CrabAccount 智能记账

CrabAccount 是面向 CrabCode 的个人记账工作流插件。它连接用户自行部署的兼容账本服务，提供日常记账、查账、统计、转账、流水修改，以及经过核对的账单导入。

插件只提供两个稳定技能：

- `crabaccount:bookkeeping`：日常记账、查账、统计、转账与流水修改。
- `crabaccount:statement-import`：把已完整提取的表格或 PDF 账单标准化、映射、查重、预览并逐行提交。

## 安全边界

- 密码不得粘贴到 CrabCode 对话，也不得作为命令参数。首次登录必须由用户在自己的终端运行隐藏输入命令。
- Token 仅保存在 CrabCode 分配的插件数据目录，权限为 `0600`；配置和恢复 journal 同样最小化保存。
- 所有账务写入先生成预览和 SHA-256 digest；只有用户确认后，带匹配 digest 的 `--apply` 才会提交。
- 批量导入不是服务端原子事务。每行区分 `success`、`confirmed_failed` 和 `commit_unknown`；结果未知时禁止盲目重试。
- 默认只允许 HTTPS。HTTP 仅自动允许 localhost、`127.0.0.0/8` 和 `::1`。
- 不支持删除流水或主数据，也不创建账户、分类和动作。

## 首次配置

CrabCode 技能正文中的 `${CRABCODE_PLUGIN_ROOT}` 和 `${CRABCODE_PLUGIN_DATA}` 会在运行时替换为绝对路径。请在自己的终端使用技能展示的实际绝对路径运行以下命令，不要把下面的占位符原样复制：

```bash
bash "<插件绝对目录>/scripts/crabaccount.sh" --data-dir "<插件数据绝对目录>" config set --base-url "https://ledger.example" --username "your-user"
bash "<插件绝对目录>/scripts/crabaccount.sh" --data-dir "<插件数据绝对目录>" auth login
bash "<插件绝对目录>/scripts/crabaccount.sh" --data-dir "<插件数据绝对目录>" doctor
```

`auth login` 从 `/dev/tty` 隐藏读取密码。旧服务要求的 MD5 只是协议兼容变换，不是密码加密或安全存储；HTTPS 仍是必要条件。

## 运行环境

- Bash 3.2+
- curl
- jq
- `shasum`、`sha256sum` 或 OpenSSL（SHA-256）
- `md5`、`md5sum` 或 OpenSSL（仅用于兼容登录协议）

插件数据目录在 inline `--plugin-dir` 模式和 Marketplace 安装态可能不同，配置与 Token 不会自动共享。卸载最后一个插件 scope 时，该目录可能被删除；服务端备份才是永久财务档案。

## 文件导入边界

CrabAccount 不内置完整 Excel、PDF 或 OCR 引擎。表格文件路由到 `crabcode-office-suite:crabcode-spreadsheets`，PDF 路由到 `crabcode-office-suite:crabcode-pdf`；办公套件缺失时可退回 CrabCode FileRead、转换格式或粘贴结构化数据。任何截断、缺页、低置信、未映射或币种冲突都会阻断写入。

CSV/TSV、XLS/XLSX/XLSM、PDF 在 v0.1 均属于“辅助抽取后导入”：只有完整性得到证明并转换为 canonical JSON 后，才进入预览与提交。OFX、QFX、QIF、CAMT 和 MT940 不支持。

## 许可

插件整体使用 Apache-2.0。第三方来源和固定提交记录见 `docs/legal/THIRD_PARTY_NOTICES.md`。
