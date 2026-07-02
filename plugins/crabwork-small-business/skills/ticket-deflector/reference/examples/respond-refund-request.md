# Example: Refund request — Alipay payment found

**Scenario:** A customer emails saying their product arrived damaged and they want a full refund. The owner pastes the email and says "answer this customer."

---

## Customer email (pasted by the owner)

> **Subject:** Damaged product — need refund
>
> Hi, I ordered a cutting board set last month and it arrived cracked. I'd like a full refund please. My order number is 20260328001847.
>
> — Sarah M.

---

## Step 2 — Alipay lookup result

`query-alipay-payment` with order number 20260328001847 returns:

- **Order number (out_trade_no):** 20260328001847
- **Amount:** ¥64.00
- **Date:** 2026-03-28
- **Trade status:** paid
- **Refund check (`query-alipay-refund`):** no refund on record

---

## Step 3 — HubSpot lookup result

Contact found: Sarah M. (sarah.m@email.com)
- Lifecycle stage: Customer
- Prior orders: 2
- Notes: "Returning customer — sent holiday promo Dec 2025."

---

## Step 4 — Draft reply (presented to owner for review)

> **Subject:** Re: Damaged product — need refund
>
> Hi Sarah,
>
> So sorry to hear your cutting board set arrived cracked — that's definitely not okay. I've pulled up your order and I'm issuing a full refund of ¥64.00. You should see it back on your original payment method within 3–5 business days.
>
> Thanks for letting me know, and I appreciate your patience. Really sorry about this.
>
> [Owner name]

---

## Step 5 — Owner approves draft (no edits)

---

## Step 6 — Refund approval prompt

> *"Issue refund of ¥64.00 to Sarah M. (sarah.m@email.com) for order 20260328001847? Reply Y to proceed."*

Owner replies: **Y**

→ Refund issued via `refund-alipay-payment`.

---

## Step 7 — Hand-off + HubSpot note

Final reply handed to the owner, who sends it from their own mailbox (no email connector).

HubSpot note logged on Sarah M.'s contact:
> "Ticket Deflector — 2026-04-23: Customer reported damaged product. Full refund of ¥64.00 issued via Alipay (order 20260328001847). Reply drafted and handed to owner to send."

---

## Step 8 — Report

> Reply finalized for Sarah M. (owner to send) · Refund of ¥64.00 issued via Alipay (20260328001847) · HubSpot note logged.
