# crabcode-html-video

CrabCode 插件：HTML→视频。宿主 agent 按 SKILL 创作 content-graph 与逐帧 HTML；MCP sidecar 只做确定性校验与渲染。

## 形态

- Skills: `video-storyboard`, `video-frames`
- Command: `/render-video`
- MCP tools: `validateGraph`, `lintFrame`, `previewFrame`, `renderFrames`, `doctor`

## 约束

- Sidecar **不调模型、不持模型/供应商 API key**；`dist/bootstrap.js` 在加载 MCP/渲染 bundle 前按白名单重建 `process.env`，remote 模式仅可持精确命名的渲染 worker bearer 凭证
- `renderFrames` **必须** `confirmed: true`（用户门控）
- 作者动画仅 CSS `@keyframes`（seekable）；作者脚本与墙钟动画一律禁用
- 帧 HTML 禁止脚本、事件处理器、iframe 与外网 URL
- 输出仅写 `${CRABCODE_PLUGIN_DATA}`；音频仅可来自插件 inputs 目录或显式 allowlist

## 运行时

- `bun` 在 PATH（宿主解析）
- ffmpeg：marketplace 运行时使用系统安装或 `HYPERFRAMES_FFMPEG_PATH`；源码开发安装可选 `ffmpeg-static`
- browser：`doctor { install: true }` 从官方 CDN 下载与 producer/Puppeteer 匹配的固定 build；`useMirror:true` 才显式使用国内镜像
- 默认使用插件内固定版本 `@hyperframes/producer` 进程内渲染，不需要另启 worker
- marketplace 运行入口是已提交的 `dist/bootstrap.js`；它先移除宿主凭证，再动态加载 `dist/server.js` 独立 bundle 与经清单校验的 Hyperframes runtime assets；启动阶段不联网、不执行依赖安装
- 白名单仅保留运行所需的 `PATH`/`HOME`/临时目录/locale、`CRABCODE_PLUGIN_ROOT`、`CRABCODE_PLUGIN_DATA` 和已列明的 HTML-video/Hyperframes 路径及调优项；其他宿主变量即使使用不含 `KEY`/`TOKEN` 字样的别名也会被移除
- 仅运维显式设置 `CRABCODE_HTML_VIDEO_RENDER_MODE=remote` 时，才读取 `CRABCODE_HTML_VIDEO_PRODUCER_URL`；远端必须 HTTPS（loopback 可 HTTP）
- remote worker 凭证仅读取三个精确契约名：`CRABCODE_HTML_VIDEO_PRODUCER_TOKEN`、`CRABCODE_HTML_VIDEO_WORKER_TOKEN`、`HTML_VIDEO_WORKER_TOKEN`；仅发送到运维固定且通过 `/health`、`/ready`、受保护资源鉴权探针的同一 origin
- 音频默认放 `${CRABCODE_PLUGIN_DATA}/inputs`；额外根目录通过 `CRABCODE_HTML_VIDEO_AUDIO_ROOTS` 按平台路径分隔符配置

## 本地开发

```bash
bun install
bun run build:mcp
bun run typecheck
bun run test
bun run start
```

## 共享包同步

`packages/VENDOR-SOURCE.json` 记录引擎仓唯一真源坐标。插件内副本只作为可安装快照；后续必须由受审同步脚本或版本化产物更新，禁止手工覆盖后不留坐标。当前 CI 已校验嵌套插件的 frozen install、类型、协议测试和提交 bundle 新鲜度；跨仓逐文件漂移门禁仍需在合并前补成版本化同步脚本。
