# Example: log email to an existing deal (happy path)

A worked scenario for the email path — contact exists, deal resolves unambiguously, activity logs cleanly.

## Setup

- User pastes an email thread with subject "明发商贸 Q2 pricing follow-up" (no email connector — threads arrive as pasted text)
- Thread has three messages between the user and `lina@mingfa.com` over the last two days
- `lina@mingfa.com` is an existing contact in HubSpot
- She is associated to exactly one open deal: "明发商贸 Q2 Expansion" (proposal sent, ¥18K, close date 2026-05-15)

## User says

> "Add this thread to the deal."

## Skill behavior

**Step 1 — Identify intent.**
Email path (user said "this thread").

**Step 2 — Gather context.**
Reads the pasted thread. Subject: "明发商贸 Q2 pricing follow-up." Latest message (yesterday, 4:12pm) from 李娜: *"Confirmed, 50 seats at ¥360/seat works. Sending the signed SOW Friday."* Primary external contact: `lina@mingfa.com`.

**Step 3 — Resolve contact + deal.**
Looks up `lina@mingfa.com` → contact exists (李娜, 明发商贸). Finds open deals associated to her: exactly one, "明发商贸 Q2 Expansion." Match is unambiguous.

**Step 4 — Execute.**
Writes an email activity on 明发商贸 Q2 Expansion:
- `hs_email_subject`: 明发商贸 Q2 pricing follow-up
- `hs_email_text`: "李娜 confirmed 50 seats at ¥360/seat (¥18K). Signed SOW coming Friday."
- `hs_timestamp`: yesterday, 4:12pm
- Associated contact: 李娜
- Associated deal: 明发商贸 Q2 Expansion

**Step 5 — Approval gate.**
Contact already existed, no creation announcement needed. Activity write happens inline — no separate gate because the user explicitly asked.

**Step 6 — Report.**

> Logged email activity to 明发商贸 Q2 Expansion:
> *"李娜 confirmed 50 seats at ¥360/seat (¥18K). Signed SOW coming Friday."*
> Timestamped yesterday 4:12pm. No contact created — 李娜 was already on the deal.
> [HubSpot: 明发商贸 Q2 Expansion]

## What makes this the happy path

- Single unambiguous deal association — no fuzzy match needed
- Contact already existed — no creation flow
- Thread subject is descriptive — usable as-is for activity title
- Summary focuses on decisions and numbers, not full thread transcript
