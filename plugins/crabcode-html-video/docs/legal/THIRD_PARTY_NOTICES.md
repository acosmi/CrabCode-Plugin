# Third-party notices

This plugin bundle includes or depends on these principal third-party components:

- `html-video` content-graph (Apache-2.0), vendored under `packages/content-graph/`; its license and notice are preserved beside the source.
- `hyperframes` producer (Apache-2.0), consumed as the exactly pinned `@hyperframes/producer` package.
- `@puppeteer/browsers` (Apache-2.0), used to provision the exactly pinned Chrome Headless Shell build.
- Model Context Protocol TypeScript SDK (MIT), bundled into the stdio server.
- Zod (MIT), bundled for tool input validation.
- linkedom (ISC), bundled for parsed-DOM security validation and normalization.
- esbuild JavaScript API (MIT), transitively bundled by the producer; the native esbuild binary is not shipped or used by this plain-HTML path.

The exact direct and transitive dependency graph is frozen in `bun.lock`. The vendored snapshot coordinate and synchronization policy are recorded in `packages/VENDOR-SOURCE.json`.
