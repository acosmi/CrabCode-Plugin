/**
 * Emergency executable MCP baseline established by the 2026-08-22 health audit.
 *
 * Generation-1 hosts execute `.mcp.json` directly and do not understand a
 * connector catalog or release leases. Until a host-side fail-closed loader is
 * released, the official marketplace therefore publishes exactly one locally
 * bundled MCP server and no remote/external-service connector configuration.
 */

export const MCP_SAFE_BASELINE_ID = "mcp-emergency-safe-baseline-v1";

export const MCP_ALLOWED_PLUGIN = "crabcode-html-video";
export const MCP_ALLOWED_SERVER = "html-video";

/** Stable user-facing disclosure required on every paused marketplace entry. */
export const MCP_PAUSED_MARKETPLACE_MARKER =
  "安全状态：本版本不发布可执行 MCP 配置；安装不会启动该服务或发起网络请求。";

/**
 * Every marketplace plugin that shipped `.mcp.json` immediately before the
 * containment release, except the one allowed local sidecar.
 */
export const MCP_PAUSED_PLUGINS = [
  "asana",
  "clangd-lsp",
  "context7",
  "crabcode-example-plugin",
  "crabcode-media-ops",
  "crabwork-bio-research",
  "crabwork-customer-support",
  "crabwork-data",
  "crabwork-design",
  "crabwork-engineering",
  "crabwork-enterprise-search",
  "crabwork-hr",
  "crabwork-marketing",
  "crabwork-operations",
  "crabwork-product-management",
  "crabwork-productivity",
  "crabwork-sales",
  "crabwork-small-business",
  "csharp-lsp",
  "discord",
  "fakechat",
  "firebase",
  "github",
  "gitlab",
  "gopls-lsp",
  "greptile",
  "imessage",
  "jdtls-lsp",
  "kotlin-lsp",
  "laravel-boost",
  "linear",
  "lua-lsp",
  "php-lsp",
  "playwright",
  "pyright-lsp",
  "ruby-lsp",
  "rust-analyzer-lsp",
  "serena",
  "swift-lsp",
  "telegram",
  "terraform",
  "typescript-lsp",
] as const;

export const MCP_PAUSED_PLUGIN_SET: ReadonlySet<string> = new Set(
  MCP_PAUSED_PLUGINS,
);
