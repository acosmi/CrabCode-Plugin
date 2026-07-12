---
description: 从研究 brief 创建版本化主稿，绑定品牌 profile 与来源
argument-hint: <选题或 contentId> --brand <brandId>
allowed-tools: [Read, Glob, Grep, Bash, Task]
---

# /media-draft

按 `media-ops` 或 `wechat-original-opinion` 路由创作。先读取品牌当前 profile 版本；没有 profile 时转 `/media-style-collect`，不得静默继续。

用 `mediaops.content.save` 保存 brief/draft，填写 brandId、profileVersion、stage、parentIds、citations、assets、savedBy。主稿阶段记录 AI 辅助状态；进入 reviewed 前还必须完成事实、原创和法律路由。

输出 contentId、revisionId、contentHash、来源数、待核查项与下一步 `/media-review`。
