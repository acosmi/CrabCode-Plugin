# crabaccount v0.1.0

发布日期：2026-07-16  
插件路径：`plugins/crabaccount`  
版本：`0.1.0`（与 `.crabcode-plugin/plugin.json` 一致）

## 变更摘要

面向 CrabCode 的个人记账工作流插件：连接用户自行部署的兼容账本服务。

- **`crabaccount:bookkeeping`**：日常记账、查账、统计、转账与流水修改  
- **`crabaccount:statement-import`**：已抽取表格/PDF 账单的标准化、映射、查重、预览与逐行提交  

## 安全与边界

- 密码不得进入对话或命令行参数；首次登录须在用户本机终端隐藏输入  
- Token 仅存插件数据目录（`0600`）；账务写入先预览 + SHA-256 digest，用户确认后才 `--apply`  
- 批量导入非服务端原子事务；结果未知时禁止盲目重试  
- 默认仅 HTTPS；HTTP 仅限 localhost  
- 不支持删除流水/主数据，不创建账户、分类与动作  
- 不内置完整 Excel/PDF/OCR；依赖 office 套件或人工结构化数据后导入  

## 运行环境

Bash 3.2+、curl、jq、SHA-256 / MD5 兼容工具（登录协议兼容）。

## 许可

Apache-2.0。第三方说明见 `plugins/crabaccount/docs/legal/THIRD_PARTY_NOTICES.md`。

## 说明

本标签为 monorepo 内插件级发版；代码已于 `main` 合入（`f8e1ca6` / `3afa5ae`）。与 `media-ops-v0.4.0` 为独立发布物。
