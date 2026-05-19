---
name: crabcode-spreadsheets
description: "Use this skill whenever a spreadsheet file is the primary input or output. Trigger when the user wants to open, read, edit, or repair an existing .xlsx, .xlsm, .csv, or .tsv file (add columns, compute formulas, format cells, build charts, clean messy rows). Trigger when creating a new spreadsheet from scratch or from other tabular sources. Trigger when converting between tabular formats. Trigger when the user mentions a spreadsheet file by name or path. Do not trigger when the deliverable is a word document, PDF, presentation, HTML report, standalone data pipeline, or a Google Sheets API integration even if tabular data is involved."
license: Apache-2.0. See docs/legal/THIRD_PARTY_NOTICES.md for source attribution.
---

# Spreadsheet Workflows

## Purpose

This skill guides any task that produces or modifies an Excel-compatible
spreadsheet. The deliverable must be a spreadsheet file on disk.

## Output Requirements

### Professional Typography

Use a consistent, professional font (Arial, Times New Roman, or Calibri)
across the workbook unless the user has asked for a specific font.

### Zero Formula Errors

Every workbook MUST be delivered with zero formula error cells. Errors to
watch for are `#REF!`, `#DIV/0!`, `#VALUE!`, `#N/A`, and `#NAME?`. Validate
before delivery; never hand over a file that contains any of these.

### Preserve Existing Templates

When updating an existing workbook, study and exactly match the existing
format, style, and conventions. Do not impose generic formatting on files
that already have an established pattern. Existing template conventions
always override these guidelines.

## Financial Model Conventions

Apply these unless the user specifies otherwise or an existing template
already has its own convention.

### Color Coding

- **Blue text** (RGB `0,0,255`): hardcoded inputs, including any number the
  user is expected to change for scenario analysis.
- **Black text** (RGB `0,0,0`): all formulas and calculations.
- **Green text** (RGB `0,128,0`): links pulling from other worksheets in the
  same workbook.
- **Red text** (RGB `255,0,0`): external links to other files.
- **Yellow background** (RGB `255,255,0`): assumptions that require review or
  cells that the user must update before the model is final.

### Number Formats

- **Years**: format as text strings, for example `"2024"`, not `2,024`.
- **Currency**: use `$#,##0`. Always declare units in the header, for
  example `Revenue ($mm)`.
- **Zeros**: use `#,##0;(#,##0);-` so that zeros render as `-`.
- **Percentages**: default to `0.0%` with one decimal.
- **Multiples**: use `0.0x` for ratios like EV/EBITDA or P/E.
- **Negative numbers**: use parentheses, for example `(123)`, not `-123`.

### Formula Construction

- Place every growth rate, margin, multiple, and other assumption in a
  dedicated assumption cell.
- Use cell references inside formulas instead of hard-coded numbers, for
  example `=B5*(1+$B$6)` rather than `=B5*1.05`.
- Confirm that every cell reference points to the intended cell.
- Sweep for off-by-one errors on ranges that span multiple projection
  periods.
- Confirm consistent formulas across all projection columns.
- Test with edge cases: zero values, negative numbers, large numbers.
- Verify that there are no unintended circular references.

### Documenting Hardcoded Inputs

Attach a source note next to or directly inside a hardcoded cell. Format:

```
Source: [System or Document], [Date], [Specific Reference], [URL if available]
```

Examples:

- `Source: Company 10-K, FY2024, Page 45, Revenue Note, [SEC EDGAR URL]`
- `Source: Company 10-Q, Q2 2025, Exhibit 99.1, [SEC EDGAR URL]`
- `Source: Internal pricing model, 2025-08-15, AAPL bench`

## Runtime Helpers

The `crabcode-office-suite` plugin bundles a TypeScript runtime under
`plugins/crabcode-office-suite/src/`. Use the runtime instead of an
ad-hoc Python script.

- `crabcode-office xlsx summarize <path>` — print a JSON metadata block.
- `summarize(path)` — programmatic surface for diagnostics.
- `recalculate(path)` — placeholder for engine-driven recalculation; wire an
  adapter before relying on calculated values.

### Recommended Library Stack

- `exceljs` for primary workbook authoring and editing.
- `xlsx` or `papaparse` for CSV/TSV interchange.
- A LibreOffice or Excel-engine adapter for formula recalculation. Run the
  adapter on every workbook that has formulas. Failure to recalculate leaves
  formula cells empty for downstream consumers.

### Critical Authoring Rules

Always use spreadsheet formulas instead of pre-computing values in code and
writing the result back. Hardcoding pre-computed values turns a dynamic
model into a static report and removes the user's ability to update inputs.

Wrong (do not do this):

```ts
const total = rows.reduce((acc, r) => acc + r.sales, 0);
sheet.getCell('B10').value = total;
```

Right:

```ts
sheet.getCell('B10').value = { formula: 'SUM(B2:B9)' };
```

This applies to every aggregate: totals, percentages, ratios, deltas, and
weighted averages.

## Workflow

1. Inspect the source: read the file, count sheets, capture header layout.
2. Choose the engine: `exceljs` for formulas and formatting; a CSV/TSV
   parser for flat tabular import or export.
3. Build or edit: add data, formulas, and formatting. Reference existing
   styles when modifying an existing file.
4. Save: write the workbook to disk.
5. Recalculate: drive the engine adapter so calculated values are flushed
   to disk. Skipping this step leaves consumers without values.
6. Verify: scan for error cells. If any are present, fix them and run
   recalculation again.

## Formula Verification Checklist

- Test two or three sample references before fanning out the formula to the
  whole worksheet.
- Confirm column letter mapping; for example, column 64 is `BL`, not `BK`.
- Remember that spreadsheet rows are 1-indexed.
- Guard against null or missing values before dividing.
- For financial data, check the far-right columns; full-year data often
  lives past column 50.
- Search for all occurrences when looking up a named line item, not just the
  first match.
- Verify that cross-sheet references use the correct `Sheet1!A1` form.
- Cover edge cases: zero, negative, and very large values.

## Engine Notes

- `exceljs` provides a cell-by-cell programmatic surface with formulas,
  styling, and conditional formatting.
- For very large workbooks, prefer streaming readers and writers so memory
  stays bounded.
- When reading a workbook for analysis only, request a read-only view to
  avoid accidental writes.
- Formulas authored by `exceljs` are stored as strings without computed
  results. Engine recalculation is required.

## Code Style

When writing helper scripts for spreadsheet work:

- Keep functions narrow and side-effect free where possible.
- Use descriptive but compact identifiers.
- Avoid logging that leaks user data.
- Inside the spreadsheet itself, attach comments to cells with complex
  formulas or important assumptions. Document every hardcoded source.
