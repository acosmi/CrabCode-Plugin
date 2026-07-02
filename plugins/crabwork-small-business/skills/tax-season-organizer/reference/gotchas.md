# Good / Bad Patterns

Common failure modes and how to avoid them.

---

## Calculations

**BAD:** Apply 22% to gross revenue.
```
Gross revenue: $120,000
Tax estimate: $120,000 × 22% = $26,400  ← wildly wrong
```

**GOOD:** Apply bracket rate to net profit AFTER SE tax deduction.
```
Gross revenue: $120,000
Expenses:      $45,000
Net profit:    $75,000
SE tax:        $75,000 × 92.35% × 15.3% = $10,628
Deductible ½: $5,314
Adjusted net:  $75,000 − $5,314 = $69,686
Fed. tax est.: $69,686 × 22% = $15,331
Total:         $10,628 + $15,331 = $25,959
```

---

## Assumptions

**BAD:** State a dollar figure without any context.
> "Your Q2 estimated payment is $6,500."

**GOOD:** State the figure with the assumptions table.
> "Based on 22% federal bracket, sole proprietor structure, and no prior-year
> safe harbor data: **Q2 payment ≈ $6,500**. State taxes not included.
> QBI deduction not applied. Review with your accountant."

---

## 1099 threshold

**BAD:** Only flag vendors carrying a "1099 eligible" tag in the owner's accounting
software export. Many owners never set this flag. Silently missing contractors is
worse than over-flagging.

**GOOD:** Work from ALL vendors with ≥ $600 in payments, then note which ones are
tagged 1099-eligible in the export and which are flagged by category heuristics.
Let the accountant make the final call.

---

## Payee deduplication

**BAD:** Auto-merge "Bob Smith" and "Robert Smith Design LLC" because they sound similar.
These could be different people or the same person's sole-prop vs. LLC.

**GOOD:** Flag likely duplicates for human review.
> "These look like they may be the same person — confirm before filing:
> Bob Smith ($1,200) | Robert Smith Design ($800) — combined would be $2,000"

---

## Incomplete payment-rail coverage

**BAD:** Build the 1099 list from the accounting-software export alone and present it
as complete when the owner also pays contractors through 支付宝 or 微信支付.

**GOOD:** Ask which payment rails the owner used, and state coverage explicitly.
> "This list covers your accounting-software export and the 支付宝商家平台 bill you
> uploaded. You mentioned some contractors are paid via 微信支付 — that export wasn't
> provided, so those payments are not included. Upload the 微信支付商户平台 bill and
> I'll re-run the aggregation."

---

## Corporation exemption

**BAD:** Automatically exclude "Smith Consulting Inc." from the 1099 list because it
has "Inc." in the name.

**GOOD:** Flag it for the accountant with a note.
> "Smith Consulting Inc. — $4,500. Corporations are generally exempt from 1099-NEC
> requirements, but confirm with your accountant (S-corps and some professional corps
> are exceptions)."

---

## Tax advice boundary

**BAD:** "You should use a SEP-IRA to reduce your tax bill."

**GOOD:** "Your accountant may recommend a SEP-IRA or Solo 401(k) contribution to
reduce taxable income — these can significantly change the estimate above."

The skill surfaces options; the accountant advises.

---

## S-corp owners

**BAD:** Apply SE tax to an S-corp owner's full income.

**GOOD:** Note that SE tax applies only to W-2 wages for S-corp shareholders, not to
K-1 distributions — and ask the user to confirm their business structure before
running calculations. If unsure, default to sole prop math and note the assumption.
