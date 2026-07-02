# Happy path: Retail shop owner, first session

## Setup

- **Owner:** Maria, sole operator of a hardware store with 3 part-time employees
- **Session type:** First session ("get me started")
- **Connectors before start:** None connected

---

## Transcript

**CrabCode:** Welcome! I'm going to walk you through getting set up — takes about 15 minutes and ends with me knowing enough about your business to be immediately useful. Ready?

**Maria:** Sure.

**CrabCode:** What are your biggest day-to-day headaches — money stuff, keeping up with customers, scheduling, or something else?

**Maria:** Cash flow. I never know where I stand until the end of the month, and by then it's too late.

**CrabCode:** That's the most common one. Quick honesty note: there's no accounting-software connector yet (用友好会计 / 金蝶精斗云 are coming), so your full books stay export-based for now. Let's connect 支付宝 first — that lets me create payment links, check a payment by order number, and process refunds the moment you need them, always with your sign-off. Open /plugin → Manage plugins → Configure and enter your 支付宝 credentials…

*[Maria connects 支付宝 — ~3 minutes]*

**CrabCode:** 支付宝 is live. For the cash picture, download last month's bill export (CSV) from 支付宝商家平台 and drop it here — I'll turn it into a 30-day snapshot.

*[Maria uploads the CSV; runs cash-flow-snapshot on the export]*

**CrabCode:** Here's your snapshot: ¥30,200 net cash in for the month, but ¥43,800 in outstanding invoices, mostly from two contractor accounts. Your biggest gap looks like Net-30 customers paying Net-45. Does that match what you're seeing?

**Maria:** Yes, exactly. I didn't know I could see that so fast.

**CrabCode:** Anytime you drop in a fresh export. Second tool: do you and the part-timers run on 钉钉 or 飞书? Connecting it lets me pull your schedule and ping you reminders where you already work.

**Maria:** 钉钉.

*[Maria connects 钉钉 — ~2 minutes]*

**CrabCode:** Good. A few questions so I know your business — one at a time. What's the one-liner for what you do?

**Maria:** Hardware store. Retail and light contractor supply.

**CrabCode:** How many people work with you, including yourself?

**Maria:** Four total — me and three part-timers.

**CrabCode:** What are your top three headaches right now?

**Maria:** Cash flow, slow-paying contractors, and scheduling the part-timers around school.

**CrabCode:** Which tools do you already use day-to-day?

**Maria:** 支付宝 and 钉钉, which we just connected. Also 微信支付 for in-store payments.

**CrabCode:** Noted — no 微信支付 connector yet, but its bill exports work here the same way as the 支付宝 one. Last question: how often would you like me to check in — daily, weekly, or only when you ask?

**Maria:** Weekly's good. Monday mornings.

**CrabCode:** Here's what I'm about to save as your business profile — let me know if anything's off:

```
Business: Hardware store — retail and light contractor supply
Size: 4 people (including owner)
Top headaches: cash flow gaps · slow-paying contractors · scheduling part-timers
Connected tools: 支付宝, 钉钉
Weekly cadence: weekly check-in every Monday
Onboarded: 2026-04-23
```

Look right?

**Maria:** Yep, that's it.

**CrabCode:** Saved. Every skill from here will know your business. Each Monday, just say "weekly check-in" and I'll pull your cash snapshot from your latest exports, flag urgent invoices, and remind you what's due that week. Want to try the invoice reminder skill right now? Say "invoice chase."

---

## Pass criteria

- [ ] Triggered on "get me started"
- [ ] Asked headache question before recommending connectors
- [ ] Recommended 支付宝 first (matched cash-flow headache) and was upfront that accounting connectors are pending
- [ ] Ran `cash-flow-snapshot` on the uploaded 支付宝商家平台 bill export immediately after 支付宝 connected, before the interview — did not claim the connector itself pulled history
- [ ] Connected second tool (钉钉) before starting interview, after asking 钉钉 vs 飞书
- [ ] Asked all 5 interview questions one at a time
- [ ] Showed profile draft before writing
- [ ] Wrote context under `## Business context` in `~/.crabcode/CRABCODE.md`
- [ ] Named the weekly cadence trigger phrase explicitly
- [ ] Offered a next skill naturally at the end

---

# Branch B: Owner uses an unsupported tool

## Setup

- **Owner:** Dev, freelance design studio (2 people)
- **Session type:** First session
- **Primary headache:** Customer follow-up
- **Current CRM:** Pipedrive (no CrabCode connector)

## Transcript

**CrabCode:** What are your biggest day-to-day headaches — money stuff, keeping up with customers, scheduling, or something else?

**Dev:** Customer follow-up. Leads slip through.

**CrabCode:** For customer follow-up, the two pieces I'd want are a CRM and your team chat (钉钉 or 飞书). Are you on HubSpot today, or something else?

**Dev:** Pipedrive.

**CrabCode:** Got it — we don't have a Pipedrive connector yet. If you stayed on Pipedrive, you'd still get cash-flow work and schedule work from CrabCode, but I wouldn't be able to score leads or draft follow-ups from inside the CRM. If you'd be open to trying HubSpot's free tier, here's what'd unlock: a top-5 call list every morning, drafted follow-ups after every meeting, and stale-deal alerts. Up to you — want to try it, or skip the CRM for now?

**Dev:** Skip for now. I'll stick with Pipedrive.

**CrabCode:** No problem. Then let's connect 飞书 — that's where I can send you a follow-up nudge and pull your schedule when we plan the week. Sound good?

**Dev:** Yeah.

*[Dev connects 飞书 — ~2 minutes]*

**CrabCode:** 飞书 is live. Let me pull today's schedule so you can see it working…

## Pass criteria

- [ ] Named the function ("a CRM and your team chat"), not the platform
- [ ] Asked what the owner uses before pitching anything
- [ ] On unsupported tool, listed gain/loss concretely without pushing
- [ ] Accepted the owner's decision and pivoted to the next supported tool
- [ ] No paragraph-long descriptions of HubSpot, 飞书, or Pipedrive
