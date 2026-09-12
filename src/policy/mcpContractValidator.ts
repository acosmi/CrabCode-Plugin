import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  MCP_ALLOWED_LOCAL_SERVERS,
  MCP_PAUSED_MARKETPLACE_MARKER,
  MCP_PAUSED_PLUGIN_SET,
} from "./mcpSafeBaseline.ts";

/**
 * Repo-wide MCP executable contract checks.
 *
 * The baseline is deliberately small: generation-1 hosts execute `.mcp.json`
 * directly, so only the fully bundled first-party local sidecars in
 * MCP_ALLOWED_LOCAL_SERVERS may ship until host-side connector profiles and
 * release gates exist.
 */

export type McpContractIssue = {
  severity: "error" | "warning";
  path: string;
  message: string;
};

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

/**
 * `${user_config.KEY}` references the host substitutes from the value the user
 * supplied for `plugin.json.userConfig[KEY]`. Substitution throws when the value
 * is missing and the host never writes the declared `default`, so an allowed
 * plugin may only reference keys it declares as `required: true`.
 */
const USER_CONFIG_REFERENCE = /\$\{user_config\.([A-Za-z0-9_]+)\}/gu;

function userConfigReferences(definition: ServerDefinition): string[] {
  const env = definition.env;
  if (!env || typeof env !== "object" || Array.isArray(env)) return [];
  const keys = new Set<string>();
  for (const value of Object.values(env as Record<string, unknown>)) {
    if (typeof value !== "string") continue;
    for (const match of value.matchAll(USER_CONFIG_REFERENCE)) keys.add(match[1]!);
  }
  return [...keys];
}

