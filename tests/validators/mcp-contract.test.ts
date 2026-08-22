import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateMcpContract } from "../../src/policy/mcpContractValidator.ts";

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
  plugins: Array<{ name: string; version: string; longDescription?: string }>,
): Promise<void> {
  const dir = path.join(root, ".crabcode-plugin");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "marketplace.json"), JSON.stringify({ plugins }, null, 2));
}

const errorsOf = (issues: Awaited<ReturnType<typeof validateMcpContract>>) =>
  issues.filter((issue) => issue.severity === "error");

describe("mcp contract validator", () => {
  test("accepts the one pinned required html-video sidecar with a committed distribution artifact", async () => {
    const root = await makeTempRoot();
    await writeMarketplace(root, [{ name: "crabcode-html-video", version: "1.0.0" }]);
    await writePlugin(root, "crabcode-html-video", {
      ".crabcode-plugin/plugin.json": { name: "crabcode-html-video", version: "1.0.0", requiredMcpServers: ["html-video"] },
      "package.json": { name: "crabcode-html-video", version: "1.0.0", scripts: { start: "bun --no-env-file dist/server.js" } },
      ".mcp.json": { mcpServers: { "html-video": { command: "bun", args: ["--no-env-file", "${CRABCODE_PLUGIN_ROOT}/dist/server.js"] } } },
      "dist/server.js": "// bundled",
    });
    expect(await validateMcpContract(root)).toEqual([]);
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
    expect(messages).toContain("must disclose the emergency safe-baseline status");
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
