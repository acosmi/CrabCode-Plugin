---
name: PDF 处理
short-description: "读取、提取、合并、拆分、加水印、填写表单与 OCR 处理 PDF"
brand-color: "#E5484D"
icon-small: "./assets/icon.png"
icon-large: "./assets/icon.png"
description: "Read, extract, merge, split, watermark, create, fill, encrypt, or OCR PDF files. 中文场景:PDF 读取与表格抽取、合并拆分、加水印、表单填写、加密解密、扫描件 OCR。Trigger whenever the user mentions a .pdf filename or asks to produce or process one."
license: Apache-2.0. See docs/legal/THIRD_PARTY_NOTICES.md for source attribution.
---

# PDF Workflows

## Purpose

This skill guides any task that produces or modifies a PDF file. The
deliverable must be a `.pdf` file on disk, an extracted artifact derived
from one, or a structured report whose primary source is one.

## Recommended Library Stack

- `pdf-lib`: primary TypeScript surface for native PDF authoring and
  editing (merge, split, rotate, annotate, simple form filling).
- `pdfjs-dist`: page rendering and text extraction.
- A `qpdf` adapter: lossless structural fixups, linearization, and
  encryption tasks that benefit from a battle-tested native tool.
- A Tesseract adapter: OCR for scanned PDFs.

The CrabCode office suite TypeScript runtime under
`plugins/crabcode-office-suite/src/pdf/` declares the stable surface that
adapters can plug into.

## Core Operations

### Reading and Extracting Text

Use `pdfjs-dist` to render each page and extract its text content. Pass
the text downstream for analysis. For scanned PDFs, route the rendered
page images through Tesseract before extraction.

### Merging PDFs

Use `pdf-lib`:

```ts
import { PDFDocument } from 'pdf-lib';
import { promises as fs } from 'node:fs';

const out = await PDFDocument.create();
for (const file of ['a.pdf', 'b.pdf']) {
  const bytes = await fs.readFile(file);
  const src = await PDFDocument.load(bytes);
  const pages = await out.copyPages(src, src.getPageIndices());
  for (const page of pages) out.addPage(page);
}
await fs.writeFile('merged.pdf', await out.save());
```

### Splitting PDFs

Load the source, iterate pages, copy each page into its own
`PDFDocument`, and write each to disk with a deterministic name such as
`page-001.pdf`.

### Rotating Pages

Use `setRotation` from `pdf-lib`. Document rotation is reversible and
non-destructive.

### Watermarking

Draw text or an image over each page with `pdf-lib`. Use a low alpha and
position the watermark consistently across pages. Preserve the original
page content beneath the watermark.

### Filling Forms

If the PDF has an AcroForm, drive `getTextField`, `getCheckBox`, etc.,
from `pdf-lib`. If the PDF embeds an XFA form, route through a qpdf or
Adobe-style adapter; `pdf-lib` does not edit XFA payloads.

### Encryption

Encryption support in `pdf-lib` is limited to read flows. For setting or
removing passwords, route through `qpdf`.

### Extracting Images

Use `pdfjs-dist` to enumerate image XObjects per page, decode them, and
write each image to disk. Image streams may be compressed; route through
the appropriate decoder before saving.

### OCR

Route rendered page images through a Tesseract adapter. Confirm DPI
before rendering; 150 DPI is a reasonable floor for body text, 300 DPI
for small print or tables.

## Workflow

1. Inspect the source: page count, encryption status, presence of forms.
2. Choose the engine: `pdf-lib` for native edits, `pdfjs-dist` for
   rendering or extraction, `qpdf` for structural fixups and security
   changes, Tesseract for OCR.
3. Execute the edit using a narrow helper that wraps the chosen engine.
4. Validate: confirm page count, spot-check rendered pages, and re-open
   the file to make sure it loads cleanly.
5. Deliver the file along with a brief report of what changed.

## Performance and Memory

PDFs can be very large. For files above a few hundred megabytes:

- Stream pages instead of loading the whole document into memory when
  the engine supports it.
- Process page ranges in batches rather than all-at-once.
- Re-encode images at moderate quality if size is a concern; record the
  trade-off in the delivery report.

## Validation

Every produced PDF should be:

- Loadable by a fresh `PDFDocument.load` call without warnings.
- Visible to the user at the expected page count.
- Free of broken references to fonts, images, or annotations.

When in doubt, render the first and last pages to PNG and visually
compare against the source.

## Code Style

- Keep PDF helpers focused on a single operation per function.
- Validate inputs (path existence, file extension, encryption status)
  before attempting an edit.
- Avoid logging the raw byte payload of a PDF; log metadata only.
- Wrap engine errors with the CrabCode `OfficeSuiteError` type so that
  callers can route on `code` rather than parse messages.
