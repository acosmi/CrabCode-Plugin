import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  MCP_ALLOWED_LOCAL_SERVERS,
  MCP_ALLOWED_PLUGIN,
  MCP_ALLOWED_PLUGIN_SET,
  MCP_ALLOWED_SERVER,
  MCP_PAUSED_MARKETPLACE_MARKER,
  MCP_PAUSED_PLUGINS,
  MCP_SAFE_BASELINE_ID,
} from "../../src/policy/mcpSafeBaseline.ts";

const root = path.resolve(import.meta.dir, "../..");

function json(relative: string): any {
  return JSON.parse(readFileSync(path.join(root, relative), "utf8"));
}

function nextPatch(version: string): string {
  const match = /^(\d+)\.(\d+)\.(\d+)$/u.exec(version);
  if (!match) throw new Error(`invalid fixture version ${version}`);
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}

function pluginDirectories(): string[] {
  return readdirSync(path.join(root, "plugins"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

type RestoredEntry = {
  pluginId: string;
  serverName: string;
  transport: string;
  configPath: string;
  configSha256: string;
  previousVersion: string;
  restoredVersion: string;
  identityInjection: string;
};

const allowedPlugins = [...MCP_ALLOWED_LOCAL_SERVERS.keys()].sort();
const restore = json("docs/audit/evidence/2026-09-12-mcp-restore/restore-inventory.json") as {
  baselineId: string;
  decision: string;
  restored: RestoredEntry[];
  stillPaused: string[];
};

describe("MCP first-party local baseline", () => {
  test("publishes exactly the allowed bundled local servers and no remote executable", () => {
    const mcpFiles = pluginDirectories()
      .map((name) => `plugins/${name}/.mcp.json`)
      .filter((relative) => existsSync(path.join(root, relative)))
      .sort();

    expect(mcpFiles).toEqual(allowedPlugins.map((plugin) => `plugins/${plugin}/.mcp.json`));
    for (const [plugin, serverName] of MCP_ALLOWED_LOCAL_SERVERS) {
      const config = json(`plugins/${plugin}/.mcp.json`);
      const servers = config.mcpServers ?? config;
      expect(Object.keys(servers), plugin).toEqual([serverName]);
      const server = servers[serverName];
      expect(server.type ?? "stdio", plugin).toBe("stdio");
      expect(server.url, plugin).toBeUndefined();
    }
  });

  // Allowed and paused are the two halves of one partition. A plugin sitting in
  // both would make every question about it answerable either way, depending on
  // which list the caller happened to consult.
  test("no plugin is both allowed and paused", () => {
    expect([...MCP_ALLOWED_PLUGIN_SET].sort()).toEqual(allowedPlugins);
    for (const plugin of MCP_PAUSED_PLUGINS) {
      expect(MCP_ALLOWED_PLUGIN_SET.has(plugin), plugin).toBe(false);
    }
  });

  test("requiredMcpServers is declared by exactly the allowed plugins", () => {
    const nonEmptyRequired = pluginDirectories()
      .filter((plugin) => {
        const manifest = path.join(root, "plugins", plugin, ".crabcode-plugin", "plugin.json");
        if (!existsSync(manifest)) return false;
        return (JSON.parse(readFileSync(manifest, "utf8")).requiredMcpServers?.length ?? 0) > 0;
      })
      .sort();
    expect(nonEmptyRequired).toEqual(allowedPlugins);
    for (const [plugin, serverName] of MCP_ALLOWED_LOCAL_SERVERS) {
      expect(json(`plugins/${plugin}/.crabcode-plugin/plugin.json`).requiredMcpServers, plugin).toEqual([serverName]);
    }
  });

  // The 2026-08-22 inventory is frozen history: it records what the containment
  // release removed, and nothing about it changes when a plugin is later
  // restored. Traceability is therefore an accounting identity — every plugin it
  // removed is either still paused or named in a restore inventory. Without this
  // a plugin could silently leave both lists.
  test("every 2026-08-22 removal is still accounted for as paused or restored", () => {
    const evidence = json("docs/audit/evidence/2026-08-22-mcp-health/containment-inventory.json");
    expect(evidence.baselineId).toBe("mcp-emergency-safe-baseline-v1");
    expect(evidence.expectedPostContainment).toEqual({
      mcpConfigFiles: 1,
      totalServers: 1,
      httpServers: 0,
      sseServers: 0,
      stdioServers: 1,
      nonEmptyRequiredMcpPlugins: 1,
      pausedMarketplaceDisclosures: 42,
    });

    const removed = evidence.removedConfigurations.map((entry: any) => entry.pluginId).sort();
    const accounted = [
      ...MCP_PAUSED_PLUGINS,
      ...restore.restored.map((entry) => entry.pluginId),
    ].sort();
    expect(removed).toEqual(accounted);
    expect(new Set(accounted).size).toBe(accounted.length);
  });

  test("binds every paused package, disclosure and one-step version bump to the evidence inventory", () => {
    const evidence = json("docs/audit/evidence/2026-08-22-mcp-health/containment-inventory.json");
    const marketplace = json(".crabcode-plugin/marketplace.json");
    const entries = new Map<string, any>(
      marketplace.plugins.map((entry: any) => [entry.name, entry]),
    );
    const removed = new Map<string, any>(
      evidence.removedConfigurations.map((entry: any) => [entry.pluginId, entry]),
    );

    for (const plugin of MCP_PAUSED_PLUGINS) {
      const record: any = removed.get(plugin);
      const marketplaceEntry: any = entries.get(plugin);
      const manifest = json(`plugins/${plugin}/.crabcode-plugin/plugin.json`);
      expect(record.safeVersion, plugin).toBe(nextPatch(record.previousVersion));
      expect(record.configSha256, plugin).toMatch(/^[0-9a-f]{64}$/u);
      expect(existsSync(path.join(root, record.configPath)), plugin).toBe(false);
      expect(manifest.version, plugin).toBe(record.safeVersion);
      expect(marketplaceEntry.version, plugin).toBe(record.safeVersion);
      expect(marketplaceEntry.longDescription, plugin).toContain(
        MCP_PAUSED_MARKETPLACE_MARKER,
      );

      const packagePath = path.join(root, "plugins", plugin, "package.json");
      if (existsSync(packagePath)) {
        expect(JSON.parse(readFileSync(packagePath, "utf8")).version, plugin).toBe(
          record.safeVersion,
        );
      }
    }

    const allowed = evidence.allowedRuntime;
    const allowedBytes = readFileSync(path.join(root, allowed.configPath));
    expect(allowed.pluginId).toBe(MCP_ALLOWED_PLUGIN);
    expect(allowed.serverName).toBe(MCP_ALLOWED_SERVER);
    expect(MCP_ALLOWED_LOCAL_SERVERS.get(allowed.pluginId)).toBe(allowed.serverName);
    expect(allowed.safeVersion).toBe(nextPatch(allowed.previousVersion));
    expect(createHash("sha256").update(allowedBytes).digest("hex")).toBe(
      allowed.configSha256,
    );
    expect(json(`plugins/${MCP_ALLOWED_PLUGIN}/.crabcode-plugin/plugin.json`).version).toBe(
      allowed.safeVersion,
    );
    expect(entries.get(MCP_ALLOWED_PLUGIN).version).toBe(allowed.safeVersion);
  });

  // The restore inventory is the same kind of artefact as the containment one:
  // it must name the exact bytes that were published and the exact version that
  // carries them, or "restored" is an unverifiable claim.
  test("the 2026-09-12 restore inventory binds to the published bytes and versions", () => {
    expect(restore.baselineId).toBe(MCP_SAFE_BASELINE_ID);
    expect(restore.decision).toBe("D-0(c)");
    expect(restore.stillPaused).toEqual([...MCP_PAUSED_PLUGINS]);

    const marketplace = json(".crabcode-plugin/marketplace.json");
    for (const entry of restore.restored) {
      expect(MCP_ALLOWED_LOCAL_SERVERS.get(entry.pluginId), entry.pluginId).toBe(entry.serverName);
      expect(entry.transport, entry.pluginId).toBe("stdio");
      expect(entry.configPath, entry.pluginId).toBe(`plugins/${entry.pluginId}/.mcp.json`);
      const bytes = readFileSync(path.join(root, entry.configPath));
      expect(createHash("sha256").update(bytes).digest("hex"), entry.pluginId).toBe(entry.configSha256);
      expect(entry.restoredVersion, entry.pluginId).toBe(nextPatch(entry.previousVersion));

      expect(json(`plugins/${entry.pluginId}/.crabcode-plugin/plugin.json`).version, entry.pluginId).toBe(entry.restoredVersion);
      expect(JSON.parse(readFileSync(path.join(root, "plugins", entry.pluginId, "package.json"), "utf8")).version, entry.pluginId).toBe(entry.restoredVersion);
      const marketplaceEntry = marketplace.plugins.find((item: any) => item.name === entry.pluginId);
      expect(marketplaceEntry.version, entry.pluginId).toBe(entry.restoredVersion);
    }
  });

  // A restored plugin that keeps the pause disclosure tells every user the
  // opposite of what the release does.
  test("a restored marketplace entry carries no pause disclosure", () => {
    const marketplace = json(".crabcode-plugin/marketplace.json");
    for (const entry of restore.restored) {
      const marketplaceEntry = marketplace.plugins.find((item: any) => item.name === entry.pluginId);
      const text = [
        marketplaceEntry.shortDescription,
        marketplaceEntry.longDescription,
        marketplaceEntry.description,
      ].join("\n");
      expect(text.includes(MCP_PAUSED_MARKETPLACE_MARKER), entry.pluginId).toBe(false);
      expect(text.includes("【连接暂停】"), entry.pluginId).toBe(false);
      expect(text.includes("Executable MCP configuration is intentionally paused"), entry.pluginId).toBe(false);
      // Positive control: the marker really is still carried by a paused entry,
      // so this assertion cannot pass because the marker text stopped matching.
      const paused = marketplace.plugins.find((item: any) => item.name === MCP_PAUSED_PLUGINS[0]);
      expect(paused.longDescription.includes(MCP_PAUSED_MARKETPLACE_MARKER)).toBe(true);
    }
  });
});
