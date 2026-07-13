---
name: Word 文档
short-description: "创建、编辑、修订并规范排版 Word 文档"
brand-color: "#3578E5"
icon-small: "./assets/icon.png"
icon-large: "./assets/icon.png"
description: "Create, read, edit, or restructure Word documents (.docx): headings, tables of contents, tracked changes, memos, letters, reports. 中文场景:Word 文档、合同文书、法律备忘录、审查报告、纪要决议等成文交付。Trigger on \"word doc\", \".docx\", or any professional document file request."
license: Apache-2.0. See docs/legal/THIRD_PARTY_NOTICES.md for source attribution.
---

# Word Document Workflows

## Purpose

This skill guides any task that produces or modifies a Microsoft Word
document. The deliverable must be a `.docx` file on disk.

## File Model

A `.docx` file is a ZIP archive of XML parts. Two distinct strategies are
needed depending on the situation:

- **Authoring a new document**: use a programmatic library that emits the
  full OOXML payload for you.
- **Editing an existing document**: unpack the archive, mutate the XML in
  place, and repack so that you preserve the original styles and any
  user-authored content that the library does not expose.

## Recommended Library Stack

- `docx` (the npm package, sometimes called `docx-js`): primary authoring
  surface in TypeScript.
- `jszip`: low-level archive read and write for in-place edits.
- `fast-xml-parser` and `@xmldom/xmldom`: OOXML traversal and mutation.
- A LibreOffice or Word adapter: legacy `.doc` to `.docx` conversion,
  rendering to PDF, accepting tracked changes.

The CrabCode office suite TypeScript runtime under
`plugins/crabcode-office-suite/src/docx/` declares the stable surface that
adapters can plug into.

## Reading Existing Documents

Two complementary tools:

- A pandoc-based extractor: best for prose text and to compare tracked
  changes against a baseline.
- An OOXML unpacker: best for structural inspection or any change that the
  high-level library cannot express, such as advanced numbering, custom
  XML parts, or content controls.

When the user asks for text content, prefer the extractor. When the user
asks for structural edits, prefer unpack-edit-repack.

## Creating New Documents

Use the `docx` library to assemble the document. The typical flow is:

1. Build a `Document` value whose sections contain the desired children
   (paragraphs, tables, headers, footers).
2. Pack the document to a `Buffer` using the library's packer.
3. Write the buffer to disk.
4. Validate the resulting file with an OOXML validator. If validation
   fails, fall back to unpack-edit-repack to fix the offending XML and
   re-archive the file.

Always include the smallest viable set of imports from the `docx` package.
A typical authoring module imports `Document`, `Packer`, `Paragraph`,
`TextRun`, plus the structural pieces it actually uses.

### Style Conventions

- Default body font is the user's preference; if unspecified, use a
  professional serif (Times New Roman or Georgia) or sans-serif (Arial or
  Calibri) consistently.
- Heading hierarchy must use `HeadingLevel` so that downstream tools can
  build a table of contents.
- Tables must declare cell widths explicitly.
- Page numbers, headers, and footers should be added through
  `Header`/`Footer` blocks, not through manual paragraph insertion.

## Editing Existing Documents

The `docx` library does not round-trip every feature. For complex edits,
unpack the archive and operate on the XML:

1. Unzip the `.docx` to a temporary directory.
2. Load `word/document.xml` and any related parts (such as
   `word/styles.xml`, `word/numbering.xml`, header and footer parts) with
   `@xmldom/xmldom` or `fast-xml-parser`.
3. Apply the edits.
4. Serialize the XML back to string form.
5. Repack the directory into a new ZIP archive.
6. Validate the file.

Common edit cases:

- **Find and replace** in body text: traverse `<w:t>` nodes and replace
  text content, taking care to merge adjacent runs when the replacement
  spans run boundaries.
- **Insert images**: add the media part to the archive, register it with
  the document's relationship file, and emit a `<w:drawing>` element.
- **Modify tracked changes**: process `<w:ins>` and `<w:del>` blocks. To
  accept all tracked changes, drop `<w:del>` content and unwrap `<w:ins>`.

## Tables of Contents

Word builds the table of contents at open time. Emit the field skeleton
through the library and ensure the document is opened with the user's
copy of Word or LibreOffice if a fully populated TOC is required. Some
PDF rendering pipelines need a pre-populated TOC; document this caveat
when relevant.

## Validation

Every produced document must pass OOXML validation before delivery.
Common failures and their fixes:

- **Schema violation in `word/document.xml`**: usually caused by emitting
  an attribute on an element that does not accept it. Inspect the
  offending element and consult the OOXML reference.
- **Broken relationship**: a referenced part is missing or misnamed.
  Verify the `word/_rels/document.xml.rels` file.
- **Content type missing**: ensure every part has an entry in
  `[Content_Types].xml`.

## Conversion Between Formats

- `.doc` to `.docx`: rely on a LibreOffice adapter. Legacy binary
  documents cannot be opened by the `docx` library directly.
- `.docx` to PDF: rely on a LibreOffice adapter or a paid Word adapter.
- `.docx` to Markdown: pandoc with `--track-changes=all` to capture
  tracked changes for review.

## Code Style

- Keep authoring code declarative. Build helper functions that map plain
  data structures into the library's element types.
- Validate inputs early; do not let invalid input propagate into the
  document and surface as an opaque OOXML error.
- Avoid unbounded string concatenation when building XML; prefer the DOM
  helpers or template tags that escape user content.
- Comment any non-obvious XML manipulation, especially relationship-file
  edits, so that maintainers can understand intent.
