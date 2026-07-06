# Data Sources

Exact mapping from each pulse section to the source that produces it. Two kinds of sources:

- **Live connectors** (HubSpot, DingTalk 钉钉, Feishu 飞书) — **dispatch all calls in a single parallel batch**; do not pull serially.
- **Owner-provided exports** (accounting software, 支付宝/微信支付 bills) — parsed from files or pasted data already in the session. No live connector exists for these; never attempt to pull them via MCP.

## Cash & Finance (accounting software — owner-provided)

Source: CSV/Excel export or pasted report from 用友好会计 / 金蝶精斗云. No MCP connector.

| Metric | Source | Notes |
|---|---|---|
| Cash / bank balance | Balance section of the export or pasted figure | Show delta vs. prior week if a prior export is available |
| MTD revenue | P&L export | Current month vs. prior month |
| Outstanding receivables | Invoice list in export | Filter to open/unpaid |
| AR aging | Invoice list in export | Group by days since due: 0–30, 31–60, 61+ |
| Overdue invoices | Invoice list in export | Filter to due_date > 30 days past; name customer + amount + days overdue |

**Missing-export handling**: if no accounting export was provided this session, mark the entire Cash section as "n/a — no accounting export provided" and continue. Invite the owner to upload one at the end of the pulse — do not block.

## Revenue & Sales (支付宝 / 微信支付 — owner-provided bill exports)

Source: bill export (CSV) from 支付宝商家平台 and/or 微信支付商户平台. The alipay MCP connector **cannot** export transaction history — its only tools create payment links, query a single payment by order number, and process refunds. Do not attempt trend pulls through it. WeChat Pay (微信支付) has no connector at all yet.

| Metric | Source | Notes |
|---|---|---|
| 7-day settlement total | 支付宝 bill export | Sum completed settlements in window |
| Sales trend | 支付宝 bill export | This 7 days vs. prior 7 days; compute delta |
| Failed / pending transactions | 支付宝 bill export | Flag any > ¥200 |
| 微信支付 settlements | 微信支付商户平台 bill export (if provided) | Same as 支付宝 — sum + trend |

Use whichever bill exports were provided. If both 支付宝 and 微信支付 bills are available, report combined and per-source. One legitimate live use of the alipay connector: if the owner asks about one specific payment and has its order number, `query-alipay-payment` can check its status.

## Pipeline (HubSpot)

| Metric | Tool | Notes |
|---|---|---|
| Pipeline by stage | `get_crm_objects` type=deals | Group by deal stage; sum amount |
| Deals closed this week | `search_crm_objects` | Filter closedate in window, stage = closed-won |
| Deals gone cold | `search_crm_objects` | Filter hs_last_activity_date > 7 days ago, open stage |
| New leads this week | `search_crm_objects` | Filter createdate in window |
| Stalled/slipped deals | `search_crm_objects` | Open deals where closedate < today |

## Commitments (钉钉日程 / 飞书日历)

Source: the connected DingTalk or Feishu connector's calendar/schedule capability. Refer to it generically — list the owner's schedule via the connected connector.

| Metric | Source | Notes |
|---|---|---|
| This week's key items | DingTalk/Feishu calendar | Filter to current week; surface meetings with customers, deadlines, important holds |
| Next 7 days | DingTalk/Feishu calendar | Forward-looking view; highlight anything with external parties |

## Watch List (DingTalk / Feishu messages)

Source: the connected DingTalk or Feishu connector's message capability.

| Metric | Source | Notes |
|---|---|---|
| Urgent threads | DingTalk/Feishu messages | Messages @mentioning the owner or flagged urgent in the last 7 days |
| Customer escalations | DingTalk/Feishu messages | Terms like "escalation," "complaint," "cancel," "refund" (投诉 / 退款 / 取消) in the last 7 days |
| Time-sensitive requests | DingTalk/Feishu messages | Unread items with keywords like "deadline," "ASAP," "today" (截止 / 尽快 / 今天) |

**Connector fallback**: if the DingTalk/Feishu call errors, skip Watch List silently and add the connector name + "unavailable" to the appendix. Do not surface the error in the pulse body.

## Risks scan

Run these alongside the metric pulls — don't wait for metrics to finish first.

| Risk | Source | Trigger condition |
|---|---|---|
| Overdue AR | Accounting export invoices | due_date > 30 days past, unpaid |
| Stalled deals | HubSpot | Open deal, no activity 7+ days |
| Slipped deals | HubSpot | Open deal, closedate in past |
| Urgent messages | DingTalk/Feishu | @mention, urgency flag, or escalation keywords |
| Failed payments | 支付宝 / 微信支付 bill exports | Failed or pending > ¥200 |

## Parallelization

All live-connector calls (HubSpot + DingTalk/Feishu) should fire in a single tool-call batch — typically 5–10 parallel calls. Parse owner-provided exports locally while the connector calls are in flight. If one call errors, the rest proceed normally and the failed source appears in "Sources unavailable" at the bottom of the pulse.
