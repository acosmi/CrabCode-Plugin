# Gotchas

## Gotcha: Confusing correlation with causation

Sales data shows a product peaked in March. That doesn't mean March marketing caused it — it might be seasonal demand.

**Why it matters:** If you push hard on a slow-moving product just because it sold well once, you waste creative energy on something that doesn't actually resonate.

### ✗ Bad
"Widgets sold 10 units in March. Push widgets hard in May because March worked."

### ✓ Good
"Widgets sell well in March. Check if that's seasonal demand (tax-season gifting?) or a one-off spike. If seasonal, position for March next year. If one-off, don't over-index on it."

---

## Gotcha: Ignoring low-velocity, high-margin products

Revenue is tempting. A low-volume, high-margin service (like consulting) might generate less total revenue than a cheap commodity product, but it's far more profitable.

**Why it matters:** If you obsess over volume winners and ignore margin leaders, you prioritize busy-work over profit.

### ✗ Bad
"Service packages sold $500 total, but widget bundles sold $2000. Push widgets."

### ✓ Good
"Ask: Which brings in the most profit per unit? Service packages might be 70% margin × $500 = $350 profit. Widget bundles might be 20% margin × $2000 = $400 profit. Different story now."

---

## Gotcha: Seasonal benchmarks that don't fit your niche

"Retail peaks in November" is true for many, but not all. A tax prep service peaks in March; a swimming pool company peaks in May.

**Why it matters:** Generic benchmarks steer you wrong. Always ask the user: "Does this seasonality match your reality?"

### ✗ Bad
"Industry benchmarks say Q4 is peak retail. You're a pool company. Push hard in Q4 anyway."

### ✓ Good
"Pool companies peak May–August. Q4 benchmarks don't apply. Confirm with user: 'Do your sales match May–August peak?'"

---

## Gotcha: Missing the composite picture

"What's selling" can mean by revenue, margin, velocity, customer lifetime value, or retention. Different metrics tell different stories.

**Why it matters:** Pick the wrong metric and you prioritize products that look good once but don't deliver repeat customers.

### ✗ Bad
Assume "top seller" = highest revenue. Rank by revenue only.

### ✓ Good
"How do you measure success? Revenue? Profit? Customer lifetime value? Repeat purchases?" Then rank by their chosen metric — or combine multiple metrics for balance.

---

## Gotcha: Not accounting for inventory constraints

A product might be flying off the shelves, but if inventory is low, pushing hard could create stockouts and frustration.

**Why it matters:** You want to drive sales, not broken customer experiences.

### ✗ Bad
"Widget sales are strong. Push widgets harder."

### ✓ Good
"Widget sales are strong, but inventory is down to 5 units. Flag: 'Before pushing, confirm inventory. Consider promoting a similar alternative or pausing until restock.'"

---

## Gotcha: Expecting the alipay connector to export transaction history

The plugin's alipay connector creates payment links, queries a single payment by order number, and processes refunds. It cannot list or export transactions, settlements, or bills.

**Why it matters:** If you try to "pull sales data from Alipay" via the connector, there is no tool for it — and querying orders one-by-one only works if you already know every order number, which defeats the purpose.

### ✗ Bad
User: "What should I post?"
Skill: [tries to fetch transaction history through the alipay connector] → no such tool → dead end, or worse, fabricated numbers

### ✓ Good
User: "What should I post?"
Skill: "I'll need your sales data as an export — log into 支付宝商家平台 and download the bill/transaction CSV for the last 90 days (微信支付商户平台 has the same export if you take WeChat Pay), or export revenue-by-product from 用友好会计/金蝶精斗云. A pasted report works too."
User: [provides file or pastes data]
Skill: [parses and analyzes]

---

## Gotcha: Payment-platform exports don't map cleanly to your product catalog

Alipay/WeChat Pay bill exports are per-transaction, and the order-title column (商品名称/订单标题) often carries checkout strings, not catalog names — and the export misses cash and other-channel sales entirely.

**Why it matters:** Grouping by raw order titles splits one product into five rows (or merges five products into one), and treating a payment-platform export as total revenue understates products that sell offline. The ranking — the whole point of the brief — comes out wrong.

### ✗ Bad
Group the Alipay CSV by the raw title column → "亚麻连衣裙-M-米白" and "亚麻连衣裙 M码" ranked as two different products → neither makes the top 5.

### ✓ Good
Normalize titles into catalog products, confirm ambiguous groupings with the owner ("are these all the linen midi?"), and prefer the accounting-software export (用友好会计/金蝶精斗云) for item names and margins. State the coverage gap in the brief: "Based on 支付宝商家平台 export — excludes cash sales."
