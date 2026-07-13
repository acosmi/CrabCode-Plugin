---
name: 发布审批门禁
short-description: "校验发布条件、记录人工审批并生成发布包"
brand-color: "#B5652A"
icon-small: "./assets/icon.png"
icon-large: "./assets/icon.png"
description: 对最终媒体变体执行完整 Media Gate、请求并记录人工审批，并在内容哈希匹配且批准后生成可移动发布包。用户要求审批、打包、发布前检查或追溯发布记录时必须使用；不执行真实平台 API 或浏览器最终发布。
---

# 审批与发布包

先读取 `../../../media-core/PRACTICE.md`、`../../PRACTICE.md` 与 `../../references/publish-runbook.md`。

1. 用 `mediaops.readiness.inspect(contentId)` 执行完整门禁。
2. ready 后用 `mediaops.approval.request` 绑定平台、revisionId 和 contentHash。
3. 只有明确的人类决定才能调用 `mediaops.approval.decide`；生成者不得自批。
4. approved 后调用 `mediaops.publish.package(contentId, approvalId, packagedBy)`。
5. 打包工具会再次复核全部门禁并复制实际资源。任何改稿都会触发 `APPROVAL_STALE`。
6. 交付发布包路径和追溯字段，明确最终发布仍由人工在平台后台完成。

pending、rejected、revoked、stale 或输入不匹配时停止，不提供绕过步骤。
