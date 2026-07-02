---
name: customer-pulse-check
version: 0.3.0
description: Synthesizes themes from payment dispute/refund records (支付宝商家平台 / 微信支付商户平台 exports or pasted data), HubSpot tickets, and review exports (大众点评/淘宝) into a top-3 fixable issues list with drafted response templates. Trigger when the owner runs /customer-pulse-check or asks "what are customers saying," "any complaints lately," "review my feedback," "what are people unhappy about," "summarize my reviews," or wants recurring customer issues surfaced. Accepts optional since-date argument.
allowed-tools: Read, WebFetch, Bash
---

Run the customer voice synthesis. Pull feedback signals from all available sources, identify the themes that are actually fixable, and produce drafted responses the owner can review and send.

Parse arguments:
- `--since` (default: last 30 days) — start date `YYYY-MM-DD` for the lookback window

## Step 1 — Gather feedback signals

Using the `customer-pulse` skill workflow:

1. Collect payment disputes and refund complaints for the period: reason, amounts, resolution status. No connector can bulk-export these — ask the owner for a 支付宝商家平台 / 微信支付商户平台 export (CSV) or pasted records.
2. Pull HubSpot support tickets and conversation notes for the period.
3. If review export files are available (大众点评 export, 淘宝评价 CSV, etc.) in Files: read and parse them. Pasted review text works too.
4. Count total signals per source.

## Step 2 — Theme extraction

Cluster all signals into recurring themes. For each theme:
- Count how many signals mention it
- Classify: Product quality / Delivery / Billing / Communication / Expectation mismatch / Other
- Rate impact: 🔴 High (revenue risk, churn) / 🟡 Medium / 🟢 Low

## Step 3 — Top-3 fixable issues

Using the `ticket-deflector` skill workflow:

Select the top 3 themes by: frequency × impact rating. For each:
1. State the issue in one sentence
2. Explain the root cause (where evident)
3. Suggest a specific operational fix
4. Draft a customer response template

Response template format:
```
Subject: Re: {issue topic}

Hi {first name},

Thank you for reaching out. {Acknowledgment of their experience in 1-2 sentences}.

{What we're doing about it / what happened / resolution offered}.

{Next step or offer}.

{Sign-off}
```

## Step 4 — Summary table

Format the output as:

```
Customer Voice — {date range}
Total signals: {n} ({Payment disputes/refunds: n} | {HubSpot tickets: n} | {Reviews: n})

TOP 3 FIXABLE ISSUES
1. {Issue} ({frequency}) — {impact} — Fix: {one-line fix}
2. {Issue} ({frequency}) — {impact} — Fix: {one-line fix}
3. {Issue} ({frequency}) — {impact} — Fix: {one-line fix}
```

## Connector failures

Run with whatever sources are available — this command degrades gracefully. If no payment export or pasted dispute data is provided, skip dispute data and note "Payment dispute data not provided — skipped." If HubSpot is missing, skip ticket data and note it. If no sources are available at all, stop and tell the owner: "No feedback sources available. Connect HubSpot, or provide a 支付宝商家平台/微信支付商户平台 export, a review export CSV, or pasted feedback."

## Approval gates

- **Never send response templates automatically.** Present drafts for owner review only — there is no email connector, so the owner copies and sends approved drafts from their own mailbox.
- **Never close HubSpot tickets without explicit owner confirmation.** Dispute resolution happens in the merchant platforms and is entirely the owner's action.
- **Never include customer PII in the summary** — use first name + last initial only.

## Output

Present the summary table, then each response template. Ask the owner which templates they'd like to use, then finalize the approved drafts for the owner to send.
