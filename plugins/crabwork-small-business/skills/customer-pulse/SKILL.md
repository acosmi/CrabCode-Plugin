---
name: customer-pulse
version: 0.3.0
description: >
  Aggregates payment dispute/refund records (支付宝商家平台 / 微信支付商户平台
  exports or pasted data), HubSpot feedback and tickets, Intercom
  conversations, and pasted customer emails (plus pasted or exported
  大众点评/淘宝 reviews) into a themes report with verbatim evidence and a
  "do these three things this week" list. Use when the user asks how
  customers are feeling, for review analysis, what people are saying, or
  about disputes and refund complaints.
---

# Customer Pulse

## Quick start

Ask: *"How are customers feeling this month?"*

CrabCode pulls tickets and Intercom conversations for the last 30 days, folds in whatever the owner provides — payment dispute/refund exports, pasted customer emails, pasted reviews — groups everything into 3–5 themes with verbatim evidence, and delivers a "do these 3 things this week" action list.

To include 大众点评 or 淘宝 reviews, paste them after triggering — or say "I have some reviews to add."

## Workflow

1. **Set the date window.** Default: last 30 days. If the user specifies a range, use it.

2. **Collect payment dispute/refund records.** There is no connector that can bulk-export disputes or transaction history — the connected Alipay MCP only handles single-payment lookups and refunds. Ask the owner for a 支付宝商家平台 and/or 微信支付商户平台 export (CSV) covering the window, or pasted dispute/refund records. If nothing is provided, add `Payments: not provided — not included` to the Sources section and continue. Do not block; do not error. See [reference/gotchas.md](reference/gotchas.md) for the missing-source pattern.

3. **Pull HubSpot tickets and feedback.** Fetch open and recently closed tickets. If 0 tickets exist, record `HubSpot tickets: 0` and continue — do not surface a warning.

4. **Collect customer emails.** There is no email connector yet — ask the owner to paste recent customer emails (or forward them as text). Scan the pasted material for complaint signals using this seed list: `refund cancel unhappy issue problem disappointed frustrated broken late slow wrong missing`. Extract subject lines and 1–2 sentence excerpts per thread. If no emails are pasted, record `Emails: none provided` and continue.

5. **Pull Intercom conversations.** Call `search_conversations` to fetch open and recently closed conversations. Then call `get_conversation` for each conversation ID returned to access the full `conversation_parts`. Extract parts where `author.type === 'user'` — these are customer messages. Exclude parts where `author.type` is `admin` or `bot`.

6. **Accept pasted reviews (optional).** If the user pastes 大众点评 or 淘宝 review text (or any other review-platform export), include it in the source pool tagged as `[Review]`. No connector required.

7. **Extract themes.** Group all evidence into 3–5 recurring themes. Each theme must include:
   - A one-sentence label (e.g., "Shipping delays causing repeat complaints")
   - 2–3 verbatim quotes with source tags: `[Payments]`, `[HubSpot]`, `[Email]`, `[Intercom]`, or `[Review]`
   - A signal count (how many items touch this theme)

   Verbatim quotes are non-negotiable — never paraphrase. See [reference/gotchas.md](reference/gotchas.md) for the verbatim anti-pattern.

8. **Generate the "do these 3 things" list.** Rank themes by signal count. Pick the top 3 and write one concrete, owner-actionable step per theme. Format as a numbered checklist.

9. **Deliver the report.** Structure the output with these sections in order:
   - **Header** — H2 with "Customer Pulse" and the date range.
   - **Sources pulled** — Bullet list with signal counts per source (payment
     disputes/refunds, HubSpot tickets, pasted emails, Intercom conversations,
     pasted reviews). Note any source that was not provided and skipped.
   - **Themes** — For each theme, show a bold numbered theme label with the
     signal count, followed by two verbatim quotes as blockquotes, each
     attributed to its source.
   - **Do these 3 things this week** — Numbered list of three concrete,
     owner-actionable steps, each tied to one of the top themes.

   For a complete worked example, see [reference/examples/example-report.md](reference/examples/example-report.md).

## Approval gates

This skill is **read-only** — it does not post, send, reply, or modify any records. No approval gate is required.

## Reference

- [reference/gotchas.md](reference/gotchas.md) — missing payment exports, HubSpot empty state, verbatim quote requirement, email keyword drift
- [reference/examples/example-report.md](reference/examples/example-report.md) — full worked example output
