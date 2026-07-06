---
name: month-end-prep
version: 0.3.0
description: >
  Walks an SMB owner through month-end close: reconciles the books from their
  accounting software (用友好会计 / 金蝶精斗云 export) against Alipay
  (支付宝商家平台) and WeChat Pay (微信支付商户平台) settlement bill exports,
  flags uncategorized transactions, suspicious duplicates, and missing
  receipts, then writes a plain-English P&L narrative and exports a close
  packet (xlsx + one-page PDF). Use when the user says "close the month,"
  "month-end," "reconcile," "what's missing," "P&L," or asks why revenue or
  margin changed this month.
  亦触发于:"月结""对账""缺什么票""利润表""这个月利润怎么变的"。
---

# Month End Prep

## Quick start

Have your accounting software export (用友好会计 / 金蝶精斗云) and your payment
platform bill exports (支付宝商家平台; 微信支付商户平台 if you collect there)
ready, then say "let's close the month." CrabCode walks you through each step of
the checklist, pausing for your input at each gate before moving forward.

There is no live accounting or payment-history connector — every step runs on
exports or pasted data the owner provides. If a file is missing, CrabCode asks
for it — it won't silently skip a step.

## Workflow

Work through these steps in order. Each step has a completion state; don't advance
until the current step is settled.

### Step 1 — Agree on the target month

Ask the user which month to close. Default to the prior calendar month if they don't
specify. Confirm before asking for any data.

### Step 2 — Collect the accounting P&L and transaction register

Ask the owner for an export from their accounting software (用友好会计 /
金蝶精斗云) — CSV/Excel, or a pasted report:
- Profit & Loss report for the target month (revenue, COGS, gross margin, operating
  expenses, net income)
- Transaction register: every income and expense line item

Flag immediately:
- **Uncategorized transactions** — any line with a blank category or the
  software's placeholder category (e.g. "未分类" / "待处理")
- **Pending-review items** — anything the software has marked as needing review

Present the count ("14 transactions need a category") and list them for the user to
classify before proceeding. Don't advance with open uncategorized items unless the
user explicitly says "skip for now."

See [reference/accounting-reconcile.md](reference/accounting-reconcile.md) for field
mappings and export notes.

### Step 3 — Collect payment platform settlement bills

Ask the owner for the settlement/bill exports for the same calendar month:
- 支付宝商家平台 bill export (CSV). The Alipay MCP connector cannot export
  settlement history — the downloaded bill file is the only bulk source. (For a
  single payment with a known order number, `query-alipay-payment` can spot-check
  its status if the connector is configured.)
- 微信支付商户平台 bill export, if the business collects via WeChat Pay (not yet
  connected — always a manual download).

Match each settlement deposit against the accounting register's bank deposit line:
- **Match** — amount and date agree within 2 days → mark as reconciled
- **Difference < ¥0.50** — rounding/fee; note but don't flag
- **Difference ≥ ¥0.50** — flag with the delta amount
- **Settlement exists, no book deposit** — flag as "missing in the books"
- **Book deposit exists, no settlement** — flag as "deposit not in platform bill"

See [reference/payment-settlements.md](reference/payment-settlements.md) for bill
export field mappings (Alipay, WeChat Pay).

### Step 4 — Detect suspicious duplicates

Scan the transaction register for likely duplicate charges or deposits. Flag a
transaction as a suspicious duplicate when **all three** match:
- Same amount (within ¥0.01)
- Same vendor or customer name
- Posted within 5 calendar days of each other

Present flagged pairs to the user. They decide whether each is legitimate (e.g., a
recurring weekly subscription) or a real duplicate to void.

See [reference/gotchas.md](reference/gotchas.md) for common false-positive patterns
and how to distinguish them.

### Step 5 — Receipts check (local files)

> **税前扣除凭证须为发票。** 中国企业所得税税前扣除,合规凭证应为**发票**(数电发票 / 增值税专用发票 / 增值税普通发票);**收据、白条一般不能作为税前扣除凭证**。做凭证核对时请区分"发票"与"收据/白条"——某笔支出即便有收据,通常仍需取得对应发票才能税前扣除。下文的凭证(receipt)检查,核对的是**是否有合规发票**留存,而不是只有一张收据。

If local file access is available, scan the receipts folder (ask the user for the
path; default `~/Documents/Receipts`) for the target month.

