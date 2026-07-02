---
name: handle-complaint
version: 0.3.0
description: Handles an incoming customer complaint end-to-end — pulls order and account context (HubSpot history, Alipay payment status by order number), drafts a tone-matched response for the owner to send, and suggests an operational fix so it doesn't recur. Trigger when the owner runs /handle-complaint or says "a customer is upset," "handle this complaint," "angry customer email," "deal with this complaint," "respond to this unhappy customer," or pastes a negative message. Accepts optional ticket ID argument.
allowed-tools: Read, WebFetch, Bash
---

Run the complaint resolution workflow by chaining two skills. Read the complaint, gather context, draft a response, and suggest a fix so it doesn't happen again.

Parse arguments:
- `TICKET_ID` (optional) — HubSpot ticket ID, or "latest" to pull the most recent unresolved complaint. If omitted, ask the owner to paste the complaint text — there is no email connector, so emailed complaints arrive as pasted text.

## Step 1 — Load the complaint (ticket-deflector)

Using the `ticket-deflector` skill workflow:

1. If a ticket ID was given: pull the full thread from HubSpot.
2. If "latest": pull the most recent unresolved HubSpot ticket tagged as complaint/support.
3. If neither: ask the owner to paste the complaint text directly.
4. Identify: customer name, order/account info (including the 支付宝 order number if present), what they're upset about, what they're asking for.

## Step 2 — Pull context

1. Search HubSpot for the customer's history: past purchases, prior complaints, deal stage, lifetime value.
2. If an Alipay order number is available, pull payment status via `query-alipay-payment` and refund status via `query-alipay-refund`. If not, ask the owner for the order number or have them look the payment up in 支付宝商家平台 / 微信支付商户平台 and paste the result. Dispute history has no connector — it comes from merchant-platform exports or pasted records.
3. Summarize: "This is a {new/returning} customer, ¥{lifetime_value} in purchases, {0/N} prior complaints. Their current issue is {one sentence}."

## Step 3 — Draft response (ticket-deflector)

Using the `ticket-deflector` skill workflow for tone-matched response:

1. Draft a reply matched to the severity and the customer's history:
   - First-time complainers with high LTV → empathetic, generous
   - Repeat complainers → professional, firm, solution-focused
   - Abusive tone → professional, brief, boundary-setting
2. Include: acknowledgment, explanation (if known), resolution offer, next step.
3. Present the draft to the owner. Do NOT send — the owner sends approved drafts from their own mailbox.

## Step 4 — Suggest operational fix (customer-pulse)

1. Check if this complaint matches a known theme (from prior `/customer-pulse-check` runs or similar complaints in HubSpot).
2. If it's a pattern: "This is the {Nth} complaint about {issue} this month. Consider: {specific operational change}."
3. If it's isolated: "This looks like a one-off. No pattern detected."

## Connector failures

If HubSpot is unreachable, ask the owner to paste the complaint text — the skill works with manual input. If Alipay is not connected or no order number is available, skip the payment lookup and note "Payment status unavailable — working from complaint text only."

## Approval gates

- **Never send a response without explicit owner approval.** Drafts only; the owner does the sending.
- **Never issue refunds or credits automatically.** Present the option; the owner decides. An Alipay refund (`refund-alipay-payment`) runs only after the owner explicitly confirms amount, customer, and order number.
- **Never close tickets without owner confirmation.** Dispute handling lives in the merchant platforms and is the owner's action.

## Output

Present the customer context summary, the drafted response, and any pattern-based operational suggestion. Ask: "Want to use this draft (I'll finalize it for you to send), edit it, or handle it differently?"
