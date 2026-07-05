import path from "node:path";
import { readdir, readFile, stat } from "node:fs/promises";

export type ReferenceSeverity = "error" | "warning";

export type ReferenceIssue = {
  severity: ReferenceSeverity;
  file: string;
  message: string;
};

type RegistryProvider = {
  skill: string;
  status: "available" | "planned";
  note?: string;
};

type RegistryDomainSpecific = {
  plugin: string;
  skill?: string;
  agent?: string;
  scope: string;
};

type RegistryCapability = {
  id: string;
  domain: string;
  keywords: string[];
  providers: RegistryProvider[];
  providerPlugins: string[];
  domainSpecific?: RegistryDomainSpecific[];
};

type Registry = {
  version: number;
  capabilities: RegistryCapability[];
};

const REGISTRY_RELATIVE = path.join("docs", "capability-routing.json");
const WALK_SKIP_DIRS = new Set(["node_modules", "dist", "coverage", ".git", "vendor"]);

// `plugin:skill` fully-qualified reference wrapped in backticks. The plugin part
// must resolve to a real plugin directory (or a registry provider plugin) before
// we treat it as a cross-plugin skill reference — this keeps tokens like
// `https:example` or arbitrary prose out of scope.
const FQN_PATTERN = /`([a-z0-9][a-z0-9-]*):([a-z0-9][a-z0-9-]*)`/g;

// Bare `mcp__<server>__` tool references must match a server declared in the
// owning plugin's .mcp.json. `mcp__plugin_...` names document CrabCode's
// plugin-tool namespace and cannot be resolved statically, so they are skipped.
const MCP_TOOL_PATTERN = /mcp__([a-z0-9_-]+)__/g;

// Upstream container mount that never exists in a CrabCode environment.
const CONTAINER_PATH = "/mnt/skills";

const MARKER_PATTERN = /<!--\s*capability-route:\s*([^>]*?)\s*-->/g;
const MARKER_TOKEN_PATTERN = /^(?:([a-z0-9-]+)\s*=\s*)?(none|pending)\s*(?:\(([^)]*)\))?$/;

type RouteMarker = {
  blanketNone: boolean;
  none: Set<string>;
  pending: Set<string>;
  malformed: string[];
};

export async function validateReferences(root: string): Promise<ReferenceIssue[]> {
  const absRoot = path.resolve(root);
  const issues: ReferenceIssue[] = [];

  const registry = await loadRegistry(absRoot, issues);
  const pluginsDir = path.join(absRoot, "plugins");
  const pluginNames = await listDirectories(pluginsDir);
  const skillIndex = new Map<string, Set<string>>();
  for (const plugin of pluginNames) {
    skillIndex.set(plugin, await collectSkillNames(path.join(pluginsDir, plugin)));
  }

  if (registry) {
    await validateRegistryIntegrity(registry, absRoot, pluginsDir, skillIndex, issues);
  }

  const registryPluginSet = new Set<string>(
    (registry?.capabilities ?? []).flatMap((capability) => capability.providerPlugins),
  );
  const mcpServerCache = new Map<string, Set<string> | null>();

  for (const plugin of pluginNames) {
    const pluginDir = path.join(pluginsDir, plugin);
    const markdownFiles = await collectMarkdownFiles(pluginDir);
    for (const file of markdownFiles) {
      let content: string;
      try {
        content = await readFile(file, "utf8");
      } catch {
        continue;
      }

      checkDeadFqns(content, file, skillIndex, registryPluginSet, issues);
      await checkMcpToolRefs(content, file, plugin, pluginDir, mcpServerCache, issues);
      if (content.includes(CONTAINER_PATH)) {
        issues.push({
          severity: "error",
          file,
          message: `引用了上游容器挂载路径 ${CONTAINER_PATH}/...,CrabCode 环境不存在该路径,请改为插件内路径或能力路由`,
        });
      }

      if (registry && path.basename(file) === "SKILL.md") {
        checkCapabilityRouting(content, file, plugin, registry, issues);
      }
    }
  }

  return issues;
}

export function formatReferenceIssues(issues: ReferenceIssue[], root: string): string {
  return issues
    .map((issue) => {
      const rel = path.relative(root, issue.file);
      return `${issue.severity.toUpperCase()} ${rel}: ${issue.message}`;
    })
    .join("\n");
}

