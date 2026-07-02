# Accounting Export — Reconciliation Reference

The owner's accounting software (用友好会计 / 金蝶精斗云) has no MCP connector —
all data arrives as a CSV/Excel export or a pasted report. Column names vary by
product and version; treat the mappings below as what to look for, and confirm
with the owner when a column is ambiguous.

## Reports to request

### Profit & Loss (P&L / 利润表)

Ask for the P&L report export for the target month:
- Date range: first day to last day of target month
- Accounting method: **Accrual** unless the user has told you they run cash-basis
- Include all accounts

Key figures used downstream:
| Figure | Notes |
|---|---|
| Total revenue (营业收入) | Top-line revenue |
| Gross profit | Revenue minus COGS; compute it if the export doesn't include it |
| Gross margin % | Compute as Gross Profit / Total Revenue |
| Net income (净利润) | Bottom line |
| Total expenses | Operating expenses subtotal |

### Transaction Register (明细账 / 流水)

Ask for a transaction detail export for the target month. This is the line-item
detail used for uncategorized flagging and duplicate detection.

Columns to look for:
| Column | Notes |
|---|---|
| Transaction date (日期) | Transaction date, not posting date, where both exist |
| Type (类型) | Invoice, payment, expense, deposit, etc. |
| Amount (金额) | Sign conventions vary — confirm whether income is positive |
| Category / account (科目) | The ledger category |
| Counterparty (往来单位) | Vendor or customer name |
| Memo (摘要 / 备注) | Free-text description |
| Voucher / document no. (单据编号 / 凭证号) | Groups split lines of one transaction |

## Identifying uncategorized transactions

Flag a transaction as uncategorized if its category column is:
- blank / null
- the software's placeholder category ("未分类", "待处理", "其他/待定" or similar)
- anything the software itself marks as needing review

If you're unsure which values are placeholders in this owner's setup, show the
distinct category list and ask.

## Export completeness

Exports are files, not APIs — there is no pagination, but there are truncated or
filtered downloads. Before reconciling:
- Check the export's date range actually covers the full target month
- Cross-check the register's income/expense totals against the P&L subtotals;
  a mismatch usually means a filtered or partial export — ask the owner to
  re-export rather than reconciling incomplete data

## Common data issues

**Split transactions** — a single purchase split across multiple categories appears as
multiple rows with the same date and vendor but different amounts. These are NOT
duplicates. Before flagging duplicates, group rows by voucher/document number
(单据编号) — rows sharing a number are splits of one transaction. If the export has
no such column, treat same-vendor same-date rows as possible splits and ask.

**Bank feeds vs. manual entries** — imported bank-flow entries usually carry a
machine-generated memo; manual entries often lack one. Neither is a signal of a
problem on its own, but it helps explain why a transaction might lack a receipt.

**Payment platform transactions already in the books** — some accounting tools
import Alipay/WeChat Pay bills automatically, so those transactions may already
appear in the register. Don't double-count them during reconciliation (Step 3).
Check whether deposit lines mention 支付宝/微信 in the account or memo before
matching.

**Retainer / deposit transactions** — a customer deposit (预收款) is not revenue
until the work is delivered. If the user is on cash-basis accounting this
distinction matters less, but flag any large deposit-type transactions without a
matching invoice for their awareness.
