---
name: sales-brief
version: 0.3.0
description: Surfaces top and bottom sellers from the owner's Alipay merchant-platform bill exports and accounting-software data (用友好会计 / 金蝶精斗云), identifies seasonality patterns, and produces a 2-week content brief to push winners and clear slow movers. Trigger when the owner runs /sales-brief or asks "what's selling," "what should I promote," "what's my best seller," "what's not moving," "what to post about," or wants a data-backed plan for what to push next. Accepts optional lookback window of 30, 60, or 90 days.
allowed-tools: Read, WebFetch, Bash
---

Run the sales analysis and content brief. Pull what sold (and what didn't), explain why, and produce a ready-to-use content plan that acts on the data.

Parse arguments:
- `--lookback` (default: `30d`) — `30d`, `60d`, or `90d` lookback window

## Step 1 — Sales breakdown

Using the `content-strategy` skill workflow for sales analysis:

1. Ask the owner for the lookback window's data: a 支付宝商家平台 bill export (CSV) — and a 微信支付商户平台 export if they take WeChat Pay — grouped by item/service/SKU, plus a revenue-by-product export from their accounting software (用友好会计 / 金蝶精斗云) if available. A pasted report works too. There is no connector that exports transaction history: the alipay connector only creates payment links, queries single payments, and processes refunds.
2. Prefer the accounting-software export for item names and margins; normalize payment-platform order titles to catalog products and confirm ambiguous groupings. De-duplicate if the accounting data already includes the payment-platform revenue.
3. Rank products by: total revenue, unit volume, and margin (if available in the accounting export).
4. Calculate each product's share of total revenue vs. prior equivalent period.

Top sellers: products that grew share or maintained top-3 rank.
Bottom sellers: products with declining volume or below 5% of revenue.

## Step 2 — Seasonality check

1. Compare current period to same period in prior year (if the accounting export includes that history — ask the owner to widen the export if needed).
2. Flag any items with a seasonal pattern (e.g., spikes around 双11/双12, Spring Festival, slow summers).
3. Note any new products with insufficient history to detect seasonality.

## Step 3 — Why analysis

For each top and bottom seller, explain the likely driver:
- Price change, promo, new channel, seasonal demand, competitor move
- Cross-reference with HubSpot campaign activity for the period
- Note where attribution is inferred vs. confirmed

## Step 4 — 2-week content brief

Produce a ready-to-use content brief:

```
2-Week Content Brief — {date range}

PUSH THESE (winners)
• {product}: {suggested angle} — {channel: email|social|both}
• {product}: {suggested angle} — {channel}

CLEAR THESE (slow movers)
• {product}: {promo angle or bundle suggestion} — {channel}

CONTENT CALENDAR
Week 1:
  Mon: {post/email concept}
  Wed: {post/email concept}
  Fri: {post/email concept}
Week 2:
  Mon: {post/email concept}
  Wed: {post/email concept}
  Fri: {post/email concept}
```

## Data availability

If no revenue data is provided at all, stop — sales analysis requires at least one source (支付宝商家平台 export, accounting-software export, or a pasted report). If only one source is available, run from it and state the coverage in the output, e.g., "Accounting export not provided — revenue data from the 支付宝商家平台 bill only; cash and other-channel sales not included" (or vice versa). If HubSpot is missing, skip campaign cross-reference in the "why analysis" and note it. Every downstream number inherits these caveats — the brief is a snapshot of the provided files, not a live feed.

## Approval gates

- **Never auto-schedule or publish content.** The brief is for owner review only.
- **Never start design-brief or asset work automatically** — offer to hand off to `design-creator` after the owner approves the brief.

## Output

Present the sales analysis, then the content brief. Ask the owner if they'd like to hand the planned posts to `design-creator` for captions and per-asset design briefs (the owner renders the visuals in their design tool).
