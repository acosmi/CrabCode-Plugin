# Onboard checklist

## The five interview questions

Ask one at a time. Wait for the full answer before moving on. One follow-up is fine if an answer is vague; do not drill further.

1. **Industry and business type.** "What kind of business do you run? Give me the one-liner."
2. **Team size.** "How many people work with you, including yourself?"
3. **Top three headaches.** "What are your three biggest headaches right now — the things that eat your time or keep you up at night?"
4. **Tools already in use.** "Which tools do you already use day-to-day? Things like 用友好会计, 金蝶精斗云, 支付宝, 微信支付, 钉钉, 飞书, 腾讯文档, 企业微信, 有赞, HubSpot…"
5. **Preferred cadence.** "How would you like me to check in — daily, weekly, or only when you ask?"

If the owner is short on time, compress to questions 1, 3, and 4 — those three feed the most downstream skills.

---

## Connector priority matrix

Map the owner's stated headache to the best two connectors to link first. Shipped connectors: alipay (支付宝), dingtalk (钉钉), feishu (飞书), tencent-docs (腾讯文档), hubspot (cross-border/外贸 CRM only — not the default). CRM default: **企业微信** (私域 SCRM), or the already-connected 钉钉/飞书 suite CRM; retail to **有赞**. Pending — never offer to connect these: 企业微信 / 有赞 CRM wrappers, accounting software (用友好会计 / 金蝶精斗云), 微信支付, 众律宝, 自营云端设计, 腾讯企业邮, 阿里云盘. Where a pending connector would have been the answer, use its export/paste workaround and say so.

| Primary headache | First connector | Second connector | Prove-value recipe |
|---|---|---|---|
| Cash flow / invoicing | alipay (支付宝) | dingtalk or feishu | `cash-flow-snapshot` on a 支付宝商家平台 bill export (CSV) or pasted accounting report — the alipay connector can't export history, so ask for the export |
| Customer follow-up | 企业微信 (default; or 钉钉/飞书 suite CRM. HubSpot for cross-border. 企微 wrapper pending → paste/export until live) | dingtalk or feishu | `crm-maintenance` (read-only demo) |
| Hiring / job posts | tencent-docs | dingtalk or feishu | `job-post-builder` |
| Staying organized | tencent-docs | Desktop (folder setup) | Desktop folder structure demo |
| Scheduling overload | dingtalk or feishu (日程/日历) | tencent-docs | `business-pulse` |
| General / unsure | dingtalk or feishu | alipay (支付宝) | `business-pulse` |

Between dingtalk and feishu, ask which one the owner's team actually uses — connect that one, not both.

If the owner names a shipped connector not chosen by this table, add it as the second connector and use `business-pulse` as the recipe.

---

## Recipe selection

Run the prove-value recipe immediately after the **first** connector is live — do not wait for the second. If connectors are already active at session start, run the matched recipe for the owner's primary headache before beginning the interview. Priority order:

1. Cash-flow headache → ask for a 支付宝商家平台 bill export (CSV) or a pasted report from the owner's accounting software (用友好会计 / 金蝶精斗云 — no connector yet) → `cash-flow-snapshot` on that data
2. A CRM (企业微信/钉钉/飞书/有赞; HubSpot for cross-border) → `crm-maintenance` (log-a-note demo, read-only)
3. alipay → with explicit owner approval, create one payment link for something they actually need to collect, then query its status by order number — the full payments loop in under a minute. If the owner would rather not, fall back to the bill-export snapshot above
4. dingtalk or feishu → pull today's schedule via the connected connector → `business-pulse`
5. tencent-docs → open (or create) the owner's working doc and show a quick edit round-trip
6. Desktop only → walk Desktop folder setup, create recommended structure

---

## Owner profile — storage format

Write this block to the CrabCode session memory directory under the heading `## Business context`. Every other skill reads this section by heading match. Do not rename the heading or change the field names.

```markdown
## Business context

- **Business:** <one-liner — industry, product/service>
- **Size:** <number of people, including owner>
- **Top headaches:** <headache 1> · <headache 2> · <headache 3>
- **Connected tools:** <comma-separated list of active connectors>
- **Weekly cadence:** <trigger phrase and day, e.g. "weekly check-in every Monday">
- **Onboarded:** <YYYY-MM-DD>
```

If a memory file already exists, append or update only the `## Business context` section. Do not touch other content.
