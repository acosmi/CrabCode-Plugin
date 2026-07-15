---
description: 独立事实核查、人工感编辑、原创复核与法律风险路由
argument-hint: "<contentId> [--platform wechat|xhs|toutiao]"
allowed-tools: [Read, Glob, Grep, Bash, Task]
---

# /media-review

1. 读取最新 content manifest 和对应 profileVersion。
2. 由独立核查角色生成 claims；verified 必须引用已打开快照中的 evidenceLinkId，空列表必须给 noVerifiableClaimsReason。
3. 按 `media-human-editor` 编辑最终 drafted revision，但不读取第三方原文、不把存疑项润色成事实。
4. 对最终稿调用 `mediaops.originality.scan`；仅 human_review_required 可由独立人调用 `mediaops.originality.review`，blocked/changes_required 必须改稿重扫。
5. 调用 `mediaops.editorial.review` 记录事实、法律路由与实际 AI 披露；这些结论不能由 content.save 自报。
6. 使用工具生成的 scanId/reviewId 单步保存 stage=reviewed。随后进入 delivery，不在此提前声称 ready。

具名 waiver 必须绑定 claimId、理由并存入当前 revision。任何改稿都使旧审批过期。
