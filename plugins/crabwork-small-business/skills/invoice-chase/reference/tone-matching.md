# Tone Matching

Scoring logic and reminder tone guidelines for invoice-chase.

## Scoring

Score each customer using the last 12 months of payment history from the owner's accounting software export (用友好会计 / 金蝶精斗云). Require a minimum of 3 invoices to score; fewer than 3 defaults to `occasionally-late`.

| Score | Criteria |
|---|---|
| `good-payer` | Paid on time or early in ≥ 75% of invoices |
| `occasionally-late` | Paid late in 25–50% of invoices, or fewer than 3 invoices on record |
| `repeat-late` | Paid late in > 50% of invoices |

"On time" means payment received on or before the invoice due date.

## Tone by score

| Score | Tone | Character |
|---|---|---|
| `good-payer` | Gentle | Friendly, assumes oversight. Opens with grace. |
| `occasionally-late` | Neutral | Professional, no judgment. Factual follow-up. |
| `repeat-late` | Firm | Direct, states a deadline. No warmth, no accusation. |

## Subject lines

Use as the email subject, or as the first line when the owner sends via WeChat/IM:

- Gentle: `Quick reminder: Invoice #[N] for ¥[amount]`
- Neutral: `Following up: Invoice #[N] — ¥[amount] past due`
- Firm: `Past due notice: Invoice #[N] — ¥[amount] ([X] days overdue)`

## Body structure (all tones)

Every reminder includes: invoice number(s), total amount due, original due date, days overdue, and payment instructions — an Alipay payment link created via the connector (with owner approval), or the owner's own payment details if the connector is unavailable.

Tone-specific additions:
- **Gentle**: one acknowledgment sentence ("I know things get busy")
- **Neutral**: none — facts only
- **Firm**: one deadline sentence ("Please remit by [date]")

One call to action per reminder. Never two.

## Consolidation rule

If a customer has multiple overdue invoices, combine into one reminder. List each invoice (number, amount, due date), then state the combined total. Use the customer's score, not the most overdue invoice's score.
