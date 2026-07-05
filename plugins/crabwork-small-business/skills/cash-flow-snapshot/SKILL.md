---
name: cash-flow-snapshot
version: 0.3.0
description: >
  Builds a 30/60/90-day cash flow forecast with percentage-variance confidence
  bands and named risk flags from the owner's accounting software export
  (用友好会计 / 金蝶精斗云 CSV or Excel) plus Alipay (支付宝商家平台) and
  WeChat Pay (微信支付商户平台) bill exports — or any pasted AR/AP data.
  Delivers a chat summary and a downloadable XLSX. Use when the user asks
  "forecast my cash flow," "will I make payroll," mentions "runway," or says
  "cash crunch."
compatibility: "Runs entirely from CSV/Excel exports or pasted data — no live accounting connector required. Output uses xlsx skill."
---

# Cash Flow Snapshot

Produces a 30/60/90-day cash flow forecast with percentage-variance confidence
bands and named risk flags. Delivers a two-part output: a concise chat summary
and a downloadable XLSX workbook.

**Quick start**

> "Will I make payroll next month?"

CrabCode reads AR/AP and fixed costs from the owner's exports, calculates expected
inflows and outflows across 30, 60, and 90-day windows, applies confidence
bands based on each customer's historical payment variance, and flags specific
risks by name.

---

## Workflow

### Step 1 — Identify available data sources

There is no live accounting or payment-history connector — this skill runs on
files the owner provides. Ask for whichever of these exist, in this order:

1. Accounting software export (用友好会计 / 金蝶精斗云) — primary source for
   AR aging, AP, and fixed costs. Ask the owner for a CSV/Excel export or a
   pasted report.
2. 支付宝商家平台 bill export (CSV) — transaction and settlement history for
   payment-timing analysis. Note: the Alipay MCP connector only creates payment
   links, queries single payments, and processes refunds — it cannot export
   history, so always ask for the downloaded bill file.
3. 微信支付商户平台 bill export (CSV) — WeChat Pay is not yet connected as a
   connector; the owner downloads the bill manually if they collect there.
4. Pasted tabular data — fallback if no export is at hand (income/expense
   data, any reasonable format).

If the owner has none of these ready, walk them through which export to
download. Note which sources were used in the output — this affects confidence
band width.

### Step 2 — Collect the data

**From the accounting software export (用友好会计 / 金蝶精斗云):**
- AR aging report: customer name, invoice amount, invoice date, due date, days outstanding
- AP: vendor name, amount due, due date
- Recurring fixed costs: rent, payroll, subscriptions (look for recurring transactions)

**From Alipay / WeChat Pay bill exports:**
- Settlement history: transaction date, amount, settlement date
- Use settlement lag (transaction date → settlement date) to compute each source's
  average and variance payment delay

**From pasted or uploaded CSV data:**
- Parse as income/expense tabular data
- Required columns (flexible naming; headers may be in Chinese): date, amount,
  type (income or expense), description
- If columns are ambiguous, show the header row and ask the user to confirm mapping

### Step 3 — Compute historical payment timing

For each AR customer (or income source from CSV), calculate:
- **Mean payment lag** — average days from invoice/transaction date to receipt
- **Payment variance** — standard deviation of payment lag across last 6–12 payments
- Use variance to set confidence band width (see Step 4)

If fewer than 3 payments exist for a customer, use the population mean as the
point estimate and apply a ±30% variance band as the default. When running on
CSV data with sufficient history (≥3 payments per source), compute the band
from the actual payment variance — do not assume ±30%.

### Step 4 — Build the 30/60/90-day forecast

Produce three time windows: 0–30 days, 31–60 days, 61–90 days.

For each window, compute:

| Line | Method |
|---|---|
| Expected inflows | AR due in window, adjusted for mean payment lag |
| Expected outflows | AP due in window + fixed costs falling in window |
| Net cash position | Inflows − Outflows |
| Confidence band | ± weighted average payment variance as a % of expected inflows |

Confidence band formula:
```
band_pct = weighted_avg_stddev_days / avg_payment_lag_days
low  = net_cash × (1 − band_pct)
high = net_cash × (1 + band_pct)
```

Round band_pct to one decimal place. Cap at ±50% — higher variance means the
data is too thin to model; flag it instead (see Step 5).

### Step 5 — Flag named risks

Scan for conditions that push the low-band estimate negative or create a
liquidity crunch. For each risk found, produce a one-line flag:

- **Late-payer risk:** "Customer X historically pays 18 days late; that shifts
  their ¥8,400 invoice out of the 30-day window into day 48."
- **Payroll crunch:** "Payroll (¥22,000) hits April 15. Low-band cash on hand
  April 14: ¥19,200. Shortfall risk: ¥2,800."
- **Thin data warning:** "Only 2 payments on record for Customer Y — confidence
  band set to default ±30%."
- **Partial-data warning:** "Running on a payment bill export only — no AP or
  recurring cost data was provided. Confidence bands are wider than normal."

Limit to the top 5 risks by severity (largest amount at stake first).

### Step 6 — Deliver outputs

**Chat summary** (always):
```
Cash Flow Snapshot — [date range]
Source(s): [exports/data used]

            Expected    Low       High
30-day net: ¥X,XXX     ¥X,XXX    ¥X,XXX
60-day net: ¥X,XXX     ¥X,XXX    ¥X,XXX
90-day net: ¥X,XXX     ¥X,XXX    ¥X,XXX

⚠ Risks flagged: [count]
  • [risk 1]
  • [risk 2]
  ...
```

**XLSX workbook** (always):
Generate the workbook via `crabcode-office-suite:crabcode-spreadsheets`. Produce a workbook with three sheets:

1. **Summary** — the 30/60/90 forecast table with confidence bands. Beneath
   each window row, expand inline sub-rows showing the individual transactions
   that make up its inflows (green) and outflows (red). This makes the estimates
   auditable without leaving the Summary sheet.

2. **Detail** — all transactions grouped by window, sorted by date within each
   group. Include a running net column (cumulative inflows minus outflows within
   the window) and a subtotal row at the bottom of each window showing total
   inflows, total outflows, and net. Grey out past transactions in a separate
   section at the bottom for reference. Ensure all three windows have rows even
   if one is empty — show a "No transactions in this window" placeholder row.

3. **Risks** — the flagged risks with amount at stake and affected window.

Save as `cash-flow-snapshot-[YYYY-MM-DD].xlsx`.

---

## Approval gates

No destructive actions — this skill is read-only. No approval gate required
before generating the forecast.

Remind the user after delivery:
> "This forecast is based on [sources listed]. It is not a substitute for
> accounting advice — verify with your bookkeeper before making financing decisions."

---

## Reference files

| File | Load when |
|---|---|
| `reference/gotchas.md` | When an export contains unexpected data or variance is extreme |
| `reference/examples/worked-example.md` | When modeling the output format for a new data shape |

---

## Deliverable routing

- The XLSX workbook is generated via `crabcode-office-suite:crabcode-spreadsheets`; the same skill parses owner exports that arrive as Excel files (.xlsx/.xls) rather than CSV.
- If triggering it reports Unknown skill, the office suite is not installed: guide the owner to install `crabcode-office-suite` via `/plugin`, then retry; until then, present the forecast tables as markdown in chat.
