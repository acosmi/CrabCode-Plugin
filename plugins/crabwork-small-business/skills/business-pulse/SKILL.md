---
name: business-pulse
version: 0.3.0
description: >
  Produces a one-page cross-functional business snapshot for SMB owners —
  cash position (owner's accounting-software export), sales trend (支付宝/微信支付
  bill exports), customer activity (your CRM — 企业微信/钉钉/飞书/有赞; HubSpot for cross-border), this week's commitments
  (钉钉日程/飞书日历), urgent watch-list items (DingTalk/Feishu messages), and
  the single most important thing needing attention today. Proactively pulls
  every available connector and gracefully scopes to whatever is connected or
  provided — one source gives a partial pulse; the full set gives the full
  picture. Trigger when the user asks how the business is doing, wants a
  snapshot, a weekly summary, a Monday brief, or says anything like "what am
  I missing" or "catch me up on the business."
  亦触发于:"生意怎么样""最近生意如何""给我个整体情况""我是不是漏了什么""帮我把生意梳理一下"。
---

# Business Pulse

One prompt, one page. Pull live data from every connected tool, fold in any finance exports the owner has provided, synthesize it all into a single scannable brief, and surface the single most important thing to act on today. Do the work — don't ask the user to help find data a connector can reach.

## Step 1 — Pull data in parallel

**Dispatch all connector calls in a single parallel batch** — see `reference/data_sources.md` for the exact source-to-metric mapping. Do not pull serially; latency turns a 30-second skill into a painful wait.

Live connectors to attempt simultaneously:

- **Your CRM** — pipeline/customers by stage, deals/customers moved or gone cold, new leads (企业微信 SCRM has no pipeline — read "pipeline movement" as customer activity; 有赞 deal ≈ 订单)
- **DingTalk (钉钉) / Feishu (飞书)** — calendar/schedule: key meetings, deadlines, events this week and next 7 days (via the connected connector)
- **DingTalk / Feishu messages** — urgent internal signals, threads needing owner attention

Owner-provided sources (no live connector — use whatever was uploaded or pasted this session):

- **Accounting software (用友好会计 / 金蝶精斗云)** — cash balance, MTD revenue, outstanding receivables, overdue invoices, from a CSV/Excel export
- **支付宝商家平台 / 微信支付商户平台 bill exports** — 7-day settlements, sales trend, failed/pending transactions. The alipay connector cannot export transaction history — it only creates payment links, queries a single payment by order number, and processes refunds — so trend data always comes from bill exports.

If a connector errors or returns no data, record it internally and move on. Never block the pulse on a single bad integration.

**Finance-data fallback**: if no accounting export was provided this session, mark the Cash section "n/a — no accounting export provided" and proceed. Add one line at the end of the pulse inviting the owner to upload an export from 用友好会计/金蝶精斗云 for the finance sections — do not block or nag mid-pulse.

**Bill-export fallback**: same for 支付宝/微信支付 bills — if none provided, mark Revenue & Sales "n/a — no bill export provided" and proceed.

## Step 2 — Compute metrics

Read `reference/thresholds.md` for red/yellow/green cutoffs. Compute:

- **AR aging** — open invoices from the accounting export grouped by days since due date (0–30, 31–60, 61+)
- **Pipeline coverage** — your CRM's weighted pipeline ÷ monthly revenue target (skip for SCRM without a pipeline)
- **Revenue trend** — this month's revenue vs. prior month from the accounting export (or 7-day 支付宝/微信支付 settlements vs. prior 7 days from the bill export)

Assign a 🟢/🟡/🔴 status to each section. If a source returned nothing, mark the metric "n/a" and note it in the appendix.

## Step 3 — Flag risks proactively

Scan for actionable items. Every risk entry must name a specific record and a next step — "some overdue invoices" is useless; "¥3,400 from 明发商贸, 47 days overdue, no response since 2026-03-12" is actionable.

- Invoices in the accounting export past due > 30 days — name customer, amount, days overdue
- Your CRM deals/customers with no activity in 7+ days, or a close date in the past but still open
- DingTalk/Feishu messages marked urgent or containing "escalation," "complaint," "cancel," "refund" (投诉 / 退款 / 取消 equivalents)
- Failed or pending transactions > ¥500 in the 支付宝/微信支付 bill exports

## Step 4 — Compose the output

Use the exact template in `reference/output_template.md`. Include only sections where real data exists — omit headers for sources that weren't available. Adapt depth to context: a casual "how are we doing" gets a fuller report; "quick snapshot before a call" gets a tighter one.

Cross-source synthesis is where this skill earns its keep. If a Feishu message connects to a stalled deal in your CRM, surface that link in the #1 Priority section. Synthesis is what makes the pulse more useful than checking each tool separately.

Writing rules:
- Numbers lead, words follow. Never write "revenue is healthy" — write "¥43k this month, ▲ 8% MoM" and let the owner judge.
- Every number carries a delta vs. the prior period where available. Absolute snapshots (cash balance) still show WoW delta.
- Names and amounts, not adjectives. "¥4,200 from 明发商贸, 23 days overdue" beats "some concerning receivables."
- No filler. If a section has nothing worth reporting, write "No material changes" and move on.

## Step 5 — Export and share (once)

After presenting the pulse, offer once:
- "Want me to save this as a 腾讯文档 doc?" (use the tencent-docs connector if available; otherwise save a local file)
- "Should I send this to your DingTalk/Feishu?" (only if the connector is available and the user confirms — sending a message requires explicit approval)

If they say yes, do it. If they say no or don't respond, move on — don't ask again.

## Scope variants

The owner may ask for a narrower cut:

- **"Just cash" / "financial check"** → only Cash & Finance + AR-related risks
- **"Pipeline only" / "deals check"** → only Pipeline section + stalled-deal risks
- **"Watch list" / "anything urgent"** → only Watch List + all risks, no metric sections
- **"Quick snapshot before a call"** → TL;DR + #1 Priority only, no full sections

## What not to do

- **Do not ask permission before pulling connector data.** If the skill was invoked, run it. Asking "should I check the CRM?" defeats the whole point. (Requesting a finance export the connectors cannot reach is different — do that once, at the end, without blocking.)
- **Do not invent or estimate numbers.** If a source returned nothing, say "n/a" explicitly. Never fill a gap with guesswork.
- **Do not skip the delta.** A number without a comparison is a missed insight. If there's no prior-period baseline, say "(no prior baseline)" rather than omitting the field.
- **Do not surface connector errors mid-pulse.** Log them to the appendix. The pulse leads with what was delivered.

## Reference files

- `reference/data_sources.md` — exact source → metric mapping with fallbacks
- `reference/thresholds.md` — 🟢/🟡/🔴 cutoffs, tunable per owner
- `reference/output_template.md` — exact markdown structure; do not deviate
- `reference/gotchas.md` — known failure modes (missing exports, connector errors, message-send approval)

## Spreadsheet input routing

- When an owner-provided export (accounting software or 支付宝/微信支付 bill) arrives as an Excel file (.xlsx/.xls), parse it via `crabcode-office-suite:crabcode-spreadsheets`; CSV files and pasted reports need no extra tooling. The pulse itself is delivered as markdown — no spreadsheet output.
- If that skill reports Unknown skill, the office suite is not installed: guide the owner to install `crabcode-office-suite` via `/plugin` and retry — or ask for a CSV export instead and continue the pulse from that.
