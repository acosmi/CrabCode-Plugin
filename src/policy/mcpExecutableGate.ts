import { existsSync } from "node:fs";
import type { Dirent } from "node:fs";
import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import type { McpContractIssue } from "./mcpContractValidator.ts";
import {
  MCP_ALLOWED_ARTIFACTS,
  MCP_ALLOWED_CONFIG,
  MCP_ALLOWED_CONFIG_PATH,
  MCP_ALLOWED_PLUGIN,
  MCP_ALLOWED_SERVER,
  MCP_PAUSED_MARKETPLACE_MARKER,
  MCP_PAUSED_PLUGIN_SET,
} from "./mcpSafeBaseline.ts";

type ServerDefinition = {
  command?: unknown;
  args?: unknown;
  url?: unknown;
  type?: unknown;
  env?: unknown;
};

type MarketplaceEntry = {
  name?: unknown;
  source?: unknown;
  version?: unknown;
  displayName?: unknown;
  shortDescription?: unknown;
  longDescription?: unknown;
  defaultPrompt?: unknown;
  description?: unknown;
  mcpServers?: unknown;
};

type PluginRootRecord = {
  pluginRoot: string;
  publishedName?: string | undefined;
  marketplaceVersion?: string | undefined;
};

/** Git metadata and installed dependencies are not mirror payload content. */
const REPOSITORY_WALK_SKIP_DIRS = new Set([".git", "node_modules"]);

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

function relativePath(root: string, target: string): string {
  return path.relative(root, target).split(path.sep).join("/") || ".";
}

function isWithin(parent: string, child: string): boolean {
  return child === parent || child.startsWith(`${parent}${path.sep}`);
}

function manifestPathFor(pluginRoot: string): string | null {
  const canonical = path.join(pluginRoot, ".crabcode-plugin", "plugin.json");
  if (existsSync(canonical)) return canonical;
  const legacy = path.join(pluginRoot, "plugin.json");
  return existsSync(legacy) ? legacy : null;
}

