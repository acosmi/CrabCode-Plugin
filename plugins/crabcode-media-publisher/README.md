# CrabCode Media Publisher

`crabcode-media-publisher` 是 CrabPublish Hub 与本地 Edge 发布助手的独立插件实施目录。本轮 `0.1.0` 只交付白底 Hub Web UI、领域状态模型、固定脱敏夹具和自动化验收基线；真实平台提交、副作用 API、OIDC、MCP 与 Edge 登录态执行保持关闭。

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

浏览器验收默认使用本机固定路径的 Google Chrome，并校验确切版本。CI/正式发布应改用固定镜像和可复现字体环境；不得用自动更新快照掩盖回归。

## 安全边界

- UI fixture 不包含平台 Cookie、密码、短信码、localStorage 或原始 token。
- 文章预览加载本地确定性构建产物，使用无 `allow-scripts`、无 `allow-same-origin` 的 sandbox iframe；父页与预览响应分别设置最小权限 CSP。
- 所有真实发布操作明确禁用；“已发布”仅用于带脱敏远端证据的固定演示状态。
- `CrabCode` 主仓库不在本插件实现范围内。

设计与验收真源：[`docs/audit/2026-07-18-crabpublish-hub-ui-白底设计系统与验收方案.md`](../../docs/audit/2026-07-18-crabpublish-hub-ui-白底设计系统与验收方案.md)。
