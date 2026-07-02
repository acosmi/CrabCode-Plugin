---
name: run-campaign
version: 0.3.0
description: Runs an end-to-end marketing campaign — sales analysis from the owner's Alipay merchant-platform / accounting-software exports, content brief, per-channel copy plus design briefs (owner renders the visuals), HubSpot staging, and audience segmentation. Trigger when the owner runs /run-campaign or says "run a campaign," "I need more customers," "sales are down, help me promote," "launch a promotion," "do a full marketing push," or wants soup-to-nuts campaign execution from analysis through staged posts. Accepts optional lookback and channel arguments.
allowed-tools: Read, WebFetch, Bash
---

Run the full campaign pipeline by chaining three skills in order. The owner approves at each handoff — never roll past a gate without explicit confirmation.

Parse arguments:
- `--lookback` (default `90d`) — how far back to look for the revenue dip
- `--channel` (default `both`) — `email`, `social`, or `both`

## Step 1 — Sales analysis + content brief (content-strategy)

Trigger the `content-strategy` skill workflow:
1. Ask the owner for sales data covering the lookback window: a 支付宝商家平台 bill export (CSV), a 微信支付商户平台 bill export (CSV) if they take WeChat Pay, and/or a revenue-by-product export from their accounting software (用友好会计 / 金蝶精斗云) — or a pasted report. There is no connector that can pull transaction history (the alipay connector only creates/queries single payments and refunds).
2. Identify the revenue dip — which product/service, which time period, magnitude. Note the data source and its coverage (e.g., excludes cash sales).
3. Produce a 30-day prioritized content brief: what to push, what offer to run, what to hold.
4. Present the brief to the owner. Wait for explicit "approved, build the campaign" before continuing.

If the owner edits the brief, incorporate edits and re-present.

## Step 2 — Copy, design briefs + staging (design-creator)

After Step 1 approval, trigger the `design-creator` skill workflow:
1. Take the approved brief from Step 1 as input.
2. Build the posting calendar matched to the brief's priorities.
3. Write a precise design brief per post (dimensions, layout, exact text overlay, brand colors). The owner renders each asset in their design tool — 自营云端设计 once its connector ships, or whatever they use today — and hands the files back; verify each rendered asset against its brief on screen before moving on. Do not claim to generate images.
4. Draft caption copy for each post and full text for each email (emails are drafted inline for the owner to send from their own tool — there is no email connector).
5. Stage the campaign in HubSpot (do NOT send — staging only). Domestic platforms (公众号/小红书/抖音/视频号) can't be published by HubSpot: those rows get a publish-ready package + scheduling CSV logged against the HubSpot campaign.
6. Present the staged campaign to the owner. Wait for explicit "approved, send to segment X" before Step 3.

## Step 3 — Audience segmentation (lead-triage)

After Step 2 approval, trigger the `lead-triage` skill workflow:
1. Pull HubSpot contacts that match the campaign's target segment (from the approved brief).
2. Score by engagement, company fit, urgency markers.
3. Produce two deliverables:
   - **Bulk send list** — the segment receiving the staged campaign from Step 2
   - **High-priority call list** — top 5 leads the owner should call personally with talking points
4. Propose call slots for the call list and, on the owner's confirmation, block them on the owner's calendar via the connected DingTalk (钉钉日程) or Feishu (飞书日历) connector; if neither is connected, present the proposed times as a plain list.
5. Present both lists. Wait for explicit "send" before pushing the HubSpot campaign live.

## Approval gates (must hold)

- Never auto-progress between steps. Each handoff requires explicit owner approval.
- Never send the HubSpot campaign without the owner's "send" command in Step 3.
- Never present an image as generated — assets exist only when the owner hands back rendered files.
- If HubSpot is unreachable, stop, report it, and ask whether to retry or abort. If the sales exports are missing, ask the owner to export or paste the data — don't proceed on invented numbers. If DingTalk/Feishu is unavailable, skip calendar blocking and note it.

## Output

End the run with a one-paragraph recap: revenue dip identified, posts produced (copy + design briefs, assets verified), segment size, calls booked. Link to the HubSpot campaign URL once sent.
