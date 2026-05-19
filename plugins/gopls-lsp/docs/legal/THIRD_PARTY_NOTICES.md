# Third-Party Notices — gopls-lsp

This plugin invokes the following third-party software at runtime. The software is not bundled, only spawned as a child process when present on the user's PATH.

## gopls

- Upstream: https://pkg.go.dev/golang.org/x/tools/gopls
- License: BSD-3-Clause

This CrabCode plugin only ships a thin TypeScript launcher (`src/lsp-wrapper.ts`). The launcher is original code authored for CrabCode and is licensed under the MIT License terms of this plugin.

This plugin was migrated from the upstream Claude-branded `gopls-lsp` source at `bangong/claude-plugins-official/plugins/gopls-lsp`. The upstream README and LICENSE files are not redistributed in this product; only the plugin name and metadata describing the wrapped server are retained.
