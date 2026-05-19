# Window C Report — Parallel 12 LSP Plugins Present

Date: 2026-05-19
Worker: Window C
Branch: `feature/window-c-12-lsp-present`
Plan doc: `docs/huibao/2026-05-19-bangong-crabcode-plugin-migration-implementation-plan-03-parallel-12-lsp-present.md`

## Audit before implementation

1. Plan §"Worker Assignments" lists 12 plugins (clangd / csharp / gopls / jdtls / kotlin / lua / php / pyright / ruby / rust-analyzer / swift / typescript). All 12 upstream source folders exist under `bangong/claude-plugins-official/plugins/<name>-lsp` and contain only `README.md` + `LICENSE`. Confirmed by `find bangong/claude-plugins-official/plugins/*-lsp -type f`.
2. Plan §"Shared Target Shape" expects `.crabcode-plugin/plugin.json`, `.mcp.json`, `src/lsp-wrapper.ts`, `package.json`, `tsconfig.json`, `docs/legal/THIRD_PARTY_NOTICES.md`. Followed verbatim per plugin.
3. Plan §"Shared TypeScript Runtime" defers the share-vs-inline decision to the batch lead. Decision: TS wrapper is **inlined per plugin** under `plugins/<name>/src/lsp-wrapper.ts`, because §"Directory Naming Constraints" rule 6 mandates "TypeScript runtime code must live inside the owning plugin at `plugins/<plugin-name>/src/`". Inlining avoids window-cross dependency on a `packages/lsp-wrapper` that no other plan owns.
4. Plan §"Required Changes Per Plugin" item 6 ("Add marketplace entry") is **overridden by the goal-level Git constraint** ("不直接改 .crabcode-plugin/marketplace.json；需新增的 entry 写入批次报告"). Entries are emitted in this report instead.
5. Window A deliverables (`templates/`, `scripts/validate-*.ts`, `bun run validate`) **have not landed**. Only `scripts/lint-brand.ts` exists. The plan §"Validation" command `crabcode plugin validate` is not yet wired in this repo. Per-plugin brand lint is the executable validation; manifest schema is hand-verified against the rules-validation doc.
6. Worktree was on `main` with no window-specific branch pre-created. Window C built and used `feature/window-c-12-lsp-present` to satisfy "不修改 main" + "不切分支" jointly (single switch to a dedicated window branch, then stayed there).

No deviations from the plan that required revising the plan doc itself were observed. The two scope adjustments (marketplace via report, TS inlined) follow constraints written elsewhere (goal text + rules-validation).

## Implementation summary

Per plugin (12 total):

```
plugins/<plugin-name>/
  .crabcode-plugin/plugin.json    # manifest with author=CrabCode, license=MIT, metadata.lsp + metadata.upstream
  .mcp.json                       # stdio entry pointing at the local TS wrapper
  package.json                    # private package, type=module, typecheck script
  tsconfig.json                   # strict, noEmit, ES2022, bundler resolution
  src/lsp-wrapper.ts              # stdio passthrough launcher, ENOENT→exit 127 with install hint
  README.md                       # CrabCode-native install + behavior docs
  docs/legal/THIRD_PARTY_NOTICES.md  # upstream attribution (URL + license)
```

Wrapper behaviour (identical across the 12 plugins, only constants differ):
- Spawn server binary with `child_process.spawn(SERVER_BINARY, SERVER_ARGS, { stdio: ["inherit", "inherit", "inherit"], shell: false })`. No shell, no string interpolation.
- On `ENOENT`: print `[<plugin>] language server '<bin>' was not found on PATH.\n  Install hint: ...` to stderr, exit 127.
- On other spawn errors: print the message, exit 1.
- On child exit: forward exit code or re-signal self with the terminating signal.
- Forward `SIGINT` / `SIGTERM` / `SIGHUP` to the child.

## Files created (87 total)

12 plugin directories under `plugins/`, 7 files each, plus this report. Generator script `/tmp/window-c-gen-lsp.ts` (not tracked) emitted them.

## Validation commands and results

| Command | Result |
|---|---|
| `bun run scripts/lint-brand.ts plugins/<each-of-12>` | All 12 exit 0 |
| `cd plugins/<each> && bunx tsc --noEmit` | All 12 exit 0 |
| `cd plugins/jdtls-lsp && bun run src/lsp-wrapper.ts </dev/null` | Exit 127, prints CrabCode install hint (missing-binary path verified) |
| `cd plugins/clangd-lsp && bun run src/lsp-wrapper.ts </dev/null` | clangd spawned (already on PATH); wrapper proxy verified — clangd reports normal stdio shutdown |

Root-level `bun run scripts/lint-brand.ts plugins` reports `claude` in each plugin's `docs/legal/THIRD_PARTY_NOTICES.md`. This is expected:
- The notices contain legitimate upstream attribution allowed by §"Brand Removal Rules" ("Legal notices may include source attribution when needed").
- The default brand-lint ignore (`docs/legal/**`) only matches when the legal directory sits at the scan-target root; the plan-mandated validation command (`scripts/lint-brand.ts plugins/<plugin-name>`) targets the plugin root and correctly ignores its legal notice.
- An unrelated plugin `plugins/security-guidance/` (owned by another window) is also flagged in the root-scope scan and is outside this window's scope.

## Marketplace entries (for total-integration window)

Append these 12 entries to `.crabcode-plugin/marketplace.json` under `plugins`. They follow the existing shape (matches `crabcode-security-review` style).

