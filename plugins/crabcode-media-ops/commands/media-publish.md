---
description: 对最终变体执行硬门禁、人工审批并生成可移动发布包
argument-hint: "<contentId>"
allowed-tools: [Read, Glob, Grep, Bash, Task]
---

# /media-publish

按 `media-publish-gate` 执行：

1. 对 reviewed revision 调用 `mediaops.delivery.render`，生成白底 HTML 主产物、Markdown 备份和平台档案。
2. 实际检查移动/桌面/宽屏/打印后调用 `mediaops.delivery.verify`；再执行 `mediaops.readiness.inspect`，非 ready 立即停止。
3. `mediaops.approval.request(contentId, deliveryId, ...)` 生成 pending；向用户展示确切 HTML 路径、平台、revision/content/articleDoc/render/artifact 哈希和检查项。
4. 只有与请求者不同的人类明确决定后才调用 `mediaops.approval.decide`。
5. approved 后调用 `mediaops.publish.package`；它只复制冻结候选，返回 HTML 主文件和 Markdown 备份路径。

打包接口不接收自由正文或原素材路径，无法绕过审稿、渲染验证或审批。真平台发布、浏览器最终点击和自动评论仍属 Gate B。
