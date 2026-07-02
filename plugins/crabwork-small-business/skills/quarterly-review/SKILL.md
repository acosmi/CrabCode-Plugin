---
name: quarterly-review
version: 0.3.0
description: Generates a full QBR narrative — revenue trend, margin trend, customer health, top opportunities and risks — as a presentation-ready PDF or online doc, working from the owner's accounting exports (用友好会计 / 金蝶精斗云) plus HubSpot. Trigger when the owner runs /quarterly-review or says "quarterly review," "QBR," "build a board deck," "how did the quarter go," "end-of-quarter summary," or wants a quarter-over-quarter business recap. Accepts optional quarter and save-to arguments.
allowed-tools: Read, WebFetch, Bash
---

Run the quarterly business review. Pull financial, sales, and customer data for the quarter, synthesize it into a narrative, and produce a presentation-ready document.

Parse arguments:
- `--quarter` (default: previous calendar quarter) — format `YYYY-QN` (e.g., `2026-Q1`)
- `--save-to` (default: `files`) — `files` (腾讯文档, via the tencent-docs connector), `desktop` (local file), or `both`

## Step 1 — Financial performance

Using the `business-pulse` skill in deep mode:

1. Get the quarter's P&L from the owner's accounting software (用友好会计 / 金蝶精斗云) — there is no accounting connector yet, so ask for a CSV/Excel export or a pasted report: revenue, COGS, gross margin, operating expenses, net margin.
2. Compare to prior quarter and same quarter last year (if available).
3. Cross-validate revenue against payment settlements if the owner provides 支付宝商家平台 / 微信支付商户平台 settlement exports (CSV) for the same period — there is no connector that can bulk-export settlements. If none are provided, skip validation and note it.
4. Calculate: revenue growth %, margin change in points, top 3 revenue categories.

## Step 2 — Customer health

1. Pull HubSpot deal data: new customers won, churned, average deal size, pipeline entering next quarter.
2. Calculate customer acquisition cost (if data available) and revenue per customer.
3. Flag any customers representing >20% of revenue (concentration risk).

## Step 3 — Top opportunities

Identify 3 specific opportunities for next quarter based on the data:
- Revenue upside (category, customer segment, or channel to double down on)
- Margin upside (cost to cut or price to raise)
- Customer upside (segment to target or churn to reduce)

## Step 4 — Top risks

Identify 3 specific risks for next quarter:
- Revenue risk (concentration, trend, seasonality)
- Margin risk (rising cost, pricing pressure)
- Operational risk (pipeline gap, vendor dependency)

## Step 5 — QBR narrative

Write a 500–800 word narrative in plain business English with this structure:
1. Quarter headline (one sentence)
2. Revenue story (trend + why)
3. Margin story (trend + why)
4. Customer story (health + pipeline)
5. Three opportunities
6. Three risks
7. One-paragraph call to action for next quarter

## Step 6 — Export

Generate:
1. **`qbr-{YYYY-QN}.pdf`** — formatted narrative + key charts (as ASCII tables if no chart tool available)
2. Save per `--save-to`: for `files`, create the narrative as an online doc in 腾讯文档 via the tencent-docs connector (and keep the PDF locally); for `desktop`, save the PDF locally; `both` does both.

## Connector failures

If no accounting export or pasted P&L is provided, stop — the QBR requires the accounting data as its foundation. Ask the owner for a 用友好会计 / 金蝶精斗云 export for the quarter. If no payment settlement export is provided, skip cross-validation and note "Settlement data not provided — revenue validated from the accounting report only." If HubSpot is missing, skip customer health (Step 2) and note "HubSpot not connected — customer health section skipped." If tencent-docs is not connected and `--save-to` is `files`, save locally and tell the owner.

## Approval gates

- **Never publish or send the QBR automatically.** Always display for owner review first.
- **Flag if any data source returns incomplete data** — note gaps in the narrative.

## Output

Present the narrative in-line, then confirm export. End with a one-paragraph "what to focus on next quarter" summary.
