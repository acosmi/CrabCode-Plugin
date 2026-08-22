# 软著申请管家 · crabcopyright-cn

面向中国版权保护中心软件著作权登记的全流程工作流插件。它负责申请规划、材料清单、
源码/说明书鉴别材料、一致性、申请包与填报指导；源码材料由内置离线确定性引擎生成，
不再依赖模型手工拼接 60 页。

## 结构

### 申请编排

| 技能 | 职责 |
|---|---|
| `apply-manager` | 总入口、阶段判断、AI 使用事实和依赖硬门 |
| `application-planning` | 仓库事实盘点、用户确认软件边界、截图计划 |
| `materials-checklist` | 按主体与开发方式核算材料 |
| `consistency-check` | 名称、版本、日期、AI、DOCX/PDF 哈希绑定复核 |
| `package-build` | 生成严格 `提交件/` 白名单和自查表 |
| `filing-guide` | 当前平台字段核对与本人签署提醒 |

### 鉴别材料

| 技能 | 职责 |
|---|---|
| `source-code-material` | 调用离线 source-core 生成可追溯 TXT/DOCX、逐行映射和审计 |
| `manual-material` | 整理真实说明书、绑定实际截图并验收 PDF |

### 只读代理

- `sc-material-collector`：仅收集仓库客观库存；无 AI 模式不替用户决定边界。
- `manual-evidence-collector`：核对路由/端口/页面；不制造截图。
- `filing-reviewer`：独立复跑全部确定性校验，只报告不修改。

标准 `agents/` 目录由 CrabCode 自动发现；不要在 manifest 重复声明目录。

## 确定性源码内核

`dist/source-core.js` 是预构建、离线运行的 Node bundle：

```bash
node ${CRABCODE_PLUGIN_ROOT}/dist/source-core.js generate   --manifest outputs/<申请名>/manifest.json
```

核心能力来自锁定的 CodeSucker v0.4.5 纯 core，vendor 文件保持逐字节一致：

- commit：`2e39375cf6891b9d958c277f1c6eb3b5104814d9`
- 来源锁：`docs/legal/SOURCE-LOCK.json`
- 许可与 NOTICE：`docs/legal/`
- Electron/UI、更新检测、窗口与安装器均未移植

本地适配增加源码根 containment、显式用户范围确认、相对路径、逐行来源映射、
SPDX/署名/生成代码/敏感信息审计、稳定 DOCX、manifest v2 和原子写回。

源码处理流程：

```text
discover → clean → select → page-map → audit → TXT/DOCX → PDF bind
```

超过 3000 个有效输出行时取前 1500 + 后 1500；不足时覆盖用户确认的软件范围内全部
合格自研源码。每页 50 行由 source-pages、line map 和 DOCX 显式分页证明，不靠 PDF
文本提取猜测。

## manifest 与规则

- manifest schema：v2
- 插件版本：0.3.0
- 规则版本：`2026.03.15.1`
- 规则注册表：`apply-core/rules/rules.json`
- manifest schema：`apply-core/schemas/manifest.schema.json`

旧 manifest 先预览迁移：

```bash
python3 scripts/migrate_manifest.py <manifest.json>
```

只有显式 `--in-place` 才写回，并生成不覆盖的备份。最终总门：

```bash
python3 scripts/check_all.py --manifest <manifest.json> --json
```

校验覆盖规则、AI 使用、材料存在性、源码中间态、DOCX、PDF、说明书、日期、产物哈希、
跨申请重叠和提交白名单相关风险。

## AI 使用事实

2026 新版申请表公开转述包含“未使用 AI”承诺。本插件运行在 AI 助手中，因此采用
fail-closed：

- 默认确定性模式：模型只解释规则/报告，软件边界由用户确认，源码由确定性程序处理；
- 模型参与拆分、源码建议、功能说明或说明书写作时，必须记录 provenance；
- `yes/unknown`、`current_workflow_used_ai=true` 或申请人未确认时，不输出“可提交”；
- 插件不代签、不保存身份证号、不建议虚假承诺。

以实际填报页面、最新版申请表和申请人的真实情况为准。

## DOCX/PDF 能力

源码 DOCX 由插件自身生成。最终 PDF 和说明书仍需实际可执行的 Documents/PDF 或
LibreOffice 能力。仓库内 `crabcode-office-suite` 的稳定接口不等于适配器一定已实现；
Unknown skill/NOT_IMPLEMENTED/无转换器都必须标 blocked，不能假完成。

生成 PDF 后使用 `record_artifact.py` 绑定当前 DOCX 和规则版本；DOCX/PDF 任一变化都会
使旧绑定失效。最终 PDF 还必须渲染检查页数、A4、页眉、页码、乱码、裁切和可读性。

## 提交白名单

`package-build` 只把以下材料放入 `提交件/`：

- 01-软件著作权登记申请表.pdf
- 02-源代码鉴别材料.pdf
- 03-说明书鉴别材料.pdf
- 04-身份证明文件.pdf
- 05-其他材料/（适用时）

manifest、`中间态/`、source-line-map、审计日志、本机路径、缓存和测试文件不进入提交件。

## 开发与验证

```bash
cd plugins/crabcopyright-cn
bun install
bun run typecheck
bun run test
bun run build
bun run check:distribution
bun run scripts/verify-codesucker-port.ts

cd ../..
bun test tests/crabcopyright-cn/
bun run validate
```

运行时不安装依赖、不访问网络。依赖或上游变化时必须更新 lock、NOTICE、SOURCE-LOCK、
bundle 和测试，不能追随浮动 `main`/`latest`。

## 重要提示

- 《登记办法》第九/十/十一条分别规定三大件、鉴别材料和主要证明文件。
- 官方普通登记自 2017-04-01 起停征登记费；代理服务费另计。
- official/platform/practice 规则分级；经验 warning 不冒充官方 fail。
- 绝不伪造、PS、注水、代签或虚构日期/权属/截图。
