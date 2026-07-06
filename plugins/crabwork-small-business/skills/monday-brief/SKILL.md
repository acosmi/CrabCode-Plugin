---
name: monday-brief
version: 0.3.0
description: Generates a one-page Monday morning briefing from live connectors (钉钉/飞书 schedule and messages, HubSpot pipeline) plus any uploaded accounting or 支付宝 bill exports — cash, sales, pipeline, week ahead, top three to-dos. Trigger when the owner runs /monday-brief or says "what's on my plate this week," "Monday brief," "start-of-week summary," "catch me up to start the week," "what should I focus on this week," or wants a beginning-of-week overview. Accepts optional post destination and save-to arguments. 亦触发于:"这周要忙啥""周一给我个概览""本周重点""开个周会"。
allowed-tools: Read, WebFetch, Bash
---

Run the Monday Morning Briefing. Pull from every connector that's live, use whatever exports the owner has provided, gracefully degrade when a source is missing, and deliver a one-page brief the owner can read in under two minutes.

Parse arguments:
- `--post` (default `none`) — send the brief summary as a `dingtalk` or `feishu` message via the connected connector, or `none`
- `--save-to` (default `docs`) — `docs` (腾讯文档 via the tencent-docs connector), `desktop` (local), or `both`

## Step 1 — Run business-pulse

Trigger the `business-pulse` skill workflow. It pulls in this order, scoping to whatever is connected or provided:

1. **Cash** — from the owner's latest accounting export or pasted report (用友好会计 / 金蝶精斗云 — no accounting connector yet): balance + last 7 days of net flow
2. **Sales trend** — 支付宝商家平台 bill export (CSV) last 7 days vs. prior 7 days, % change, top SKU. The alipay connector cannot export transaction history, so this comes from an owner-provided export; note 微信支付 data the same way once the owner exports it (WeChat Pay connector pending)
3. **Pipeline** — HubSpot deals moved, deals stalled (>14 days no activity), new inbound leads
4. **This week's commitments** — 钉钉日程 / 飞书日历 via the dingtalk/feishu connector: events with external attendees, deliverable deadlines
5. **Watch-list** — DingTalk/Feishu messages awaiting a response, via the connected connector
6. **The 3 things** — the three highest-leverage actions for today, ranked

If a source is missing, note it in the brief ("no 支付宝 bill export this week — sales trend skipped", "DingTalk/Feishu not connected — week-ahead skipped") rather than failing.

## Step 2 — Format the one-page brief

Layout (markdown, fits on one screen):

```
# Monday Brief — {YYYY-MM-DD}

## Cash
{¥X balance · {+/-}¥Y net last 7 days · runway note}

## Sales (last 7d vs prior 7d)
{¥X total · {+/-}Z% · top SKU: {name} ({¥})}

## Pipeline
{N deals moved · M stalled · K new leads}

## Week ahead
- {Tue 10am} — {Customer X discovery call}
- {Thu EOD}  — {Proposal due to Y}
- ...

## Three things that need you today
1. {Highest-leverage action with one-line why}
2. {...}
3. {...}
```

## Step 3 — Save and (optionally) post

1. Save the brief to the chosen `--save-to` location:
   - `docs` — a 腾讯文档 doc named `monday-brief-YYYY-MM-DD`, via the tencent-docs connector
   - `desktop` — `~/Desktop/monday-brief-YYYY-MM-DD.md`
   - `both` — both locations
2. If `--post dingtalk` or `--post feishu`, send the **Three things** section only (not the full brief — keep the message short) via the connected connector, and say where the full brief is saved.
3. Show the full brief in chat regardless of save target.

## Approval gates

- **Saving the file is auto.** No approval needed — it's the owner's own doc space or Desktop.
- **Sending a DingTalk/Feishu message requires confirmation.** Show the message draft and wait for "send it" before sending.
- **Never send if the brief surfaces unflattering numbers** (significant cash drop, deal slipping) without explicitly asking the owner — the group chat may have non-leadership members.

## Cadence note

This command is designed to run weekly. The owner may schedule it via CrabCode's task scheduler — when run on Monday at 7am, the output goes straight to 腾讯文档 (or Desktop) and, if configured, a DingTalk/Feishu message. For the cash and sales sections to be fresh, the owner drops in the latest accounting and 支付宝 bill exports beforehand — otherwise those sections are noted as skipped.
