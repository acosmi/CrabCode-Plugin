---
description: 独立事实核查、人工感编辑、原创复核与法律风险路由
argument-hint: <contentId> [--platform wechat|xhs|toutiao]
allowed-tools: [Read, Glob, Grep, Bash, Task]
---

# /media-review

1. 读取最新 content manifest 和对应 profileVersion。
2. 由独立核查角色生成带 id 的 claims；verified 必须有 sourceUrl，空列表必须给 noVerifiableClaimsReason。
3. 按 `media-human-editor` 编辑，但不把存疑项润色成事实。
4. 按 `media-originality-review` 写 originalityReview；高风险内容路由法律插件并写 legalReview。
5. 记录实际 AI 披露方法与确认人。
6. 保存 stage=reviewed 的新 revision，再调用 `mediaops.readiness.inspect(contentId)`。

具名 waiver 必须绑定 claimId、理由并存入当前 revision。任何改稿都使旧审批过期。
