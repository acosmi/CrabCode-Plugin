---
name: tax-prep
version: 0.3.0
description: Prepares tax-season materials — quarterly estimated tax calculation or year-end 1099 prep — and produces an accountant handoff packet (framed as deliverables, not tax advice). Works from owner-provided exports — accounting software (用友好会计 / 金蝶精斗云) CSV/Excel plus 支付宝商家平台 / 微信支付商户平台 bill exports. Trigger when the owner runs /tax-prep or mentions "estimated taxes," "quarterly taxes," "how much to set aside for taxes," "1099s," "1099-NEC," "contractor payments," "W-9s," "year-end tax prep," or "my accountant needs..." Accepts optional mode and year arguments.
allowed-tools: Read, WebFetch, Bash
---

Run the tax prep workflow using the `tax-season-organizer` skill. Act immediately — the user typed /tax-prep, so skip the discovery phase.

Parse arguments:
- `--mode` (default: infer from date — Q1-Q3 defaults to `quarterly`, Q4/Jan defaults to `both`) — `quarterly` for estimated tax payment, `1099` for year-end 1099-NEC prep, `both` for combined
- `--year` (default: current year)

**Framing:** Open every deliverable with "Prepared for review by your accountant — not tax advice."

## Step 1 — Determine mode

If `--mode` was not provided:
1. Check the current date. If Oct–Jan, default to `both`. Otherwise default to `quarterly`.
2. Confirm with the owner: "Based on the time of year, I'll prepare [mode]. Want me to do something different?"

## Step 2 — Quarterly estimated tax (if mode includes quarterly)

1. Ask the owner for a YTD Profit & Loss (Jan 1 through last completed quarter) exported from their accounting software (用友好会计 / 金蝶精斗云) as CSV/Excel — or pasted net income. There is no accounting-software connector yet; this is always an owner-provided export.
2. If the owner can't export right now, work from pasted key numbers (gross revenue, total expenses, net income).
3. Ask: "How much have you already paid in estimated taxes this year?"
4. Calculate: SE tax, adjusted net income, federal income tax estimate (default 22% bracket), quarterly payment due.
5. State every assumption explicitly — bracket, business type, exclusions.
6. Deliver the formatted estimate with the due date for the current quarter.

## Step 3 — Year-end 1099 prep (if mode includes 1099)

1. Gather contractor/vendor payments from owner-provided exports: the accounting-software vendor payment report (CSV/Excel) plus 支付宝商家平台 bill export — and 微信支付商户平台 bill export if the owner pays contractors via WeChat Pay (微信支付, not yet connected). Note: the alipay connector cannot export payment history, so bill data always comes from the 商家平台 export or pasted records.
2. Aggregate by payee across sources. Flag likely duplicates for human review — never auto-merge.
3. Apply the $600 threshold. Flag near-threshold payees ($400–$599).
4. Check W-9 status from the accounting-software export for each flagged payee.
5. Deliver the 1099-NEC candidate list with missing W-9 action items and a data coverage note stating which exports were provided.

## Approval gates

- **Not tax advice.** State this in every output header.
- **State every assumption.** Bracket, business type, excluded deductions — give the accountant the levers.
- **Don't merge payees automatically.** Flag duplicates for human review.
- **Don't file anything.** Output is prep material only.

## Spreadsheet input routing

- When the P&L or vendor-payment export arrives as an Excel file (.xlsx/.xls), parse it via `crabcode-office-suite:crabcode-spreadsheets`; CSV files and pasted numbers need no extra tooling. Use the same skill if the owner wants the 1099 candidate list delivered as a spreadsheet file for their accountant.
- If that skill reports Unknown skill, the office suite is not installed: guide the owner to install `crabcode-office-suite` via `/plugin` and retry — or ask for a CSV export instead and deliver the prep material as markdown.

## Output

End with a next-steps checklist for the accountant: missing W-9s to collect, assumptions to verify, deadlines to hit.
