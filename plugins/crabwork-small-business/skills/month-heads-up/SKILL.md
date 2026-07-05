---
name: month-heads-up
version: 0.3.0
description: Shows the next 30-day forward cash-flow outlook from the owner's accounting-software export (用友好会计 / 金蝶精斗云) and 支付宝商家平台 bill data, and flags anything that needs attention before month-end — designed to run around the 25th. Trigger when the owner runs /month-heads-up or asks "what does next month look like," "cash forecast," "what's my runway," "anything I need to watch before month-end," "will I be okay on cash," or wants a look-ahead at upcoming cash. Accepts optional 30 or 60 day horizon.
allowed-tools: Read, WebFetch, Bash
---

Run the month-end heads-up. Gather forward-looking cash data and give the owner a clear "here's what the next 30 days look like" picture with specific things to watch.

Parse arguments:
- `--horizon` (default: `30`) — forecast window in days (`30` or `60`)

## Step 1 — Current cash position

Using the `cash-flow-snapshot` skill workflow:

1. Ask the owner for current cash and receivables balances — a CSV/Excel export or pasted report from their accounting software (用友好会计 / 金蝶精斗云). There is no accounting-software connector yet.
2. Ask for the 支付宝 settled balance and pending settlements — pasted from 支付宝商家平台 or as a bill export (CSV). The alipay connector cannot pull balances or export history, so this is always owner-provided. Same for 微信支付商户平台 if the owner takes WeChat Pay (微信支付, not yet connected).
3. Combine for total available + incoming cash.

## Step 2 — Upcoming obligations

1. From the accounting export, list recurring expenses (payroll, subscriptions, rent/lease) due in the next 30 days — ask the owner to confirm or fill gaps.
2. List any outstanding invoices past due or due within 14 days.
3. Flag any payment that would push the balance below a comfortable buffer (default: <$2,000 or the owner's average monthly expense × 0.5, computed from the export).

## Step 3 — Cash-flow forecast

1. Project 30-day net cash: current balance + expected inflows − known obligations.
2. Identify the single tightest week (lowest projected balance).
3. Flag if any week projects negative.

## Step 4 — Two things to watch

Surface no more than two specific, actionable watches:
- Which invoice(s) to chase now
- Which expense(s) to defer or negotiate

Format as:

```
Month-End Heads Up — {current date}
Horizon: next {X} days

Cash today: ${amount}
Projected end-of-period: ${amount}
Tightest week: {date range} — projected ${amount}

TWO THINGS TO WATCH
1. {item} — {why it matters} — suggested action: {action}
2. {item} — {why it matters} — suggested action: {action}
```

## Missing data

If the owner cannot provide accounting data (export or pasted balances), stop — the cash forecast requires the books as the source of truth. If 支付宝 balance/bill data is missing, run the forecast from the accounting data only and note "支付宝 data not provided — 支付宝 receivables excluded from forecast." Same for 微信支付 if missing. Because all inputs are point-in-time exports, state the as-of date of the data in the brief.

## Approval gates

- **Never initiate payments or send anything automatically.** Surface the data and actions for the owner to take.
- **Never project revenue that hasn't been confirmed in the books or the 支付宝/微信支付 bills.** Use conservative estimates only.

## Spreadsheet input routing

- When the accounting or bill export arrives as an Excel file (.xlsx/.xls), parse it via `crabcode-office-suite:crabcode-spreadsheets`; CSV files and pasted balances need no extra tooling. The brief itself is delivered in chat — no spreadsheet output.
- If that skill reports Unknown skill, the office suite is not installed: guide the owner to install `crabcode-office-suite` via `/plugin` and retry — or ask for a CSV export instead.

## Output

Present the formatted brief and offer to draft chase reminders for any flagged overdue invoices — drafted in chat for the owner to copy and send (no email connector yet), or sent as a DingTalk/Feishu message via the connected connector if the owner wants an internal nudge instead.
