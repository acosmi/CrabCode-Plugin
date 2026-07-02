---
name: ticket-deflector
version: 0.3.0
description: >
  Reads a pasted customer email or ticket, pulls payment/refund status from
  Alipay (支付宝, by order number) and account history from HubSpot, drafts a
  tone-matched reply in the owner's writing voice for the owner to send, and
  can issue an Alipay refund with explicit owner approval. Use when the user
  says "draft a response," "answer this customer," "where's my order," or
  "I want a refund."
compatibility: "Requires Alipay (支付宝), HubSpot. Optional: Intercom, DingTalk/Feishu. WeChat Pay (微信支付) not yet connected. Works from pasted text alone if connectors are missing."
---

# Ticket Deflector

## Quick start

Paste a customer email or message — CrabCode pulls payment status from Alipay (when the order number is known), looks up the customer in HubSpot, and drafts a reply in the owner's voice. If a refund is needed, it stages the details and waits for explicit approval before issuing anything.

```
User: "answer this customer" [pastes email]
→ Extract customer email + issue + order number from text
→ Pull Alipay payment status (query-alipay-payment, by order number)
→ Pull HubSpot contact history
→ Draft reply in owner's voice
→ Owner approves draft → owner sends it
→ If refund needed: approval prompt → owner confirms → issue via refund-alipay-payment
```

## Workflow

1. **Read the customer message.** Accept pasted email or message text — there is no email connector yet, so the owner pastes the thread. Extract: customer email address, name, order number (支付宝 out_trade_no, if present), and the core issue — refund request, order status question, or general complaint. If multiple issues are present, address them in the order they appear.

2. **Pull payment status from Alipay.** The Alipay connector looks up a single payment by order number (`query-alipay-payment`) — it cannot search by customer email or list transactions.
   - If the message contains an order number, call `query-alipay-payment` with it. Capture: amount, date, and trade status. Use `query-alipay-refund` to check whether a refund has already been processed.
   - If no order number is present, ask the owner to get it from the customer, or to look the payment up in 支付宝商家平台 and paste the result. Do not guess at a match.
   - If the payment was made via WeChat Pay, there is no connector yet — ask the owner to check 微信支付商户平台 and paste the details.
   - If Alipay is not connected (unconfigured connectors are simply absent), note it in the draft and continue from pasted data.
   - If Intercom is connected, check for open support tickets from this customer.
   - If the customer references multiple orders, surface all of them and ask the owner which one applies before drafting.

3. **Pull customer history from HubSpot.** Search contacts by email address. Pull: lifecycle stage, notes, open deals, and recent activity. If no contact exists, note it and offer to create one after the reply is sent — do not create during the response workflow.

4. **Draft the reply.** Write in the owner's writing voice. Adjust tone to fit the issue type:
   - Refund request → empathetic, clear, action-oriented
   - Order status question → factual, reassuring
   - General complaint → acknowledge, explain, offer resolution
   Flag any data gaps inline in the draft with a bracketed note (e.g., *[Note: No Alipay payment found for this order number — verify it before sending]*) so the owner sees the gap before sending. For a worked example, see [reference/examples/respond-refund-request.md](reference/examples/respond-refund-request.md). For common pitfalls, see [reference/gotchas.md](reference/gotchas.md).

5. **Approval gate — owner reviews the draft.** Present the full draft. Do not finalize it until the owner approves. The owner may edit freely before approving.

6. **Approval gate — refund issuance.** If a refund is warranted, surface a dedicated confirmation prompt after the owner approves the draft:

   > *"Issue refund of ¥[amount] to [customer name] ([email]) for order [out_trade_no]? Reply Y to proceed."*

   Wait for explicit confirmation. If the owner's reply is anything other than a clear yes, stop and ask what they'd like to do instead. Only then call `refund-alipay-payment`.

7. **Hand off the reply.** There is no email connector — after draft approval, hand the final text to the owner to send from their own mailbox. If DingTalk or Feishu is connected and the owner wants it, send them the final draft as a DingTalk/Feishu message via the connected connector. Then log the interaction as a note on the HubSpot contact timeline.

8. **Report.** One short paragraph: reply finalized and handed off, refund issued or not, HubSpot note logged.

## Approval gates

- **Never issue an Alipay refund without explicit owner confirmation** — always show amount, customer name, email, and order number before calling `refund-alipay-payment`.
- **Never send or finalize the reply without owner review.** Always present the full draft first; the owner does the sending.
- **Never create a HubSpot contact during the response flow.** Offer it afterward.
- **Never guess which order a message is about.** If the order number is missing or multiple orders are in play, ask the owner before drafting around payment details.
- **Never fabricate order details.** If Alipay has no record for the order number (or no order number is available), say so inline in the draft — do not invent a status.

## Reference

- [reference/gotchas.md](reference/gotchas.md) — Good / Bad patterns for tone, order-number lookup, and ambiguous refund scenarios
- [reference/examples/respond-refund-request.md](reference/examples/respond-refund-request.md) — worked example: refund request with Alipay payment found
