# Example: clean up a stale deal

Worked scenario for the cleanup path — user asks the skill to audit one specific deal, skill surfaces findings and waits for approval.

## Setup

- Deal: "明发商贸 Q2 Expansion" — stage "Proposal Sent," amount ¥18K, close date 2026-05-15, next step "send pricing," `hs_lastactivitydate` 22 days ago
- Deal has two associated contacts: 李娜 and 王强
- The owner pastes the last 14 days of email with 李娜, including a 2026-04-18 thread titled "Re: 明发商贸 pricing" where 李娜 confirmed the pricing and said "we'll sign once our legal review wraps, should be mid-June"
- A Feishu calendar event on 2026-04-20 titled "明发商贸 — legal review walkthrough" included a new person, `chenmin@mingfa.com`, who is not in HubSpot and not on the deal
- No email, meeting, or note suggests the deal has moved stage

## User says

> "Clean up the 明发商贸 Q2 Expansion deal."

## Skill behavior

**Step 1 — Identify intent.**
Cleanup path, scoped to one named deal.

**Step 2 — Gather context.**
Pulls the deal record. Reads the email threads the owner pasted (last 14 days, involving 李娜 and 王强). Pulls Feishu calendar events from the same window via the connected connector.

**Step 3 — Resolve.**
Deal explicitly named — no resolution needed. Contacts on recent emails/meetings: 李娜 (on deal), 王强 (on deal), 陈敏 (not on deal, not in HubSpot).

**Step 4 — Walk the cleanup checklist.**

Skill does NOT write anything yet. Produces this review list:

> **Cleanup review — 明发商贸 Q2 Expansion**
>
> **1. Last activity date.** Deal shows 22 days old. Newer activity found: 2026-04-18 email from 李娜 ("Re: 明发商贸 pricing"), 2026-04-20 meeting ("明发商贸 — legal review walkthrough"). Neither is logged to HubSpot.
> **→ Propose:** Log the 2026-04-18 email and the 2026-04-20 meeting as activities on this deal.
>
> **2. Next-step field.** Currently "send pricing." The 2026-04-18 email shows pricing was sent and confirmed by 李娜.
> **→ Propose:** `hs_next_step`: "send pricing" → "wait for legal review sign-off."
>
> **3. Deal stage.** Currently "Proposal Sent." No evidence of stage movement — 李娜 said they'll sign *after* legal review. Stage is consistent with reality.
> **→ Flag only — no change.**
>
> **4. Close date.** Currently 2026-05-15. 李娜's 2026-04-18 email says "should be mid-June."
> **→ Propose:** `closedate`: 2026-05-15 → 2026-06-15.
>
> **5. Amount.** Currently ¥18K. 2026-04-18 email confirms 50 seats at ¥360 = ¥18K. No change needed.
> **→ No action.**
>
> **6. Associated contacts.** 陈敏 (`chenmin@mingfa.com`) attended the 2026-04-20 legal review meeting. Not on the deal, not in HubSpot.
> **→ Propose:** Create the contact and associate to the deal.
>
> **7. Notes hygiene.** No conflicting notes found in the last 90 days.
> **→ No action.**
>
> Approve items 1, 2, 4, 6 to write? Or specify which ones.

**Step 5 — Approval gate.**
Waits for the user. User replies: *"Yes to all except 4 — leave close date alone, she might be optimistic."*

**Step 6 — Execute approved items.**
- Logs the 2026-04-18 email as an email activity
- Logs the 2026-04-20 meeting as a call activity with attendees 李娜, 王强, and (newly created) 陈敏
- Updates `hs_next_step` to "wait for legal review sign-off"
- Does NOT update `closedate`
- Creates 陈敏 contact and associates to the deal

**Report.**

> Wrote changes to 明发商贸 Q2 Expansion:
> - Logged 2026-04-18 email and 2026-04-20 call activities
> - Updated next step to "wait for legal review sign-off"
> - Created contact 陈敏 (chenmin@mingfa.com) and added to deal
> Close date unchanged per your call.
> Deal stage was flagged as consistent with reality — no change needed.
> [HubSpot: 明发商贸 Q2 Expansion]

## What this example demonstrates

- Every field check from `reference/cleanup-checklist.md` applied to one deal
- Side-by-side current → proposed framing for every proposed change
- Stage change correctly held as flag-only
- User selectively approves items — skill honors the exact selection
- Contact creation folded into the same approval cycle
