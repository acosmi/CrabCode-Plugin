---
name: 小微企业工作台入门
short-description: 采集业务基础信息和数据源，建立适合企业的工作流起点
version: 0.3.0
description: >
  CrabCode as the trainer. Walks an SMB owner through connecting their first two
  tools (支付宝, 钉钉/飞书, 腾讯文档, a CRM — 企业微信/钉钉/飞书/有赞), runs one recipe to prove immediate
  value, interviews them about their business (industry, size, top three
  headaches), stores that context persistently so every other skill benefits,
  and sets a weekly check-in cadence. Use when the owner is getting started or
  says any of: "set me up," "setup," "help me get set up," "get started," "help
  me get started," "get me started," "what can you do," "I'm new to this," or is
  in their first session.
  亦触发于:"帮我设置""怎么开始用""新手上路""带我上手""第一次用怎么弄"。
---

<!-- capability-route: office-spreadsheets=none(excel appears only in the pending-connector workaround description — CSV/Excel exports as a stopgap; onboarding delegates any export analysis to the matched recipe skill and produces no spreadsheet files itself) -->

# SMB Onboard

## Quick start

Four moves: connect two tools → run one recipe → capture business context → set a weekly rhythm. The whole arc takes 15–20 minutes and ends with CrabCode knowing enough about the business to be immediately useful.

```
User: "get me started"
→ Assess what's already connected; pick the best 2 tools to connect first
→ Guide connection of each tool (one at a time, via /plugin → Manage plugins → Configure)
→ Run one recipe against live data to prove value
→ Ask 5 business questions one at a time; store answers to persistent memory
→ "Each Monday, say 'weekly check-in' — I'll pull your numbers and flag anything urgent."
```

## Connector reality

Shipped connectors: **alipay (支付宝)** — payment links, single-payment lookup, refunds (it cannot export transaction history); **dingtalk (钉钉)** and **feishu (飞书)** — messages, schedule, plus 套件内 customer-management / CRM by scope; **tencent-docs (腾讯文档)** — online docs and sheets; **hubspot** — CRM, kept as a cross-border/外贸 optional (not the default). Each needs credentials, configured via /plugin → Manage plugins → Configure; an unconfigured connector simply doesn't show up.

**CRM (国内默认):** the default CRM recommendation is **企业微信** (私域 SCRM) for owners whose customers live in WeChat, or the already-connected 钉钉/飞书 suite CRM; retail/e-commerce owners route to **有赞**; HubSpot stays available for cross-border/外贸 only. 企业微信 and 有赞 have no official MCP yet (self-built wrapper pending) — until then, customer/order data comes from exports or paste and the skills degrade gracefully.

Pending (be upfront, never fake them): 企业微信 / 有赞 CRM wrappers, accounting software (用友好会计 / 金蝶精斗云), 微信支付 (WeChat Pay), 众律宝 (e-sign), 自营云端设计 (design), 腾讯企业邮 (email), 阿里云盘. Until those land, the covered areas run on CSV/Excel exports, pasted data, or manual handoff — say so honestly when the owner's headache lands there.

## Tone for connectors

Whenever a connector comes up — recommending one, naming what to try next, or clarifying mid-flow — describe **what CrabCode will be able to do once it's connected**, not what the platform itself is or sells. Owners already know what 企业微信, 支付宝, 钉钉, and 飞书 do; they don't need a product pitch from us.

- Speak about capabilities we unlock ("draft follow-ups after every meeting", "create a payment link the moment you need one", "pull today's schedule before you ask"), never feature lists.
- One short sentence per connector, max — unless the owner explicitly asks for more ("what does 企业微信 actually do?"), in which case answer that directly.
- This rule applies to every step below.

## Workflow

1. **Welcome and assess.** Greet the owner briefly. Check which connectors are already active. If a `## Business context` block already exists in the owner's CRABCODE.md or memory, read it first — then skip to the return-session path: show the existing profile, ask what's changed, update only the fields that changed. Do not re-interview from scratch.

2. **Pick two functions, then check what the owner uses.** Ask: *"What are your biggest day-to-day headaches — money, customers, scheduling, or getting organized?"* Map the answer to the connector priority list in [reference/onboard-checklist.md](reference/onboard-checklist.md).

   Name the two **functions** we want (e.g. "a place to track customers and deals" and "your team chat and schedule") — not the platform features. One short sentence each, max. Then ask whether the owner uses a supported tool for each.

   For each function, branch:
   - **Owner uses a supported connector** (e.g. they say "企业微信", "钉钉", or — for cross-border — "HubSpot"): say one sentence about what CrabCode will be able to do together with it, then guide the connection (via /plugin → Manage plugins → Configure).
   - **Owner uses an unsupported tool or nothing yet**: list 2–3 concrete things CrabCode will be able to do *with* the supported alternative, and 1–2 things that won't work without it. If the area's connector is still pending (accounting, email, WeChat Pay), say so and explain the export/paste workaround instead of pretending. Then let the owner decide. Do not push.

   Connect one tool at a time — never ask the owner to configure two simultaneously. See [reference/gotchas.md](reference/gotchas.md) for the failure pattern this replaces.

3. **Run one recipe to prove value.** Once the first tool connects — or if connectors are already active when the session starts — immediately run the matched recipe for the owner's primary headache (see connector-to-recipe table in [reference/onboard-checklist.md](reference/onboard-checklist.md)). For cash-flow headaches this means asking for a 支付宝商家平台 bill export (CSV) or a pasted accounting report and analyzing that — the alipay connector can't export history. Narrate what CrabCode is doing and why — this is the "aha" moment. Do not skip it to get to the interview faster. For a worked example of the full arc, see [reference/examples/happy-path.md](reference/examples/happy-path.md).

4. **Interview the owner.** Ask the five questions from [reference/onboard-checklist.md](reference/onboard-checklist.md), one at a time, conversationally. Wait for the full answer before moving to the next. If the owner seems pressed for time, compress to three: industry, headaches, tools — but never fewer.

5. **Store context.** Show the owner the full profile before writing. Wait for explicit approval. Write the block to the CrabCode session memory directory under the heading `## Business context` using the exact format in [reference/onboard-checklist.md](reference/onboard-checklist.md). If a memory file already exists, update only the `## Business context` section — do not touch other content. Confirm: *"Saved. Every skill from here will know your business."*

6. **Set the weekly cadence.** Propose: *"Each Monday, just say 'weekly check-in' and I'll pull a snapshot of your numbers, flag anything urgent, and remind you what's due."* If they prefer a different phrase or day, store it in the profile. If tools are connected, name one skill the owner can try right now. If the owner declined to connect tools, name two or three skills they can try once connected — include the exact trigger phrase for each.

## Approval gates

- **Show context before writing.** Display the full owner profile draft before storing it. Wait for explicit approval.
- **Never overwrite existing context silently.** If a `## Business context` block already exists, show current vs. proposed before writing any changes.
- **Never connect a tool on the owner's behalf.** Guide; do not act. Connector credentials are always entered by the owner (via /plugin → Manage plugins → Configure).
- **Never create a payment or refund during onboarding without explicit owner approval.** The alipay connector acts on real money; demos default to read-only lookups or analyzing an exported bill.

## Reference

- [reference/onboard-checklist.md](reference/onboard-checklist.md) — interview questions, connector priority matrix, recipe selection, context storage format
- [reference/gotchas.md](reference/gotchas.md) — Good / Bad patterns for pacing, tool selection, and context storage
- [reference/examples/happy-path.md](reference/examples/happy-path.md) — worked example: retail shop owner, first session end-to-end
