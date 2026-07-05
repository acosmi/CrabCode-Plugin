---
name: plan-payroll
version: 0.3.0
description: Forecasts cash, ranks overdue invoices, drafts payment reminders, and stages Alipay (支付宝) payment links so the owner can confidently run payroll. Works from owner-provided accounting exports (用友好会计 / 金蝶精斗云) and 支付宝商家平台 bill data. Trigger when the owner runs /plan-payroll or says "can I make payroll," "do I have enough to pay my team," "cash is tight before payroll," "plan for payroll," "will payroll clear," or worries about covering wages. Accepts optional horizon and payroll-date arguments.
allowed-tools: Read, WebFetch, Bash
---

Run the payroll-confidence pipeline by chaining two skills. The owner approves at each handoff — never send a reminder or create a payment request without explicit confirmation.

Parse arguments:
- `--horizon` (default `30`) — forecast window in days (30, 60, or 90)
- `--payroll-date` (optional) — the date payroll runs; defaults to next Friday

## Step 1 — Cash forecast (cash-flow-snapshot)

Trigger the `cash-flow-snapshot` skill workflow:
1. Ask the owner for AR, AP, and historical cash-timing data: a CSV/Excel export or pasted report from their accounting software (用友好会计 / 金蝶精斗云), plus a 支付宝商家平台 bill export (and 微信支付商户平台 export if they take WeChat Pay — 微信支付 is not yet connected). There is no live connector for any of these — the alipay connector cannot export transaction history, so the forecast is always built from owner-provided data.
2. Layer in known fixed costs (rent, payroll, recurring vendor charges).
3. Produce a 30/60/90-day forecast (use the requested `--horizon`) with percentage-variance confidence bands.
4. Flag named risks — e.g., "payroll on May 15 lands $4,200 below your fixed-cost floor at the median forecast."
5. Deliver chat summary + downloadable XLSX.
6. Present to the owner. Wait for explicit "okay, see what we can collect" before Step 2.

If the forecast shows payroll is comfortably covered, ask the owner whether they still want to chase overdue invoices or stop here.

## Step 2 — Overdue collection (invoice-chase)

After Step 1 approval, trigger the `invoice-chase` skill workflow:
1. Identify overdue invoices from the accounting-software export (and any receivables the owner lists manually).
2. Rank by amount × days-late × customer payment history.
3. For each, draft a reminder matched to tone (gentle for good customers, firm for repeat late payers). There is no email connector yet — reminders are drafted in chat for the owner to copy and send through their own channel.
4. For customers who pay via Alipay: with the owner's approval, create a payment link via the alipay connector (`create-web-page-alipay-payment` or `create-mobile-alipay-payment`) and attach it to the drafted reminder so the customer can pay in one tap. If the alipay connector is not configured, skip link creation and note it — the reminder still works without a link.
5. Present the ranked list with drafted reminders. Show the projected cash impact if a top-N subset gets paid within the horizon — does that close the payroll gap from Step 1?
6. Wait for explicit approval per reminder (or batch approval) before creating any payment link. The owner sends the reminders themselves; nothing is sent automatically.
7. Optional follow-up: if the owner has the order number for a staged payment link, check whether it was paid via `query-alipay-payment`.

## Approval gates (must hold)

- Never send a reminder on the owner's behalf — all reminders are drafts the owner copies and sends.
- Never create an Alipay payment link without owner approval — drafts only until approval is given.
- Never commit a forecast as authoritative without owner sign-off.
- If required data is missing (no accounting export, no 支付宝 bill), stop, report what's missing, and ask whether the owner can provide it or wants to proceed with a partial forecast (flagged as such).

## Deliverable routing

- The Step 1 forecast workbook (XLSX) is generated via `crabcode-office-suite:crabcode-spreadsheets`; the same skill parses accounting or bill exports that arrive as Excel files rather than CSV.
- If it reports Unknown skill, the office suite is not installed: guide the owner to install `crabcode-office-suite` via `/plugin`, then retry; until then, present the forecast as markdown tables in chat.

## Output

End the run with a one-paragraph recap: forecast verdict (covered / gap / risk), reminders drafted and payment links created (and for whom), projected new cash position if reminders convert.
