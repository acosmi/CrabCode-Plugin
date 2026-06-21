---
name: build-dashboard
description: Build a self-contained interactive HTML dashboard with charts, filters, KPI cards, and sortable tables that opens in any browser with no server. Use when the user wants a dashboard, an executive or exec overview, a KPI scorecard, a metrics dashboard, a monitoring snapshot, or a shareable report; when turning query results or a pasted CSV into one browser-openable .html file; or for asks like "build me a dashboard", "make an interactive report", "put these charts in one page I can send around", "MRR/churn/sales dashboard", or "Chart.js dashboard with filters".
argument-hint: "<description> [data source]"
---

# /build-dashboard - Build Interactive Dashboards

> If you see unfamiliar placeholders or need to check which tools are connected, see [CONNECTORS.md](../../CONNECTORS.md).

Build a self-contained interactive HTML dashboard with charts, filters, tables, and professional styling. Opens directly in a browser -- no server or dependencies required.

## Usage

```
/build-dashboard <description of dashboard> [data source]
```

## Workflow

### 1. Understand the Dashboard Requirements

Determine:

- **Purpose**: Executive overview, operational monitoring, deep-dive analysis, team reporting
- **Audience**: Who will use this dashboard?
- **Key metrics**: What numbers matter most?
- **Dimensions**: What should users be able to filter or slice by?
- **Data source**: Live query, pasted data, CSV file, or sample data

### 2. Gather the Data

**If data warehouse is connected:**
1. Query the necessary data
2. Embed the results as JSON within the HTML file

**If data is pasted or uploaded:**
1. Parse and clean the data
2. Embed as JSON in the dashboard

**If working from a description without data:**
1. Create a realistic sample dataset matching the described schema
2. Note in the dashboard that it uses sample data
3. Provide instructions for swapping in real data

### 3. Design the Dashboard Layout

Follow a standard dashboard layout pattern:

```
┌──────────────────────────────────────────────────┐
│  Dashboard Title                    [Filters ▼]  │
├────────────┬────────────┬────────────┬───────────┤
│  KPI Card  │  KPI Card  │  KPI Card  │ KPI Card  │
├────────────┴────────────┼────────────┴───────────┤
│                         │                        │
│    Primary Chart        │   Secondary Chart      │
│    (largest area)       │                        │
│                         │                        │
├─────────────────────────┴────────────────────────┤
│                                                  │
│    Detail Table (sortable, scrollable)           │
│                                                  │
└──────────────────────────────────────────────────┘
```

**Adapt the layout to the content:**
- 2-4 KPI cards at the top for headline numbers
- 1-3 charts in the middle section for trends and breakdowns
- Optional detail table at the bottom for drill-down data
- Filters in the header or sidebar depending on complexity

### 4. Build the HTML Dashboard

Generate a single self-contained HTML file. Copy the base template, KPI, chart, filter, and table snippets from [references/code-patterns.md](references/code-patterns.md), and the CSS from [references/styling.md](references/styling.md). The file includes:

**Structure (HTML):**
- Semantic HTML5 layout
- Responsive grid using CSS Grid or Flexbox
- Filter controls (dropdowns, date pickers, toggles)
- KPI cards with values and labels
- Chart containers
- Data table with sortable headers

**Styling (CSS):**
- Professional color scheme (clean whites, grays, with accent colors for data)
- Card-based layout with subtle shadows
- Consistent typography (system fonts for fast loading)
- Responsive design that works on different screen sizes
- Print-friendly styles

**Interactivity (JavaScript):**
- Chart.js for interactive charts (included via CDN)
- Filter dropdowns that update all charts and tables simultaneously
- Sortable table columns
- Hover tooltips on charts
- Number formatting (commas, currency, percentages)

**Data (embedded JSON):**
- All data embedded directly in the HTML as JavaScript variables
- No external data fetches required
- Dashboard works completely offline

### 5. Implement Chart Types

Use Chart.js for all charts. Common dashboard chart patterns:

- **Line chart**: Time series trends
- **Bar chart**: Category comparisons
- **Doughnut chart**: Composition (when <6 categories)
- **Stacked bar**: Composition over time
- **Mixed (bar + line)**: Volume with rate overlay

Use the Chart.js integration patterns in [references/code-patterns.md](references/code-patterns.md) for each chart type.

### 6. Add Interactivity

Use the filter and interactivity patterns in [references/code-patterns.md](references/code-patterns.md) for dropdown filters, date range filters, combined filter logic, sortable tables, and chart updates.

### 7. Save and Open

1. Save the dashboard as an HTML file with a descriptive name (e.g., `sales_dashboard.html`)
2. Open it in the user's default browser
3. Confirm it renders correctly
4. Provide instructions for updating data or customizing

---

## Reference Material

The full copy-paste building blocks live in `references/`. Pull them in as you write the file:

- [references/code-patterns.md](references/code-patterns.md) -- base HTML template, KPI cards, Chart.js (line/bar/doughnut), filter controls (dropdown, date range, combined), chart-update logic, and sortable tables.
- [references/styling.md](references/styling.md) -- CSS color system (custom properties for easy brand/dark-mode swaps), layout, KPI and chart containers, filters, data table, responsive and print styles.
- [references/performance.md](references/performance.md) -- read before embedding more than ~1,000 rows: data-size guidelines, pre-aggregation pattern, and chart/DOM performance limits.

## Examples

```
/build-dashboard Monthly sales dashboard with revenue trend, top products, and regional breakdown. Data is in the orders table.
```

```
/build-dashboard Here's our support ticket data [pastes CSV]. Build a dashboard showing volume by priority, response time trends, and resolution rates.
```

```
/build-dashboard Create a template executive dashboard for a SaaS company showing MRR, churn, new customers, and NPS. Use sample data.
```

## Tips

- Dashboards are fully self-contained HTML files -- share them with anyone by sending the file
- For real-time dashboards, consider connecting to a BI tool instead. These dashboards are point-in-time snapshots
- Request "dark mode" or "presentation mode" for different styling
- You can request a specific color scheme to match your brand
