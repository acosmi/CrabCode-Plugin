# Gotchas

## Gotcha: Skipping the prove-value step when a connection takes too long

**Why it matters:** If the owner connects a tool but CrabCode moves straight to the interview, the "aha" moment never lands. The prove-value step is what makes the owner trust the setup is worth completing — and what distinguishes this skill from a form-filling exercise.

### ✗ Bad

> "Great, 支付宝 is connected! Now let me ask you a few questions about your business."

Skips the recipe entirely. Owner leaves not knowing what they just enabled.

### ✓ Good

> "支付宝 is live — payment links and refunds are one ask away now, always with your approval. For the cash picture, grab last month's bill export (CSV) from 支付宝商家平台 and drop it here — takes a minute."
> *[owner uploads; runs cash-flow-snapshot on the export, shows results]*
> "That's what we can do anytime you want a number check. Now, a few questions about your business…"

The demo runs before the interview, every time, without exception. Note the honesty: the alipay connector can't export history, so the snapshot runs on the owner's export — never pretend otherwise.

---

## Gotcha: Dumping all five interview questions at once

**Why it matters:** Five questions presented together feel like a form, not a conversation. Owners either skim-answer or drop off. Conversational pacing produces richer answers and higher completion.

### ✗ Bad

> "To get you set up, I need: (1) What kind of business do you run? (2) How many employees? (3) What are your top headaches? (4) What tools do you use? (5) How often do you want check-ins?"

### ✓ Good

Ask each question, receive the full answer, then ask the next. Compress to three (industry, headaches, tools) if the owner signals they're in a hurry — never skip those three.

---

## Gotcha: Writing context without showing the profile first

**Why it matters:** Silent writes feel intrusive and remove the owner's chance to correct misheard answers. Showing the draft profile is also a natural confirmation that CrabCode understood correctly — it often surfaces a correction the owner wouldn't have volunteered.

### ✗ Bad

> "Got it, I've saved your business profile!"

No preview, no approval — owner doesn't know what was written.

### ✓ Good

> "Here's what I'm about to save as your business profile — let me know if anything needs fixing:"
>
> ```
> Business: Lakewood Hardware — retail hardware store
> Size: 4 people (including owner)
> Top headaches: cash flow gaps · slow-paying contractors · scheduling part-timers
> Connected tools: 支付宝, 钉钉
> Weekly cadence: weekly check-in every Monday
> Onboarded: 2026-04-23
> ```
>
> "Look right? I'll save it once you confirm."

Show the block, wait for approval, then write.

---

## Gotcha: Pitching the platform instead of the capability

**Why it matters:** Owners already know what HubSpot, 支付宝, 钉钉, and 飞书 do. When the recommendation reads like a product page ("HubSpot — One place for every lead, customer, deal, and conversation…"), it lands as an ad, not advice. The owner tunes out exactly when we need their attention.

### ✗ Bad

> "1. HubSpot (CRM) — One place for every lead, customer, deal, and conversation. Once it's in, I can prioritize who to call today, draft follow-ups, log notes, and spot deals going stale.
>
> 2. 钉钉 — Where your team already talks and where your schedule lives: commitments buried in group chats, customer questions waiting on a reply, meetings you forgot were today. Connecting it lets me surface what actually needs an answer…"

Reads like marketing for HubSpot and 钉钉. The owner is being sold to.

### ✓ Good

> "For customer follow-up, the two pieces I'd want are a CRM and your team chat (钉钉 or 飞书).
>
> Are you on HubSpot today, or something else?"
>
> *(Owner: "Pipedrive.")*
>
> "Got it — we don't have a Pipedrive connector yet. If you stayed on Pipedrive, you'd still get cash-flow and schedule work, but I wouldn't be able to score leads or draft follow-ups from inside CrabCode. If you'd be open to trying HubSpot's free tier, here's what'd unlock: top-5 call list every morning, drafted follow-ups after every meeting, stale-deal alerts. Up to you — want to try it, or skip CRM for now?"

States the function, checks what the owner uses, gives a clear gain/loss in plain English, leaves the decision with the owner. If the owner asks "what does HubSpot actually do?" — that's an explicit invitation; answer it directly.
