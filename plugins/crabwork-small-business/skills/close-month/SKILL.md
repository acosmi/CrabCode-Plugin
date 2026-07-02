---
name: close-month
version: 0.3.0
description: Closes the month — reconciles the owner's accounting-software export (用友好会计 / 金蝶精斗云) against payment-platform bill exports (支付宝商家平台, 微信支付商户平台), flags gaps and uncategorized transactions, writes a plain-English P&L narrative, and exports an xlsx + PDF close packet. Trigger when the owner runs /close-month or says "close the month," "close the books," "month-end close," "reconcile last month," "do the monthly close," or hands the books off to their accountant. Accepts optional month and save-to arguments.
allowed-tools: Read, WebFetch, Bash
---

Run the month-end close workflow. Reconcile, flag gaps, narrate the P&L, and export the close packet for the owner's records (and their accountant).

Parse arguments:
- `--month` (default: previous calendar month) — `YYYY-MM` format
- `--save-to` (default `desktop`) — `desktop` (local files). Cloud file storage (阿里云盘) is not yet connected; offer to copy the summary tables into a 腾讯文档 sheet via the tencent-docs connector if the owner wants an online copy.

## Step 1 — Reconcile

Trigger the `month-end-prep` skill workflow:

1. Ask the owner for a full transaction export (CSV/Excel) for the target month from their accounting software (用友好会计 / 金蝶精斗云). There is no accounting-software connector yet — this export is the source of truth for the close.
2. Ask for the month's bill exports (CSV) from each payment platform the owner uses: 支付宝商家平台, and 微信支付商户平台 if they take WeChat Pay (微信支付, not yet connected). The alipay connector cannot export settlement history — bill data always comes from the 商家平台 export.
3. Match accounting entries to platform settlements by amount + date (±2 days).
4. Surface three gap categories:
   - **Unmatched platform settlements** — money came in via 支付宝/微信支付 but never landed in the books
   - **Unmatched book deposits** — the books show income with no platform record (cash? bank transfer? misclassified?)
   - **Variance lines** — matched but amount differs (fees, refunds split)

## Step 2 — Flag suspicious entries

Surface in the same report:
- **Uncategorized transactions** — book entries with no category
- **Suspicious duplicates** — same amount, same vendor, within 3 days
- **Missing receipts** — book entries above $75 with no attachment noted in the export

For each, recommend an action for the owner to take in their accounting software: categorize as X, delete duplicate, attach receipt.

Wait for owner to triage flagged items before generating the narrative. Do not auto-categorize or auto-delete. Note: fixes happen in the owner's accounting software, not here — if entries change, ask for a fresh export before finalizing.

## Step 3 — P&L narrative

After triage, generate a plain-English P&L narrative:

```
{Month YYYY} closed at ${revenue} revenue ({+/-}{X}% vs prior month).
Top driver: {category/customer}. Biggest swing: {category} {direction} ${amount}
because {reason inferred from transactions}.

Margin: {X}% ({+/-}Y pts vs prior). {Cost-side commentary}.

Three notable items:
1. ...
2. ...
3. ...
```

Numbers come from the accounting export; the *why* comes from cross-referencing top transactions, vendor names, and prior-month deltas. Prior-month comparisons need last month's export too — ask for it, or mark deltas "n/a (no prior-month export)".

## Step 4 — Export the close packet

Generate two files:

1. **`close-packet-{YYYY-MM}.xlsx`** — multi-tab workbook:
   - `Reconciliation` — books ↔ platform match table with gap rows highlighted
   - `Flagged` — uncategorized / duplicates / missing receipts
   - `P&L` — formatted income statement with prior-month delta column
   - `Trial Balance` — accounts + ending balances (if the export includes them)
2. **`close-packet-{YYYY-MM}.pdf`** — one-page summary: P&L narrative + top-line numbers + gap count

Save both locally. Filename format: `close-packet-2026-04.xlsx` etc. If the owner wants an online copy, offer to create a 腾讯文档 sheet with the reconciliation and P&L tables via the tencent-docs connector.

## Missing data

If the owner cannot provide the accounting-software export, stop — reconciliation requires the books as the source of truth. If a payment-platform bill export is missing, run reconciliation against the available exports and note "支付宝商家平台 bill not provided — 支付宝 settlements skipped from reconciliation" (or whichever is missing). If no platform exports are provided, run books-only analysis and flag it.

## Approval gates

- **Never auto-fix flagged items.** Always show the gap, recommend an action, wait for the owner.
- **Never delete duplicates without explicit confirmation.** Show both records side-by-side (and the fix itself happens in the owner's accounting software).
- **Saving the packet locally is auto** — it stays on the owner's own machine. Creating a 腾讯文档 copy requires the owner's confirmation.

## Output

End the run with a one-paragraph recap: revenue, margin, gap count remaining (if any), file paths to the saved packet. If gaps were not all resolved, list them so the owner can revisit.
