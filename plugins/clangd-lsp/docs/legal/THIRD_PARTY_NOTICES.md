# Third-Party Notices — clangd-lsp

This plugin invokes the following third-party software at runtime. The software is not bundled, only spawned as a child process when present on the user's PATH.

## clangd

- Upstream: https://clangd.llvm.org/
- License: Apache-2.0 WITH LLVM-exception

This CrabCode plugin only ships a thin TypeScript launcher (`src/lsp-wrapper.ts`). The launcher is original code authored for CrabCode and is licensed under the MIT License terms of this plugin.

This plugin was migrated from the upstream legacy-branded `clangd-lsp` source at `bangong/legacy-plugins-official/plugins/clangd-lsp`. The upstream README and LICENSE files are not redistributed in this product; only the plugin name and metadata describing the wrapped server are retained.
