# CSV Upload Schema

The owner supplies exported CSV files — there is no live accounting or payment-history connector. This document specifies what columns to expect and how to handle variations.

## Revenue CSV (payment bill / transactions export)

Expected columns (order doesn't matter; headers are case-insensitive and may be in Chinese):

| Column | Required | Description |
|---|---|---|
| `date` (日期 / 交易时间) | Yes | Transaction date (any standard format: YYYY-MM-DD, YYYY/MM/DD, etc.) |
| `item` or `product` or `service` or `description` (商品名称 / 备注) | Yes | What was sold |
| `amount` or `revenue` or `total` (金额) | Yes | Transaction amount (CNY unless stated otherwise) |
| `quantity` or `qty` (数量) | No | Units sold — if missing, assume 1 per transaction |

**Exports that typically match this format:**
- 支付宝商家平台: bill download (交易账单 CSV)
- 微信支付商户平台: transaction bill download (WeChat Pay — not yet connected; manual export)
- Shop/order systems: order export (often the only source of item names)

Payment bills sometimes carry only order numbers, not product names. If so, ask the owner for an order export or an order-to-product mapping.

If the export has more columns, ignore the extras. If a required column is missing, ask the owner which column maps to it.

## Cost CSV (expense or COGS export)

Expected columns:

| Column | Required | Description |
|---|---|---|
| `date` (日期) | No | Expense date (useful for trend analysis) |
| `item` or `product` or `service` or `category` (科目 / 类别) | Yes | What the cost relates to |
| `amount` or `cost` or `expense` (金额) | Yes | Cost amount (CNY unless stated otherwise) |
| `type` (类型) | No | COGS vs. operating expense — if absent, ask the owner |

**Exports that typically match this format:**
- 用友好会计 / 金蝶精斗云: P&L detail (利润表明细) or expense report export
- Bank or corporate-card statement exports, filtered to expense categories

## Handling messy CSVs

Real-world exports are messy. Common issues:

- **Extra header rows:** Bill exports often start with several summary/metadata rows — skip rows until you find one that looks like column names
- **Currency symbols:** Strip `¥`, `$`, `,` from numeric fields before parsing
- **Negative refunds:** Include them — they reduce net revenue
- **Mixed currencies:** Flag it and ask which currency to use; default to CNY if unclear
- **"Gross" vs "Net" amounts:** Prefer net (after payment service fees) for revenue; ask if unclear

## After loading

Confirm the data shape with the owner before proceeding:
- "I loaded X transactions from [date] to [date] across Y products. Does that look right?"
- If the date range or product count looks off, ask them to double-check the export filters.