async function loadRegistry(absRoot: string, issues: ReferenceIssue[]): Promise<Registry | null> {
  const registryPath = path.join(absRoot, REGISTRY_RELATIVE);
  let raw: string;
  try {
    raw = await readFile(registryPath, "utf8");
  } catch {
    issues.push({
      severity: "error",
      file: registryPath,
      message: "能力路由注册表缺失(docs/capability-routing.json),lint:refs 无法执行关键词路由检查",
    });
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Registry;
    if (!Array.isArray(parsed.capabilities)) throw new Error("capabilities missing");
    return parsed;
  } catch (error) {
    issues.push({
      severity: "error",
      file: registryPath,
      message: `能力路由注册表解析失败:${error instanceof Error ? error.message : String(error)}`,
    });
    return null;
  }
}

async function validateRegistryIntegrity(
  registry: Registry,
  absRoot: string,
  pluginsDir: string,
  skillIndex: Map<string, Set<string>>,
  issues: ReferenceIssue[],
): Promise<void> {
  const registryPath = path.join(absRoot, REGISTRY_RELATIVE);
  for (const capability of registry.capabilities) {
    for (const provider of capability.providers) {
      if (provider.status !== "available") continue;
      const [plugin, skill] = provider.skill.split(":");
      if (!plugin || !skill || !skillIndex.get(plugin)?.has(skill)) {
        issues.push({
          severity: "error",
          file: registryPath,
          message: `能力「${capability.id}」的 available provider ${provider.skill} 无法解析为存量技能`,
        });
      }
    }
    for (const entry of capability.domainSpecific ?? []) {
      if (entry.skill && !skillIndex.get(entry.plugin)?.has(entry.skill)) {
        issues.push({
          severity: "error",
          file: registryPath,
          message: `能力「${capability.id}」的域内专用技能 ${entry.plugin}:${entry.skill} 无法解析`,
        });
      }
      if (entry.agent) {
        const agentPath = path.join(pluginsDir, entry.plugin, "agents", `${entry.agent}.md`);
        try {
          await stat(agentPath);
        } catch {
          issues.push({
            severity: "error",
            file: registryPath,
            message: `能力「${capability.id}」的域内专用代理 ${entry.plugin}/agents/${entry.agent}.md 无法解析`,
          });
        }
      }
    }
  }
}

function checkDeadFqns(
  content: string,
  file: string,
  skillIndex: Map<string, Set<string>>,
  registryPluginSet: Set<string>,
  issues: ReferenceIssue[],
): void {
  for (const match of content.matchAll(FQN_PATTERN)) {
    const plugin = match[1] ?? "";
    const skill = match[2] ?? "";
    const known = skillIndex.has(plugin);
    const planned = registryPluginSet.has(plugin);
    if (!known && !planned) continue;
    if (known && skillIndex.get(plugin)?.has(skill)) continue;
    issues.push({
      severity: "error",
      file,
      message: known
        ? `死链引用 \`${plugin}:${skill}\`:插件存在但技能不存在`
        : `死链引用 \`${plugin}:${skill}\`:provider 插件尚未就位(注册表状态 planned),请改用 pending 标记与升级路径措辞`,
    });
  }
}

async function checkMcpToolRefs(
  content: string,
  file: string,
  plugin: string,
  pluginDir: string,
  cache: Map<string, Set<string> | null>,
  issues: ReferenceIssue[],
): Promise<void> {
  const servers = new Set<string>();
  for (const match of content.matchAll(MCP_TOOL_PATTERN)) {
    const server = match[1] ?? "";
    if (server.startsWith("plugin_")) continue;
    servers.add(server);
  }
  if (servers.size === 0) return;

  if (!cache.has(plugin)) {
    cache.set(plugin, await loadMcpServers(pluginDir));
  }
  const declared = cache.get(plugin) ?? null;
  for (const server of servers) {
    if (declared?.has(server)) continue;
    issues.push({
      severity: "error",
      file,
      message: `引用了 mcp__${server}__* 工具,但插件${declared ? "的 .mcp.json 未声明" : "没有 .mcp.json,无法提供"} server「${server}」——工具在运行时不存在`,
    });
  }
}

async function loadMcpServers(pluginDir: string): Promise<Set<string> | null> {
  try {
    const raw = await readFile(path.join(pluginDir, ".mcp.json"), "utf8");
    const parsed = JSON.parse(raw) as { mcpServers?: Record<string, unknown> };
    return new Set(Object.keys(parsed.mcpServers ?? {}));
  } catch {
    return null;
  }
}

