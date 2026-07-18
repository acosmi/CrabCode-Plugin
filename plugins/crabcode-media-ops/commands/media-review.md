---
description: 独立事实核查、人工感编辑、原创复核与法律风险路由
argument-hint: "<contentId> [--platform wechat|xhs|toutiao]"
allowed-tools: [Read, Glob, Grep, Bash, Task]
---

# /media-review

先按 `media-core/PRACTICE.md`《运行前预检》执行 preflight；失败按停止码停止，任何手工比对只标 diagnostic，复核结论一律记 `GATE_NOT_EXECUTED`，不得声称已扫描/已复核。

1. 读取最新 content manifest 和对应 profileVersion。
2. 由独立核查角色生成 claims；verified 必须引用已打开快照中的 evidenceLinkId。先以空/不完整 `statementCoverage` 调用 `mediaops.editorial.review`，从 action_required data 取得服务端对全部可见句生成的 `statementLedgerHash` 与 statements/statementId；逐项分为 `verified_fact`、`author_inference`、`opinion`、`non_claim`。前两类映射 verified claimIds 并确认方向，推论还需正文显式标记；后两类不得携带事实字段。四类都写明理由后对同一 revision 重试。不得仿造 statementId，空列表/noVerifiableClaimsReason 也不能替代正文事实。
3. 按 `media-human-editor` 编辑最终 drafted revision，但不读取第三方原文、不把存疑项润色成事实。
4. 对最终稿调用 `mediaops.originality.scan`；仅 human_review_required 可由独立人调用 `mediaops.originality.review`，blocked/changes_required 必须改稿重扫。
5. 调用 `mediaops.editorial.review` 记录事实、完整 statement ledger/coverage、法律路由与实际 AI 披露；这些结论和责任人由可信 principal 绑定，不能由 content.save 或调用参数中的姓名自报。
6. 使用工具生成的 scanId/reviewId 单步保存 stage=reviewed。随后进入 delivery，不在此提前声称 ready。

waiver 必须由具备相应角色的可信 principal 绑定 claimId、理由和当前 subjectHash。任何改稿都使旧 statement coverage、扫描、交付与审批过期。
