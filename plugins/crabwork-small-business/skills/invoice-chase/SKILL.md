---
name: invoice-chase
version: 0.3.0
description: >
  Drafts overdue-invoice reminders from the owner's accounting software AR
  aging (用友好会计 / 金蝶精斗云 export) cross-checked against Alipay
  (支付宝商家平台) bill exports, matched to each customer's payment history and
  tone (gentle for good customers, firm for repeat late payers). With owner
  approval, creates Alipay payment links to include in reminders; all reminder
  text is drafted in chat for the owner to copy and send. Use when the user
  asks "who owes me money," mentions overdue invoices, or wants to follow up
  on unpaid invoices.
---

# Invoice Chase

## Quick start

Read the AR aging report, score each customer by payment history, draft a tone-matched reminder for each overdue invoice, and present them to the owner. Nothing goes out until the owner says so.

```
User: "who owes me money"
→ Ask for the AR aging export from the accounting software (用友好会计 / 金蝶精斗云)
→ Cross-reference a recent 支付宝商家平台 bill export (last 14 days)
→ Score each customer: good-payer / occasionally-late / repeat-late
→ Draft tone-matched reminders
→ Show summary table + drafts. Wait for "send these."
```

## Setup (first run only)

Ask the owner two questions before running for the first time:

1. **Reminder channel**: "How do you usually send payment reminders — email, WeChat, or something else?" There is no email connector yet (腾讯企业邮 wrapper pending), so reminders are drafted in chat for the owner to copy into their channel. If the owner just wants an internal nudge to themselves or their bookkeeper, that can go out as a DingTalk/Feishu message via the connected connector instead. Store the answer.
2. **WeChat Pay**: "Do you also collect payments via WeChat Pay (微信支付)? It's not connected yet, but if you upload a 微信支付商户平台 bill export I'll include it in the overdue sweep." — if yes, ask for that export alongside the accounting data.

Do not ask again on subsequent runs.

## Workflow

1. **Pull overdue receivables.** Ask the owner for an AR aging export (CSV/Excel, or a pasted report) from their accounting software (用友好会计 / 金蝶精斗云) covering all invoices more than 1 day past due. If WeChat Pay is in scope (owner confirmed at setup), also take the 微信支付商户平台 bill export.

2. **Cross-reference payment history.** Ask the owner for a recent 支付宝商家平台 bill export (CSV) covering at least the last 14 days. The Alipay MCP connector cannot export transaction history — the bill file is the only bulk source.
   - If the export's end date is more than 2 days old, ask for a fresh download before proceeding — stale data risks dunning someone who already paid.
   - For a single invoice with a known merchant order number, `query-alipay-payment` (if the Alipay connector is configured) can spot-check that one payment's status. Do not use it to sweep the whole customer list.
   - If no bill export is available, flag every customer in the batch as "Alipay not verified — confirm manually" in the summary table and score from accounting history only. Do not silently drop the caveat.

   If a customer shows a settled payment within the last 14 days, flag as "possibly paid — verify" and exclude from the draft queue.

3. **Score each customer.** Read [reference/tone-matching.md](reference/tone-matching.md) for scoring logic. Result: `good-payer`, `occasionally-late`, or `repeat-late`.

4. **Draft reminder messages.** One message per customer — consolidate multiple overdue invoices into one message. Match tone to score. See [reference/examples/gentle-reminder.md](reference/examples/gentle-reminder.md) and [reference/examples/firm-reminder.md](reference/examples/firm-reminder.md).

5. **Present drafts to owner.** Show a summary table first:

   | Customer | Amount Due | Days Late | Tone | Delivery |
   |---|---|---|---|---|
   | Acme Corp | ¥1,200 | 18 days | Gentle | Alipay link + chat draft (owner sends) |
   | Smith LLC | ¥450 | 47 days | Firm | Chat draft (owner sends) |

   Then show each draft in full. Wait for owner to say "send these" or approve individually.

6. **Prepare delivery — only after approval.**
   - For invoices to be collected via Alipay: create a payment link with the Alipay connector (`create-web-page-alipay-payment` or `create-mobile-alipay-payment`) and insert it into the reminder text. If the Alipay connector is not configured, it will be absent — fall back to the owner's own收款 link or bank details in the draft, and say so.
   - Hand the finished reminder text to the owner in chat to copy and send through their channel — there is no email connector yet.
   - Where a plain notification suffices (e.g. alerting the bookkeeper), send a DingTalk/Feishu message via the connected connector.
   - Never create a payment link or send any message without explicit approval.

7. **Report what happened.** List which payment links were created, which drafts were handed off for the owner to send, which notifications went out, and what was flagged (possibly paid, excluded).

## Approval gates

- **Never create a payment link, send a message, or finalize a draft batch without explicit owner approval.** Present all drafts first; wait for the go-ahead.
- **Never include a customer who paid in the last 14 days.** Flag as "possibly paid — verify" instead.
- **Never draft a reminder for a customer not in the accounting software AR export** (or the WeChat Pay export, if provided). No reminders from memory alone.
- **One approval covers one batch.** Adding a customer or changing a draft after approval starts a new round.

## Reference

- [reference/tone-matching.md](reference/tone-matching.md) — scoring logic, tone guidelines, subject line formulas
- [reference/gotchas.md](reference/gotchas.md) — known failure modes
- [reference/examples/gentle-reminder.md](reference/examples/gentle-reminder.md) — good-payer reminder example
- [reference/examples/firm-reminder.md](reference/examples/firm-reminder.md) — repeat-late-payer reminder example

## Spreadsheet input routing

- When the AR aging or bill export arrives as an Excel file (.xlsx/.xls), parse it via `crabcode-office-suite:crabcode-spreadsheets`; CSV files and pasted reports need no extra tooling. Reminders themselves are chat drafts — no spreadsheet output.
- If that skill reports Unknown skill, the office suite is not installed: guide the owner to install `crabcode-office-suite` via `/plugin` and retry — or ask for a CSV export instead.
