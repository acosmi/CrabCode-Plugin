# Worked example — cash-flow-snapshot

**Scenario:** Small services business. Owner provided a 用友好会计 export
(AR/AP + fixed costs) and a 支付宝商家平台 bill export. Three active customers,
monthly payroll, office rent.

---

## Input data (from the owner's exports)

**AR aging (用友好会计 export):**

| Customer   | Invoice | Amount   | Due Date   | Days Outstanding |
|------------|---------|----------|------------|------------------|
| 明发商贸   | INV-112 | ¥8,400   | 2026-04-10 | 12               |
| 云溪科技   | INV-108 | ¥14,200  | 2026-04-22 | 0                |
| 恒盛实业   | INV-115 | ¥6,000   | 2026-05-05 | —                |

**Historical payment lag (from the 支付宝商家平台 bill export):**

| Customer   | Mean Lag | Std Dev | Payments on Record |
|------------|----------|---------|--------------------|
| 明发商贸   | 18 days  | 4 days  | 11                 |
| 云溪科技   | 7 days   | 2 days  | 8                  |
| 恒盛实业   | 12 days  | 5 days  | 6                  |

**Fixed costs (recurring AP in the accounting export):**
- Payroll: ¥22,000 — hits 2026-04-15
- Rent: ¥3,200 — hits 2026-05-01
- Software subscriptions: ¥480 — hits 2026-05-01

---

## Step 3 output — adjusted inflow dates

| Customer   | Invoice Amount | Adj. Receipt Date | Notes                            |
|------------|----------------|-------------------|----------------------------------|
| 明发商贸   | ¥8,400         | 2026-04-28        | Due 2026-04-10 + 18-day mean lag |
| 云溪科技   | ¥14,200        | 2026-04-29        | Due 2026-04-22 + 7-day mean lag  |
| 恒盛实业   | ¥6,000         | 2026-05-17        | Due 2026-05-05 + 12-day mean lag |

---

## Step 4 output — 30/60/90 forecast

Confidence band calculation:
- Weighted avg stddev: 3.6 days
- Weighted avg mean lag: 12.7 days
- band_pct = 3.6 / 12.7 = **28.3%**

| Window  | Expected Inflows | Expected Outflows | Net      | Low (−28%) | High (+28%) |
|---------|-----------------|-------------------|----------|------------|-------------|
| 0–30d   | ¥22,600         | ¥22,000           | +¥600    | −¥5,928    | +¥7,128    |
| 31–60d  | ¥6,000          | ¥3,680            | +¥2,320  | +¥1,670    | +¥2,970    |
| 61–90d  | ¥0              | ¥0                | ¥0       | —          | —           |

---

## Step 5 output — risks flagged

1. **Payroll crunch:** Payroll (¥22,000) hits 2026-04-15. Low-band inflows through
   2026-04-14: ¥0 (both AR receipts fall 2026-04-28 and 04-29). Shortfall risk: up to ¥22,000.
   *Recommend: confirm receivables timing with 明发商贸 and 云溪科技 before 2026-04-14.*

2. **Late-payer risk:** 明发商贸 historically pays 18 days late. Their ¥8,400
   invoice (due 2026-04-10) shifts to 2026-04-28 — after payroll.

---

## Step 6 output — chat summary

```
Cash Flow Snapshot — 2026-04-23 → 2026-07-21
Sources: 用友好会计 export, 支付宝商家平台 bill export

              Expected    Low        High
30-day net:   +¥600      −¥5,928    +¥7,128
60-day net:   +¥2,320    +¥1,670    +¥2,970
90-day net:   ¥0         —          —

⚠ 2 risks flagged:
  • Payroll crunch: ¥22K payroll hits 2026-04-15; AR receipts don't clear until
    2026-04-28/29. Low-band shortfall risk: up to ¥22,000.
  • Late-payer: 明发商贸 (mean 18-day lag) shifts ¥8,400 past payroll date.

Confidence band: ±28% (based on historical payment variance across 3 customers).

This forecast is based on the accounting-export AR/AP and Alipay settlement
history the owner provided. It is not a substitute for accounting advice —
verify with your bookkeeper before making financing decisions.
```

**XLSX:** `cash-flow-snapshot-2026-04-23.xlsx` — Summary / Detail / Risks sheets.
