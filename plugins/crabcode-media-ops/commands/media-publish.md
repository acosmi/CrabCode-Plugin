---
description: 对最终变体执行硬门禁、人工审批并生成可移动发布包
argument-hint: <contentId>
allowed-tools: [Read, Glob, Grep, Bash, Task]
---

# /media-publish

按 `media-publish-gate` 执行：

1. `mediaops.readiness.inspect(contentId)`；非 ready 立即停止。
2. `mediaops.approval.request` 生成 pending 记录。
3. 向用户展示标题、平台、revisionId、contentHash 和检查项；只有用户明确决定后才调用 `mediaops.approval.decide`。
4. approved 后调用 `mediaops.publish.package(contentId, approvalId, packagedBy)`。
5. 返回发布包路径和审计字段。

打包接口不接收自由正文，无法绕过审稿或审批。真平台发布、浏览器最终点击和自动评论仍属 Gate B。
