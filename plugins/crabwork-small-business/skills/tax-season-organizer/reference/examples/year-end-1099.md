# Worked Example: Year-End 1099 Prep

**Scenario:** Marcus owns a digital marketing agency. He asks: "I need to send out
my 1099s — can you pull together a list of who needs one?"

---

## Step 1: Gather contractor payments from all sources

**Accounting software export** (用友好会计 vendor payment report, Jan 1 – Dec 31, 2024,
uploaded as CSV):

| Vendor | Total paid | 1099 eligible? | EIN/SSN on file? |
|--------|-----------|----------------|-----------------|
| Jenna Torres (copywriter) | $8,400 | Yes | Yes |
| Apex Web Solutions | $15,200 | Yes | Yes |
| Bob Nguyen | $550 | No | No |
| FedEx | $320 | No | No |
| Spark Digital Inc. | $6,000 | Yes | Yes |

**Alipay (支付宝商家平台 bill export, payments sent, 2024)** — the alipay connector
cannot export history, so Marcus downloaded the bill CSV from 支付宝商家平台:

| Recipient | Total sent | Notes |
|-----------|-----------|-------|
| jenna.torres@email.com | $1,200 | Likely same as accounting-software vendor |
| designbymike@163.com | $2,100 | Not in the accounting export |
| Bob Nguyen | $480 | |

**WeChat Pay (微信支付)** — Marcus confirmed he pays no contractors via WeChat Pay;
no 微信支付商户平台 export needed.

---

## Step 2: Aggregate and deduplicate

Cross-referencing the accounting export and the 支付宝 bill:

| Payee | Accounting export | 支付宝 | Total | Notes |
|-------|-----------|--------|-------|-------|
| Jenna Torres | $8,400 | $1,200 | **$9,600** | Same person — email match |
| Apex Web Solutions | $15,200 | — | **$15,200** | |
| Spark Digital Inc. | $6,000 | — | **$6,000** | |
| Design by Mike (Mike unknown) | — | $2,100 | **$2,100** | Not in accounting export; payee name unknown |
| Bob Nguyen | $550 | $480 | **$1,030** | Combined > $600; flagged |
| FedEx | $320 | — | $320 | Below threshold; goods/shipping — exempt |

---

## Step 3: Apply $600 threshold and W-9 check

- Jenna Torres: $9,600 ✅ → **1099-NEC required** · W-9 on file (EIN in accounting software)
- Apex Web Solutions: $15,200 ✅ → **1099-NEC candidate** · W-9 on file · Note: may be a corp (confirm)
- Spark Digital Inc.: $6,000 ✅ → **1099-NEC candidate** · W-9 on file · "Inc." — likely corp exempt (confirm)
- Design by Mike: $2,100 ✅ → **1099-NEC required** · W-9 not on file — must collect
- Bob Nguyen: $1,030 ✅ → **1099-NEC required** · W-9 not on file — must collect
- FedEx: $320 → below threshold; goods/shipping — not required

---

## Step 4: Output delivered to Marcus

```
## 1099 prep list — 2024
Prepared January 10, 2025 · For review by your accountant · Not tax advice

### Summary
- Contractors paying: 5 candidates identified
- Require 1099-NEC (≥$600 for services): 5
- Missing W-9: 2 — action required before January 31
- Corporation exemption review needed: 2 (Apex, Spark)

### 1099-NEC candidates

| Payee | Total paid | Source(s) | W-9 status | Notes |
|-------|-----------|-----------|------------|-------|
| Jenna Torres | $9,600 | Accounting export + 支付宝 | ✅ EIN on file | 支付宝 also paid $1,200 — combined above |
| Apex Web Solutions | $15,200 | Accounting export | ✅ EIN on file | "Solutions" — may be corp; confirm exemption with accountant |
| Spark Digital Inc. | $6,000 | Accounting export | ✅ EIN on file | "Inc." — likely corp-exempt; confirm with accountant |
| Design by Mike | $2,100 | 支付宝 only | ⚠️ Missing W-9 | Full name unknown — obtain before filing |
| Bob Nguyen | $1,030 | Accounting export + 支付宝 | ⚠️ Missing W-9 | Combined books ($550) + 支付宝 ($480) = $1,030 |

### Missing W-9 action list
These contractors must provide a W-9 before you can file:

1. **Design by Mike** — paid $2,100 via 支付宝. Obtain full legal name and W-9.
   IRS W-9 form: https://www.irs.gov/pub/irs-pdf/fw9.pdf
2. **Bob Nguyen** — paid $1,030 (books + 支付宝). W-9 not on file for either source.

### Data coverage note
This list covers the 用友好会计 vendor payment export and the 支付宝商家平台 bill
export for 2024. Marcus confirmed no contractors are paid via 微信支付, so no
微信支付商户平台 bill was needed. If any other payment rail was used, those
payments are not included.

### Next steps for your accountant
- [ ] Collect W-9 from Design by Mike (full legal name needed first)
- [ ] Collect W-9 from Bob Nguyen
- [ ] Confirm corporation exemption for Apex Web Solutions
- [ ] Confirm corporation exemption for Spark Digital Inc.
- [ ] File 1099-NECs by January 31, 2025
- [ ] File 1096 transmittal with IRS by January 31, 2025
```
