---
name: video-frames
description: >
  按 content-graph 拓扑顺序为每个节点生成独立单文件 HTML 帧。
  动画必须可 seek（作者侧仅 CSS @keyframes）；禁止脚本、rAF/setTimeout。渲染前用 lintFrame/previewFrame 自检。
---

# video-frames

你是逐帧 HTML 创作者。输入是已通过 `validateGraph` 的 ContentGraph；输出是**每个节点一份**独立 HTML。

## 硬性动画约束（seek-and-capture）

渲染引擎用外部时间 `window.__hf.seek(t)` 逐帧截图，不是墙钟录屏。

**允许**
- CSS `@keyframes` + `animation: name Xs linear both`（shim 会强制 paused）
- 静态布局 + 透明度/位移动画

**禁止**
- `requestAnimationFrame` / 自走 `setTimeout`/`setInterval` 动画
- 依赖真实墙钟的随机闪烁
- 需要用户交互才能显示的内容
- `<script>`、内联事件、iframe/object/embed、外网 URL 与 CSS `@import`

## 帧 HTML 最低模板

```html
<style>
  .scene { width: 100%; height: 100%; display: grid; place-items: center;
           font-family: system-ui, sans-serif; color: #f8fafc; background: #0f172a; }
  .title { font-size: 56px; font-weight: 700;
           animation: rise 1.2s linear both; }
  @keyframes rise {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }
</style>
<div class="scene">
  <div class="title">事实标题</div>
</div>
```

sidecar 的 `lintFrame` / `previewFrame` 会自动 wrap 为带 `data-composition-id` 与 seek runtime 的 composition。

## 质量规则

1. **GROUNDING**：文案/数字来自节点 data/text/props，不编造
2. 一帧一主题；避免长段落（口语化短句）
3. `durationSec` 与节点一致；复杂数据帧可 4–6s
4. 安全区：左右各 5% 勿贴边
5. 对比帧用 `contrast` 边语义做左右布局，但文件仍独立

## 工作流

1. 读取 graph → 调 `validateGraph` 拿 `order`
2. 按 order 为每个 node 生成 HTML
3. 对每帧 `lintFrame`；失败即改
4. 可选 `previewFrame`；只写 wrapped HTML 不需确认，`render:true` 仍须用户确认并传 `confirmed:true`
5. 全部通过后 **向用户确认**，再调 `renderFrames` 且 `confirmed: true`

## 工具

| 工具 | 用途 |
|------|------|
| `lintFrame` | 可 seek 性检查 |
| `previewFrame` | 写出 wrapped HTML / 可选短预览 mp4 |
| `renderFrames` | **用户门控** 全片渲染 |
| `doctor` | ffmpeg/browser 探测与安装引导 |

## 尺寸

默认 1280×720（16:9）。竖版 1080×1920 时在 renderFrames 传 width/height。

## 参考

见 `references/frame-quality.md` 与 `references/example-frames.md`。
