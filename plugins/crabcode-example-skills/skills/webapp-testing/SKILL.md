---
name: webapp-testing
description: "Toolkit for interacting with and testing local web applications using Playwright. Use this skill to verify frontend functionality, debug UI behavior, capture browser screenshots, view browser logs, or drive an end-to-end smoke test against a local dev server."
license: Apache-2.0. See ../../docs/legal/THIRD_PARTY_NOTICES.md for source attribution.
---

# Web Application Testing

Drive Playwright scripts to interact with and test local web
applications.

**Helper scripts available**:

- `scripts/with_server.py` — manages server lifecycle, including
  multi-server scenarios.

Always run scripts with `--help` first to see usage. Do not read the
source until calling `--help` proves insufficient; these scripts can
be large and reading the source needlessly inflates context. Treat
them as black boxes.

## Decision Tree

```
User task → Is it static HTML?
    ├─ Yes → Read the HTML file to identify selectors
    │         ├─ Success → Write a Playwright script using those selectors
    │         └─ Fails or incomplete → Treat as dynamic (below)
    │
    └─ No (dynamic webapp) → Is the server already running?
        ├─ No  → Run `python scripts/with_server.py --help`
        │        then use the helper plus a simplified Playwright script
        └─ Yes → Reconnaissance-then-action:
            1. Navigate and wait for `networkidle`.
            2. Take a screenshot or inspect the DOM.
            3. Identify selectors from the rendered state.
            4. Execute actions with the discovered selectors.
```

## Example — Using `with_server.py`

Run `--help` first, then drive the helper:

**Single server.**

```bash
python scripts/with_server.py --server "npm run dev" --port 5173 \
  -- python your_automation.py
```

**Multiple servers (backend plus frontend).**

```bash
python scripts/with_server.py \
  --server "cd backend && python server.py" --port 3000 \
  --server "cd frontend && npm run dev" --port 5173 \
  -- python your_automation.py
```

Inside `your_automation.py`, include only Playwright logic; the helper
manages the servers:

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("http://localhost:5173")
    page.wait_for_load_state("networkidle")
    # ... your automation logic
    browser.close()
```

## Reconnaissance-Then-Action

1. **Inspect rendered DOM.**

   ```python
   page.screenshot(path="/tmp/inspect.png", full_page=True)
   content = page.content()
   page.locator("button").all()
   ```

2. **Identify selectors** from the screenshot or DOM dump.

3. **Execute actions** using the discovered selectors.

## Common Pitfalls

- Do not inspect the DOM before `networkidle` on dynamic apps.
- Do wait for `page.wait_for_load_state("networkidle")` before
  inspection.

## Best Practices

- Use bundled scripts as black boxes. They handle common, complex
  workflows reliably without crowding the context. Invoke with
  `--help` first; only ingest source if a customization is genuinely
  required.
- Prefer `sync_playwright()` for synchronous scripts.
- Always close the browser when done.
- Use descriptive selectors: `text=`, `role=`, CSS selectors, or
  stable IDs.
- Add appropriate waits with `page.wait_for_selector()` or
  `page.wait_for_timeout()`.

## Reference Files

- `examples/` — common patterns:
  - `element_discovery.py` — discovering buttons, links, and inputs
    on a page.
  - `static_html_automation.py` — using `file://` URLs for local
    HTML.
  - `console_logging.py` — capturing console logs during
    automation.
