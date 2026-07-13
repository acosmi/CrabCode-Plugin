---
name: CRM 数据清理
short-description: 识别重复、缺失与沉睡记录，并按确认结果清理客户数据
version: 0.3.0
description: Scans your CRM (企业微信/钉钉/飞书/有赞; HubSpot for cross-border) for stale deals/dormant customers, duplicate contacts, and missing fields, then fixes what the owner approves. Trigger when the owner runs /crm-cleanup or says "clean up the CRM," "客户资料一团乱," "dedupe my contacts," "fix stale deals," "tidy up my pipeline," or wants their CRM data cleaned. Accepts optional scope argument for deals, contacts, or all. 亦触发于:"清理一下 CRM""客户资料太乱了""合并重复客户""清理僵尸商机 / 沉睡客户""整理管道"。
allowed-tools: Read, WebFetch, Bash
---

Run a CRM hygiene pass using the `crm-maintenance` skill cleanup workflow. Act immediately — the user typed /crm-cleanup, so skip the intent-detection step. Your CRM may be 企业微信 / 钉钉 / 飞书 / 有赞 (HubSpot for cross-border); operate on whichever is connected. For SCRM without a sales pipeline (企业微信), read "deals" below as "active customers / 客户" and "stale deal" as "dormant / long-inactive customer."

Parse arguments:
- `--scope` (default: `all`) — `deals` for deal audit only, `contacts` for contact dedup only, `all` for both

## Step 1 — Scan for stale deals

If scope includes deals:

1. Pull all open deals from your CRM (for SCRM like 企业微信 with no pipeline, pull active customers / 客户 instead).
2. Flag deals/customers with no activity (email, call, meeting, message, note) in the last 14 days.
3. For each stale deal: show deal name, stage, last activity date, associated contacts, and amount.
4. Propose actions per deal: update next-step, change stage, add a note, or close-lost.

Present the full stale-deals list before making any changes.

## Step 2 — Scan for duplicate contacts

If scope includes contacts:

1. Search your CRM's contacts for likely duplicates (same email/phone/WeChat, similar names, same company + similar name).
2. For each duplicate set: show both records side-by-side — name, email, company, deals, last activity.
3. Propose which record to keep and which fields to merge.

Present all duplicate sets before merging anything.

## Step 3 — Scan for missing required fields

1. Check all open deals for missing fields: close date, amount, deal stage, associated contact, next-step/notes.
2. Check contacts associated with open deals for missing fields: email, company, phone.
3. Present a table of records with missing fields and what's missing.

## Step 4 — Apply approved fixes

1. Walk through each finding from Steps 1-3.
2. Apply only the changes the owner explicitly approves.
3. Report each change as it's made with a link into your CRM.

## Connector failures

If your CRM is unreachable or not yet connected, stop — this command operates directly on CRM data. Tell the owner: "No CRM is connected. Configure one (企业微信/钉钉/飞书/有赞, or HubSpot for cross-border) under /plugin → Manage plugins → Configure, then rerun /crm-cleanup." If the owner's CRM has no live connector yet (企业微信/有赞 wrapper pending), a cleanup can still be proposed against an exported/pasted contact & deal list — but changes are then applied by the owner in their CRM, not written back automatically.

## Approval gates

- **Never delete records.** Not contacts, not deals, not activities. If the user asks, say the skill cannot and direct them to do it in their CRM.
- **Never change deal stage or close a deal without explicit approval.** Even if evidence is strong. Flag and defer.
- **Never auto-merge duplicate contacts.** Show side-by-side and wait for approval per pair.
- **Side-by-side diffs for all changes.** Show current value and proposed value; wait for approval per item.

## 个人信息合规(PIPL)

扫描、去重、合并你的 CRM 联系人本质上是**处理个人信息**(姓名、邮箱、电话、微信等),受《个人信息保护法》(PIPL)约束:相关个人信息须**合法取得、获得授权、遵循最小必要**。**合并重复联系人、填充缺失字段(尤其邮箱、电话、微信)前,务必逐条向用户确认**,绝不自动合并。SCRM(企业微信)还涉及客户朋友圈 / 客户群,个人信息面更广——护栏只增不减。涉及跨境传输、批量导出或更深入的合规判断时,移交 `crablaw-cn:data-activity-triage` 处理。

## Output

End with a summary: X deals updated, Y contacts merged, Z fields filled. Include links to the affected records.
