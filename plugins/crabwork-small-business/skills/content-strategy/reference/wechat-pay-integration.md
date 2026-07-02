# WeChat Pay integration (future enhancement)

WeChat Pay (微信支付) is a planned revenue source for content-strategy, but
no connector exists yet. This document records the current export-based
path and what a future connector would change.

## Current state

- **No WeChat Pay connector.** All WeChat Pay revenue enters the analysis
  the same way as Alipay revenue: the owner exports a bill CSV — from
  微信支付商户平台 (merchant platform) — and hands over the file or pastes
  the data.
- The plugin's **alipay** connector does not help here either: it only
  creates payment links, queries a single payment by order number, and
  processes refunds. It cannot export transaction history for Alipay, let
  alone WeChat Pay.
- Primary tested paths today: 支付宝商家平台 bill export (CSV) and
  accounting-software exports (用友好会计 / 金蝶精斗云).

## Export-based path (works today)

1. Owner logs into 微信支付商户平台 and downloads the transaction bill
   (交易账单) for the lookback window as CSV.
2. Skill parses per-transaction rows: date, amount, order title.
3. Same caveats as the Alipay export apply:
   - Order titles may not map cleanly to catalog product names —
     normalize and confirm groupings with the owner.
   - The export covers WeChat Pay only; combine with the Alipay export
     and/or accounting data for full coverage, and de-duplicate if the
     accounting software already books this revenue.

## What a future connector would change

If a WeChat Pay connector ships with bill/transaction access:

1. The manual export step disappears for the lookback pull.
2. SKILL.md Step 1 gains WeChat Pay as a live source alongside the
   file-based ones.
3. A worked example (`reference/examples/`) should be added and validated
   against a real merchant account before the path is documented as
   tested.

Do not assume any of this exists until the connector appears in the
plugin's connector list — until then, refer only to the export path.

## Why it's not wired up

1. **No connector available** — there is nothing to call.
2. **No test merchant account** — even when a connector appears, the path
   needs end-to-end validation with real bill data before it's documented
   as a co-equal source.
