# CRM fields and activity types (neutral concepts → per-platform mapping)

The objects, fields, and activity types the `crm-maintenance` skill reads from and writes to, expressed as **neutral capability concepts**. Only what is listed here is in-scope for this skill — everything else in the CRM is untouched.

The right column gives concrete **HubSpot** property names (kept as the cross-border/外贸 option). For **企业微信 / 钉钉 / 飞书 / 有赞**, map each concept to that platform's equivalent object/field — **the exact names, scopes, and API shapes are per that platform's current official open-platform docs**; do not hardcode them from memory. Small businesses usually connect just one CRM; operate on whichever is connected.

> **Paradigm note.** 企业微信 (SCRM) has **no sales pipeline / deal object** — the "deal" concept maps to the **customer / 客户 or 客户群** record, and activity is logged against that. **有赞** is retail: "deal" ≈ **订单 (order)**, "contact" ≈ **会员 (member)**. 钉钉/飞书 have suite-internal CRM objects between the two. Where a concept has no equivalent on a platform, skip it — never invent a field.

## Contacts — write

| Concept | Usage | HubSpot (cross-border) property | Domestic mapping |
|---|---|---|---|
| Primary identifier | Lookup + dedupe. Always set on creation. | `email` | 企微:外部联系人 unionid/微信;有赞:会员手机号/账号(**个人信息,最小必要**) |
| Given / family name | From email signature or calendar invite; blank if unknown. | `firstname` / `lastname` | 外部联系人 / 会员昵称 |
| Company | From email-signature domain or calendar org if available. | `company` | 客户标签 / 企业名;有赞常无 |

Do not write any other contact properties. Owner, lifecycle stage, and lead source are user-managed fields — **never overwrite**.

## Contacts — read (for lookup)

| Concept | Usage | HubSpot property | Domestic mapping |
|---|---|---|---|
| Search key | Case-insensitive exact match. | `email` | 手机号 / 微信 / 会员账号 |
| Display fields | Shown during ambiguity resolution. | `firstname` · `lastname` · `company` | 姓名 / 昵称 / 客户标签 |
| Object id | Association with deals and activities. | `hs_object_id` | 平台各自的对象 id |

## Deals / customers — read (all cleanup + resolution paths)

For SCRM without deals (企业微信), read these against the **customer / 客户** record instead.

| Concept | Usage | HubSpot property | Domestic mapping |
|---|---|---|---|
| Deal/customer name | Displayed; fuzzy-matched against email/meeting topic | `dealname` | 客户名 / 订单号(有赞) |
| Stage | **Read-only during cleanup — flag discrepancies, never change** | `dealstage` | SCRM 标签/阶段;有赞订单状态;企微无管道→客户活跃度 |
| Amount | Read; flag if recent email/meeting implies a change | `amount` | 订单金额(有赞);企微无金额→跳过 |
| Close date | Read; flag if outdated | `closedate` | 预计成交 / 订单日期;企微常无 |
| Next step | Read + propose updates during cleanup | `hs_next_step` | 跟进备注 / 下一步 |
| Owner | Displayed; **never changed** | `hubspot_owner_id` | 负责人 / 导购;never changed |
| Last activity | Detect stale deals/dormant customers | `hs_lastactivitydate` | 最近互动 / 下单时间 |
| Associated contacts | Whether recent participants are on the record | Associated contacts | 关联联系人 / 会员 |

## Deals / customers — write (cleanup path only, with approval)

| Concept | Rule | HubSpot property |
|---|---|---|
| Next step | Propose updates; write only with explicit user approval | `hs_next_step` |
| Close date | Propose updates; write only with explicit user approval | `closedate` |
| Amount | Propose updates; write only with explicit user approval | `amount` |
| Contact assoc. | Propose adding missing participants; write only with approval | Contact association |

**Never write** the stage field (`dealstage`), pipeline, the owner field (`hubspot_owner_id`), or any custom property during cleanup. Those are owner-managed — the same rule holds for the equivalent stage/owner fields on any platform.

## Activities — write

| Activity type | Used by | Concept fields set |
|---|---|---|
| Email engagement | Email path | subject (thread subject), body (summary, not full thread), timestamp (latest message time), associated contact(s) + deal/customer. HubSpot: `EMAIL` / `hs_email_subject` / `hs_email_text` / `hs_timestamp`. |
| Call engagement | Call path | title (event title), body (summary), duration (from calendar), timestamp (event start), associated contact(s) + deal/customer. HubSpot: `CALL` / `hs_call_title` / `hs_call_body` / `hs_call_duration` / `hs_timestamp`. |
| Note | Cleanup path | note body (when flagging something for future review that doesn't fit a field update). HubSpot: `NOTE` / `hs_note_body`. |

Use each platform's **standard** engagement/activity vocabulary. Do not invent custom activity types. For 企业微信, "activity" is a 跟进记录 / 客户动态 against the customer; for 有赞 it attaches to the member/order.

## Association rules

- Every activity must associate to the deal/customer AND to at least one contact.
- If a contact is created on-the-fly during activity logging, associate it to the deal/customer in the same operation so the activity shows up on both timelines.
- Do not associate a contact to a deal/customer during an activity-logging flow unless the contact is actually a participant in that email thread or meeting.
