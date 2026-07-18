---
name: 原创性审校
short-description: "审核观点原创性、来源覆盖与近似表达风险"
brand-color: "#C05679"
icon-small: "./assets/icon.png"
icon-large: "./assets/icon.png"
description: 独立审核媒体稿的论点原创性、因果链、反方边界、来源覆盖、近似表达、第一人称真实性及权利声誉风险。用户只要求查原创/洗稿风险、原创度复核或发布前原创审校时使用；默认只审核不改稿，也不保证平台原创声明。
---

# 原创与发布风险复核

先读取 `../../../media-core/PRACTICE.md`、`../../PRACTICE.md` 与 `../../references/originality-review.md`。复核开始前先按《运行前预检》确认 `mediaops.capabilities` 可用与身份就绪；预检失败按停止码停止，原创结论一律记 `GATE_NOT_EXECUTED`。

存在第三方或授权参考时必须调用 `mediaops.originality.scan`；旧 `../../scripts/originality_scan.py` 与任何通用 reviewer 的手工比对只能标注为 diagnostic，不是门禁权威，不产生 scanId，也不得写入阶段报告的已完成列表。工具同时记录多尺度 n-gram、最长连续重合、覆盖率、段落对齐、结构风险以及正文/参考哈希；它报告风险，不输出“原创率”或法律结论。

逐项输出：独立论点、因果链、强反方、边界、来源覆盖、近似表达、第一人称真实性、样本权利、名誉/隐私/时效风险。结论只能是：

- `blocked`：高字面重合，不得人工覆盖，必须改稿重扫；
- `changes_required`：中风险，必须改稿重扫；
- `human_review_required`：由 `issuer:principalId` 与作者/扫描者不同、具备 `originality_reviewer` 角色的可信 principal 调用 `mediaops.originality.review`，明确结构和论证是否独立；
- `low_risk`：只表示未触发既定风险阈值，不是原创证明。

除非用户另行要求，不直接重写正文。结论只能由工具写入哈希绑定的 scan/review 记录，责任人由可信 principal 覆盖绑定；不允许调用方把 `originalityReview: publishable` 或自由填写的 reviewer 姓名塞入内容 manifest。
