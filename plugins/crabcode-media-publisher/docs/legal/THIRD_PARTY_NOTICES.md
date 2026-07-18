# Third-Party Notices

This plugin's runtime UI contains no remote runtime assets. Local Markdown and HTML imports use the unified/remark/rehype ecosystem to parse and sanitize untrusted document content.

Runtime document processing:

- unified, remark, rehype, micromark, mdast and hast utilities (including `hast-util-to-mdast`), MIT License.
- `rehype-sanitize`, MIT License; raw HTML is disabled before the allowlist sanitation stage.

Development and acceptance tooling:

- Playwright, Apache License 2.0.
- axe-core / `@axe-core/playwright`, Mozilla Public License 2.0.
- Nu Html Checker / `vnu-jar`, MIT License; see the package and upstream project notices.
- TypeScript, Apache License 2.0.

No Apple design-kit assets or SF Symbols are redistributed. The UI uses the local system font stack and independently authored SVG paths.
