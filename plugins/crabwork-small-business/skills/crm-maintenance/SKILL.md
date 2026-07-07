---
name: crm-maintenance
version: 0.3.0
description: >
  Keeps your CRM current without the owner opening it: creates and updates
  contacts and deals from pasted email threads and DingTalk/Feishu calendar
  context, logs notes and calls, and flags stale records. Works with whichever
  CRM is connected (企业微信/钉钉/飞书/有赞; HubSpot for cross-border). The "stop
  doing data entry" skill. Use when the user asks to update the CRM, "log a call,"
  "log this meeting," "add this contact to my CRM," "update the deal," "note what
  we discussed," "add context to a deal," or wants their CRM kept in sync after
  a conversation. (For bulk dedupe and stale-deal sweeps, that is crm-cleanup.)
  亦触发于:"更新一下客户""记一下这次沟通""把这个客户加进去""记个通话""把刚聊的记下来"。
---

# CRM Maintenance

## Quick start

Pull context from the pasted email thread or the DingTalk/Feishu calendar event, resolve the right contact and deal in your CRM, log the activity, and surface what changed. For a deal cleanup, audit the deal against recent email/calendar activity and propose updates — never apply them without approval. (SCRM like 企业微信 has no sales pipeline — read "deal" as the customer / 客户 record and log activity against that.)

```
User: "log this call to the 明发商贸 deal"
→ Read the most recent completed DingTalk/Feishu calendar event
→ Confirm attendees map to the 明发商贸 deal's contacts
→ Write a call activity on the 明发商贸 deal
→ Report: "Logged call to 明发商贸 Q2 Expansion. [deal link]"
```

## Workflow

1. **Identify intent.** Decide which of three paths applies from the user's message and context:
   - **Email path** — "update my CRM", "add this to the deal", or any reference to an email thread (there is no email connector yet — the thread arrives as pasted text)
   - **Call path** — "log this call", "log the meeting", or any reference to a DingTalk/Feishu calendar event
   - **Cleanup path** — "clean up the CRM", "is this deal up to date", or any request to audit a specific deal
   If the intent is ambiguous (e.g. "update the CRM" with no referenced email/meeting/deal), ask which path before proceeding.

2. **Gather context.**
   - Email path: read the pasted thread (subject, participants, last 1–3 messages). If the user references an email but hasn't pasted it, ask them to paste it — no email connector exists yet. Identify the primary external contact.
   - Call path: read the calendar event via the connected DingTalk or Feishu calendar connector (title, attendees, time, description). If no event was specified, use the most recent completed meeting in the last 24 hours and confirm with the user before proceeding. If no calendar connector is configured, ask the user to describe the meeting (title, attendees, time, duration) — the skill works from that alone.
   - Cleanup path: pull the deal (stage, amount, close date, next-step, associated contacts, activities in last 60 days), plus any email threads the owner pastes and the last 14 days of DingTalk/Feishu calendar events involving the deal's contacts.

3. **Resolve the contact and deal in your CRM.** For email/call paths:
   - Search your CRM's contacts by email / phone / WeChat. If a contact is missing, create it from email signature or calendar invite data — announce creation in chat before writing.
   - Find the right deal in this order: (a) explicit match if the user named one, (b) the contact's sole open deal, (c) fuzzy match across the contact's open deals against the email subject or meeting title — confirm before writing, (d) ask the user if no match. **Never auto-create a deal.** (For SCRM without deals, resolve to the customer / 客户 record instead.)
   - For field names, activity types, and association rules, read [reference/crm-fields.md](reference/crm-fields.md) before writing anything to your CRM.
   - If deduplication or deal-resolution feels ambiguous, check [reference/gotchas.md](reference/gotchas.md) before proceeding — it covers the most common failure modes.

4. **Execute the action.**
   - Email path: write an email activity with the thread subject as the title and a concise summary (not the full thread) as the body. Timestamp to the latest message. For a worked example, see [reference/examples/log-email-happy-path.md](reference/examples/log-email-happy-path.md).
   - Call path: write a call activity with the event title, duration, and any notes available. Timestamp to the event start. For a worked example including a missing-contact scenario, see [reference/examples/log-call-happy-path.md](reference/examples/log-call-happy-path.md).
   - Cleanup path: walk each field per [reference/cleanup-checklist.md](reference/cleanup-checklist.md) and assemble a proposed-changes list. Show current → proposed side-by-side. Write only what the user approves. For a full worked example, see [reference/examples/cleanup-deal.md](reference/examples/cleanup-deal.md).

5. **Approval gate — every externally visible write.** For contact creation and activity logging, announce before writing and surface the result after. For cleanup edits, do not write anything until the user approves the specific changes.

6. **Report what happened.** Tell the user what was written and what's pending. Include a link into your CRM to the affected deal when possible. Keep it short.

## Approval gates

- **Never delete records.** Not contacts, not deals, not activities. If the user asks, say the skill cannot and direct them to do it in their CRM.
- **Never change deal stage or close a deal without explicit user approval.** Even if evidence is strong. Flag and defer.
- **Never create a new deal unprompted.** Ask if the right deal can't be resolved.
- **Announce contact creation before writing.** One line — lets the user catch typos or duplicates.
- **Side-by-side diffs for cleanup.** Show current value and proposed value; wait for approval per item.

## 个人信息合规(PIPL)

从邮件、日历、邮件签名自动创建或合并客户联系人,本质上是**收集个人信息**(姓名、邮箱、电话等),受《个人信息保护法》(PIPL)约束:须**合法取得、获得授权、遵循最小必要**原则,只收集业务确需的字段。**在去重/合并个人信息(尤其邮箱、电话)之前,务必先向用户确认**,不要自动合并。涉及跨境传输、批量导出或更深入的合规判断时,移交 `crablaw-cn:data-activity-triage` 处理。

## Reference

- [reference/crm-fields.md](reference/crm-fields.md) — neutral capability concepts → per-platform object/field mapping, activity types, association rules used in this skill
- [reference/cleanup-checklist.md](reference/cleanup-checklist.md) — the fields checked during a deal cleanup and the evidence needed to flag each
- [reference/gotchas.md](reference/gotchas.md) — Good / Bad patterns for contact resolution, activity summaries, and cleanup proposals
- [reference/examples/log-email-happy-path.md](reference/examples/log-email-happy-path.md) — worked example: email to existing deal
- [reference/examples/log-call-happy-path.md](reference/examples/log-call-happy-path.md) — worked example: meeting to existing deal, missing contact
- [reference/examples/cleanup-deal.md](reference/examples/cleanup-deal.md) — worked example: stale deal audit
