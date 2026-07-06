# Example: log a call with a missing contact

Worked scenario for the call path — a DingTalk calendar event has three attendees, one of them isn't in HubSpot yet.

## Setup

- User just finished a 30-minute video call titled "明发商贸 — technical deep dive" at 10:00am, scheduled via DingTalk calendar
- Attendees on the calendar invite: the user, `lina@mingfa.com`, `wangqiang@mingfa.com`
- 李娜 is an existing HubSpot contact on the "明发商贸 Q2 Expansion" deal
- 王强 is NOT in HubSpot
- The 明发商贸 Q2 Expansion deal is the only open deal for 李娜

## User says

> "Log this call."

## Skill behavior

**Step 1 — Identify intent.**
Call path. No specific event named — falls back to the most recent completed meeting in the last 24 hours.

**Step 2 — Gather context.**
Finds the "明发商贸 — technical deep dive" event from 10:00am via the connected DingTalk calendar connector. Confirms with the user before proceeding:

> *"Logging the '明发商贸 — technical deep dive' call from 10:00am this morning — correct?"*

User confirms.

Reads event details: 30 minutes, external attendees `lina@mingfa.com` and `wangqiang@mingfa.com`. No description on the event.

**Step 3 — Resolve contact + deal.**
- Looks up `lina@mingfa.com` → exists (李娜, on 明发商贸 Q2 Expansion).
- Looks up `wangqiang@mingfa.com` → does not exist.
- Announces contact creation:

> *"王强 (wangqiang@mingfa.com) isn't in HubSpot. Creating the contact and associating to the 明发商贸 Q2 Expansion deal."*

Creates the contact with `email`, `firstname: 强`, `lastname: 王`, `company: 明发商贸` (inferred from email domain). Associates to the deal.

Deal resolution: 李娜's only open deal is 明发商贸 Q2 Expansion — unambiguous match.

**Step 4 — Execute.**
Writes a call activity on 明发商贸 Q2 Expansion:
- `hs_call_title`: 明发商贸 — technical deep dive
- `hs_call_body`: "Meeting held; notes to be added." (No description on the calendar event; placeholder surfaced to user so they know to add detail.)
- `hs_call_duration`: 30 min
- `hs_timestamp`: 10:00am today
- Associated contacts: 李娜, 王强
- Associated deal: 明发商贸 Q2 Expansion

**Step 5 — Approval gate.**
Announced the contact creation before writing. Activity write is inline per the user's explicit "log this call" request.

**Step 6 — Report.**

> Logged call activity to 明发商贸 Q2 Expansion:
> *"明发商贸 — technical deep dive" (30 min, 10:00am)*
> Created new contact: 王强 (wangqiang@mingfa.com) — associated to the deal.
> Call body is a placeholder — add your notes if you want them on the deal timeline.
> [HubSpot: 明发商贸 Q2 Expansion]

## What this example demonstrates

- Fallback to most-recent-meeting when the user doesn't specify an event
- Confirmation before acting on inferred context
- Contact creation with inferred company from email domain
- Placeholder body with user notification when no meeting notes exist
- Associating multiple contacts (existing + newly created) to the same activity
