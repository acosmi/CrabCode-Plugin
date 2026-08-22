# CodeSucker core 来源与适配边界

## 锁定来源

- 仓库：`https://github.com/fanbuz/codesucker.git`
- 正式版本：`v0.4.5`
- annotated tag：`9ed5137e83a1cb495fd3ab5d7f3d1f5a450e424d`
- commit：`2e39375cf6891b9d958c277f1c6eb3b5104814d9`
- 上游目录：`packages/core/src`
- 本地目录：`plugins/crabcopyright-cn/vendor/codesucker-core/src`

机器可读文件清单、字节数、Git blob SHA-1 和 SHA-256 见
[`SOURCE-LOCK.json`](./SOURCE-LOCK.json)。本地 vendor 的 11 个文件必须与上游逐字节一致。

## 移植范围

仅移植纯 core：

- `async.ts`
- `audit.ts`
- `clean.ts`
- `discover.ts`
- `exclude-rules.ts`
- `index.ts`
- `language-syntax.ts`
- `render.ts`
- `select.ts`
- `types.ts`
- `version.ts`

明确不移植 Electron 应用、React UI、窗口/最近项目、更新检测、安装包、品牌图标、设计原型和发布脚本。

## 适配方式

上游 vendor 文件不修改。本地适配全部位于：

- `src/source-core-cli.ts`：路径 containment、用户确认范围、稳定行映射、第三方/生成代码提示、确定性 DOCX 规范化、manifest v2 写回和 CLI；
- `scripts/check-source-core-distribution.ts`：bundle 新鲜度；
- `scripts/verify-codesucker-port.ts`：vendor 来源完整性；
- Python `scripts/`：申请包、规则、AI、PDF、日期与跨申请校验。

这样可以把“上游原样源码”和“CrabCode/Codex 宿主适配”分开审计。任何上游同步都必须选择新 commit、重建 SOURCE-LOCK、复核许可证和重新运行差异测试；不得追随浮动 `main` 或 `latest`。

## 行为边界

CodeSucker core 提供词法清洗、发现、排序、分页、DOCX 和基础审计。本地适配不会把以下经验判断升级为官方规则：

- 末页达到 2/3；
- 文件首尾等于自然模块语义边界；
- 任意跨申请相同文件必然驳回；
- 文件 mtime 可证明真实开发日期。

最终是否可提交仍取决于当前规则注册表、AI 使用事实、申请人真实性确认、最终 PDF 和申请平台实际口径。
