# crabcode-html-video

CrabCode 插件：HTML→视频。宿主 agent 按 SKILL 创作 content-graph 与逐帧 HTML；MCP sidecar 只做确定性校验与渲染。

## 形态

- Skills: `video-storyboard`, `video-frames`
- Command: `/render-video`
- MCP tools: `validateGraph`, `lintFrame`, `previewFrame`, `renderFrames`, `doctor`

## 约束

- Sidecar **不调模型、不持 key**
- `renderFrames` **必须** `confirmed: true`（用户门控）
- 动画仅 CSS/WAAPI（seekable）

## 运行时

- `bun` 在 PATH（宿主解析）
- ffmpeg：系统安装或 `HYPERFRAMES_FFMPEG_PATH`；可选 `ffmpeg-static`
- browser：`doctor { install: true }` 下载到 `${CRABCODE_PLUGIN_DATA}/browsers`（默认 npmmirror）
- 或指向已运行的 worker：`CRABCODE_HTML_VIDEO_PRODUCER_URL=http://127.0.0.1:7788`

## 本地开发

```bash
# monorepo 根
bun install
bun run worker:start   # 终端 1
# 终端 2
cd plugin && bun run start
```
