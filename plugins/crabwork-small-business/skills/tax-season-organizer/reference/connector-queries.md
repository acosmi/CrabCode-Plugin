# Data Source Guide

How to gather the right data for each mode. **None of these sources have a live MCP
connector** — everything comes from owner-provided exports (CSV/Excel) or pasted
reports. The alipay MCP connector cannot export transaction history (it only creates
payment links, queries a single payment by order number, and processes refunds), so
do not attempt to pull bulk payment data through it.

---

## Accounting software (用友好会计 / 金蝶精斗云) — Quarterly mode (P&L)

Ask the owner to export a **Profit & Loss** report for the period January 1 through
the last day of the most recently completed quarter, as CSV or Excel — or to paste
the key numbers directly.

Key fields to capture:
- `Total Income` / 收入合计 (gross revenue)
- `Total Expenses` / 费用合计 (all operating expenses)
- `Net Ordinary Income` / 净利润 (= income − expenses; this is the basis for tax calculation)

If the report shows multiple income/expense categories, sum them. You want the single
bottom-line net profit figure.

**If the owner's books are on cash basis**, use that. If accrual, note it in output —
the accountant should confirm which basis to use for estimated taxes.

---

## Accounting software — Year-end mode (contractor payments)

Ask the owner to export all **vendor payments** (bill payments, checks, transfers to
vendors) for the full tax year (Jan 1 – Dec 31) — a transaction list grouped by vendor.

Filter for:
- Any vendor flagged as a contractor/1099-eligible (if the owner tags vendors)
- OR any vendor whose category is: consulting, contract labor, subcontractor, freelance, design, legal, accounting, marketing, staffing

For each vendor record, capture:
- Vendor name (legal name if available)
- EIN / SSN (from vendor profile / tax ID column — indicates W-9 on file)
- Total payments for the year
- Payment dates and amounts (for cross-reference)
- Vendor type / 1099 eligibility flag

**Common issue:** Many owners never tag vendors as 1099-eligible in their accounting
software. If the eligibility flag yields few or no results, work from ALL vendors with
significant payment totals and let the user / accountant classify them. Note this in output.

---

## Alipay (支付宝) — Year-end mode

Ask the owner to export a **bill/transaction report (CSV)** from 支付宝商家平台 covering
payments **sent** (not received) for the tax year.

Key fields:
- Counterparty name / account (email or phone)
- Total amount per recipient (aggregate for the year)
- Transaction type (keep payments for services; see exclusions)
- Date

**Exclude:** refunds, disputes, transfers between the owner's own accounts, and
payments for goods.

---

## WeChat Pay (微信支付) — Year-end mode — not yet connected

If the owner also pays contractors via WeChat Pay, ask for a bill export (CSV) from
微信支付商户平台 for the same period. Same fields and exclusions as the Alipay export.

---

## CSV handling

Typical export paths to suggest:
1. Accounting software: 用友好会计 / 金蝶精斗云 → reports → Profit & Loss (or vendor
   transaction list) → export CSV/Excel
2. 支付宝商家平台 → 账单/对账中心 → download bill CSV for the date range
3. 微信支付商户平台 → 交易账单 → download CSV for the date range

When reading uploaded CSVs, look for these columns (names vary by export):
- P&L: `Description`/摘要, `Amount`/金额, `Type`/类型 (Income / Expense)
- Alipay bill: counterparty name/account, transaction type, amount, date, transaction ID
- WeChat Pay bill: counterparty, amount, transaction time, transaction ID

If columns don't match, ask the user to identify the payee name and amount columns.
