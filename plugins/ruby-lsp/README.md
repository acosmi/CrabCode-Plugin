# ruby-lsp

Ruby language server bridge for CrabCode, providing code intelligence and analysis.

This plugin is a CrabCode wrapper around the upstream ruby-lsp language server. It does **not** install the server for you. The TypeScript launcher at `src/lsp-wrapper.ts` spawns `ruby-lsp` over stdio with no shell interpolation, forwards lifecycle signals, and emits an install hint when the binary is missing.

## Supported Extensions

`.rb`, `.rake`, `.gemspec`, `.ru`, `.erb`

## Installation

### RubyGems (recommended)

```bash
gem install ruby-lsp
```

### Bundler

```bash
# In Gemfile:
# gem 'ruby-lsp', group: :development
bundle install
```

## Requirements

- Ruby 3.0 or later.

## Usage

After installing ruby-lsp, register this plugin with CrabCode. The runtime entry is declared in `.mcp.json` and starts the wrapper via `bun run src/lsp-wrapper.ts`. The wrapper proxies LSP traffic between the CrabCode host and the upstream server.

If `ruby-lsp` is missing from `PATH`, the wrapper exits with status 127 and prints an install hint to stderr.

## Upstream

- Project: [ruby-lsp](https://github.com/Shopify/ruby-lsp)
- License: MIT

See [`docs/legal/THIRD_PARTY_NOTICES.md`](docs/legal/THIRD_PARTY_NOTICES.md) for full attribution.
