---
name: 原创性审校
short-description: "审核观点原创性、来源覆盖与近似表达风险"
brand-color: "#C05679"
icon-small: "./assets/icon.png"
icon-large: "./assets/icon.png"
description: 独立审核媒体稿的论点原创性、因果链、反方边界、来源覆盖、近似表达、第一人称真实性及权利声誉风险。用户只要求查原创/洗稿风险、原创度复核或发布前原创审校时使用；默认只审核不改稿，也不保证平台原创声明。
---

# 原创与发布风险复核

先读取 `../../../media-core/PRACTICE.md`、`../../PRACTICE.md` 与 `../../references/originality-review.md`。

可选运行 `../../scripts/originality_scan.py` 对用户提供的对照文本做短语重合预警。扫描结果只是启发式线索，不是全网查重或原创率。

逐项输出：独立论点、因果链、强反方、边界、来源覆盖、近似表达、第一人称真实性、样本权利、名誉/隐私/时效风险。结论只能是：

- `可发布`；
- `修改后发布`；
- `需补证`。

除非用户另行要求，不直接重写正文。将结论写入 originalityReview，并保留复核人和时间。
