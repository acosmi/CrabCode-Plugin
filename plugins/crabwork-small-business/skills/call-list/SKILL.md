---
name: call-list
version: 0.3.0
description: Ranks the top-5 leads most worth calling today from HubSpot, supplies talking points from CRM activity history, blocks call slots on the owner's DingTalk (钉钉日程) or Feishu (飞书日历) calendar, and drafts follow-up messages for the owner to send. Trigger when the owner runs /call-list or asks "who should I call today," "who are my hottest leads," "build my call list," "who do I follow up with," or wants a prioritized list of prospects to phone. Accepts optional count and date arguments.
allowed-tools: Read, WebFetch, Bash
---

Run the lead prioritization. Scan the pipeline, rank by urgency and opportunity, pull relevant context from HubSpot, and get the owner ready to make calls.

Parse arguments:
- `--n` (default: `5`) — number of leads to surface (1–10)
- `--date` (default: today) — date to build the call list for (`YYYY-MM-DD`)

## Step 1 — Pipeline scan

Using the `lead-triage` skill workflow:

1. Pull open HubSpot deals and contacts with activity in the last 30 days.
2. Pull each lead's recent context from HubSpot: notes, logged emails/calls, and engagement history. (There is no email connector — if the owner wants a thread referenced verbatim, ask them to paste it.)
3. Score each lead on:
   - **Recency**: days since last owner touchpoint (lower = better)
   - **Stage**: how close to close (later stage = higher priority)
   - **Signal**: any recent inbound activity in HubSpot (email open, reply, meeting hold, web visit)
   - **Value**: deal size from HubSpot

## Step 2 — Rank and select top N

Rank all scored leads and select the top `--n`. For ties, prefer leads with unanswered inbound signals.

For each selected lead, produce a call card:

```
{Rank}. {Contact Name} — {Company}
Deal: ¥{amount} | Stage: {stage} | Last contact: {X days ago}
Signal: {most recent activity}

TALKING POINTS
• {point from CRM/deal context}
• {point from CRM/deal context}
• {open question to ask}

GOAL FOR THIS CALL: {one sentence — advance to next stage / re-engage / close}
```

## Step 3 — Calendar block

For each lead on the list, offer to block 20 minutes on the owner's calendar for the target date, via the connected DingTalk (钉钉日程) or Feishu (飞书日历) connector.

Show the proposed calendar entries:
```
{time slot} — Call: {Contact Name} ({Company})
```

Wait for owner to confirm which calls to block before creating any calendar events through the connector.

## Step 4 — Draft follow-ups

For any lead whose last outreach has gone unanswered for more than 3 days (per HubSpot activity history), draft a brief follow-up for the owner to copy and send from their own email tool or WeChat:
```
Subject: Re: {thread subject}

Hi {first name},

{One sentence referencing prior conversation}. {One sentence with a clear next step or question}.

{Sign-off}
```

If DingTalk or Feishu is connected and the owner prefers, the follow-up nudge to themselves (e.g., the day's call list) can be sent as a DingTalk/Feishu message via the connected connector — but outreach to leads is always copy-and-send by the owner.

## Connector failures

If HubSpot is unreachable, stop and tell the owner — lead scoring requires CRM data. If neither the DingTalk nor Feishu calendar is connected, skip calendar blocking, present the proposed time slots as a plain list, and note "no calendar connector — slots not booked" in the output. Follow-up drafts (Step 4) always work: they're drafted in chat, nothing is sent.

## Approval gates

- **Never send emails or messages to leads automatically.** Present drafts for owner approval only; the owner sends from their own tool.
- **Never create calendar blocks without owner confirmation** — show the proposed list first.
- **Never update HubSpot deal stages automatically.**

## Output

Present the ranked call list with talk tracks. Then show proposed calendar blocks and ask for confirmation before booking via DingTalk/Feishu. Then show follow-up drafts and ask which the owner wants to copy and send.
