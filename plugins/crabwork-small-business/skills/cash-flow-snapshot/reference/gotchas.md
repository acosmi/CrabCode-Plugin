# Gotchas — cash-flow-snapshot

Known edge cases and data-export failure modes. 2–5 entries, Good/Bad format.

---

## 1. AR aging exports include invoices already collected

**Bad:** Including fully-paid invoices from the AR aging report inflates inflow
projections. Accounting exports (用友好会计 / 金蝶精斗云) sometimes include
¥0-balance invoices in aging reports.

**Good:** Filter AR rows to `balance_due > 0` before computing inflows. If the
export has no balance-due column, subtract known Alipay/WeChat Pay settlements
from the invoice total before including it.

---

## 2. Alipay settlement lag varies by transaction type

**Bad:** Assuming all Alipay receipts settle on a single fixed schedule.
Settlement timing depends on the merchant's account settings and transaction
type — a flat settlement assumption produces overconfident inflow timing.

**Good:** Compute settlement lag from actual transaction-date → settlement-date
pairs in the 支付宝商家平台 bill export. Use the computed mean and stddev per
customer or transaction type.

---

## 3. CSV column names are inconsistent across exports

**Bad:** Requiring exact column names like "Date", "Amount", "Type".
用友好会计, 金蝶精斗云, 支付宝商家平台, and 微信支付商户平台 exports each use
their own header names — usually in Chinese, and different between the
transaction bill and the funds bill. Rigid parsing fails silently.

**Good:** Fuzzy-match column headers, including Chinese ones (日期/交易时间 →
date; 金额/收入/支出 → amount; 类型/科目 → type). Show the header row to the
user and confirm mapping before computing — one question beats a silent wrong
forecast.

---

## 4. Fixed costs hidden in one-off AP entries

**Bad:** Only pulling line items the accounting software tags as "recurring".
Many SMBs don't tag fixed costs consistently — rent may appear as a one-off
vendor bill each month.

**Good:** Look for AP entries that appear in 3+ consecutive months with the same
vendor and similar amount (±10%). Treat these as recurring fixed costs in the
forecast. Surface the list to the user: "I'm treating these as fixed monthly
costs — does that look right?"

---

## 5. Confidence band formula breaks when mean payment lag is zero

**Bad:** Dividing stddev by a mean lag of 0 (e.g. customers who pay instantly
by scanning an Alipay QR code) produces a divide-by-zero error or an infinite
band.

**Good:** If mean lag ≤ 1 day, set band_pct to 5% (low variance, near-immediate
settlement). Don't attempt the division.
