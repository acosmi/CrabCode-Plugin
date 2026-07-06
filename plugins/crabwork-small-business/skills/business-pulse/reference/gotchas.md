# Gotchas

Known failure modes for the business-pulse skill. Good / Bad pairs.

---

## Gotcha: No accounting export provided

**Why it matters:** There is no connector for the owner's accounting software (用友好会计 / 金蝶精斗云) — cash and AR data only exist if the owner uploaded an export or pasted figures this session. Skipping the Cash section silently makes the owner assume the pulse checked their books and found nothing.

### ✗ Bad

```
CrabCode: [no accounting export in session]
        → skips Cash section silently
        → pulse presents no cash data; owner assumes the books were checked
```

The owner acts on an "all clear" that was never actually verified.

### ✓ Good

```
CrabCode: [no accounting export in session]
        → Cash section header present with: "n/a — no accounting export provided this session"
        → "Sources unavailable: accounting software — no export provided" in appendix
        → one line at the end: "Upload a 用友好会计/金蝶精斗云 export and I'll fill in the finance sections."
```

The owner sees the gap explicitly and can provide the export or proceed with a partial pulse.

---

## Gotcha: Trying to pull sales history through the alipay connector

**Why it matters:** The alipay connector's only tools create payment links, query a single payment by order number, and process refunds. It cannot bulk-export transactions, settlements, or AR. Attempting a "pull 7-day settlements" call against it fails or, worse, produces a misleading single-payment answer.

### ✗ Bad

```
CrabCode: [calls query-alipay-payment hoping for a transaction list]
        → gets a single-payment lookup error or an unrelated record
        → reports "支付宝 revenue: ¥0" in the pulse
```

### ✓ Good

```
CrabCode: [needs sales trend]
        → uses the 支付宝商家平台 bill export the owner provided
        → if none provided: Revenue section shows "n/a — no bill export provided"
        → alipay connector is only used when the owner asks about one specific payment by order number
```

---

## Gotcha: Asking permission before pulling connector data

**Why it matters:** The skill's core value is doing the work without prompting. An owner who invoked the pulse already implicitly approved the data pull from connected tools. Asking "should I check HubSpot?" or "can I look at your Feishu messages?" defeats the purpose and erodes trust in the skill as an autonomous assistant.

### ✗ Bad

```
Owner: "catch me up on the business"
CrabCode: "Should I check your HubSpot pipeline? And is it okay to look at your DingTalk messages?"
```

Three more round trips before anything useful is delivered.

### ✓ Good

```
Owner: "catch me up on the business"
CrabCode: [immediately dispatches all parallel connector calls: HubSpot + DingTalk/Feishu]
        → presents pulse in one response, finance sections filled from any exports already provided
```

Note the distinction: requesting a finance export (which no connector can reach) is a data handoff, not a permission question — do it once, at the end, without blocking the pulse.

---

## Gotcha: DingTalk/Feishu message send requires explicit confirmation

**Why it matters:** Sending a DingTalk/Feishu message posts into chats other people can see. Auto-sending the pulse without confirmation could embarrass the owner or broadcast financials to the whole team.

### ✗ Bad

```
CrabCode: [at end of pulse]
        "I've sent this to your team's DingTalk group."
```

Owner never asked for it; now the whole team has the financial data.

### ✓ Good

```
CrabCode: [at end of pulse]
        "Want me to send this via DingTalk or Feishu? If so, to which chat?"
```

A message is sent only with a specific "yes + destination" from the owner. Never assume.
