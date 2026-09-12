/**
 * First-party local MCP baseline.
 *
 * v1 (2026-08-22 health audit) published exactly one locally bundled MCP server
 * because generation-1 hosts execute `.mcp.json` directly and understood neither
 * a connector catalog nor release leases.
 *
 * v2 (2026-09-12, three-repo root-cause remediation, decision D-0(c)) widens the
 * allow list to the two *first-party* servers that ship their own prebuilt
 * artifact inside the plugin and speak stdio to a sibling process: html-video
 * and media-ops. Nothing else changes — the remaining 41 connectors stay paused,
 * remote/SSE transport stays forbidden, and every allowed server must still be
 * fully pinned, install nothing on launch and reference a committed artifact.
 *
 * media-ops additionally injects its trusted local principal from host
 * `user_config`, so an allowed plugin's `.mcp.json` may only reference
 * `${user_config.X}` keys the manifest declares as `required: true` (the host
 * throws on substitution when a value is missing and never writes `default`).
 */

export const MCP_SAFE_BASELINE_ID = "mcp-safe-baseline-v2-first-party-local";

/** pluginId → the single stdio server name that plugin may publish. */
export const MCP_ALLOWED_LOCAL_SERVERS: ReadonlyMap<string, string> = new Map([
  ["crabcode-html-video", "html-video"],
  ["crabcode-media-ops", "mediaops"],
]);

export const MCP_ALLOWED_PLUGIN_SET: ReadonlySet<string> = new Set(
  MCP_ALLOWED_LOCAL_SERVERS.keys(),
);

/**
 * v1 aliases, kept because scripts and tests still name the html-video sidecar
 * through them. New code should read MCP_ALLOWED_LOCAL_SERVERS.
 */
export const MCP_ALLOWED_PLUGIN = "crabcode-html-video";
export const MCP_ALLOWED_SERVER = "html-video";

/** Stable user-facing disclosure required on every paused marketplace entry. */
export const MCP_PAUSED_MARKETPLACE_MARKER =
  "安全状态：本版本不发布可执行 MCP 配置；安装不会启动该服务或发起网络请求。";

/**
 * Every marketplace plugin that shipped `.mcp.json` immediately before the
 * containment release and is still paused under v2.
 */
export const MCP_PAUSED_PLUGINS = [
  "asana",
  "clangd-lsp",
  "context7",
  "crabcode-example-plugin",
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
