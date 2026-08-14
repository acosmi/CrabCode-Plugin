# CrabCode Media Publisher

`crabcode-media-publisher` 是 CrabPublish Hub 与本地 Edge 发布助手的独立插件实施目录。本轮 `0.1.0` 只交付白底 Hub Web UI、领域状态模型、固定脱敏夹具和自动化验收基线；真实平台提交、副作用 API、OIDC、MCP 与 Edge 登录态执行保持关闭。

当前目录是内部验收夹具，不是可安装的 marketplace 发行物：manifest 尚未声明宿主可加载入口，构建产物也未纳入分发包。因此不得把它加入官方 marketplace；完成宿主入口、发行物与端到端发布闭环后再单独发版。

内容编辑器支持从本机导入 `.md/.markdown` 与 `.html/.htm` 文件。导入内容只在当前浏览器页面内处理：标题、导语和 Markdown 正文构成单一草稿事实源，再确定性派生白底 HTML 阅读预览与 Markdown 备份；这不是服务端保存或冻结 revision。

## 本地运行

```bash
bun install --frozen-lockfile
bun run build
bun run preview
```

默认入口为 `http://127.0.0.1:4173/app`。可通过 `CRABPUBLISH_UI_PORT` 修改端口。

## 验证

```bash
bun run typecheck
bun run lint
bun run test
bun run qa:nu
bun run test:browser
```

完整视觉验收默认使用本机固定路径的 Google Chrome、校验确切版本并比对已提交快照。CI 使用固定 Playwright 镜像自带的 Chromium，并设置 `CRABPUBLISH_SKIP_VISUAL=1`：只跳过与 macOS/Chrome 150 绑定的像素快照，39 个浏览器流程、可访问性、安全与响应式断言仍会执行。正式视觉基线迁移必须在唯一固定的浏览器、操作系统和字体环境中单独完成，不得用自动更新快照掩盖回归。

## 安全边界

- UI fixture 不包含平台 Cookie、密码、短信码、localStorage 或原始 token。
- Markdown 导入先生成规范化安全 AST；HTML 导入经 allowlist 清洗后通过 `hast-util-to-mdast` 转换。脚本、样式、表单、iframe、事件属性、远程图片和危险 URL 不进入成品或 MD 备份。单文件上限为 256 KiB，过密结构按实时复杂度预算拒绝；文件不会上传，也不会写入 localStorage/sessionStorage。导入或改动固定稿后，作者、来源与 AI 披露立即回到待复核。
- 固定文章预览加载本地确定性构建产物；会话草稿预览使用可撤销的本机内存 Blob URL。两者均运行在无 `allow-scripts`、无 `allow-same-origin` 的 sandbox iframe，预览文档禁止脚本、连接、表单和远程资源，父页与预览响应分别设置最小权限 CSP。
- 所有真实发布操作明确禁用；“已发布”仅用于带脱敏远端证据的固定演示状态。
- `CrabCode` 主仓库不在本插件实现范围内。

设计与验收真源：[`docs/audit/2026-07-18-crabpublish-hub-ui-白底设计系统与验收方案.md`](../../docs/audit/2026-07-18-crabpublish-hub-ui-白底设计系统与验收方案.md)。
