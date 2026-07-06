# Gotchas

Edge cases where the `crm-maintenance` skill is most likely to produce bad CRM data. Each entry uses the Good / Bad pattern.

---

## Gotcha: Creating a duplicate contact when the email is already in HubSpot under a different case

**Why it matters:** HubSpot dedupes on exact email match. `Lina@mingfa.com` and `lina@mingfa.com` are treated as distinct, but an owner who already created one will see a silent duplicate appear. That destroys the owner's trust in the skill.

### ✗ Bad

> Searched HubSpot for `Lina@mingfa.com` — no match. Creating new contact: 李娜 (Lina@mingfa.com).

New contact is created; owner's existing `lina@mingfa.com` contact now has a duplicate.

### ✓ Good

> Searched HubSpot for `lina@mingfa.com` (case-insensitive) — no match. Creating new contact: 李娜 (lina@mingfa.com). Announcing before write.

Always normalize email to lowercase before lookup. Announce the creation so the owner can catch misses.

---

## Gotcha: Writing the full email thread as the activity body

**Why it matters:** HubSpot activities are signal surfaces for fast scanning, not a transcript archive. A 12-message thread pasted into the activity body is useless; a three-sentence summary of what was agreed is actionable.

### ✗ Bad

> **Activity body:**
> *From: 李娜 — 2026-04-09…*
> *Hi! Following up on our call, here are the specs we discussed…*
> *[1,200 more words]*

Owner scrolls past it every time.

### ✓ Good

> **Activity body:** 李娜 confirmed scope for Q2 expansion — 50 seats, ¥18K ACV, start date 2026-06-01. She'll send the signed SOW by Friday. No open questions.

Summary names the decisions, the numbers, and the next step.

---

## Gotcha: Auto-creating a deal when the right one can't be resolved

**Why it matters:** Duplicate deals are very hard to untangle in HubSpot — they split activity history, confuse reporting, and the owner usually notices weeks later when a forecast looks wrong.

### ✗ Bad

> No open deal found for 李娜 at 明发商贸. Creating new deal: "明发商贸 — new opportunity" and logging the call to it.

Now there are two 明发商贸 deals and the owner has no idea which one is real.

### ✓ Good

> No open deal found for 李娜 at 明发商贸. Which deal should I log this to? Options: (1) 明发商贸 Q2 Expansion (closed-won Feb), (2) 明发商贸 Renewal 2027 (open). Or do you want to skip logging for now?

Ask. Never create a deal on behalf of the owner.

---

## Gotcha: Proposing a deal stage change based on email language

**Why it matters:** "We're moving forward" in an email doesn't always mean "advance to closed-won." Customers say it when they're moving forward with evaluation, or with a procurement step. Owners have context the skill doesn't. Auto-advancing stage is destructive to the pipeline.

### ✗ Bad

> Email from 李娜 says "we're moving forward." Proposing `dealstage` → Closed Won. Writing now.

### ✓ Good

> Flagging: the 2026-04-18 email from 李娜 ("we're moving forward with the 明发商贸 evaluation") may indicate stage movement. Current stage is "Proposal Sent." Do you want to advance it? I won't change stage without your explicit go-ahead.

Surface the evidence, hold the write.

---

## Gotcha: Overwriting an owner-set next-step during cleanup

**Why it matters:** The owner may have set a next step that reflects context the skill can't see — a phone call, a DingTalk or Feishu thread, a private note. Overwriting it because a recent email suggests something different erases real work.

### ✗ Bad

> `hs_next_step` currently says "wait for legal review." Latest email from 李娜 says "let's schedule pricing review." Updating `hs_next_step` to "schedule pricing review."

### ✓ Good

> `hs_next_step` currently reads "wait for legal review" (set by you 3 days ago). The 2026-04-19 email from 李娜 suggests a pricing review is also needed. Propose appending or replacing? Current → Proposed: "wait for legal review" → "wait for legal review; then schedule pricing review." Approve?

Show the current value, propose the change explicitly, wait for approval.
