import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Repo-wide MCP contract checks (audit 2026-07-18 §8.5).
 *
 * Hard rules apply to every plugin; legacy findings that predate the contract
 * are frozen in shrink-only baselines: existing entries downgrade to warnings,
 * NEW violations and stale baseline entries are errors. That ratchets the repo
 * toward the contract without rewriting 30+ plugins in one batch.
 */

export type McpContractIssue = {
  severity: "error" | "warning";
  path: string;
  message: string;
};

/** Raw LSP byte-stream proxies mis-filed as MCP servers; migration to a host .lsp.json declaration is pending host schema. */
const LSP_PROXY_BASELINE = new Set([
  "clangd-lsp", "csharp-lsp", "gopls-lsp", "jdtls-lsp", "kotlin-lsp", "lua-lsp",
  "php-lsp", "pyright-lsp", "ruby-lsp", "rust-analyzer-lsp", "swift-lsp", "typescript-lsp",
]);

/** Channel-notification plugins whose manifests still lack the newer channels declaration. */
const CHANNEL_DECLARATION_BASELINE = new Set(["discord", "fakechat", "imessage", "telegram"]);

/** Plugins whose sidecar start script still runs an installer (forbidden for anything required/auto-activated). */
const INSTALL_ON_START_BASELINE = new Set(["discord", "fakechat", "imessage", "telegram"]);

/** crabwork connectors shipped with empty placeholder URLs. */
const EMPTY_URL_BASELINE = new Set([
  "crabwork-bio-research", "crabwork-customer-support", "crabwork-data", "crabwork-design",
  "crabwork-engineering", "crabwork-enterprise-search", "crabwork-hr", "crabwork-marketing",
  "crabwork-operations", "crabwork-product-management", "crabwork-productivity", "crabwork-sales",
]);

/** Plugins with floating (@latest / versionless npx / unpinned git) launcher versions. */
const FLOATING_VERSION_BASELINE = new Set([
  "context7", "firebase", "playwright", "serena", "crabwork-small-business",
]);

type ServerDefinition = {
  command?: unknown;
  args?: unknown;
  url?: unknown;
  type?: unknown;
  env?: unknown;
};

function parseServers(parsed: unknown): Record<string, ServerDefinition> | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  const wrapped = record.mcpServers;
  const source = wrapped && typeof wrapped === "object" && !Array.isArray(wrapped)
    ? wrapped as Record<string, unknown>
    : record;
  const servers: Record<string, ServerDefinition> = {};
  for (const [name, definition] of Object.entries(source)) {
    if (!definition || typeof definition !== "object" || Array.isArray(definition)) return null;
    servers[name] = definition as ServerDefinition;
  }
  return servers;
}

