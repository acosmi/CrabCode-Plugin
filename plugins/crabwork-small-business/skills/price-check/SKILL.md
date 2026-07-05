---
name: price-check
version: 0.3.0
description: Produces a margin-by-product table and three pricing-scenario data views so the owner can see the full financial picture before making a pricing decision. Works from the owner's accounting-software export (用友好会计 / 金蝶精斗云), optionally cross-validated against a 支付宝商家平台 bill export. Trigger when the owner runs /price-check or asks "should I raise prices," "what are my margins," "what should I charge," "am I making enough on this," "is this priced right," or "my costs are going up." Accepts optional product name argument.
allowed-tools: Read, WebFetch, Bash
---

Run the pricing analysis. Gather cost and revenue data, build the margin table, and model three pricing scenarios — so the owner can see the numbers clearly before deciding what to charge.

Parse arguments:
- `PRODUCT_NAME` (optional) — specific product or service to analyze; if omitted, analyze all active products

## Step 1 — Current margin baseline

Using the `margin-analyzer` skill workflow:

1. Ask the owner for a revenue-by-product/service report for the last 90 days — a CSV/Excel export or pasted report from their accounting software (用友好会计 / 金蝶精斗云). There is no accounting-software connector yet.
2. From the same export (or a second one), capture COGS or direct costs per product, if categorized.
3. Optionally cross-validate against gross sales from a 支付宝商家平台 bill export (CSV) for the same period — the alipay connector cannot export sales history, so this too is owner-provided.
4. Calculate current gross margin per product: (revenue − COGS) ÷ revenue.

Build the margin table:

```
Product          | Revenue  | COGS     | Gross Margin | Margin %
{product}        | ${amt}   | ${amt}   | ${amt}       | {X}%
```

Flag any product with margin below 20% as a risk.

## Step 2 — Three pricing scenarios

For each product (or the specified product), model three scenarios. Do NOT recommend a price — present data only.

**Scenario A — Hold current price**
- Project revenue at current price × current volume
- Project margin at current COGS

**Scenario B — Price increase (+10% to +20%, owner to specify)**
- Project revenue assuming 0%, 5%, and 10% volume loss at new price
- Show the break-even volume needed to maintain current profit

**Scenario C — Price decrease (−10%, to drive volume)**
- Project revenue assuming 10%, 20%, and 30% volume increase
- Show the volume needed to match current profit

Present each scenario as a data table, not a recommendation.

## Step 3 — Customer messaging brief

Produce a plain-language brief (for price increase scenarios) the owner can use to communicate a change to customers:
- One paragraph explaining the change
- Three key message options (direct, value-focused, empathetic)
- Suggested timing and channel (WeChat or email from the owner's own account, invoice note, in-person)

## Missing data

If the owner cannot provide the accounting export or pasted revenue/cost numbers, stop — margin analysis requires revenue and cost data. If no 支付宝 bill export is provided, run from the accounting data only and note "支付宝 bill not provided — cross-validation against 支付宝 sales skipped."

## Approval gates

- **Never recommend a specific price.** Provide data views only — pricing decisions belong to the owner.
- **Flag if COGS data is incomplete** (many small-business books don't track per-product COGS) and note the gap.
- **Never update any prices in the owner's accounting software, 支付宝, or any connected system.**

## Spreadsheet input routing

- When the revenue/cost export arrives as an Excel file (.xlsx/.xls), parse it via `crabcode-office-suite:crabcode-spreadsheets`; CSV files and pasted reports need no extra tooling. Use the same skill if the owner asks for the margin or scenario tables as a spreadsheet file.
- If that skill reports Unknown skill, the office suite is not installed: guide the owner to install `crabcode-office-suite` via `/plugin` and retry — or ask for a CSV export instead.

## Output

Present the margin table, then the three scenario tables side-by-side. If a price increase scenario is being considered, append the customer messaging brief. End with: "Which scenario would you like to explore further?"
