# Content Templates Reference

Section-by-section content templates for Phase 3 (Content Generation). Pull the templates that match the structure chosen in Phase 2.

General principle for all content: reference specific pain points from user input or transcripts, use the prospect's own language, map the seller's product to the prospect's needs explicitly, include proof points where available, and make it feel tailored rather than templated.

## Section Templates

### Hero / Intro
```
Headline: "[Prospect's Goal] with [Seller's Product]"
Subhead: Tie to their stated priority or top industry challenge
Metrics: 3-4 key facts about the prospect (shows we did homework)
```

### Their Priorities (if discovery follow-up)
```
Reference specific pain points from conversation:
- Use their exact words where possible
- Show we listened and understood
- Connect each to how we help
```

### Solution Mapping
```
For each pain point:
├── The challenge (in their words)
├── How [Product] addresses it
├── Proof point or example
└── Outcome / benefit
```

### Use Cases / Demos
```
3-5 relevant use cases:
├── Visual mockup or interactive demo
├── Business impact (quantified if possible)
├── "How it works" — 3-4 step summary
└── Relevant to their industry/role
```

### ROI / Business Case
```
Interactive calculator with:
├── Inputs relevant to their business (from research)
│   ├── Number of users/developers
│   ├── Current costs or time spent
│   └── Expected improvement %
├── Outputs:
│   ├── Annual value / savings
│   ├── Cost of solution
│   ├── Net ROI
│   └── Payback period
└── Assumptions clearly stated (editable)
```

### Why Us / Differentiators
```
├── Differentiators vs. alternatives they might consider
├── Trust, security, compliance positioning
├── Support and partnership model
└── Customer proof points (logos, quotes, case studies)
```

### Next Steps / CTA
```
├── Clear action aligned to Purpose (c)
├── Specific next step (not vague "let's chat")
├── Contact information
├── Suggested timeline
└── What happens after they take action
```

## Workflow Demo Content

### Component Definitions

For each system, define:

```yaml
component:
  id: "snowflake"
  label: "Snowflake Data Warehouse"
  type: "database"  # database | api | ai | middleware | human | document | output
  icon: "database"
  description: "Financial performance data"
  brand_color: "#29B5E8"
```

**Component types:**
- `human` — Person initiating or receiving
- `document` — PDFs, contracts, files
- `ai` — AI/ML models, agents
- `database` — Data stores, warehouses
- `api` — APIs, services
- `middleware` — Integration platforms, MCP servers
- `output` — Dashboards, reports, notifications

### Flow Steps

For each step, define:

```yaml
step:
  number: 1
  from: "human"
  to: "crabcode"
  action: "Initiates performance review"
  description: "Sarah, a Brand Analyst at [Prospect], kicks off the quarterly review..."
  data_example: "Review request: Nike brand, Q4 2025"
  duration: "~1 second"
  value_note: "No manual data gathering required"
```

### Scenario Narrative

Write a clear, specific walkthrough:

```
Step 1: Human Trigger
"Sarah, a Brand Performance Analyst at Centric Brands, needs to review
Q4 performance for the Nike license agreement. She opens the review
dashboard and clicks 'Start Review'..."

Step 2: Contract Analysis
"CrabCode retrieves the Nike contract PDF and extracts the performance
obligations: minimum $50M revenue, 12% margin requirement, quarterly
reporting deadline..."

Step 3: Data Query
"CrabCode formulates a query and sends it to Workato DataGenie:
'Get Q4 2025 revenue and gross margin for Nike brand from Snowflake'..."

Step 4: Results & Synthesis
"Snowflake returns the data. CrabCode compares actuals vs. obligations:
Revenue $52.3M ✓ (exceeded by $2.3M)
Margin 11.2% ⚠️ (0.8% below threshold)..."

Step 5: Insight Delivery
"CrabCode synthesizes findings into an executive summary with
recommendations: 'Review promotional spend allocation to improve
margin performance...'"
```

## Worked Examples

### Example 1: Executive Landing Page

**Input:**
- Prospect: Acme Corp (manufacturing)
- Audience: C-suite
- Purpose: Exec alignment after discovery
- Format: Interactive landing page

**Output structure:**
```
[Tabs]
Strategic Fit | Business Impact | ROI Calculator | Security & Trust | Next Steps

[Strategic Fit tab]
- Acme's stated priorities (from discovery call)
- How [Product] aligns
- Relevant manufacturing customers
```

### Example 2: Technical Workflow Demo

**Input:**
- Prospect: Centric Brands
- Audience: IT architects
- Purpose: POC proposal
- Format: Workflow demo
- Components: CrabCode, Workato DataGenie, Snowflake, PDF contracts

**Output structure:**
```
[Interactive canvas with 5 nodes]
Human → CrabCode → PDF Contracts → Workato → Snowflake
         ↓
    [Results back to Human]

[Step-by-step walkthrough with sample data]
[Controls: Play | Pause | Step | Reset]
```

### Example 3: Sales One-Pager

**Input:**
- Prospect: TechStart Inc
- Audience: VP Engineering
- Purpose: Leave-behind after first meeting
- Format: One-pager

**Output structure:**
```
Hero: "Accelerate TechStart's Product Velocity"
Point 1: [Dev productivity]
Point 2: [Code quality]
Point 3: [Time to market]
Proof: "Similar companies saw 40% faster releases"
CTA: "Schedule technical deep-dive"
```
