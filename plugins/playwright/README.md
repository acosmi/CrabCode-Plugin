# Playwright

CrabCode integration with Microsoft's Playwright MCP server. Drive a browser
from CrabCode for end-to-end test authoring, page inspection, and automated
screenshots.

## Connect

The plugin runs `npx @playwright/mcp@latest` on stdio. Node.js and `npx` are
the only host requirements; Playwright will install browser binaries on
first run.

## What you can do

- Navigate to URLs and inspect page DOM and accessibility tree
- Fill forms, click elements, and capture screenshots
- Run scripted browser flows for end-to-end test creation
- Diagnose flaky tests by reproducing user steps

## Notes

The MCP server controls a real browser. Treat any URL it opens as you would
in a normal session — only navigate to sites you trust.
