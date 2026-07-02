# Gotchas

Common mistakes and edge cases in month-end close. Each entry has the pattern,
the reason it matters, and a Bad / Good example.

---

## Gotcha: Flagging split transactions as duplicates

**Why it matters:** A single purchase split across multiple ledger categories
appears as multiple rows in the accounting export — same vendor, same date,
different amounts. Flagging these as duplicates sends the owner on a wild goose
chase.

### ✗ Bad

> Flagged as duplicate: Office Depot ¥47.50 on March 12 and Office Depot ¥62.50
> on March 12 — same vendor, same date.

Both rows share the same voucher number (单据编号) — they're splits of a ¥110
purchase across "Office Supplies" and "Equipment."

### ✓ Good

Before flagging duplicates, group rows by voucher/document number. Only compare
transactions with distinct numbers. Splits of the same transaction are never
duplicates.

---

## Gotcha: Treating a refund as a missing settlement

**Why it matters:** An Alipay refund appears as a refund-type or negative row in
the bill export. If you treat it as an unmatched outflow, you'll flag a
legitimate refund as a problem.

### ✗ Bad

> Flagged: Alipay outflow of –¥89.00 on March 18 has no matching book deposit.
> Possible missing transaction.

The –¥89.00 is a refund to a customer. It should match a credit/refund entry in
the books, not a deposit.

### ✓ Good

Separate inflows (payments) from outflows (refunds) before reconciling. Match
refund rows against the books' credit or refund entries, not deposits. Only flag
an unmatched refund if no corresponding credit entry exists in the books. To
settle a disputed refund, `query-alipay-refund` can look up that single refund
by order number (if the Alipay connector is configured).

---

## Gotcha: Comparing gross bill amount to net book deposit

**Why it matters:** The books often record the net settlement (after the
platform's service fee), but the bill export also carries the gross sale amount.
Comparing gross to net will always show a discrepancy equal to the fee.

### ✗ Bad

> Discrepancy: Alipay settlement ¥500.00, book deposit ¥497.00 — delta ¥3.00.
> Flagged as reconciliation error.

The ¥3.00 is the platform's service fee (0.6% here). This is expected and correct.

### ✓ Good

Use the **net settlement** amount from the bill export (gross amount minus the
service fee column) when comparing to the book deposit. If the delta is < ¥0.50
after fee adjustment, mark as RECONCILED.

---

## Gotcha: Advancing past Step 6 when there are unresolved flags

**Why it matters:** The close packet is the final artifact the owner files or
shares with their accountant. Exporting it with open flags bakes errors into
the record.

### ✗ Bad

> Owner hasn't responded about the 3 uncategorized transactions. Generating
> the close packet now so they have something to look at.

### ✓ Good

Hold at the Step 6 gate until the owner acknowledges every flag — either
resolving it ("categorize this as office supplies") or explicitly deferring it
("mark that as 'to review later'"). Only then export. Open items that the owner
deferred should appear in the Action Items sheet, not be silently dropped.
