import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  MCP_ALLOWED_PLUGIN,
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

describe("MCP emergency safe baseline", () => {
  test("publishes exactly one bundled local server and no remote executable", () => {
    const mcpFiles = readdirSync(path.join(root, "plugins"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `plugins/${entry.name}/.mcp.json`)
      .filter((relative) => existsSync(path.join(root, relative)))
      .sort();

    expect(mcpFiles).toEqual([`plugins/${MCP_ALLOWED_PLUGIN}/.mcp.json`]);
    const config = json(mcpFiles[0]!);
    expect(Object.keys(config.mcpServers ?? config)).toEqual([MCP_ALLOWED_SERVER]);
    const server = (config.mcpServers ?? config)[MCP_ALLOWED_SERVER];
    expect(server.type ?? "stdio").toBe("stdio");
    expect(server.url).toBeUndefined();

    const nonEmptyRequired = readdirSync(path.join(root, "plugins"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((plugin) => {
        const manifest = path.join(root, "plugins", plugin, ".crabcode-plugin", "plugin.json");
        if (!existsSync(manifest)) return false;
        return (JSON.parse(readFileSync(manifest, "utf8")).requiredMcpServers?.length ?? 0) > 0;
      });
    expect(nonEmptyRequired).toEqual([MCP_ALLOWED_PLUGIN]);
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

    expect(evidence.baselineId).toBe(MCP_SAFE_BASELINE_ID);
    expect([...removed.keys()].sort()).toEqual([...MCP_PAUSED_PLUGINS].sort());
    expect(evidence.expectedPostContainment).toEqual({
      mcpConfigFiles: 1,
      totalServers: 1,
      httpServers: 0,
      sseServers: 0,
      stdioServers: 1,
      nonEmptyRequiredMcpPlugins: 1,
      pausedMarketplaceDisclosures: MCP_PAUSED_PLUGINS.length,
    });

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
    expect(allowed.safeVersion).toBe(nextPatch(allowed.previousVersion));
    expect(createHash("sha256").update(allowedBytes).digest("hex")).toBe(
      allowed.configSha256,
    );
    expect(json(`plugins/${MCP_ALLOWED_PLUGIN}/.crabcode-plugin/plugin.json`).version).toBe(
      allowed.safeVersion,
    );
    expect(entries.get(MCP_ALLOWED_PLUGIN).version).toBe(allowed.safeVersion);
  });
});
