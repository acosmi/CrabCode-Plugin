# Output Template

This is the exact structure every pulse must follow. Do not reorder sections. Omit a section only if its connector returned no data — never leave an empty header.

Variables in `{{double braces}}` are placeholders — replace with computed values. Arrow convention: ▲ up, ▼ down, ▬ flat (<1% change). Always show the delta value after the arrow.

---

```markdown
# Business Pulse — {{YYYY-MM-DD}}

**Overall: {{🟢|🟡|🔴}} {{one-line status, e.g. "Cash healthy, one overdue invoice needs attention."}}}**

## TL;DR

- {{Most important number-backed fact, e.g. "Cash balance ¥84k, down ¥6k WoW — two large vendor payments cleared."}}
- {{Second most important, e.g. "¥3,400 from 明发商贸 is 47 days overdue — no response since 2026-03-12."}}
- {{Third, e.g. "Pipeline ¥128k weighted; two deals gone cold this week."}}

---

## 💰 Cash & Finance — {{🟢|🟡|🔴}}

- **Cash balance**: ¥{{BALANCE}} ({{▲|▼|▬}} ¥{{DELTA}} WoW)
- **MTD revenue**: ¥{{MTD}} vs. ¥{{PRIOR_MTD}} last month ({{▲|▼|▬}} {{PCT}}%)
- **Outstanding AR**: ¥{{AR_TOTAL}} across {{N}} open invoices

**AR aging**
- 0–30 days: ¥{{AR_0_30}}
- 31–60 days: ¥{{AR_31_60}} {{🟡 if nonzero}}
- 61+ days: ¥{{AR_61}} {{🔴 if nonzero}}

**Overdue > 30 days**
- {{customer}} — ¥{{amount}} ({{days}} days overdue)
- {{customer}} — ¥{{amount}} ({{days}} days)

---

## 📈 Revenue & Sales — {{🟢|🟡|🔴}}

- **7-day settlements**: ¥{{SETTLEMENTS}} ({{▲|▼|▬}} {{PCT}}% vs. prior 7 days)
- **Alipay (支付宝)**: ¥{{ALIPAY_TOTAL}} | **WeChat Pay (微信支付)**: ¥{{WECHATPAY_TOTAL}} {{omit if no bill export provided}}

**Unusual transactions**
- {{amount}} — {{counterparty}} — {{status: failed/pending/large}}
- {{or "No unusual transactions this week."}}

---

## 🔮 Pipeline — {{🟢|🟡|🔴}}

- **Weighted pipeline**: ¥{{WEIGHTED}} ({{▲|▼|▬}} ¥{{DELTA}} WoW)
- **Coverage vs. target**: {{RATIO}}x monthly target {{🟢|🟡|🔴}}
- **Closed-won this week**: ¥{{CW}} across {{N}} deals
- **New deals created**: {{N}} (¥{{TOTAL}})

**Deals needing attention**
- {{deal name}} — {{stage}} — {{why: gone cold / slipped / stalled}}
- {{or "No deals flagged this week."}}

---

## 📅 This Week

- {{Meeting/deadline — external party, why it matters}}
- {{Meeting/deadline}}
- {{Meeting/deadline}}
{{3–5 items max. Omit internal-only calendar noise.}}

---

## ✉️ Watch List

- {{sender / source}} — {{one-line summary of what needs attention}}
- {{sender / source}} — {{summary}}
{{Or: "No urgent threads detected." — include this explicitly so the owner knows the check ran.}}

---

## ⚠️ #1 Priority

{{One specific thing to act on today. Name amounts, people, deadlines.
Not "review cash flow" — say "The ¥4,200 invoice from 明发商贸 is 23 days
overdue. Call 李娜 at 138xxxxxxxx today."}}

---

## Appendix

**Window**: {{date range}}

**Sources pulled**: {{list of connectors that returned data and owner-provided exports used}}

**Sources unavailable**: {{list with reason, e.g. "Feishu — connector error" or "accounting software — no export provided"}}

**Thresholds used**: {{note any TODO thresholds that are still defaults}}
```

---

## Formatting rules

1. **Currency amounts**: `¥43k` for thousands, `¥1.2m` for millions. No unnecessary decimals.
2. **Percentages**: one decimal for trends (e.g. "▲ 8.3%"), integers elsewhere.
3. **Dates**: ISO `YYYY-MM-DD` (e.g. "2026-04-14"), in both prose and metadata.
4. **Arrow spacing**: `▲ ¥2k` not `▲¥2k`.
5. **Length**: aim for one page. Two pages max. If a section balloons, tighten prose.