async function readJson(filePath: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

function serverArgStrings(definition: ServerDefinition): string[] {
  const parts: string[] = [];
  if (typeof definition.command === "string") parts.push(definition.command);
  if (Array.isArray(definition.args)) {
    for (const value of definition.args) if (typeof value === "string") parts.push(value);
  }
  return parts;
}

function hasFloatingVersion(parts: string[]): boolean {
  const joined = parts.join(" ");
  if (joined.includes("@latest")) return true;
  if (joined.includes("git+") && !/#[0-9a-f]{7,40}/.test(joined)) return true;
  // npx/uvx launching a scoped package without a version downloads whatever is newest.
  if (/\b(?:npx|uvx)\b/.test(joined)) {
    const scopedPackages = parts.filter((part) => part.startsWith("@") && part.includes("/"));
    if (scopedPackages.some((name) => !name.includes("@", 1))) return true;
  }
  return false;
}

export async function validateMcpContract(root: string): Promise<McpContractIssue[]> {
  const issues: McpContractIssue[] = [];
  const pluginsRoot = path.join(root, "plugins");
  let entries: string[] = [];
  try {
    entries = (await readdir(pluginsRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return issues;
  }

  const marketplace = await readJson(path.join(root, ".crabcode-plugin", "marketplace.json")) as
    | { plugins?: Array<{ name?: unknown; version?: unknown }> }
    | null;
  const marketplaceVersions = new Map<string, string>();
  for (const entry of marketplace?.plugins ?? []) {
    if (typeof entry.name === "string" && typeof entry.version === "string") marketplaceVersions.set(entry.name, entry.version);
  }

  const triggeredBaselines = {
    lsp: new Set<string>(),
    channel: new Set<string>(),
    install: new Set<string>(),
    emptyUrl: new Set<string>(),
    floating: new Set<string>(),
  };

  for (const pluginName of entries) {
    const pluginRoot = path.join(pluginsRoot, pluginName);
    const mcpPath = path.join(pluginRoot, ".mcp.json");
    if (!existsSync(mcpPath)) continue;
    const relativeMcp = path.relative(root, mcpPath);

    const parsed = await readJson(mcpPath);
    const servers = parsed === null ? null : parseServers(parsed);
    if (!servers) {
      issues.push({ severity: "error", path: relativeMcp, message: "invalid .mcp.json: expected wrapped mcpServers or a bare server map of objects" });
      continue;
    }

    const manifestPath = existsSync(path.join(pluginRoot, ".crabcode-plugin", "plugin.json"))
      ? path.join(pluginRoot, ".crabcode-plugin", "plugin.json")
      : path.join(pluginRoot, "plugin.json");
    const manifest = await readJson(manifestPath) as { version?: unknown; requiredMcpServers?: unknown; channels?: unknown } | null;
    if (!manifest) {
      issues.push({ severity: "error", path: relativeMcp, message: "plugin declares MCP servers but has no parseable plugin manifest" });
      continue;
    }
    const required = Array.isArray(manifest.requiredMcpServers)
      ? manifest.requiredMcpServers.filter((name): name is string => typeof name === "string")
      : [];
    for (const name of required) {
      if (!servers[name]) {
        issues.push({ severity: "error", path: path.relative(root, manifestPath), message: `requiredMcpServers entry "${name}" has no matching server in .mcp.json` });
      }
    }

    const packageJson = await readJson(path.join(pluginRoot, "package.json")) as { version?: unknown; scripts?: Record<string, unknown> } | null;
    const startScript = typeof packageJson?.scripts?.start === "string" ? packageJson.scripts.start : "";
    const startInstalls = /\b(?:bun|npm|pnpm|yarn)\s+install\b/.test(startScript);

    if (required.length > 0) {
      const manifestVersion = typeof manifest.version === "string" ? manifest.version : null;
      const packageVersion = typeof packageJson?.version === "string" ? packageJson.version : null;
      const marketVersion = marketplaceVersions.get(pluginName) ?? null;
      if (manifestVersion && packageVersion && manifestVersion !== packageVersion) {
        issues.push({ severity: "error", path: path.relative(root, manifestPath), message: `required-MCP plugin version mismatch: manifest=${manifestVersion}, package.json=${packageVersion}` });
      }
      if (manifestVersion && marketVersion && manifestVersion !== marketVersion) {
        issues.push({ severity: "error", path: path.relative(root, manifestPath), message: `required-MCP plugin version mismatch: manifest=${manifestVersion}, marketplace=${marketVersion}` });
      }
    }

    for (const [serverName, definition] of Object.entries(servers)) {
      const parts = serverArgStrings(definition);
      const joined = parts.join(" ");
      const isRequired = required.includes(serverName);
      const url = typeof definition.url === "string" ? definition.url : null;

      // Raw LSP byte-stream proxies do not speak MCP initialize/tools-list.
      if (joined.includes("lsp-wrapper")) {
        if (LSP_PROXY_BASELINE.has(pluginName)) {
          triggeredBaselines.lsp.add(pluginName);
          issues.push({ severity: "warning", path: relativeMcp, message: `raw LSP proxy "${serverName}" is mis-filed as an MCP server (legacy baseline; migrate to a host LSP declaration, never mark it required)` });
        } else {
          issues.push({ severity: "error", path: relativeMcp, message: `raw LSP proxy "${serverName}" must not be declared in .mcp.json (it has no MCP handshake)` });
        }
        continue;
      }

      if (url !== null && url.trim() === "") {
        if (EMPTY_URL_BASELINE.has(pluginName)) {
          triggeredBaselines.emptyUrl.add(pluginName);
          issues.push({ severity: "warning", path: relativeMcp, message: `server "${serverName}" has an empty placeholder URL (legacy baseline; fill in or remove the connector)` });
        } else {
          issues.push({ severity: "error", path: relativeMcp, message: `server "${serverName}" has an empty URL; executable config must not ship unset endpoints` });
        }
      }

      if (hasFloatingVersion(parts)) {
        if (FLOATING_VERSION_BASELINE.has(pluginName) && !isRequired) {
          triggeredBaselines.floating.add(pluginName);
          issues.push({ severity: "warning", path: relativeMcp, message: `server "${serverName}" launches a floating version (@latest/unpinned) — legacy baseline; pin before any auto-activation` });
        } else {
          issues.push({ severity: "error", path: relativeMcp, message: `server "${serverName}" launches a floating version (@latest/unpinned); ${isRequired ? "required servers must be fully pinned" : "pin the launcher version"}` });
        }
      }

      const runsStartScript = joined.includes(" start") || (Array.isArray(definition.args) && (definition.args as unknown[]).includes("start"));
      const installsOnLaunch = /\binstall\b/.test(joined) || (runsStartScript && startInstalls);
      if (installsOnLaunch) {
        if (isRequired) {
          issues.push({ severity: "error", path: relativeMcp, message: `required server "${serverName}" runs an installer on launch; required-local sidecars must cold-start offline from a prebuilt artifact` });
        } else if (INSTALL_ON_START_BASELINE.has(pluginName)) {
          triggeredBaselines.install.add(pluginName);
          issues.push({ severity: "warning", path: relativeMcp, message: `server "${serverName}" installs dependencies on launch (legacy baseline; ship a prebuilt artifact before activation-by-default)` });
        } else {
          issues.push({ severity: "error", path: relativeMcp, message: `server "${serverName}" installs dependencies on launch; ship a prebuilt artifact instead` });
        }
      }

      if (isRequired) {
        const artifactArgs = parts.filter((part) => part.startsWith("${CRABCODE_PLUGIN_ROOT}/"));
        for (const artifact of artifactArgs) {
          const relativeArtifact = artifact.replace("${CRABCODE_PLUGIN_ROOT}/", "");
          const artifactPath = path.join(pluginRoot, relativeArtifact);
          try {
            const stats = await stat(artifactPath);
            if (!stats.isFile()) throw new Error("not a file");
          } catch {
            issues.push({ severity: "error", path: relativeMcp, message: `required server "${serverName}" references missing artifact ${relativeArtifact}; build and commit the distribution` });
          }
        }
      }
    }

    // Channel-notification implementations need a manifest channels declaration.
    const serverSource = path.join(pluginRoot, "src", "server.ts");
    if (existsSync(serverSource)) {
      const source = await readFile(serverSource, "utf8");
      if (source.includes("notifications/crabcode/channel") && manifest.channels === undefined) {
        if (CHANNEL_DECLARATION_BASELINE.has(pluginName)) {
          triggeredBaselines.channel.add(pluginName);
          issues.push({ severity: "warning", path: path.relative(root, manifestPath), message: "channel notification implementation lacks a manifest channels declaration (legacy baseline; adopt the host channel lifecycle)" });
        } else {
          issues.push({ severity: "error", path: path.relative(root, manifestPath), message: "channel notification implementation must declare channels in the plugin manifest" });
        }
      }
    }
  }

  const staleChecks: Array<[Set<string>, Set<string>, string]> = [
    [LSP_PROXY_BASELINE, triggeredBaselines.lsp, "LSP_PROXY_BASELINE"],
    [CHANNEL_DECLARATION_BASELINE, triggeredBaselines.channel, "CHANNEL_DECLARATION_BASELINE"],
    [INSTALL_ON_START_BASELINE, triggeredBaselines.install, "INSTALL_ON_START_BASELINE"],
    [EMPTY_URL_BASELINE, triggeredBaselines.emptyUrl, "EMPTY_URL_BASELINE"],
    [FLOATING_VERSION_BASELINE, triggeredBaselines.floating, "FLOATING_VERSION_BASELINE"],
  ];
  const scannedPlugins = new Set(entries);
  for (const [baseline, triggered, label] of staleChecks) {
    for (const name of baseline) {
      // A baseline entry is stale only when its plugin is present in this scan
      // yet no longer triggers — partial fixture roots must not raise it.
      if (scannedPlugins.has(name) && !triggered.has(name)) {
        issues.push({ severity: "error", path: "src/policy/mcpContractValidator.ts", message: `stale ${label} entry "${name}" no longer triggers; remove it so the baseline only shrinks` });
      }
    }
  }

  return issues;
}

export function formatMcpContractIssues(issues: McpContractIssue[], root: string): string {
  void root;
  return issues
    .map((issue) => `${issue.severity === "error" ? "ERROR" : "warn"} ${issue.path}: ${issue.message}`)
    .join("\n");
}
