---
description: 从研究 brief 创建版本化主稿，绑定品牌 profile 与来源
argument-hint: "<选题或 contentId> --brand <brandId>"
allowed-tools: [Read, Glob, Grep, Bash, WebSearch, WebFetch, Task]
---

# /media-draft

按 `media-ops` 或 `wechat-original-opinion` 路由创作。先读取品牌当前 profile 版本；没有 profile 时转 `/media-style-collect`，不得静默继续。外部内容先 `mediaops.reference.register`，再用 WebSearch 找独立来源、逐页调用 `mediaops.research.capture`；向 `mediaops.research.complete` 只提交服务端 captureId、快照绑定的 assessment、主张级证据和搜索日志，不自报 sourceTier/isPrimary/independenceGroup。

首存只能由 `author` principal 用 `mediaops.content.save` 保存 intake；`researcher` principal 负责 capture，独立 `fact_checker` principal 完成研究后单步推进 researched。调用 fresh-context `draft-writer` 时只传结构化研究包、profile 摘要和不可复制清单，不传原文/附件/路径；再保存 drafted。不得把 review/originality/legal/AI 结论或 actor 姓名随 content.save 自报。

输出 contentId、revisionId、contentHash、来源数、待核查项与下一步 `/media-review`。
