# Gotchas

## Gotcha: Treating revenue as profit

An owner sees ¥50K in Alipay collections and thinks that's what they made. It isn't — it's what they collected.

**Why it matters:** If you surface revenue figures without immediately pairing them with costs, the owner may misread the analysis and feel reassured when they shouldn't be.

### ✗ Bad
"Your Alipay revenue last quarter was ¥50,000."

### ✓ Good
"Your Alipay revenue last quarter was ¥50,000. After direct costs of ¥31,000, your gross profit was ¥19,000 — a 38% gross margin."

---

## Gotcha: Using list price instead of effective price

Owners often have discounts, refunds, and promotions that reduce what they actually receive per transaction. The Alipay/WeChat Pay bill exports reflect actual collected amounts, but accounting-software invoices may show list price.

**Why it matters:** If you compute margins using list price but the bill export shows actual collections, your cost-per-unit math will look better than reality.

### ✗ Bad
Use invoice amounts from the accounting export for revenue and bill-export data for COGS → margin appears inflated.

### ✓ Good
Use the Alipay/WeChat Pay bill amounts as the revenue source (actual collected), and the accounting export for costs. Note any discrepancy between invoice totals and payment totals — it's worth surfacing.

---

## Gotcha: Elasticity from a single price change

A business raised prices once, volume dipped for a month, then rebounded. Declaring that as "a 5% increase causes 3% volume loss" is overfit to one event.

**Why it matters:** One data point isn't a pattern. Seasonal dips, external events, or marketing changes may have caused the volume move, not the price change.

### ✗ Bad
"In March 2024, you raised prices 8% and volume fell 4%. Elasticity = −0.5."

### ✓ Good
"In March 2024, you raised prices 8% and the following month showed a 4% volume drop. Note: this is a single observation — the actual relationship between price and demand likely varies. I'll use this as a rough guide and show a range of scenarios."

---

## Gotcha: Ignoring service delivery costs for service businesses

For product businesses, COGS is usually clear (materials, manufacturing). For service businesses, owners often undercount their real cost — especially their own labor.

**Why it matters:** A service business can show 80% gross margin on paper while the owner is effectively paying themselves nothing after accounting for time.

### ✗ Bad
A freelance designer reports ¥0 COGS because they have no physical materials. Gross margin shows 100%.

### ✓ Good
Ask service businesses: "For this service, what does it cost you in time and any direct expenses to deliver it? Including your own labor at a rough hourly rate?" Use that as COGS for the analysis.

---

## Gotcha: COGS not broken down by product/service

Many small businesses record COGS as a single line item, not broken out by product. A P&L export from 用友好会计 or 金蝶精斗云 may only show a lump-sum cost.

**Why it matters:** You can't compute per-product margins if COGS is lumped together.

### ✗ Bad
Read the P&L export → Get total COGS ¥22,000 → Try to divide across 12 products → Numbers are meaningless.

### ✓ Good
If the export doesn't have item-level COGS, ask the owner: "Your books have your total costs but not a breakdown by product. Do you have a rough sense of what each item costs you to make or deliver? Even ballpark figures work." Proceed with owner-provided figures and flag the limitation in the output.

---

## Gotcha: Cost and revenue windows don't match

The cost export and the payment bill export often cover different date ranges — e.g. 12 months of costs but only the 3 months of Alipay bills the owner happened to download.

**Why it matters:** Dividing a year of costs into a quarter of revenue (or vice versa) produces margins that are wrong by a large, silent factor.

### ✗ Bad
Compute margin from a 12-month cost export against a 3-month 支付宝 bill export → margins look catastrophically negative → owner panics.

### ✓ Good
Check both files' date ranges before computing. If they differ, either ask the owner to re-download the bill export for the matching window, or trim the cost data to the overlapping months and say so: "I'm analyzing March–May only, since that's the window both files cover."

---

## Gotcha: Presenting scenarios as forecasts

The pricing scenario tables are math, not predictions. Volume elasticity is estimated from limited data, and real-world responses depend on competition, customer sensitivity, and timing.

**Why it matters:** An owner might act on the table as if it's a forecast, then feel misled when actual results differ.

### ✗ Bad
"If you raise prices 10%, you'll make ¥55,000 next quarter."

### ✓ Good
"If you raise prices 10% and volume drops ~5% (based on available history), revenue would be approximately ¥53,000. This is a rough projection — actual results will depend on your specific customers and competitive environment."