For each expense transaction in the register above ¥25 with no attached document:
- Check for a matching receipt file (match by amount ± ¥0.50 and date within 3 days)
- **Matched** → note as "receipt on file"
- **Not matched** → flag as "missing receipt"

List missing receipts. The user can supply the file or mark as "receipt not required"
(e.g., a recurring auto-pay with no receipt).

If local file access is not available, ask the user to confirm which expenses have a
compliant 发票 on file (收据/白条 generally won't be deductible) — don't silently skip this step.

### Step 6 — Owner sign-off gate

Present a summary before going further:

```
Uncategorized transactions:  X of X resolved
Settlement discrepancies:    X flagged, X resolved
Suspicious duplicates:       X flagged, X cleared
Missing receipts:            X outstanding
```

Ask: "Ready to write the P&L summary and export the close packet?"

**Do not proceed to Steps 7–8 without explicit confirmation.**

### Step 7 — Write the P&L narrative

Write a plain-English summary of the month — the kind an owner would share with their
spouse or accountant, not a CFO memo. Aim for 150–250 words.

Structure:
1. **Headline** — one sentence: "March came in at ¥X net, up/down Y% from February."
2. **Revenue** — what drove the number; name products, services, or customers if
   the data shows concentration.
3. **Gross margin** — whether it held, rose, or compressed, and the main reason why.
4. **Key expenses** — any line that moved more than 10% MoM or is outside the normal
   range; one sentence each.
5. **Bottom line** — net income vs. prior month; ask if they have a target to compare.
6. **Watch list** — 1–3 things to monitor next month.

Avoid jargon; define anything that isn't plain English ("MoM" = month over month).

See [reference/examples/pl-narrative.md](reference/examples/pl-narrative.md) for a
worked example.

### Step 8 — Export the close packet

Produce two files:

**`close-packet-[YYYY-MM].xlsx`** — three sheets:
- `P&L` — the accounting P&L data, formatted
- `Reconciliation` — matched and flagged transactions side by side
- `Action Items` — any outstanding flags (uncategorized, missing receipts, etc.)

**`close-packet-[YYYY-MM]-summary.pdf`** — one page:
- Month and business name at the top
- Key figures (revenue, gross margin %, net income)
- The P&L narrative from Step 7
- Count of open action items, if any

Save both to the Desktop (or a path the user specifies). Confirm the file locations.
If the owner wants the packet in a shared online doc, they can upload the files to
腾讯文档 via the tencent-docs connector.

See [reference/close-packet-format.md](reference/close-packet-format.md) for column
specs and PDF layout details.

## Approval gates

- **Never run reconciliation on a month that has been filed.** Confirm the books are
  still open before collecting data.
- **Never modify the owner's books.** Surface flags; the owner makes changes in
  their accounting software.
- **Always pause at Step 6** before producing outputs. Unresolved flags must be
  acknowledged or explicitly skipped.

## Graceful degradation

| Missing input | Fallback |
|---|---|
| Accounting export (用友好会计 / 金蝶精斗云) | Ask the owner to paste the P&L and transaction list, or answer questions inline |
| Payment platform bill | Ask the owner to download it from 支付宝商家平台 / 微信支付商户平台; spot-check single Alipay payments by order number via `query-alipay-payment` if the connector is configured |
| Local receipts folder | Ask the user to confirm receipt status for each flagged expense |

## Reference files

- [reference/accounting-reconcile.md](reference/accounting-reconcile.md) — accounting
  export field mappings, completeness checks, common data issues
- [reference/payment-settlements.md](reference/payment-settlements.md) — bill export
  structure for Alipay and WeChat Pay
- [reference/close-packet-format.md](reference/close-packet-format.md) — xlsx column
  specs, PDF layout, file naming convention
- [reference/gotchas.md](reference/gotchas.md) — duplicate false positives, split
  transactions, partial-month edge cases
- [reference/examples/pl-narrative.md](reference/examples/pl-narrative.md) — worked
  P&L narrative example

## Deliverable routing

- Build `close-packet-[YYYY-MM].xlsx` via `crabcode-office-suite:crabcode-spreadsheets` and the one-page `close-packet-[YYYY-MM]-summary.pdf` via `crabcode-office-suite:crabcode-pdf`. The spreadsheets skill also parses owner exports that arrive as Excel files rather than CSV.
- If either skill reports Unknown skill, the office suite is not installed: guide the owner to install `crabcode-office-suite` via `/plugin`, then retry; until then, present the close packet as markdown tables in chat for confirmation.
