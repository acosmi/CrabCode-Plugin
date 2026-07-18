---
description: 生成平台变体与本地预览，保留完整审计字段
argument-hint: "<contentId> --platform wechat|xhs|toutiao"
allowed-tools: [Read, Glob, Grep, Bash, Task]
---

# /media-preview

先按 `media-core/PRACTICE.md`《运行前预检》执行 preflight；失败按停止码停止，预览与门禁状态一律记 `GATE_NOT_EXECUTED`。

按 `media-platform-adapter` 执行：先读取 `mediaops.platform.rules.get`，再从主稿派生 variant，parentIds 指向上游 contentId。平台改写若改变事实或观点，必须重新审稿；不得复制旧 review 冒充已核查。

平台变体按完整状态流复核后，先调用 `mediaops.delivery.render`，提交独立视觉确认并调用 `mediaops.delivery.verify` 自动运行 Nu/Playwright/axe、多视口/配色、文本压力和打印检查。`mediaops.preview.create` 只返回同一 verified HTML，不重新渲染；再用 readiness 汇总门禁。输出规则版本、revisionId、renderManifestHash、QA 证据摘要、HTML 主预览、Markdown 备份和问题清单。