function checkCapabilityRouting(
  content: string,
  file: string,
  plugin: string,
  registry: Registry,
  issues: ReferenceIssue[],
): void {
  const marker = parseRouteMarkers(content);
  const knownIds = new Set(registry.capabilities.map((capability) => capability.id));
  for (const malformed of marker.malformed) {
    issues.push({
      severity: "warning",
      file,
      message: `capability-route 标记无法解析:「${malformed}」(语法:none(理由) / <能力id>=none(理由) / <能力id>=pending(理由))`,
    });
  }
  for (const id of [...marker.none, ...marker.pending]) {
    if (!knownIds.has(id)) {
      issues.push({
        severity: "warning",
        file,
        message: `capability-route 标记引用了注册表不存在的能力 id「${id}」,请核对 docs/capability-routing.json`,
      });
    }
  }

  for (const capability of registry.capabilities) {
    if (capability.providerPlugins.includes(plugin)) continue;
    const matched = matchKeywords(content, capability.keywords);
    if (matched.length === 0) continue;

    const availableProviders = capability.providers.filter((provider) => provider.status === "available");
    const routed = availableProviders.some((provider) => content.includes(provider.skill));
    if (routed) continue;

    if (marker.pending.has(capability.id)) {
      if (availableProviders.length > 0) {
        issues.push({
          severity: "warning",
          file,
          message: `能力「${capability.id}」标记为 pending,但 provider 已就位(${availableProviders
            .map((provider) => provider.skill)
            .join("、")}),请改为全限定名路由`,
        });
      }
      continue;
    }
    if (marker.blanketNone || marker.none.has(capability.id)) continue;

    const suggestion =
      availableProviders.length > 0
        ? `请引用 \`${availableProviders[0]?.skill}\` 路由段`
        : `provider 未就位,请添加 <!-- capability-route: ${capability.id}=pending(理由) --> 并写明升级路径`;
    issues.push({
      severity: "warning",
      file,
      message: `正文命中「${capability.domain}」关键词(${matched.join("、")})但无路由引导——${suggestion},或添加 <!-- capability-route: ${capability.id}=none(理由) --> 显式豁免`,
    });
  }
}

function parseRouteMarkers(content: string): RouteMarker {
  const marker: RouteMarker = { blanketNone: false, none: new Set(), pending: new Set(), malformed: [] };
  for (const match of content.matchAll(MARKER_PATTERN)) {
    const body = match[1] ?? "";
    for (const rawToken of splitMarkerTokens(body)) {
      const token = rawToken.trim();
      if (!token) continue;
      const parsed = token.match(MARKER_TOKEN_PATTERN);
      if (!parsed) {
        marker.malformed.push(token);
        continue;
      }
      const id = parsed[1];
      const kind = parsed[2];
      if (kind === "none") {
        if (id) marker.none.add(id);
        else marker.blanketNone = true;
      } else if (kind === "pending") {
        if (id) marker.pending.add(id);
        else marker.malformed.push(token);
      }
    }
  }
  return marker;
}

// Tokens are comma-separated, but reasons inside parentheses may contain
// commas (Chinese or ASCII), so split at depth zero only.
function splitMarkerTokens(body: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let depth = 0;
  for (const char of body) {
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);
    if (char === "," && depth === 0) {
      tokens.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  tokens.push(current);
  return tokens;
}

const keywordRegexCache = new Map<string, RegExp>();

function matchKeywords(content: string, keywords: string[]): string[] {
  const matched: string[] = [];
  for (const keyword of keywords) {
    let regex = keywordRegexCache.get(keyword);
    if (!regex) {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const head = /^[a-z0-9]/i.test(keyword) ? "(?<![a-z0-9])" : "";
      const tail = /[a-z0-9]$/i.test(keyword) ? "(?![a-z0-9])" : "";
      regex = new RegExp(`${head}${escaped}${tail}`, "i");
      keywordRegexCache.set(keyword, regex);
    }
    if (regex.test(content)) matched.push(keyword);
  }
  return matched;
}

async function listDirectories(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }
}

async function collectSkillNames(pluginDir: string): Promise<Set<string>> {
  const skillDirs: string[] = [];
  await walkForSkillDirs(pluginDir, skillDirs);
  return new Set(skillDirs.map((dir) => path.basename(dir)));
}

async function walkForSkillDirs(dir: string, out: string[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".") || WALK_SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    try {
      await stat(path.join(full, "SKILL.md"));
      out.push(full);
    } catch {
      // not a skill dir; keep walking
    }
    await walkForSkillDirs(full, out);
  }
}

async function collectMarkdownFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  await walkForMarkdown(dir, out);
  return out;
}

async function walkForMarkdown(dir: string, out: string[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".") || WALK_SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "legal" && path.basename(dir) === "docs") continue;
      await walkForMarkdown(full, out);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      out.push(full);
    }
  }
}
