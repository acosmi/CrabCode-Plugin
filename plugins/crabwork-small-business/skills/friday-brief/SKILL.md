---
name: 周五经营简报
short-description: 汇总本周营收、热销、进展和风险，形成周末复盘简报
version: 0.3.0
description: Delivers the Friday end-of-week pulse from the owner's 支付宝商家平台 bill export and your CRM — revenue vs prior week, top sellers, wins and watches. Trigger when the owner runs /friday-brief or says "how did we do this week," "end-of-week recap," "Friday recap," "wrap up the week," "wins and watches," or wants a week-in-review summary. Accepts optional lookback window of 7 or 14 days. 亦触发于:"这周做得怎么样""周总结""周五收个尾""本周战报"。
allowed-tools: Read, WebFetch, Bash
---

Run the Friday wins-and-watches briefing. Pull the numbers, surface what matters, and give the owner a clean end-of-week picture.

Parse arguments:
- `--lookback` (default: `7d`) — `7d` for one week or `14d` for a two-week rolling comparison

## Step 1 — Revenue pulse

Using the `business-pulse` skill workflow:

1. Load transaction data for the lookback period from the owner's 支付宝商家平台 bill export (CSV) or pasted data. The alipay connector cannot export transaction history, so ask the owner for the export if it hasn't been provided. If they take 微信支付 too, ask for that export as well (WeChat Pay connector pending).
2. Pull any deal closes from your CRM for the same window (for SCRM without a pipeline, use customer conversions / activity; 有赞 close ≈ 订单).
3. Calculate week-over-week revenue delta.
4. Surface top 3 revenue sources (product / customer / channel) ranked by contribution.

## Step 2 — Sales breakdown

1. List the top 5 selling products/services by volume and revenue.
2. List the bottom 3 (anything that moved less than expected vs. prior period).
3. Flag any items with a sudden spike or drop (>20% change).

## Step 3 — Wins and watches summary

Format the output as:

```
Friday Brief — {date}

WINS
• {win 1}
• {win 2}
• {win 3}

WATCHES
• {watch 1} — {recommended action}
• {watch 2} — {recommended action}

Revenue this week: ¥{amount} ({+/-}X% vs last week)
```

## Data failures

Run with whatever is available — this command degrades gracefully. If no 支付宝 bill export was provided, skip transaction data and note "no 支付宝 bill export this week — revenue data from your CRM deals only." If your CRM is not connected, skip deal closes and note it. If neither is available, stop and tell the owner: "No revenue sources available. Upload a 支付宝商家平台 bill export (CSV) or connect your CRM (企业微信/钉钉/飞书/有赞; HubSpot for cross-border) to run the Friday brief."

## Approval gates

- **Never send or post this brief automatically.** Always display it for the owner to review first.
- **Never auto-cancel or modify anything.** Surface the data and recommendations only.

## Output

End with the formatted brief and ask the owner: "Want me to send this as a DingTalk/Feishu message, save it to 腾讯文档 or your Desktop, or leave it here?"