function resolveMarketplaceSource(root: string, source: string): string {
  const trimmed = source.replace(/^\.\//u, "").replace(/\/+$/u, "");
  return path.resolve(root, trimmed.length === 0 ? "." : trimmed);
}

function isCanonicalLocalSource(source: string): boolean {
  if (source === "./") return true;
  if (!source.startsWith("./")) return false;
  const relative = source.slice(2);
  if (relative.length === 0 || relative.includes("\\") || relative.endsWith("/")) return false;
  const segments = relative.split("/");
  return segments.every((segment) => segment.length > 0 && segment !== "." && segment !== "..") &&
    path.posix.normalize(relative) === relative;
}

async function collectPluginRoots(
  root: string,
  realRepositoryRoot: string,
  marketplaceEntries: MarketplaceEntry[],
  issues: McpContractIssue[],
): Promise<PluginRootRecord[]> {
  const records = new Map<string, PluginRootRecord>();
  const add = (candidate: PluginRootRecord): void => {
    const resolved = path.resolve(candidate.pluginRoot);
    const previous = records.get(resolved);
    records.set(resolved, {
      pluginRoot: resolved,
      publishedName: candidate.publishedName ?? previous?.publishedName,
      marketplaceVersion: candidate.marketplaceVersion ?? previous?.marketplaceVersion,
    });
  };

  // The repository itself can be a plugin (`source: "./"`). Validate it even
  // when a malformed or partial marketplace fixture omits that source entry.
  if (manifestPathFor(root)) add({ pluginRoot: root });

  for (const entry of marketplaceEntries) {
    if (
      typeof entry.source !== "string" ||
      !isCanonicalLocalSource(entry.source)
    ) {
      const entryName = typeof entry.name === "string" ? entry.name : "<unnamed>";
      issues.push({
        severity: "error",
        path: ".crabcode-plugin/marketplace.json",
        message: `marketplace entry "${entryName}" must use a canonical in-repository local string source; external npm/pip/url/github/git sources are forbidden by the emergency MCP baseline`,
      });
      continue;
    }
    const sourceRoot = resolveMarketplaceSource(root, entry.source);
    if (!isWithin(root, sourceRoot)) {
      issues.push({
        severity: "error",
        path: ".crabcode-plugin/marketplace.json",
        message: `marketplace MCP source "${entry.source}" escapes the repository root`,
      });
      continue;
    }
    try {
      const sourceStats = await lstat(sourceRoot);
      const realSourceRoot = await realpath(sourceRoot);
      const lexicalRelative = path.relative(root, sourceRoot);
      const expectedRealSource = path.resolve(realRepositoryRoot, lexicalRelative);
      if (
        !sourceStats.isDirectory() ||
        sourceStats.isSymbolicLink() ||
        !isWithin(realRepositoryRoot, realSourceRoot) ||
        realSourceRoot !== expectedRealSource
      ) {
        throw new Error("source is a symlink, is not a directory, or resolves outside the repository");
      }
    } catch (error) {
      issues.push({
        severity: "error",
        path: ".crabcode-plugin/marketplace.json",
        message: `marketplace MCP source "${entry.source}" is not a canonical in-repository directory (${error instanceof Error ? error.message : String(error)})`,
      });
      continue;
    }
    add({
      pluginRoot: sourceRoot,
      publishedName: typeof entry.name === "string" ? entry.name : undefined,
      marketplaceVersion: typeof entry.version === "string" ? entry.version : undefined,
    });
  }

  // Direct plugin roots remain part of the validation surface for staged
  // packages and for small validator fixtures without marketplace sources.
  try {
    for (const entry of await readdir(path.join(root, "plugins"), { withFileTypes: true })) {
      if (entry.isDirectory()) {
        add({
          pluginRoot: path.join(root, "plugins", entry.name),
          publishedName: entry.name,
        });
      }
    }
  } catch {
    // The root plugin and marketplace sources above still remain enforceable.
  }

  return [...records.values()].sort((a, b) => a.pluginRoot.localeCompare(b.pluginRoot));
}

async function collectRepositoryMcpFiles(root: string): Promise<string[]> {
  const found: string[] = [];
  const pending = [root];
  while (pending.length > 0) {
    const current = pending.pop()!;
    let entries: Dirent[];
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const target = path.join(current, entry.name);
      if (entry.name === ".mcp.json" && (entry.isFile() || entry.isSymbolicLink())) {
        found.push(target);
        continue;
      }
      if (
        entry.isDirectory() &&
        !entry.isSymbolicLink() &&
        !REPOSITORY_WALK_SKIP_DIRS.has(entry.name)
      ) {
        pending.push(target);
      }
    }
  }
  return found.sort((a, b) => a.localeCompare(b));
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
  if (joined.includes("git+") && !/#[0-9a-f]{7,40}/u.test(joined)) return true;
  if (/\b(?:npx|uvx)\b/u.test(joined)) {
    const scopedPackages = parts.filter((part) => part.startsWith("@") && part.includes("/"));
    if (scopedPackages.some((name) => !name.includes("@", 1))) return true;
  }
  return false;
}

function containsMcpbReference(value: unknown): boolean {
  if (typeof value === "string") return /(?:\.mcpb|\.dxt)(?:$|[?#])/iu.test(value);
  if (Array.isArray(value)) return value.some(containsMcpbReference);
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some(containsMcpbReference);
  }
  return false;
}

async function validateOrdinaryContainedFile(
  pluginRoot: string,
  filePath: string,
  label: string,
  issuePath: string,
  issues: McpContractIssue[],
): Promise<void> {
  try {
    const fileStats = await lstat(filePath);
    if (!fileStats.isFile() || fileStats.isSymbolicLink()) {
      throw new Error("not an ordinary file");
    }
    const [realPluginRoot, realFile] = await Promise.all([
      realpath(pluginRoot),
      realpath(filePath),
    ]);
    if (!isWithin(realPluginRoot, realFile)) {
      throw new Error("realpath escapes plugin root");
    }
  } catch (error) {
    issues.push({
      severity: "error",
      path: issuePath,
      message: `${label} must be an ordinary committed file whose realpath stays inside the plugin root (${error instanceof Error ? error.message : String(error)})`,
    });
  }
}

/**
 * Validate the full MCP execution surface that a published CrabCode plugin can
 * reach. The only exception is the canonical, prebuilt html-video sidecar.
 */
export async function validateMcpExecutableContract(root: string): Promise<McpContractIssue[]> {
  const issues: McpContractIssue[] = [];
  const absoluteRoot = path.resolve(root);
  let realRepositoryRoot: string;
  try {
    const rootStats = await lstat(absoluteRoot);
    if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) {
      throw new Error("repository root is not an ordinary directory");
    }
    realRepositoryRoot = await realpath(absoluteRoot);
  } catch (error) {
    return [{
      severity: "error",
      path: ".",
      message: `MCP contract repository root cannot be validated safely (${error instanceof Error ? error.message : String(error)})`,
    }];
  }
  const marketplace = await readJson(
    path.join(absoluteRoot, ".crabcode-plugin", "marketplace.json"),
  ) as { plugins?: MarketplaceEntry[] } | null;
  const marketplaceEntries = Array.isArray(marketplace?.plugins)
    ? marketplace.plugins
    : [];
  for (const entry of marketplaceEntries) {
    if (!Object.prototype.hasOwnProperty.call(entry, "mcpServers")) continue;
    const entryName = typeof entry.name === "string" ? entry.name : "<unnamed>";
    issues.push({
      severity: "error",
      path: ".crabcode-plugin/marketplace.json",
      message: containsMcpbReference(entry.mcpServers)
        ? `marketplace entry "${entryName}" mcpServers/MCPB path or URL is forbidden by the emergency MCP safe baseline`
        : `marketplace entry "${entryName}" mcpServers (inline or external JSON) is forbidden by the emergency MCP safe baseline`,
    });
  }
  const pluginRoots = await collectPluginRoots(
    absoluteRoot,
    realRepositoryRoot,
    marketplaceEntries,
    issues,
  );

  const marketplaceByName = new Map<string, MarketplaceEntry>();
  const marketplaceVersions = new Map<string, string>();
  for (const entry of marketplaceEntries) {
    if (typeof entry.name === "string" && typeof entry.version === "string") {
      marketplaceVersions.set(entry.name, entry.version);
    }
    if (typeof entry.name === "string") marketplaceByName.set(entry.name, entry);
  }
  for (const plugin of MCP_PAUSED_PLUGIN_SET) {
    const entry = marketplaceByName.get(plugin);
    if (!entry) continue;
    const displayName = typeof entry.displayName === "string" ? entry.displayName : "";
    const expectedShort = `【连接暂停】${displayName}历史/未来能力目录，当前无可执行 MCP 或连接`;
    const expectedLong = `${MCP_PAUSED_MARKETPLACE_MARKER}${displayName}条目仅保留历史/未来能力分类；当前没有内置服务、已连接来源或开箱可用工具，不得按条目配置、登录或启动服务。`;
    const expectedPrompts = [
      `说明${displayName}当前暂停状态和离线可用边界`,
      `列出未来恢复${displayName}连接前所需的安全与 E2E 证据`,
      "只用我直接提供的材料完成可降级任务",
    ];
    const expectedDescription = `Historical/future capability inventory for ${displayName}; executable MCP configuration, installation, and connection are disabled in this release.`;
    if (
      !displayName ||
      entry.shortDescription !== expectedShort ||
      entry.longDescription !== expectedLong ||
      !isDeepStrictEqual(entry.defaultPrompt, expectedPrompts) ||
      entry.description !== expectedDescription
    ) {
      issues.push({
        severity: "error",
        path: ".crabcode-plugin/marketplace.json",
        message: `paused MCP plugin "${plugin}" must use the canonical emergency safe-baseline marketplace copy; suffix disclaimers cannot override current-tense capability claims`,
      });
    }
  }

  for (const record of pluginRoots) {
    const manifestPath = manifestPathFor(record.pluginRoot);
    if (!manifestPath) continue;
    const manifest = await readJson(manifestPath) as Record<string, unknown> | null;
    if (!manifest) continue;
    const pluginName = typeof manifest.name === "string"
      ? manifest.name
      : record.publishedName ?? path.basename(record.pluginRoot);
    const relManifest = relativePath(absoluteRoot, manifestPath);

    if (Object.prototype.hasOwnProperty.call(manifest, "mcpServers")) {
      issues.push({
        severity: "error",
        path: relManifest,
        message: containsMcpbReference(manifest.mcpServers)
          ? "manifest mcpServers/MCPB path or URL is forbidden by the emergency MCP safe baseline; record a non-executable proposal instead"
          : "manifest mcpServers (inline or external JSON) is forbidden by the emergency MCP safe baseline; record a non-executable proposal instead",
      });
    }

    const manifestVersion = typeof manifest.version === "string" ? manifest.version : null;
    const packageJson = await readJson(path.join(record.pluginRoot, "package.json")) as
      | { version?: unknown }
      | null;
    const packageVersion = typeof packageJson?.version === "string" ? packageJson.version : null;
    if (manifestVersion && packageVersion && manifestVersion !== packageVersion) {
      issues.push({
        severity: "error",
        path: relManifest,
        message: `plugin version mismatch: manifest=${manifestVersion}, package.json=${packageVersion}`,
      });
    }
    const marketplaceVersion = record.marketplaceVersion ?? marketplaceVersions.get(pluginName);
    if (manifestVersion && marketplaceVersion && manifestVersion !== marketplaceVersion) {
      issues.push({
        severity: "error",
        path: relManifest,
        message: `plugin version mismatch: manifest=${manifestVersion}, marketplace=${marketplaceVersion}`,
      });
    }

    const required = Array.isArray(manifest.requiredMcpServers)
      ? manifest.requiredMcpServers.filter((name): name is string => typeof name === "string")
      : [];
    if (pluginName === MCP_ALLOWED_PLUGIN) {
      const canonicalRoot = path.join(absoluteRoot, "plugins", MCP_ALLOWED_PLUGIN);
      if (path.resolve(record.pluginRoot) !== canonicalRoot) {
        issues.push({
          severity: "error",
          path: relManifest,
          message: `the ${MCP_ALLOWED_PLUGIN} exception is valid only at plugins/${MCP_ALLOWED_PLUGIN}`,
        });
      }
      if (required.length !== 1 || required[0] !== MCP_ALLOWED_SERVER) {
        issues.push({
          severity: "error",
          path: relManifest,
          message: `emergency MCP safe baseline requires requiredMcpServers=["${MCP_ALLOWED_SERVER}"]`,
        });
      }
      if (!existsSync(path.join(record.pluginRoot, ".mcp.json"))) {
        issues.push({
          severity: "error",
          path: relManifest,
          message: "emergency MCP safe baseline requires the bundled html-video .mcp.json",
        });
      }
    } else if (required.length > 0) {
      issues.push({
        severity: "error",
        path: relManifest,
        message: `requiredMcpServers is reserved for ${MCP_ALLOWED_PLUGIN} during the emergency MCP safe baseline`,
      });
    }
  }

  for (const mcpPath of await collectRepositoryMcpFiles(absoluteRoot)) {
    const relativeMcp = relativePath(absoluteRoot, mcpPath);
    const allowedPath = relativeMcp === MCP_ALLOWED_CONFIG_PATH;
    if (!allowedPath) {
      issues.push({
        severity: "error",
        path: relativeMcp,
        message: `emergency MCP safe baseline permits .mcp.json only at ${MCP_ALLOWED_CONFIG_PATH}`,
      });
    }

    const parsed = await readJson(mcpPath);
    const servers = parsed === null ? null : parseServers(parsed);
    if (!servers) {
      issues.push({
        severity: "error",
        path: relativeMcp,
        message: "invalid .mcp.json: expected wrapped mcpServers or a bare server map of objects",
      });
      continue;
    }

    const pluginRoot = path.dirname(mcpPath);
    const manifestPath = manifestPathFor(pluginRoot);
    const manifest = manifestPath
      ? await readJson(manifestPath) as Record<string, unknown> | null
      : null;
    if (!manifest) {
      issues.push({
        severity: "error",
        path: relativeMcp,
        message: "plugin declares MCP servers but has no parseable plugin manifest",
      });
    }
    const required = Array.isArray(manifest?.requiredMcpServers)
      ? manifest.requiredMcpServers.filter((name): name is string => typeof name === "string")
      : [];
    const serverNames = Object.keys(servers);
    if (allowedPath && (serverNames.length !== 1 || serverNames[0] !== MCP_ALLOWED_SERVER)) {
      issues.push({
        severity: "error",
        path: relativeMcp,
        message: `emergency MCP safe baseline permits exactly one server named "${MCP_ALLOWED_SERVER}"`,
      });
    }
    for (const name of required) {
      if (!servers[name]) {
        issues.push({
          severity: "error",
          path: manifestPath ? relativePath(absoluteRoot, manifestPath) : relativeMcp,
          message: `requiredMcpServers entry "${name}" has no matching server in .mcp.json`,
        });
      }
    }

    const packageJson = await readJson(path.join(pluginRoot, "package.json")) as
      | { scripts?: Record<string, unknown> }
      | null;
    const startScript = typeof packageJson?.scripts?.start === "string"
      ? packageJson.scripts.start
      : "";
    const startInstalls = /\b(?:bun|npm|pnpm|yarn)\s+install\b/u.test(startScript);

    for (const [serverName, definition] of Object.entries(servers)) {
      const parts = serverArgStrings(definition);
      const joined = parts.join(" ");
      const isRequired = required.includes(serverName);
      const url = typeof definition.url === "string" ? definition.url : null;
      if (url !== null || definition.type === "http" || definition.type === "sse") {
        issues.push({
          severity: "error",
          path: relativeMcp,
          message: `remote/SSE server "${serverName}" is disabled by the emergency MCP safe baseline`,
        });
      }
      if (joined.includes("lsp-wrapper")) {
        issues.push({
          severity: "error",
          path: relativeMcp,
          message: `raw LSP proxy "${serverName}" must not be declared in .mcp.json (it has no MCP handshake)`,
        });
        continue;
      }
      if (url !== null && url.trim() === "") {
        issues.push({
          severity: "error",
          path: relativeMcp,
          message: `server "${serverName}" has an empty URL; executable config must not ship unset endpoints`,
        });
      }
      if (hasFloatingVersion(parts)) {
        issues.push({
          severity: "error",
          path: relativeMcp,
          message: `server "${serverName}" launches a floating version (@latest/unpinned); ${isRequired ? "required servers must be fully pinned" : "pin the launcher version"}`,
        });
      }
      const runsStartScript = joined.includes(" start") ||
        (Array.isArray(definition.args) && definition.args.includes("start"));
      const installsOnLaunch = /\binstall\b/u.test(joined) || (runsStartScript && startInstalls);
      if (installsOnLaunch) {
        issues.push({
          severity: "error",
          path: relativeMcp,
          message: `${isRequired ? "required " : ""}server "${serverName}" installs dependencies on launch; ship a prebuilt artifact instead`,
        });
      }
      if (isRequired) {
        for (const artifact of parts.filter((part) => part.startsWith("${CRABCODE_PLUGIN_ROOT}/"))) {
          const relativeArtifact = artifact.replace("${CRABCODE_PLUGIN_ROOT}/", "");
          await validateOrdinaryContainedFile(
            pluginRoot,
            path.join(pluginRoot, relativeArtifact),
            `required server "${serverName}" artifact ${relativeArtifact}`,
            relativeMcp,
            issues,
          );
        }
      }
    }

    if (allowedPath) {
      if (!isDeepStrictEqual(parsed, MCP_ALLOWED_CONFIG)) {
        issues.push({
          severity: "error",
          path: relativeMcp,
          message: "html-video .mcp.json must exactly match the canonical command, args, env, and zero-extra-field contract",
        });
      }
      await validateOrdinaryContainedFile(
        pluginRoot,
        mcpPath,
        "html-video .mcp.json",
        relativeMcp,
        issues,
      );
      for (const artifact of MCP_ALLOWED_ARTIFACTS) {
        await validateOrdinaryContainedFile(
          pluginRoot,
          path.join(pluginRoot, artifact),
          `html-video artifact ${artifact}`,
          relativeMcp,
          issues,
        );
      }
    }
  }

  return issues;
}
