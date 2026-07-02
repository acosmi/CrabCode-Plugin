# Gotchas — customer-pulse

## Gotcha: Missing payment dispute/refund export treated as a blocker

**Why it matters:** Dispute and refund history has no connector — the Alipay MCP only does single-payment lookups and refunds, so bulk data must come from a 支付宝商家平台 / 微信支付商户平台 export or pasted records. Owners often don't have the export handy; the report must still ship.

### ✗ Bad
Stop the run and demand the export: "Cannot generate pulse report — payment data missing." User gets nothing.

### ✓ Good
Ask once for the export or pasted records. If nothing is provided, add `Payments: not provided — not included` to the Sources section and continue with the remaining sources. Mention that the owner can rerun with a merchant-platform CSV for fuller coverage.

---

## Gotcha: Verbatim quotes paraphrased or summarized

**Why it matters:** The owner needs to see the actual customer words — not CrabCode's interpretation. Paraphrase destroys the credibility of the report.

### ✗ Bad
**Theme: Slow shipping** (8 signals)
> Customers reported that deliveries arrived later than expected.

### ✓ Good
**Theme: Slow shipping** (8 signals)
> "Ordered 2 weeks ago and still nothing — this is unacceptable." — [Email]
> "Package was 10 days late and support never responded." — [Intercom]

---

## Gotcha: HubSpot returning 0 tickets treated as an error

**Why it matters:** Test portals and new accounts legitimately have 0 tickets. Surfacing a warning creates noise and erodes trust.

### ✗ Bad
> ⚠️ HubSpot returned 0 tickets. Check your connection or permissions.

### ✓ Good
Record `HubSpot tickets: 0` in the Sources section and continue. Only flag a connector issue if authentication itself fails.

---

## Gotcha: Email keyword list too narrow

**Why it matters:** Customers don't use standard complaint keywords. A 1-star experience often surfaces as "took forever" or "never again," not "disappointed."

### ✗ Bad
Scan pasted emails only for: `refund cancel unhappy`

### ✓ Good
Use the full seed list from Workflow step 4: `refund cancel unhappy issue problem disappointed frustrated broken late slow wrong missing`. Let theme-extraction filter signal from noise — over-inclusion is cheaper than missed themes.