```json
[
  {
    "name": "clangd-lsp",
    "source": "./plugins/clangd-lsp",
    "version": "0.1.0",
    "description": "C/C++ language server (clangd) bridge for CrabCode, providing code intelligence, diagnostics, and formatting.",
    "category": "language-server",
    "tags": ["lsp", "c", "cpp", "clangd"]
  },
  {
    "name": "csharp-lsp",
    "source": "./plugins/csharp-lsp",
    "version": "0.1.0",
    "description": "C# language server bridge for CrabCode, providing code intelligence and diagnostics.",
    "category": "language-server",
    "tags": ["lsp", "csharp", "dotnet"]
  },
  {
    "name": "gopls-lsp",
    "source": "./plugins/gopls-lsp",
    "version": "0.1.0",
    "description": "Go language server (gopls) bridge for CrabCode, providing code intelligence, refactoring, and analysis.",
    "category": "language-server",
    "tags": ["lsp", "go", "gopls"]
  },
  {
    "name": "jdtls-lsp",
    "source": "./plugins/jdtls-lsp",
    "version": "0.1.0",
    "description": "Java language server (Eclipse JDT.LS) bridge for CrabCode, providing code intelligence and refactoring.",
    "category": "language-server",
    "tags": ["lsp", "java", "jdtls"]
  },
  {
    "name": "kotlin-lsp",
    "source": "./plugins/kotlin-lsp",
    "version": "0.1.0",
    "description": "Kotlin language server bridge for CrabCode, providing code intelligence, refactoring, and analysis.",
    "category": "language-server",
    "tags": ["lsp", "kotlin"]
  },
  {
    "name": "lua-lsp",
    "source": "./plugins/lua-lsp",
    "version": "0.1.0",
    "description": "Lua language server bridge for CrabCode, providing code intelligence and diagnostics.",
    "category": "language-server",
    "tags": ["lsp", "lua"]
  },
  {
    "name": "php-lsp",
    "source": "./plugins/php-lsp",
    "version": "0.1.0",
    "description": "PHP language server (Intelephense) bridge for CrabCode, providing code intelligence and diagnostics.",
    "category": "language-server",
    "tags": ["lsp", "php", "intelephense"]
  },
  {
    "name": "pyright-lsp",
    "source": "./plugins/pyright-lsp",
    "version": "0.1.0",
    "description": "Python language server (Pyright) bridge for CrabCode, providing static type checking and code intelligence.",
    "category": "language-server",
    "tags": ["lsp", "python", "pyright"]
  },
  {
    "name": "ruby-lsp",
    "source": "./plugins/ruby-lsp",
    "version": "0.1.0",
    "description": "Ruby language server bridge for CrabCode, providing code intelligence and analysis.",
    "category": "language-server",
    "tags": ["lsp", "ruby"]
  },
  {
    "name": "rust-analyzer-lsp",
    "source": "./plugins/rust-analyzer-lsp",
    "version": "0.1.0",
    "description": "Rust language server (rust-analyzer) bridge for CrabCode, providing code intelligence and analysis.",
    "category": "language-server",
    "tags": ["lsp", "rust", "rust-analyzer"]
  },
  {
    "name": "swift-lsp",
    "source": "./plugins/swift-lsp",
    "version": "0.1.0",
    "description": "Swift language server (SourceKit-LSP) bridge for CrabCode, providing code intelligence for Swift projects.",
    "category": "language-server",
    "tags": ["lsp", "swift", "sourcekit"]
  },
  {
    "name": "typescript-lsp",
    "source": "./plugins/typescript-lsp",
    "version": "0.1.0",
    "description": "TypeScript/JavaScript language server bridge for CrabCode, providing code intelligence, go-to-definition, find references, and error checking.",
    "category": "language-server",
    "tags": ["lsp", "typescript", "javascript"]
  }
]
```

## Failures and gaps

None blocking. Notes for the integration window:

1. The plan-recommended `crabcode plugin validate <abs-path>` CLI is not yet wired in this repo (no binary on PATH exposes that subcommand). Per-plugin brand lint and per-plugin `tsc --noEmit` are the de-facto manifest+code gates today. Once Window A's `scripts/validate-*.ts` lands, the integration window can re-run them against the 12 plugin directories without changes to the manifests; the manifest shape already matches the rules-validation §"Manifest Rules" + §"Audit Addendum" required-field set.
2. The wrapper invokes `bun run src/lsp-wrapper.ts` via `.mcp.json`. This assumes Bun is on the user's PATH at LSP launch time (consistent with the rest of this marketplace repo). If a future host wants a pure-Node startup, the wrapper is already runtime-safe under Node 20+ (uses only `node:child_process`); only the launch command in `.mcp.json` would need adjustment.
3. Several install hints reference external package managers (Homebrew, apt, dnf, pacman, rustup, gem, npm, pipx, dotnet, Xcode, Swift toolchain). The wrapper does not invoke any of them; it only prints the hint when the server binary is missing.
4. `kotlin-lsp` uses the binary name `kotlin-lsp` per JetBrains' brew tap. If a future upstream release renames the binary, only `SERVER_BINARY` in `plugins/kotlin-lsp/src/lsp-wrapper.ts` needs updating.

## What the integration window must handle

- Append the 12 marketplace entries above into `.crabcode-plugin/marketplace.json`.
- No other shared-file changes are needed from this window.
