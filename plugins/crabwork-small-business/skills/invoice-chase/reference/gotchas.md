# Gotchas

Known failure modes for invoice-chase.

---

**Customer paid via bank transfer or WeChat Pay — not visible in the Alipay bill export.**

The Alipay cross-reference only catches Alipay payments. A customer who paid by bank transfer or WeChat Pay may still appear as overdue in AR. Note this in the summary: "Alipay bill only — bank transfer / WeChat Pay payments not verified." Let the owner confirm before sending.

---

**The Alipay bill export is stale.**

The "possibly paid" check is only as fresh as the bill file. If the export's end date is more than 2 days old, a customer may have paid since it was downloaded. Ask the owner for a fresh 支付宝商家平台 download before presenting drafts for approval; if they can't provide one, say so in the summary rather than presenting the check as current.

---

**The accounting AR export includes internal or test accounts.**

Some setups include internal billing accounts or test records in AR. Before drafting, filter out customers whose email domain matches the owner's domain, and flag any customer name containing "Test," "Internal," "Demo," or "测试."

---

**Multiple overdue invoices from the same customer — send one reminder only.**

Never draft two separate reminders to the same customer in one batch. Consolidate all overdue invoices into one message with a total amount and a list of invoice numbers. Two messages to the same person in one batch looks disorganized and may get flagged as spam.

---

**Alipay payment link creation fails or the connector is absent.**

Creating a payment link requires the Alipay connector to be configured (via /plugin → Manage plugins → Configure); if it isn't, the connector simply won't appear. In that case — or if link creation returns an error — fall back to the owner's own收款 link or bank details in the draft, and report the fallback: "Alipay link unavailable for [customer] — draft uses your standard payment instructions instead." Do not silently drop the reminder.

---

**The WeChat Pay export and the accounting AR may both carry the same invoice.**

If the owner provided a 微信支付商户平台 export and a customer appears in both it and the accounting AR, it may be the same invoice tracked in two systems. Match on invoice/order number first; if no number match, match on amount + due date. When uncertain, flag to the owner and draft only one reminder rather than two.
