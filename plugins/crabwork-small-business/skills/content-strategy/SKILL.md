---
name: content-strategy
version: 0.3.0
description: >
  Analyzes sales data from Alipay merchant-platform (支付宝商家平台) bill
  exports and the owner's accounting software (用友好会计 / 金蝶精斗云) to
  find top performers and slow movers, layers in seasonality, and produces
  a prioritized 30-day content brief: what to push, what offers to run,
  what to hold. Data arrives as CSV/Excel exports or pasted reports — no
  live transaction feed. Strategic output only — no calendars, no assets,
  no sends. Use when the user asks "what should I post," "what should I
  promote this month," "what's selling," "build me a content plan," "what
  offers should I run," or wants a data-backed marketing plan. (To turn an
  approved brief into actual posts and design briefs, that is
  design-creator / run-campaign.)
---

# Content Strategy

> **Status:** MVP draft
> **Owner:** JJ
> **Version:** 0.3.0 · Phase MVP
> **Category:** Marketing & Sales

## Quick start

When an SMB owner asks "what should I post this month?" or "what's my content plan?", this skill:

1. **Ingests sales data** the owner exports from 支付宝商家平台 (Alipay merchant platform, CSV bill export) and/or their accounting software (用友好会计 / 金蝶精斗云 — CSV/Excel export or a pasted report)
2. **Identifies patterns** — top-selling products, slow movers, seasonal trends
3. **Layers in context** — seasonality (user-provided or industry benchmarks), past performance
4. **Produces a 30-day brief** — ranked recommendations of what to push, what to hold, what offers to consider
5. **Gets owner approval** before the brief feeds into `design-creator` for calendar, copy, and design briefs

The output is strategic only — no calendar scheduling, no creative assets.

---

## Workflow

### Step 1: Pre-flight check (data sources)

There is no connector that can pull transaction history. The plugin's
alipay connector only creates payment links, queries a single payment by
order number, and processes refunds — it **cannot** export bills or
transaction lists. WeChat Pay (微信支付) has no connector yet. So the
analysis runs on files the owner exports:

1. Ask which sources the owner has:
   - **支付宝商家平台** — bill/transaction export (CSV), covers Alipay revenue
   - **微信支付商户平台** — bill export (CSV), covers WeChat Pay revenue
   - **Accounting software (用友好会计 / 金蝶精斗云)** — revenue by
     product/service export (CSV/Excel), usually the best source for
     item names and margins
   - **Pasted report** — fine for small businesses; paste totals by
     product and month
2. Ask them to export the lookback window (default: last 90 days) and
   provide the file path, or paste the data.
3. If no source is available at all, stop: the brief can't be data-backed
   without at least one revenue source. Offer to proceed with a
   benchmark-only brief, clearly labeled as not data-backed.

### Step 2: Clarify priorities & metrics

When triggered, ask the user:

- **"How do you want me to measure 'top performers'?"**
  - By total revenue?
  - By profit margin?
  - By sales velocity (how fast they're selling)?
  - Combination of the above?

- **"Do you have seasonality patterns in mind?"**
  - If yes: "Tell me about them" (capture user's known seasonality)
  - If no: "I'll use industry benchmarks for your category"

### Step 3: Parse and analyze the sales data

Read the provided files (CSV/Excel) or pasted report:

- **Date range:** Last 90 days (or full history if <90 days available)
- **Extract:** Product/service name, date sold, revenue, quantity

**Source-specific notes:**

- **支付宝商家平台 / 微信支付商户平台 bill exports:** rows are per
  transaction; the "商品名称/订单标题" (order title) column may not map
  cleanly to your product catalog — group carefully and confirm ambiguous
  groupings with the owner. Payment-platform exports also miss cash and
  other-channel sales; say so in the brief if the owner sells offline.
- **用友好会计 / 金蝶精斗云 exports:** revenue-by-product reports carry
  cleaner item names and (sometimes) cost/margin — prefer them for
  ranking by margin.
- **Multiple sources:** de-duplicate — accounting software often already
  includes the payment-platform revenue. Ask the owner which source is
  the system of record before summing anything across files.

**Fallback:** If <3 months of data, use industry seasonality benchmarks for the SMB's category (e.g., retail, services, e-commerce)

Identify:
- **Top 3–5 performers** (by user's chosen metric)
- **Bottom 3–5 slow movers** (consider holding or repositioning)
- **Trending up** (gaining momentum in last 30 days)
- **Trending down** (losing momentum)

### Step 4: Layer in seasonality

- **User-provided:** If they shared seasonal patterns, weight recommendations against them
- **Industry benchmarks:** For categories without strong user data (e.g., "Q1 is strong for tax services")
- **Timing:** Flag products that should ramp up/down in the next 30 days based on seasonal patterns

### Step 5: Build the 30-day brief

Structure:
- **Executive summary** (1–2 sentences: "Your best sellers are X and Y. Seasonal shift to Z is starting.")
- **Push hard** (Top 2–3 products + recommended content angle, e.g., "Case study on ROI", "How-to video")
- **Hold steady** (Middle performers; maintain visibility but no heavy lift)
- **Reposition or pause** (Slow movers; consider discounting, bundling, or pausing)
- **Seasonal opportunities** (What's coming next month that you should position for now)
- **Recommended offers** (Bundle, discount, or free-trial strategy based on data)

Note the data source and its coverage in the brief header (e.g., "Based on
支付宝商家平台 export, Apr 1–Jun 30 — excludes cash sales"). Downstream
skills must not assume live API data behind these numbers.

Example length: **200–400 words** (brief and actionable, not essay-length).

### Step 6: Owner approval & iteration

Present the brief to the owner. Ask:
- "Does this match your gut?"
- "Anything to adjust?"
- "Ready to feed this to design-creator for the calendar, copy, and design briefs?"

Iterate if needed; once approved, return the final brief as structured JSON (ready for downstream tools).

---

## Gotchas & edge cases

See [`reference/gotchas.md`](reference/gotchas.md) for common pitfalls.

## WeChat Pay integration

Not yet connected — see
[`reference/wechat-pay-integration.md`](reference/wechat-pay-integration.md)
for the current export-based path and what a future connector would change.

---

## Examples

See [`reference/examples/`](reference/examples/) for worked examples (SaaS, retail, services).

## Spreadsheet input routing

- When a revenue export (支付宝商家平台 / 微信支付商户平台 bill, or accounting software) arrives as an Excel file (.xlsx/.xls), parse it via `crabcode-office-suite:crabcode-spreadsheets`; CSV files and pasted reports need no extra tooling. The brief itself stays markdown/JSON — no spreadsheet output.
- If that skill reports Unknown skill, the office suite is not installed: guide the owner to install `crabcode-office-suite` via `/plugin` and retry — or ask for a CSV export instead.
