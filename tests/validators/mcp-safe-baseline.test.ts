import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  MCP_ALLOWED_PLUGIN,
  MCP_ALLOWED_CONFIG,
  MCP_ALLOWED_CONFIG_PATH,
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

function gitText(...args: string[]): string {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
}

function gitBytes(...args: string[]): Buffer {
  return execFileSync("git", ["-C", root, ...args]);
}

function repositoryMcpFiles(current: string, base: string = current): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const target = path.join(current, entry.name);
    if (entry.isDirectory() && !entry.isSymbolicLink()) {
      files.push(...repositoryMcpFiles(target, base));
    } else if (entry.name === ".mcp.json") {
      files.push(path.relative(base, target).split(path.sep).join("/"));
    }
  }
  return files.sort();
}

describe("MCP emergency safe baseline", () => {
  test("publishes exactly one bundled local server and no remote executable", () => {
    const mcpFiles = repositoryMcpFiles(root);

    expect(mcpFiles).toEqual([MCP_ALLOWED_CONFIG_PATH]);
    const config = json(mcpFiles[0]!);
    expect(config).toEqual(MCP_ALLOWED_CONFIG);
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
    expect(evidence.requiredRemediationPostContainment).toMatchObject({
      publishedPluginRootMcpConfigFiles: 1,
      repositoryExecutableMcpConfigFiles: 1,
      allowedExecutableConfigPath: MCP_ALLOWED_CONFIG_PATH,
      manifestInlineOrPathMcpServers: 0,
      publishedMcpbReferences: 0,
      repositoryHttpServers: 0,
      repositorySseServers: 0,
      repositoryStdioServers: 1,
    });

    for (const plugin of MCP_PAUSED_PLUGINS) {
      const record: any = removed.get(plugin);
      const marketplaceEntry: any = entries.get(plugin);
      const manifest = json(`plugins/${plugin}/.crabcode-plugin/plugin.json`);
      expect(record.safeVersion, plugin).toBe(nextPatch(record.previousVersion));
      expect(record.configSha256, plugin).toMatch(/^[0-9a-f]{64}$/u);
      expect(existsSync(path.join(root, record.configPath)), plugin).toBe(false);
      const remediationVersion = nextPatch(record.safeVersion);
      expect(manifest.version, plugin).toBe(remediationVersion);
      expect(marketplaceEntry.version, plugin).toBe(remediationVersion);
      expect(marketplaceEntry.longDescription, plugin).toContain(
        MCP_PAUSED_MARKETPLACE_MARKER,
      );

      const packagePath = path.join(root, "plugins", plugin, "package.json");
      if (existsSync(packagePath)) {
        expect(JSON.parse(readFileSync(packagePath, "utf8")).version, plugin).toBe(
          remediationVersion,
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
    const allowedRemediationVersion = nextPatch(allowed.safeVersion);
    expect(json(`plugins/${MCP_ALLOWED_PLUGIN}/.crabcode-plugin/plugin.json`).version).toBe(
      allowedRemediationVersion,
    );
    expect(json(`plugins/${MCP_ALLOWED_PLUGIN}/package.json`).version).toBe(
      allowedRemediationVersion,
    );
    expect(entries.get(MCP_ALLOWED_PLUGIN).version).toBe(allowedRemediationVersion);
  });

  test("recomputes the historical inventory from its declared parent Git objects", () => {
    const evidence = json("docs/audit/evidence/2026-08-22-mcp-health/containment-inventory.json");
    const baseline = evidence.baselineCommit as string;
    const target = evidence.targetTaskCommit as string;
    const merge = evidence.targetMergeCommit as string;

    expect(gitText("rev-parse", `${baseline}^{tree}`)).toBe(evidence.baselineTree);
    expect(gitText("rev-parse", `${target}^{tree}`)).toBe(evidence.targetTree);
    expect(gitText("rev-parse", `${merge}^{tree}`)).toBe(evidence.targetTree);
    const actualParent = gitText("rev-parse", `${target}^`);
    expect(actualParent).toBe(baseline);
    expect(evidence.parentBinding).toMatchObject({
      child: target,
      expectedDirectParent: baseline,
      actualDirectParent: actualParent,
      verified: true,
      allRemovedConfigShasVerifiedAgainstDirectParent: true,
    });

    for (const record of evidence.removedConfigurations as any[]) {
      expect(record.configPath).toBe(`plugins/${record.pluginId}/.mcp.json`);
      const baselineBytes = gitBytes("show", `${baseline}:${record.configPath}`);
      expect(
        createHash("sha256").update(baselineBytes).digest("hex"),
        record.pluginId,
      ).toBe(record.configSha256);
      const manifest = JSON.parse(gitText(
        "show",
        `${baseline}:plugins/${record.pluginId}/.crabcode-plugin/plugin.json`,
      ));
      expect(manifest.version, record.pluginId).toBe(record.previousVersion);
    }

    const allowed = evidence.allowedRuntime;
    const allowedManifest = JSON.parse(gitText(
      "show",
      `${baseline}:plugins/${allowed.pluginId}/.crabcode-plugin/plugin.json`,
    ));
    expect(allowedManifest.version).toBe(allowed.previousVersion);
  });

  test("binds every distributable-byte remediation to a new patch version", () => {
    const historical = json("docs/audit/evidence/2026-08-22-mcp-health/containment-inventory.json");
    const release = json("docs/audit/evidence/2026-08-23-mcp-remediation/remediation-release.json");
    const marketplace = json(".crabcode-plugin/marketplace.json");
    const marketplaceVersions = new Map<string, string>(
      marketplace.plugins.map((entry: any) => [entry.name, entry.version]),
    );
    const historicalVersions = new Map<string, string>([
      ...historical.removedConfigurations.map((entry: any) => [entry.pluginId, entry.safeVersion]),
      [historical.allowedRuntime.pluginId, historical.allowedRuntime.safeVersion],
      ["plugin-dev", "0.2.2"],
      ["crabwork-plugin-management", "0.2.1"],
      ["mcp-server-dev", "0.1.1"],
      ["crabcode-setup", "0.3.0"],
    ]);

    expect(release.baseline).toEqual({
      commit: historical.targetMergeCommit,
      tree: historical.targetTree,
      marketplaceVersion: "0.4.3",
    });
    expect(marketplace.metadata.version).toBe("0.4.4");
    expect(release.remediation.marketplaceVersion).toBe("0.4.4");
    expect(release.changedPluginCount).toBe(47);
    expect(new Set(release.changedPlugins.map((entry: any) => entry.pluginId)).size).toBe(47);

    for (const entry of release.changedPlugins as any[]) {
      const historicalVersion = historicalVersions.get(entry.pluginId as string);
      expect(historicalVersion, entry.pluginId).toBeDefined();
      expect(entry.previousVersion as string, entry.pluginId).toBe(historicalVersion!);
      expect(entry.remediationVersion as string, entry.pluginId).toBe(
        nextPatch(entry.previousVersion as string),
      );
      const manifestPath = entry.pluginId === "crabcode-setup"
        ? ".crabcode-plugin/plugin.json"
        : `plugins/${entry.pluginId}/.crabcode-plugin/plugin.json`;
      expect(json(manifestPath).version, entry.pluginId).toBe(entry.remediationVersion);
      expect(marketplaceVersions.get(entry.pluginId), entry.pluginId).toBe(entry.remediationVersion);
      const packagePath = entry.pluginId === "crabcode-setup"
        ? path.join(root, "package.json")
        : path.join(root, "plugins", entry.pluginId, "package.json");
      if (existsSync(packagePath)) {
        expect(JSON.parse(readFileSync(packagePath, "utf8")).version, entry.pluginId).toBe(
          entry.remediationVersion,
        );
      }
    }

    expect(release.status).toBe("exact-main-annotated-tag-required");
    expect(release.gateEligibility).toEqual({
      mode: "runtime-computed-from-exact-main-annotated-tag",
      staticPassForbidden: true,
      requiredValidators: [
        "scripts/validate-local-test-attestation.py",
        "scripts/validate-retired-publisher.py",
        "scripts/validate-mirror-release-gate.py",
      ],
    });
    expect(release.remediation.commitBinding).toEqual({
      type: "annotated-git-tag",
      refTemplate: "refs/tags/mcp-remediation-tested-<40-lowercase-main-sha>",
      mustPeelToPublishedCommit: true,
      signatureFormat: "ssh-ed25519",
      allowedSigners: "docs/audit/keys/mcp-remediation-test-allowed-signers",
      requiredPrincipal: "release-attestor",
    });
    expect(release.remediation.treeBinding).toContain("published commit^{tree}");
    expect(release.remediation.logsBinding).toEqual({
      type: "ssh-signed-annotated-git-tag",
      refTemplate: "refs/tags/mcp-remediation-logs-<40-lowercase-main-sha>",
      zeroParentCommitRequired: true,
      exactTreeAllowlistRequired: true,
      rawLogByteVerificationRequired: true,
    });
    expect(release.remediation.testBinding).toEqual({
      evidenceId: "mcp-remediation-local-tests-v1",
      validator: "scripts/validate-local-test-attestation.py",
      matrixContract: "docs/audit/evidence/2026-08-23-mcp-remediation/local-test-matrix-contract.json",
      requiredCellCount: 18,
      logsManifestSha256Required: true,
    });
  });
});
