# Payment Platform Settlements Reference

## Contents

- [Alipay (支付宝)](#alipay-支付宝)
- [WeChat Pay (微信支付)](#wechat-pay-微信支付)
- [Reconciliation logic (all platforms)](#reconciliation-logic-all-platforms)

Both platforms deliver settlement data as **downloaded bill files**, not live API
pulls. The Alipay MCP connector only creates payment links, queries a single
payment by order number, and processes refunds — it cannot export a month of
history. WeChat Pay has no connector at all yet. Always ask the owner for the
bill downloads.

Column names in the bill files are in Chinese and vary by bill type and account
version — confirm the header row with the owner before parsing.

---

## Alipay (支付宝)

### Bill export

Source: 支付宝商家平台 bill/statement download (CSV) for the target month.

What to identify in the file:

| Data | Notes |
|---|---|
| Order / transaction number | Alipay's transaction ID and the merchant order number |
| Transaction time | When the payment occurred |
| Gross amount | Money in (positive) |
| Service fee | Alipay's fee, deducted before settlement |
| Net / settlement amount | What actually reaches the account — use this for matching |
| Transaction type/status | Distinguishes payments, refunds, transfers |

**Settlement date vs. transaction date:** funds from a sale may reach the bank
or balance later than the transaction time, depending on the account's
settlement cycle. Match by **settlement/arrival date** when reconciling against
book deposits, not transaction time.

**Refunds:** appear as refund-type or negative rows. They should offset the
original sale — don't flag a refund as a discrepancy against the register unless
there's no corresponding credit entry in the books. To spot-check a single
refund, `query-alipay-refund` can look it up by order number (if the Alipay
connector is configured).

**Spot checks:** for one specific payment, `query-alipay-payment` (connector
required) returns that payment's current status by merchant order number. Use it
to settle a disputed line, not to rebuild the month.

---

## WeChat Pay (微信支付)

### Bill export

Source: 微信支付商户平台 bill downloads for the target month. WeChat Pay is not
yet connected — this is always a manual download by the owner.

The merchant platform offers a transaction bill (交易账单) and a funds bill
(资金账单). For deposit reconciliation, prefer the funds bill — it reflects
actual money movement; the transaction bill lists sales activity.

What to identify in the file:

| Data | Notes |
|---|---|
| Order / transaction number | WeChat transaction ID and merchant order number |
| Transaction time | When the payment occurred |
| Gross amount | Sale amount |
| Service fee | WeChat Pay's fee |
| Net / settlement amount | Use this for matching against book deposits |

**Fees:** deducted before settlement — compare net amounts to the book deposit,
not the gross sale total.

---

## Reconciliation logic (all platforms)

Use this logic to match platform settlements against the accounting register's
bank deposits:

```
for each platform settlement in target month:
    find book deposit where:
        abs(book.amount - platform.net_amount) < ¥0.50
        AND abs(book.date - platform.settlement_date) <= 2 days

    if match found:
        mark as RECONCILED
    elif abs(book.amount - platform.net_amount) < ¥0.50 (date mismatch only):
        flag as DATE_MISMATCH (usually a timing difference — low priority)
    elif platform settlement not matched at all:
        flag as MISSING_IN_BOOKS
    elif book deposit not matched to any platform record:
        flag as UNMATCHED_DEPOSIT (may be bank transfer, cash, or other income)
```

**Multi-platform businesses:** run this logic independently per platform, then
aggregate flags. A book deposit that doesn't match Alipay may legitimately be a
WeChat Pay settlement — don't flag it until you've checked every platform whose
bill the owner provided. If a platform's bill wasn't provided, say so in the
flags rather than marking its deposits as errors.
