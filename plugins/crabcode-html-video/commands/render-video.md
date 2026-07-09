---
description: 生成 HTML 视频（分镜 → 逐帧 HTML → 用户确认后渲染）
---

# /render-video

按 **crabcode-html-video** 工作流创作短视频：

1. 激活 `video-storyboard`：与用户确认主题/事实/风格/画幅 → 产出 ContentGraph → `validateGraph`
2. 激活 `video-frames`：按 topo 顺序为每个节点写独立 HTML → `lintFrame` / 可选 `previewFrame`
3. **向用户展示帧清单与总时长，明确请求渲染确认**（渲染分钟级、占 CPU）
4. 用户确认后调用 `renderFrames`，`confirmed: true`
5. 交付 mp4 路径

前置：若环境未知，先 `doctor`。缺 browser/ffmpeg 时按 doctor 提示安装（国内默认 npmmirror）。

禁止：未确认时调用 `renderFrames`；禁止 rAF/setTimeout 动画；禁止编造事实。