function allowedPluginList(): string {
  return [...MCP_ALLOWED_LOCAL_SERVERS.keys()].join(", ");
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
    | { plugins?: Array<{ name?: unknown; version?: unknown; longDescription?: unknown }> }
    | null;
  const marketplaceVersions = new Map<string, string>();
  const marketplaceLongDescriptions = new Map<string, string>();
  for (const entry of marketplace?.plugins ?? []) {
    if (typeof entry.name === "string" && typeof entry.version === "string") marketplaceVersions.set(entry.name, entry.version);
    if (typeof entry.name === "string" && typeof entry.longDescription === "string") {
      marketplaceLongDescriptions.set(entry.name, entry.longDescription);
    }
  }

  // A plugin states its version in up to three places, and a batch bump that
  // updates the manifest and the marketplace entry but forgets package.json
  // leaves the plugin describing two different versions of itself. This ran
  // inside the .mcp.json loop under `requiredMcpServers.length > 0`, which is
  // two plugins out of ~76 — so the identical defect elsewhere passed silently
  // until one of those plugins declared a required server. It is a per-plugin
  // rule, so it runs per plugin.
  //
  // Each comparison is skipped when a side is absent rather than reported: most
  // plugins ship no package.json, and a staged-not-active plugin is deliberately
  // missing from the active marketplace.
  for (const pluginName of entries) {
    const pluginRoot = path.join(pluginsRoot, pluginName);
    const manifestPath = existsSync(path.join(pluginRoot, ".crabcode-plugin", "plugin.json"))
      ? path.join(pluginRoot, ".crabcode-plugin", "plugin.json")
      : path.join(pluginRoot, "plugin.json");
    if (!existsSync(manifestPath)) continue;
    const manifest = await readJson(manifestPath) as { version?: unknown; requiredMcpServers?: unknown } | null;
    const manifestVersion = typeof manifest?.version === "string" ? manifest.version : null;
    if (!manifest || !manifestVersion) continue;

    const packageJson = await readJson(path.join(pluginRoot, "package.json")) as { version?: unknown } | null;
    const packageVersion = typeof packageJson?.version === "string" ? packageJson.version : null;
    if (packageVersion && manifestVersion !== packageVersion) {
      issues.push({ severity: "error", path: path.relative(root, manifestPath), message: `plugin version mismatch: manifest=${manifestVersion}, package.json=${packageVersion}` });
    }

    const marketVersion = marketplaceVersions.get(pluginName) ?? null;
    if (marketVersion && manifestVersion !== marketVersion) {
      issues.push({ severity: "error", path: path.relative(root, manifestPath), message: `plugin version mismatch: manifest=${manifestVersion}, marketplace=${marketVersion}` });
    }

    const required = Array.isArray(manifest.requiredMcpServers)
      ? manifest.requiredMcpServers.filter((name): name is string => typeof name === "string")
      : [];
    const allowedServer = MCP_ALLOWED_LOCAL_SERVERS.get(pluginName);
    if (allowedServer !== undefined) {
      if (required.length !== 1 || required[0] !== allowedServer) {
        issues.push({ severity: "error", path: path.relative(root, manifestPath), message: `MCP safe baseline requires requiredMcpServers=["${allowedServer}"]` });
      }
      if (!existsSync(path.join(pluginRoot, ".mcp.json"))) {
        issues.push({ severity: "error", path: path.relative(root, manifestPath), message: `MCP safe baseline requires the bundled ${allowedServer} .mcp.json` });
      }
    } else if (required.length > 0) {
      issues.push({ severity: "error", path: path.relative(root, manifestPath), message: `requiredMcpServers is reserved for the first-party local servers (${allowedPluginList()}) during the MCP safe baseline` });
    }

    if (MCP_PAUSED_PLUGIN_SET.has(pluginName)) {
      const description = marketplaceLongDescriptions.get(pluginName);
      if (description !== undefined && !description.includes(MCP_PAUSED_MARKETPLACE_MARKER)) {
        issues.push({ severity: "error", path: ".crabcode-plugin/marketplace.json", message: `paused MCP plugin "${pluginName}" must disclose the emergency safe-baseline status` });
      }
    }
  }

  for (const pluginName of entries) {
    const pluginRoot = path.join(pluginsRoot, pluginName);
    const mcpPath = path.join(pluginRoot, ".mcp.json");
    if (!existsSync(mcpPath)) continue;
    const relativeMcp = path.relative(root, mcpPath);

    const allowedServer = MCP_ALLOWED_LOCAL_SERVERS.get(pluginName);
    if (allowedServer === undefined) {
      issues.push({ severity: "error", path: relativeMcp, message: `MCP safe baseline permits .mcp.json only for the first-party local servers (${allowedPluginList()})` });
    }

    const parsed = await readJson(mcpPath);
    const servers = parsed === null ? null : parseServers(parsed);
    if (!servers) {
      issues.push({ severity: "error", path: relativeMcp, message: "invalid .mcp.json: expected wrapped mcpServers or a bare server map of objects" });
      continue;
    }

    const manifestPath = existsSync(path.join(pluginRoot, ".crabcode-plugin", "plugin.json"))
      ? path.join(pluginRoot, ".crabcode-plugin", "plugin.json")
      : path.join(pluginRoot, "plugin.json");
    const manifest = await readJson(manifestPath) as { version?: unknown; requiredMcpServers?: unknown; channels?: unknown; userConfig?: unknown } | null;
    if (!manifest) {
      issues.push({ severity: "error", path: relativeMcp, message: "plugin declares MCP servers but has no parseable plugin manifest" });
      continue;
    }
    const required = Array.isArray(manifest.requiredMcpServers)
      ? manifest.requiredMcpServers.filter((name): name is string => typeof name === "string")
      : [];

    const serverNames = Object.keys(servers);
    if (
      allowedServer !== undefined &&
      (serverNames.length !== 1 || serverNames[0] !== allowedServer)
    ) {
      issues.push({ severity: "error", path: relativeMcp, message: `MCP safe baseline permits exactly one server named "${allowedServer}" for ${pluginName}` });
    }
    if (allowedServer !== undefined) {
      const declared = manifest.userConfig && typeof manifest.userConfig === "object" && !Array.isArray(manifest.userConfig)
        ? manifest.userConfig as Record<string, unknown>
        : {};
      for (const definition of Object.values(servers)) {
        for (const key of userConfigReferences(definition)) {
          const field = declared[key];
          const isRequired = Boolean(field && typeof field === "object" && !Array.isArray(field) && (field as Record<string, unknown>).required === true);
          if (!isRequired) {
            issues.push({
              severity: "error",
              path: relativeMcp,
              message: `env references \${user_config.${key}} but plugin.json userConfig.${key} is not declared with required: true; the host throws on substitution when the value is missing and never writes the declared default`,
            });
          }
        }
      }
    }
    for (const name of required) {
      if (!servers[name]) {
        issues.push({ severity: "error", path: path.relative(root, manifestPath), message: `requiredMcpServers entry "${name}" has no matching server in .mcp.json` });
      }
    }

    const packageJson = await readJson(path.join(pluginRoot, "package.json")) as { version?: unknown; scripts?: Record<string, unknown> } | null;
    const startScript = typeof packageJson?.scripts?.start === "string" ? packageJson.scripts.start : "";
    const startInstalls = /\b(?:bun|npm|pnpm|yarn)\s+install\b/.test(startScript);

    for (const [serverName, definition] of Object.entries(servers)) {
      const parts = serverArgStrings(definition);
      const joined = parts.join(" ");
      const isRequired = required.includes(serverName);
      const url = typeof definition.url === "string" ? definition.url : null;

      if (url !== null || definition.type === "http" || definition.type === "sse") {
        issues.push({ severity: "error", path: relativeMcp, message: `remote/SSE server "${serverName}" is disabled by the emergency MCP safe baseline` });
      }

      // Raw LSP byte-stream proxies do not speak MCP initialize/tools-list.
      if (joined.includes("lsp-wrapper")) {
        issues.push({ severity: "error", path: relativeMcp, message: `raw LSP proxy "${serverName}" must not be declared in .mcp.json (it has no MCP handshake)` });
        continue;
      }

      if (url !== null && url.trim() === "") {
        issues.push({ severity: "error", path: relativeMcp, message: `server "${serverName}" has an empty URL; executable config must not ship unset endpoints` });
      }

      if (hasFloatingVersion(parts)) {
        issues.push({ severity: "error", path: relativeMcp, message: `server "${serverName}" launches a floating version (@latest/unpinned); ${isRequired ? "required servers must be fully pinned" : "pin the launcher version"}` });
      }

      const runsStartScript = joined.includes(" start") || (Array.isArray(definition.args) && (definition.args as unknown[]).includes("start"));
      const installsOnLaunch = /\binstall\b/.test(joined) || (runsStartScript && startInstalls);
      if (installsOnLaunch) {
        issues.push({ severity: "error", path: relativeMcp, message: `${isRequired ? "required " : ""}server "${serverName}" installs dependencies on launch; ship a prebuilt artifact instead` });
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

  }

  return issues;
}

export function formatMcpContractIssues(issues: McpContractIssue[], root: string): string {
  void root;
  return issues
    .map((issue) => `${issue.severity === "error" ? "ERROR" : "warn"} ${issue.path}: ${issue.message}`)
    .join("\n");
}
