---
description: 对最终变体执行硬门禁、人工审批并生成可移动发布包
argument-hint: "<contentId>"
allowed-tools: [Read, Glob, Grep, Bash, Task]
---

# /media-publish

先按 `media-core/PRACTICE.md`《运行前预检》执行完整 preflight（含 `mediaops.doctor` 依赖检查）；失败按停止码停止，未真实执行的门禁一律记 `GATE_NOT_EXECUTED`，报告中的已完成阶段必须逐项附权威 ID/哈希。

按 `media-publish-gate` 执行：

1. 对 reviewed revision 调用 `mediaops.delivery.render`，生成白底 HTML 主产物、Markdown 备份和平台档案。
2. 由与 `renderer` principal 不同、具备 `delivery_reviewer` 角色的可信 principal 提交移动/桌面/宽屏/打印视觉确认后调用 `mediaops.delivery.verify`；验证器自动运行 Nu、Playwright/Chromium、axe、多视口/配色、文本压力和打印 QA。再执行 `mediaops.readiness.inspect`，非 ready 立即停止。
3. 由具备 `approval_requester` 角色的可信 principal 调用 `mediaops.approval.request(contentId, deliveryId, ...)` 生成 pending；向用户展示确切 HTML 路径、平台、revision/content/articleDoc/render/artifact/QA 哈希和检查项。
4. 只有 `issuer:principalId` 与请求者不同且具备 approver 角色的可信 principal 明确决定后才调用 `mediaops.approval.decide`；自由填写的姓名无效。
5. approved 后由 publisher principal 调用 `mediaops.publish.package`；它只复制冻结候选和 QA 证据，返回 HTML 主文件和 Markdown 备份路径。

打包接口不接收自由正文或原素材路径，无法绕过审稿、自动 QA、渲染验证或审批。真平台发布、浏览器最终点击和自动评论仍属 Gate B；自动 QA 不等于完整 WCAG 认证。
